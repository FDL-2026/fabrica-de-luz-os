/*
 * Integração com o Google Drive (compartilhada entre uploads do montador e de
 * chamados). Reúne autenticação (refresh token -> access token com cache),
 * chamadas resilientes, criação idempotente de pastas e upload multipart.
 */

export const MAX_FILE_SIZE = 25 * 1024 * 1024;

export function env(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

// Erro específico de credencial do Drive (expirada/revogada ou mal configurada).
// Diferencia "problema de configuração do sistema" de "erro do usuário".
export class GoogleDriveAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleDriveAuthError";
  }
}

// Cache em memória do access token do Google. O refresh token gera um access
// token válido por ~1h; sem cache, cada arquivo de um lote faria uma nova
// chamada ao endpoint de token, o que é lento e desnecessário.
let cachedGoogleToken: { token: string; expiresAt: number } | null = null;

export function sanitizeFolderName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function requestGoogleAccessToken() {
  const body = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
    refresh_token: env("GOOGLE_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (data?.error === "invalid_grant") {
      throw new GoogleDriveAuthError(
        "A conexão com o Google Drive expirou. Isto é uma configuração do sistema (não é problema do seu acesso). " +
          "Avise o administrador para renovar a conexão do Drive."
      );
    }

    throw new GoogleDriveAuthError(
      data?.error_description ||
        data?.error ||
        "Não foi possível autenticar no Google Drive."
    );
  }

  return {
    token: data.access_token as string,
    expiresIn: Number(data.expires_in ?? 3600),
  };
}

export async function getGoogleAccessToken() {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60_000) {
    return cachedGoogleToken.token;
  }

  const { token, expiresIn } = await requestGoogleAccessToken();

  cachedGoogleToken = {
    token,
    expiresAt: Date.now() + Math.max(60, expiresIn - 120) * 1000,
  };

  return token;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function driveFetch<T>(
  accessToken: string,
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const maxTentativas = 3;
  let ultimoErro: unknown = null;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(init.headers ?? {}),
        },
      });
    } catch (networkError) {
      ultimoErro = networkError;
      if (tentativa < maxTentativas) {
        await sleep(500 * tentativa);
        continue;
      }
      throw new Error(
        "Falha de conexão com o Google Drive. Verifique a internet e tente enviar novamente."
      );
    }

    const text = await response.text();

    if (response.ok) {
      return text ? (JSON.parse(text) as T) : ({} as T);
    }

    if (response.status === 401 || response.status === 403) {
      cachedGoogleToken = null;
    }

    const ehTransitorio = response.status === 429 || response.status >= 500;

    if (ehTransitorio && tentativa < maxTentativas) {
      ultimoErro = new Error(text);
      await sleep(500 * tentativa);
      continue;
    }

    throw new Error(text || "Erro na comunicação com Google Drive.");
  }

  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error("Erro na comunicação com Google Drive.");
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

async function createFolder(accessToken: string, parentId: string, name: string) {
  const data = await driveFetch<{ id: string; name: string }>(
    accessToken,
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    }
  );

  return data.id;
}

export async function ensureFolder(
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

export async function uploadFileToDrive(params: {
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
