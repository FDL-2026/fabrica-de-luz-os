import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env, getGoogleAccessToken } from "@/lib/drive/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxy PÚBLICO de foto-prova de chamado, para o cliente que acompanha pelo
// protocolo (sem login). A autorização é feita pela RPC, que só libera fotos
// "antes/depois" do montador e apenas quando o chamado já foi validado pela
// gestão. Sem isso, nenhuma foto é servida.
export async function GET(request: NextRequest) {
  const protocolo = request.nextUrl.searchParams.get("protocolo") ?? "";
  const fileId = request.nextUrl.searchParams.get("fileId") ?? "";
  const querThumb = request.nextUrl.searchParams.get("thumb") === "1";

  if (!protocolo || !fileId || !/^[\w-]+$/.test(fileId)) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const supabase = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase.rpc("fdl_anexo_chamado_publico", {
    p_protocolo: protocolo,
    p_external_file_id: fileId,
  });

  const autorizado = Array.isArray(data) ? data[0] : null;

  if (error || !autorizado) {
    return NextResponse.json(
      { error: "Sem acesso a este arquivo." },
      { status: 403 }
    );
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken();
  } catch {
    return NextResponse.json(
      { error: "Falha ao acessar o Drive." },
      { status: 502 }
    );
  }

  if (querThumb) {
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (metaResponse.ok) {
      const meta = (await metaResponse.json()) as { thumbnailLink?: string };
      if (meta.thumbnailLink) {
        const thumbResponse = await fetch(
          meta.thumbnailLink.replace(/=s\d+$/, "=s640"),
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (thumbResponse.ok && thumbResponse.body) {
          return new NextResponse(thumbResponse.body, {
            status: 200,
            headers: {
              "Content-Type":
                thumbResponse.headers.get("content-type") ?? "image/jpeg",
              "Cache-Control": "private, max-age=600",
            },
          });
        }
      }
    }
    // Sem miniatura: cai para o conteúdo completo abaixo.
  }

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
