import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import RelatorioAcoes from "@/components/vistoria/relatorio-acoes";
import {
  relatorioVistoriaBody,
  type VistoriaRelatorio,
} from "@/lib/vistoria/relatorio-html";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function RelatorioVistoriaPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase } = await requireUser(`/vistorias/${id}`, {
    negarPerfis: ["visitante"],
  });

  const { data, error } = await supabase.rpc("fdl_obter_vistoria_gestao", {
    p_id: id,
  });

  const vistoria = (data && typeof data === "object" ? data : null) as
    | VistoriaRelatorio
    | null;

  if (error || !vistoria) {
    return (
      <main className="min-h-screen bg-[var(--fdl-purple-dark)] px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/vistorias"
            className="text-sm font-semibold text-white/60 hover:text-white"
          >
            ← Vistorias
          </Link>
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center">
            <h1 className="text-xl font-bold">Vistoria não encontrada</h1>
            <p className="mt-3 text-sm text-white/60">
              Ela pode ter sido removida ou está fora do seu escopo.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const corpo = relatorioVistoriaBody(
    vistoria,
    (fileId) => `/api/anexos/${fileId}`
  );

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] px-4 py-8 text-white print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl">
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/vistorias"
            className="text-sm font-semibold text-white/60 hover:text-white"
          >
            ← Vistorias
          </Link>
          <RelatorioAcoes wordHref={`/api/vistoria/${id}/word`} />
        </div>

        <div
          className="rounded-2xl bg-white p-6 text-[#222] shadow-xl sm:p-10 print:rounded-none print:p-0 print:shadow-none"
          dangerouslySetInnerHTML={{ __html: corpo }}
        />
      </div>
    </main>
  );
}
