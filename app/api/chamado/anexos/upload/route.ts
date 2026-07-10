import { createClient } from "@supabase/supabase-js";
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

type ContextoChamado = {
  chamado_id: string;
  protocolo: string | null;
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const chamadoId = String(formData.get("chamadoId") ?? "");
    const file = formData.get("file");

    if (!chamadoId) {
      return Response.json(
        { error: "Chamado não identificado para o envio." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Nenhum arquivo foi enviado." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      return Response.json(
        { error: "Envie apenas fotos ou vídeos." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "Arquivo muito grande. Envie arquivos de até 25 MB." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      env("NEXT_PUBLIC_SUPABASE_URL"),
      env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: contextoData, error: contextoError } = await supabase.rpc(
      "fdl_obter_contexto_chamado",
      { p_chamado_id: chamadoId }
    );

    if (contextoError) {
      return Response.json({ error: contextoError.message }, { status: 400 });
    }

    const contexto = Array.isArray(contextoData)
      ? (contextoData[0] as ContextoChamado | undefined)
      : undefined;

    if (!contexto) {
      return Response.json({ error: "Chamado não encontrado." }, { status: 404 });
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
    const nomeChamado = sanitizeFolderName(
      `Chamado ${contexto.protocolo || contexto.chamado_id}`
    );

    const tipo = file.type.startsWith("video/") ? "video" : "foto";
    const pastaTipo = tipo === "video" ? "Vídeos" : "Fotos";

    const temporadaFolderId = await ensureFolder(
      accessToken,
      rootFolderId,
      temporada
    );
    const projetoFolderId = await ensureFolder(
      accessToken,
      temporadaFolderId,
      nomeProjeto
    );
    const chamadosFolderId = await ensureFolder(
      accessToken,
      projetoFolderId,
      "03 - Chamados de Manutenção"
    );
    const chamadoFolderId = await ensureFolder(
      accessToken,
      chamadosFolderId,
      nomeChamado
    );
    const tipoFolderId = await ensureFolder(
      accessToken,
      chamadoFolderId,
      pastaTipo
    );

    const originalName = sanitizeFolderName(file.name || "arquivo");
    const fileName = `${Date.now()} - ${originalName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const driveFile = await uploadFileToDrive({
      accessToken,
      folderId: tipoFolderId,
      fileName,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    const caminhoArquivo = [
      temporada,
      nomeProjeto,
      "03 - Chamados de Manutenção",
      nomeChamado,
      pastaTipo,
      fileName,
    ].join("/");

    const { error: anexoError } = await supabase.rpc(
      "fdl_registrar_anexo_chamado",
      {
        p_chamado_id: chamadoId,
        p_tipo: tipo,
        p_nome_arquivo: fileName,
        p_mime_type: file.type || "application/octet-stream",
        p_tamanho_bytes: file.size,
        p_provider: "google_drive",
        p_external_file_id: driveFile.id,
        p_external_folder_id: tipoFolderId,
        p_url_visualizacao: driveFile.webViewLink ?? "",
        p_caminho_arquivo: caminhoArquivo,
      }
    );

    if (anexoError) {
      return Response.json({ error: anexoError.message }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado no upload.";

    if (error instanceof GoogleDriveAuthError) {
      return Response.json(
        { error: message, codigo: "drive_auth" },
        { status: 502 }
      );
    }

    return Response.json({ error: message }, { status: 500 });
  }
}
