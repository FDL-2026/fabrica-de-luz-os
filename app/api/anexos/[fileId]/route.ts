import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }

  return value;
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
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error_description ?? "Falha ao autenticar no Drive.");
  }

  return data.access_token as string;
}

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { fileId } = await context.params;

  if (!fileId || !/^[\w-]+$/.test(fileId)) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  // Exige usuário autenticado no sistema (gestão)
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let accessToken: string;

  try {
    accessToken = await getGoogleAccessToken();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao acessar o Drive.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const querThumb = request.nextUrl.searchParams.get("thumb") === "1";

  if (querThumb) {
    // Miniatura leve gerada pelo próprio Drive
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink,mimeType&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaResponse.ok) {
      return NextResponse.json(
        { error: "Arquivo não encontrado no Drive." },
        { status: 404 }
      );
    }

    const meta = (await metaResponse.json()) as {
      thumbnailLink?: string;
    };

    if (!meta.thumbnailLink) {
      return NextResponse.json(
        { error: "Sem miniatura disponível." },
        { status: 404 }
      );
    }

    const thumbResponse = await fetch(
      meta.thumbnailLink.replace(/=s\d+$/, "=s640"),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!thumbResponse.ok || !thumbResponse.body) {
      return NextResponse.json(
        { error: "Falha ao carregar miniatura." },
        { status: 502 }
      );
    }

    return new NextResponse(thumbResponse.body, {
      status: 200,
      headers: {
        "Content-Type":
          thumbResponse.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "private, max-age=600",
      },
    });
  }

  // Conteúdo completo, com suporte a Range (necessário para vídeo)
  const range = request.headers.get("range");

  const driveResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(range ? { Range: range } : {}),
      },
    }
  );

  if (!driveResponse.ok || !driveResponse.body) {
    return NextResponse.json(
      { error: "Arquivo não encontrado no Drive." },
      { status: driveResponse.status === 404 ? 404 : 502 }
    );
  }

  const headers = new Headers({
    "Content-Type":
      driveResponse.headers.get("content-type") ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
  });

  for (const nome of ["content-length", "content-range"]) {
    const valor = driveResponse.headers.get(nome);
    if (valor) headers.set(nome, valor);
  }

  return new NextResponse(driveResponse.body, {
    status: driveResponse.status,
    headers,
  });
}
