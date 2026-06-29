import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

type ContextoUpload = {
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
  os_id: string;
  codigo_os: string | null;
  codigo_cronograma: string | null;
};

function env(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }

  return value;
}

function sanitizeFolderName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function getGoogleAccessToken() {
  const body = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
    refresh_token: env("GOOGLE_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error_description ||
        data?.error ||
        "Não foi possível autenticar no Google Drive."
    );
  }

  return data.access_token as string;
}

async function driveFetch<T>(
  accessToken: string,
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || "Erro na comunicação com Google Drive.");
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function findFolder(
  accessToken: string,
  parentId: string,
  name: string
): Promise<string | null> {
  const query = [
    `'${escapeDriveQuery(parentId)}' in parents`,
    `name = '${escapeDriveQuery(name)}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    "trashed = false",
  ].join(" and ");

  const url =
    "https://www.googleapis.com/drive/v3/files" +
    `?q=${encodeURIComponent(query)}` +
    "&fields=files(id,name)" +
    "&pageSize=1" +
    "&supportsAllDrives=true" +
    "&includeItemsFromAllDrives=true";

  const data = await driveFetch<{ files: Array<{ id: string; name: string }> }>(
    accessToken,
    url
  );

  return data.files?.[0]?.id ?? null;
}

async function createFolder(
  accessToken: string,
  parentId: string,
  name: string
) {
  const data = await driveFetch<{ id: string; name: string }>(
    accessToken,
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    }
  );

  return data.id;
}

async function ensureFolder(
  accessToken: string,
  parentId: string,
  name: string
) {
  const existingId = await findFolder(accessToken, parentId, name);

  if (existingId) {
    return existingId;
  }

  return createFolder(accessToken, parentId, name);
}

async function uploadFileToDrive(params: {
  accessToken: string;
  folderId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const boundary = `fdl_boundary_${Date.now()}`;

  const metadata = {
    name: params.fileName,
    parents: [params.folderId],
    mimeType: params.mimeType,
  };

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from("Content-Type: application/json; charset=UTF-8\r\n\r\n"),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from(`\r\n--${boundary}\r\n`),
    Buffer.from(`Content-Type: ${params.mimeType}\r\n\r\n`),
    params.buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  return driveFetch<{
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    webViewLink?: string;
  }>(
    params.accessToken,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink",
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const usuarioId = String(formData.get("usuarioId") ?? "");
    const projetoId = String(formData.get("projetoId") ?? "");
    const osId = String(formData.get("osId") ?? "");
    const file = formData.get("file");

    if (!usuarioId || !projetoId || !osId) {
      return Response.json(
        { error: "Dados de acesso incompletos para upload." },
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
        { error: "Arquivo muito grande. Envie arquivos de até 25 MB nesta fase." },
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

    const { data: contextoData, error: contextoError } = await supabase.rpc(
      "obter_contexto_upload_os_montador",
      {
        p_usuario_id: usuarioId,
        p_projeto_id: projetoId,
        p_os_id: osId,
      }
    );

    if (contextoError) {
      return Response.json({ error: contextoError.message }, { status: 400 });
    }

    const contexto = Array.isArray(contextoData)
      ? (contextoData[0] as ContextoUpload | undefined)
      : undefined;

    if (!contexto) {
      return Response.json(
        { error: "OS não encontrada ou montador sem vínculo com este projeto." },
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

    const nomeOs = sanitizeFolderName(
      `OS ${contexto.codigo_cronograma || contexto.codigo_os || contexto.os_id}`
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

    const registrosFolderId = await ensureFolder(
      accessToken,
      projetoFolderId,
      "02 - Registros de Execução"
    );

    const osFolderId = await ensureFolder(
      accessToken,
      registrosFolderId,
      nomeOs
    );

    const tipoFolderId = await ensureFolder(accessToken, osFolderId, pastaTipo);

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
      "02 - Registros de Execução",
      nomeOs,
      pastaTipo,
      fileName,
    ].join("/");

    const { data: arquivoData, error: arquivoError } = await supabase.rpc(
      "registrar_arquivo_os_montador",
      {
        p_usuario_id: usuarioId,
        p_projeto_id: projetoId,
        p_os_id: osId,
        p_tipo: tipo,
        p_bucket: "google_drive",
        p_caminho_arquivo: caminhoArquivo,
        p_nome_arquivo: fileName,
        p_mime_type: file.type || "application/octet-stream",
        p_tamanho_bytes: file.size,
        p_provider: "google_drive",
        p_external_file_id: driveFile.id,
        p_external_folder_id: tipoFolderId,
        p_url_visualizacao: driveFile.webViewLink ?? "",
      }
    );

    if (arquivoError) {
      return Response.json({ error: arquivoError.message }, { status: 400 });
    }

    return Response.json({
      ok: true,
      arquivo: Array.isArray(arquivoData) ? arquivoData[0] : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado no upload.";

    return Response.json({ error: message }, { status: 500 });
  }
}
