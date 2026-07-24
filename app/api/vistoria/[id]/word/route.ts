import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/drive/google-drive";
import {
  relatorioVistoriaDoc,
  type VistoriaRelatorio,
} from "@/lib/vistoria/relatorio-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Coleta os external_file_id de todas as fotos do relatório.
function coletarFileIds(v: VistoriaRelatorio): string[] {
  const ids: string[] = [];
  for (const local of v.locais ?? []) {
    for (const p of local.pontos ?? []) {
      for (const f of p.fotos ?? []) {
        if (f.external_file_id) ids.push(f.external_file_id);
      }
    }
  }
  return ids;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("fdl_obter_vistoria_gestao", {
    p_id: id,
  });

  const vistoria = (data && typeof data === "object" ? data : null) as
    | VistoriaRelatorio
    | null;

  if (error || !vistoria) {
    return NextResponse.json(
      { error: "Vistoria não encontrada." },
      { status: 404 }
    );
  }

  // Baixa cada foto do Drive e converte para data URI (embute no .doc).
  const mapa = new Map<string, string>();
  const ids = [...new Set(coletarFileIds(vistoria))];

  if (ids.length > 0) {
    try {
      const accessToken = await getGoogleAccessToken();
      await Promise.all(
        ids.map(async (fileId) => {
          try {
            const resp = await fetch(
              `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!resp.ok) return;
            const contentType = resp.headers.get("content-type") ?? "image/jpeg";
            const buffer = Buffer.from(await resp.arrayBuffer());
            mapa.set(fileId, `data:${contentType};base64,${buffer.toString("base64")}`);
          } catch {
            // Ignora foto que falhar; o relatório sai sem ela.
          }
        })
      );
    } catch {
      // Sem acesso ao Drive: gera o documento só com texto.
    }
  }

  const html = relatorioVistoriaDoc(vistoria, (fileId) => mapa.get(fileId) ?? null);

  const nomeArquivo = `Vistoria - ${(vistoria.titulo ?? "relatorio")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .slice(0, 60) || "relatorio"}.doc`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        nomeArquivo
      )}"`,
      "Cache-Control": "no-store",
    },
  });
}
