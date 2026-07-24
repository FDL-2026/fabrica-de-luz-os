import { createClient as createAnonClient } from "@supabase/supabase-js";
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
  vistoria_id: string;
  projeto_id: string | null;
  titulo: string | null;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
};

// Upload de foto de um PONTO da vistoria técnica. Fluxo público (link de
// preenchimento, sem login): autoriza pelo token + ponto via
// fdl_contexto_vistoria_token e sobe para o Drive.
export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const token = String(form.get("token") ?? "").trim();
    const pontoId = String(form.get("pontoId") ?? "").trim();
    const categoria =
      String(form.get("categoria") ?? "").trim() === "referencia"
        ? "referencia"
        : "in_loco";
    const file = form.get("file");

    if (!token || !pontoId) {
      return Response.json(
        { error: "Dados incompletos (link ou ponto) para upload." },
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
        { error: "Arquivo muito grande. Envie fotos de até 25 MB." },
        { status: 400 }
      );
    }

    const supabase = createAnonClient(
      env("NEXT_PUBLIC_SUPABASE_URL"),
      env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: ctxData, error: ctxError } = await supabase.rpc(
      "fdl_contexto_vistoria_token",
      { p_token: token, p_ponto_id: pontoId }
    );

    if (ctxError) {
      return Response.json({ error: ctxError.message }, { status: 400 });
    }

    const contexto = Array.isArray(ctxData)
      ? (ctxData[0] as Contexto | undefined)
      : undefined;

    if (!contexto) {
      return Response.json(
        { error: "Vistoria não encontrada ou já concluída." },
        { status: 403 }
      );
    }

    const accessToken = await getGoogleAccessToken();
    const rootFolderId = env("GOOGLE_DRIVE_ROOT_FOLDER_ID");

    const temporada = sanitizeFolderName(
      `Temporada ${contexto.temporada ?? "Sem temporada"}`
    );
    const nomeProjeto = sanitizeFolderName(
      `${
        contexto.cliente ||
        contexto.shopping ||
        contexto.titulo ||
        "Vistoria avulsa"
      } - ${contexto.uf || "UF"}`
    );
    const nomeVistoria = sanitizeFolderName(
      `Vistoria ${contexto.vistoria_id.slice(0, 8)}`
    );

    const pastaCategoria = categoria === "referencia" ? "Referencia" : "In loco";

    const temporadaFolderId = await ensureFolder(accessToken, rootFolderId, temporada);
    const projetoFolderId = await ensureFolder(accessToken, temporadaFolderId, nomeProjeto);
    const raizId = await ensureFolder(accessToken, projetoFolderId, "05 - Vistorias Técnicas");
    const vistoriaFolderId = await ensureFolder(accessToken, raizId, nomeVistoria);
    const categoriaFolderId = await ensureFolder(accessToken, vistoriaFolderId, pastaCategoria);

    const originalName = sanitizeFolderName(file.name || "foto");
    const fileName = `${Date.now()} - ${originalName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const driveFile = await uploadFileToDrive({
      accessToken,
      folderId: categoriaFolderId,
      fileName,
      mimeType: file.type || "image/jpeg",
      buffer,
    });

    const caminhoArquivo = [
      temporada,
      nomeProjeto,
      "05 - Vistorias Técnicas",
      nomeVistoria,
      pastaCategoria,
      fileName,
    ].join("/");

    const { data: anexoData, error: anexoError } = await supabase.rpc(
      "fdl_registrar_anexo_vistoria_token",
      {
        p_token: token,
        p_ponto_id: pontoId,
        p_tipo: "foto",
        p_nome_arquivo: fileName,
        p_mime_type: file.type || "image/jpeg",
        p_tamanho_bytes: file.size,
        p_provider: "google_drive",
        p_external_file_id: driveFile.id,
        p_external_folder_id: vistoriaFolderId,
        p_url_visualizacao: driveFile.webViewLink ?? "",
        p_caminho_arquivo: caminhoArquivo,
        p_categoria: categoria,
      }
    );

    if (anexoError) {
      return Response.json({ error: anexoError.message }, { status: 400 });
    }

    return Response.json({
      ok: true,
      anexo: Array.isArray(anexoData) ? anexoData[0] : null,
      fileId: driveFile.id,
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
