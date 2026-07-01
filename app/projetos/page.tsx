import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import ProgressoPonderadoCardProjeto from "@/components/progresso/progresso-ponderado-card-projeto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatStatus(status: string | null) {
  if (!status) return "Sem status";

  const labels: Record<string, string> = {
    planejamento: "Planejamento",
    em_montagem: "Em montagem",
    pausado: "Pausado",
    concluido: "Concluído",
    cancelado: "Cancelado",
  };

  return labels[status] ?? status.replace("_", " ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "em_montagem":
      return "bg-green-100 text-green-700";
    case "planejamento":
      return "bg-blue-100 text-blue-700";
    case "pausado":
      return "bg-yellow-100 text-yellow-700";
    case "concluido":
      return "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]";
    case "cancelado":
      return "bg-red-100 text-red-700";
    default:
      return "bg-white/20 text-white";
  }
}

function formatDate(date: string | null) {
  if (!date) return "Não informado";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function ProjetosPage() {
  const { supabase, usuario } = await requireUser("/projetos");

  const { data: projetos } = await supabase
    .from("projetos")
    .select(
      "id, cliente, shopping, cidade, uf, temporada, status, data_inicio, data_fim"
    )
    .order("criado_em", { ascending: false });

  const totalProjetos = projetos?.length ?? 0;

  const projetosEmMontagem =
    projetos?.filter((projeto) => projeto.status === "em_montagem").length ?? 0;

  const projetosPlanejamento =
    projetos?.filter((projeto) => projeto.status === "planejamento").length ??
    0;

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="grid min-h-screen lg:grid-cols-[264px_1fr]">
        <aside className="border-r border-white/10 bg-[var(--fdl-purple)] p-6">
          <div className="mb-10 flex items-center justify-center rounded-3xl bg-white/5 p-4">
            <Image
              src="/brand/H_TAGLINE_SF_ROXO.png"
              alt="Fábrica de Luz"
              width={500}
              height={300}
              priority
              className="h-auto max-h-28 w-full object-contain"
            />
          </div>

          <nav className="space-y-2 text-sm">
            <Link
              href="/dashboard"
              className="block rounded-2xl px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Painel geral
            </Link>

            <Link
              href="/projetos"
              className="block rounded-2xl bg-white/15 px-4 py-3 font-semibold text-white"
            >
              Projetos
            </Link>

            <Link
              href="/usuarios"
              className="block rounded-2xl px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Usuários
            </Link>

            <Link
              href="/importar"
              className="block rounded-2xl px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Importar cronograma
            </Link>
          </nav>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/10 p-4">
            <p className="text-sm font-semibold">{usuario.nome}</p>
            <p className="mt-1 text-xs text-white/60">
              {usuario.perfil.replace("_", " ")}
            </p>
          </div>

          <a
            href="/logout"
            className="mt-4 block rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Sair
          </a>
        </aside>

        <section className="p-8">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
                Projetos
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                Controle de projetos
              </h1>

              <p className="mt-2 text-sm text-white/60">
                Acompanhe os projetos por cliente, status, temporada e regional.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/70">
                Temporada 2026
              </div>

              <a
                href="/importar"
                className="rounded-full bg-[var(--fdl-cream)] px-5 py-2 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
              >
                Importar cronograma
              </a>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="fdl-projects-kpi-card">
              <p className="fdl-projects-kpi-label">Total de projetos</p>
              <strong className="fdl-projects-kpi-value">{totalProjetos}</strong>
              <span className="fdl-projects-kpi-help">
                visíveis para seu perfil
              </span>
            </div>

            <div className="fdl-projects-kpi-card">
              <p className="fdl-projects-kpi-label">Em montagem</p>
              <strong className="fdl-projects-kpi-value">
                {projetosEmMontagem}
              </strong>
              <span className="fdl-projects-kpi-help fdl-projects-kpi-success">
                projetos em execução
              </span>
            </div>

            <div className="fdl-projects-kpi-card">
              <p className="fdl-projects-kpi-label">Planejamento</p>
              <strong className="fdl-projects-kpi-value">
                {projetosPlanejamento}
              </strong>
              <span className="fdl-projects-kpi-help">
                aguardando início
              </span>
            </div>
          </div>

          <section className="mt-8">
            <div className="mb-5">
              <h2 className="text-xl font-semibold">Projetos cadastrados</h2>
              <p className="mt-1 text-sm text-white/50">
                Clique em um projeto para abrir o acompanhamento detalhado.
              </p>
            </div>

            {projetos && projetos.length > 0 ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {projetos.map((projeto) => (
                  <article
                    key={projeto.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-xl transition hover:border-[var(--fdl-cream)]/50 hover:bg-white/[0.08]"
                  >
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-[var(--fdl-cream)]">
                          {projeto.temporada}
                        </p>

                        <h3 className="mt-2 text-2xl font-bold">
                          {projeto.cliente || projeto.shopping}
                        </h3>

                        <p className="fdl-section-subtitle">
                           {projeto.uf}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          projeto.status
                        )}`}
                      >
                        {formatStatus(projeto.status)}
                      </span>
                    </div>

                    <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-white/45">Início previsto</p>
                        <p className="mt-1 font-semibold">
                          {formatDate(projeto.data_inicio)}
                        </p>
                      </div>

                      <div>
                        <p className="text-white/45">Fim previsto</p>
                        <p className="mt-1 font-semibold">
                          {formatDate(projeto.data_fim)}
                        </p>
                      </div>
                    </div>

                    <ProgressoPonderadoCardProjeto projetoId={projeto.id} />

                    <div className="mt-5 flex flex-wrap gap-3">
                      <a
                        href={`/projetos/${projeto.id}`}
                        className="rounded-2xl bg-[var(--fdl-cream)] px-5 py-3 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
                      >
                        Ver projeto
                      </a>

                      <a
                        href={`/projetos/${projeto.id}/cronograma`}
                        className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                      >
                        Cronograma
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-10 text-center">
                <p className="text-lg font-semibold">
                  Nenhum projeto encontrado.
                </p>
                <p className="mt-2 text-sm text-white/50">
                  Importe um cronograma ou cadastre um projeto para começar.
                </p>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}