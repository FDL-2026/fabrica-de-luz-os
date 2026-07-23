import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  MAX_FILE_SIZE,
  GoogleDriveAuthError,
  env,
  ensureFolder,
  getGoogleAccessToken,
  sanitizeFolderName,
  uploadFileToDrive,
} from "@/lib/drive/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexto = {
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
};

// Upload de foto de MANUTENÇÃO (antes/depois), para os dois atores:
//  - Montador (PIN): envia usuarioId no form -> cliente anônimo + p_usuario_id.
//  - Gestão (sessão): sem usuarioId -> cliente do servidor (cookies) + auth.uid().
// A autorização e o contexto do projeto vêm de fdl_contexto_manutencao.
export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const usuarioId = String(form.get("usuarioId") ?? "").trim();
    const manutencaoId = String(form.get("manutencaoId") ?? "").trim();
    const faseBruta = String(form.get("fase") ?? "").trim().toLowerCase();
    const file = form.get("file");

    const fase =
      faseBruta === "antes" || faseBruta === "depois" ? faseBruta : "";

    if (!manutencaoId || !fase) {
      return Response.json(
        { error: "Dados incompletos (manutenção ou fase) para upload." },
        { status: 400 }
      );
    }
    if (!(file instanceof File)) {
      return Response.json({ error: "Nenhum arquivo foi enviado." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return Response.json({ error: "Envie apenas fotos." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "Arquivo muito grande. Envie fotos de até 25 MB nesta fase." },
        { status: 400 }
      );
    }

    const ehMontador = usuarioId.length > 0;
    const pUsuario = ehMontador ? usuarioId : null;

    const supabase = ehMontador
      ? createAnonClient(
          env("NEXT_PUBLIC_SUPABASE_URL"),
          env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
          { auth: { persistSession: false, autoRefreshToken: false } }
        )
      : await createServerClient();

    const { data: ctxData, error: ctxError } = await supabase.rpc(
      "fdl_contexto_manutencao",
      { p_manutencao_id: manutencaoId, p_usuario_id: pUsuario }
    );

    if (ctxError) {
      return Response.json({ error: ctxError.message }, { status: 400 });
    }

    const contexto = Array.isArray(ctxData)
      ? (ctxData[0] as Contexto | undefined)
      : undefined;

    if (!contexto) {
      return Response.json(
        { error: "Manutenção não encontrada ou sem acesso." },
        { status: 403 }
      );
    }

    const accessToken = await getGoogleAccessToken();
    const rootFolderId = env("GOOGLE_DRIVE_ROOT_FOLDER_ID");

    const temporada = sanitizeFolderName(
      `Temporada ${contexto.temporada ?? "Sem temporada"}`
    );
    const nomeProjeto = sanitizeFolderName(
      `${contexto.cliente || contexto.shopping || "Projeto sem nome"} - ${
        contexto.uf || "UF"
      }`
    );
    const nomeManut = sanitizeFolderName(`Manutencao ${manutencaoId.slice(0, 8)}`);
    const pastaFase = fase === "antes" ? "Antes" : "Depois";

    const temporadaFolderId = await ensureFolder(accessToken, rootFolderId, temporada);
    const projetoFolderId = await ensureFolder(accessToken, temporadaFolderId, nomeProjeto);
    const manutRaizId = await ensureFolder(accessToken, projetoFolderId, "04 - Manutenções");
    const manutFolderId = await ensureFolder(accessToken, manutRaizId, nomeManut);
    const faseFolderId = await ensureFolder(accessToken, manutFolderId, pastaFase);

    const originalName = sanitizeFolderName(file.name || "foto");
    const fileName = `${Date.now()} - ${originalName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const driveFile = await uploadFileToDrive({
      accessToken,
      folderId: faseFolderId,
      fileName,
      mimeType: file.type || "image/jpeg",
      buffer,
    });

    const caminhoArquivo = [
      temporada,
      nomeProjeto,
      "04 - Manutenções",
      nomeManut,
      pastaFase,
      fileName,
    ].join("/");

    const { data: anexoData, error: anexoError } = await supabase.rpc(
      "fdl_registrar_anexo_manutencao",
      {
        p_manutencao_id: manutencaoId,
        p_fase: fase,
        p_tipo: "foto",
        p_nome_arquivo: fileName,
        p_mime_type: file.type || "image/jpeg",
        p_tamanho_bytes: file.size,
        p_provider: "google_drive",
        p_external_file_id: driveFile.id,
        p_external_folder_id: faseFolderId,
        p_url_visualizacao: driveFile.webViewLink ?? "",
        p_caminho_arquivo: caminhoArquivo,
        p_usuario_id: pUsuario,
      }
    );

    if (anexoError) {
      return Response.json({ error: anexoError.message }, { status: 400 });
    }

    return Response.json({
      ok: true,
      anexo: Array.isArray(anexoData) ? anexoData[0] : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado no upload.";
    if (error instanceof GoogleDriveAuthError) {
      return Response.json({ error: message, codigo: "drive_auth" }, { status: 502 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
