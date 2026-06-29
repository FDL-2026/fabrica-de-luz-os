export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mask(value: string | undefined) {
  if (!value) return "AUSENTE";
  if (value.length <= 12) return "PRESENTE_MAS_CURTO";
  return `${value.slice(0, 6)}...${value.slice(-6)} (${value.length} caracteres)`;
}

function env(name: string) {
  return process.env[name];
}

async function getGoogleAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID") ?? "",
      client_secret: env("GOOGLE_CLIENT_SECRET") ?? "",
      refresh_token: env("GOOGLE_REFRESH_TOKEN") ?? "",
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (token !== "fdl-debug") {
    return Response.json({ error: "Acesso negado" }, { status: 401 });
  }

  const envStatus = {
    GOOGLE_CLIENT_ID: mask(env("GOOGLE_CLIENT_ID")),
    GOOGLE_CLIENT_SECRET: mask(env("GOOGLE_CLIENT_SECRET")),
    GOOGLE_REFRESH_TOKEN: mask(env("GOOGLE_REFRESH_TOKEN")),
    GOOGLE_DRIVE_ROOT_FOLDER_ID: mask(env("GOOGLE_DRIVE_ROOT_FOLDER_ID")),
  };

  const tokenResult = await getGoogleAccessToken();

  if (!tokenResult.ok) {
    return Response.json({
      etapa: "oauth_token",
      envStatus,
      tokenStatus: tokenResult.status,
      googleError: tokenResult.data,
      diagnostico:
        "Falhou ao trocar refresh token por access token. O problema está no Client ID, Client Secret ou Refresh Token.",
    });
  }

  const accessToken = tokenResult.data?.access_token;

  const folderId = env("GOOGLE_DRIVE_ROOT_FOLDER_ID");

  if (!folderId) {
    return Response.json({
      etapa: "root_folder",
      envStatus,
      tokenStatus: tokenResult.status,
      tokenOk: true,
      diagnostico: "Access token gerado, mas GOOGLE_DRIVE_ROOT_FOLDER_ID está ausente.",
    });
  }

  const driveResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,capabilities&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const driveData = await driveResponse.json().catch(() => null);

  return Response.json({
    etapa: "drive_folder",
    envStatus,
    tokenStatus: tokenResult.status,
    tokenOk: true,
    driveStatus: driveResponse.status,
    driveOk: driveResponse.ok,
    driveData,
    diagnostico: driveResponse.ok
      ? "Google Drive autenticado e pasta raiz encontrada."
      : "Access token gerado, mas o sistema não conseguiu acessar a pasta raiz do Drive.",
  });
}
