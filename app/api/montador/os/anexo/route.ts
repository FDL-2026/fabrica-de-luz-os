import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env, getGoogleAccessToken } from "@/lib/drive/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Extrai o id do arquivo do Drive a partir do link de visualização
// (webViewLink: https://drive.google.com/file/d/<ID>/view...).
function idDoDrive(url: string | null): string | null {
  if (!url) return null;
  const porPath = url.match(/\/d\/([\w-]+)/);
  if (porPath) return porPath[1];
  const porQuery = url.match(/[?&]id=([\w-]+)/);
  return porQuery ? porQuery[1] : null;
}

type ArquivoOs = { url_visualizacao: string | null };

// Proxy de foto de OS para o MONTADOR (acesso por PIN, sem sessão autenticada).
// Autoriza reusando listar_arquivos_os_montador: o arquivo pedido precisa
// pertencer a uma OS a que o montador tem vínculo. Só então serve do Drive.
export async function GET(request: NextRequest) {
  const usuarioId = request.nextUrl.searchParams.get("usuarioId") ?? "";
  const projetoId = request.nextUrl.searchParams.get("projetoId") ?? "";
  const osId = request.nextUrl.searchParams.get("osId") ?? "";
  const fileId = request.nextUrl.searchParams.get("fileId") ?? "";
  const querThumb = request.nextUrl.searchParams.get("thumb") === "1";

  if (
    !usuarioId ||
    !projetoId ||
    !osId ||
    !fileId ||
    !/^[\w-]+$/.test(fileId)
  ) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const supabase = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase.rpc("listar_arquivos_os_montador", {
    p_usuario_id: usuarioId,
    p_projeto_id: projetoId,
    p_os_id: osId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const autorizado = ((data ?? []) as ArquivoOs[]).some(
    (a) => idDoDrive(a.url_visualizacao) === fileId
  );

  if (!autorizado) {
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
    // sem miniatura: cai para o conteúdo completo abaixo
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
