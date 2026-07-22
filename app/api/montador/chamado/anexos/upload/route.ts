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

type ChamadoContexto = {
  chamado_id: string;
  protocolo: string;
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
};

// Upload de foto do chamado pelo MONTADOR (acesso por PIN, sem sessão). A foto
// entra separada por FASE: "antes" ou "depois" do atendimento. Autorização e
// contexto (projeto) vêm de fdl_obter_chamado_montador, que já checa o vínculo.
export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const usuarioId = String(formData.get("usuarioId") ?? "");
    const chamadoId = String(formData.get("chamadoId") ?? "");
    const faseBruta = String(formData.get("fase") ?? "").trim().toLowerCase();
    const file = formData.get("file");

    const fase = faseBruta === "antes" || faseBruta === "depois" ? faseBruta : "";

    if (!usuarioId || !chamadoId || !fase) {
      return Response.json(
        { error: "Dados incompletos (usuário, chamado ou fase) para upload." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Nenhum arquivo foi enviado." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return Response.json(
        { error: "Envie apenas fotos." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "Arquivo muito grande. Envie fotos de até 25 MB nesta fase." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      env("NEXT_PUBLIC_SUPABASE_URL"),
      env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data: detalhe, error: detalheError } = await supabase.rpc(
      "fdl_obter_chamado_montador",
      {
        p_usuario_id: usuarioId,
        p_chamado_id: chamadoId,
      }
    );

    if (detalheError) {
      return Response.json({ error: detalheError.message }, { status: 400 });
    }

    const contexto = (
      detalhe as { chamado?: ChamadoContexto } | null
    )?.chamado;

    if (!contexto) {
      return Response.json(
        {
          error:
            "Chamado não encontrado ou montador sem vínculo com este projeto.",
        },
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

    const nomeChamado = sanitizeFolderName(
      `Chamado ${contexto.protocolo || contexto.chamado_id}`
    );

    const pastaFase = fase === "antes" ? "Antes" : "Depois";

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
      "03 - Chamados"
    );

    const chamadoFolderId = await ensureFolder(
      accessToken,
      chamadosFolderId,
      nomeChamado
    );

    const faseFolderId = await ensureFolder(
      accessToken,
      chamadoFolderId,
      pastaFase
    );

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
      "03 - Chamados",
      nomeChamado,
      pastaFase,
      fileName,
    ].join("/");

    const { data: anexoData, error: anexoError } = await supabase.rpc(
      "fdl_registrar_anexo_chamado_montador",
      {
        p_usuario_id: usuarioId,
        p_chamado_id: chamadoId,
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
      return Response.json(
        { error: message, codigo: "drive_auth" },
        { status: 502 }
      );
    }

    return Response.json({ error: message }, { status: 500 });
  }
}
