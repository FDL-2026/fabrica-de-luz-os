import ProgressoPonderadoProjeto from "@/components/progresso/progresso-ponderado-projeto";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProgressoProjetoPage({ params }: PageProps) {
  await requireUser();

  const { id } = await params;

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl space-y-5">
        <a
          href={`/projetos/${id}`}
          className="inline-flex h-11 items-center rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-[var(--fdl-cream)] transition hover:bg-white/[0.09]"
        >
          ← Voltar para o projeto
        </a>

        <ProgressoPonderadoProjeto projetoId={id} />
      </div>
    </main>
  );
}
