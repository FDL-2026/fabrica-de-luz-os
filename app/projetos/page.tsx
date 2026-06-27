import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

export default async function ProjetosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nome, email, perfil, ativo")
    .eq("auth_user_id", user.id)
    .single();

  if (!usuario || !usuario.ativo) {
    redirect("/login");
  }

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
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
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

          <Link
            href="/logout"
            className="mt-4 block rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Sair
          </Link>
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

              <Link
                href="/importar"
                className="rounded-full bg-[var(--fdl-cream)] px-5 py-2 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
              >
                Importar cronograma
              </Link>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Total de projetos</p>
              <strong className="mt-3 block text-4xl">{totalProjetos}</strong>
              <span className="mt-2 block text-sm text-[#7d6488]">
                visíveis para seu perfil
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Em montagem</p>
              <strong className="mt-3 block text-4xl">
                {projetosEmMontagem}
              </strong>
              <span className="mt-2 block text-sm text-green-600">
                projetos em execução
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Planejamento</p>
              <strong className="mt-3 block text-4xl">
                {projetosPlanejamento}
              </strong>
              <span className="mt-2 block text-sm text-[#7d6488]">
                aguardando início
              </span>
            </div>
          </div>

          <section className="mt-8">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Projetos cadastrados</h2>
                <p className="mt-1 text-sm text-white/50">
                  Clique em um projeto para abrir o acompanhamento detalhado.
                </p>
              </div>
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

                        <p className="mt-1 text-sm text-white/60">
                          {projeto.cidade} / {projeto.uf}
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
                          {projeto.data_inicio
                            ? new Date(projeto.data_inicio).toLocaleDateString(
                                "pt-BR"
                              )
                            : "Não informado"}
                        </p>
                      </div>

                      <div>
                        <p className="text-white/45">Fim previsto</p>
                        <p className="mt-1 font-semibold">
                          {projeto.data_fim
                            ? new Date(projeto.data_fim).toLocaleDateString(
                                "pt-BR"
                              )
                            : "Não informado"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/projetos/${projeto.id}`}
                        className="rounded-2xl bg-[var(--fdl-cream)] px-5 py-3 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
                      >
                        Ver projeto
                      </Link>

                      <Link
                        href={`/projetos/${projeto.id}/cronograma`}
                        className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                      >
                        Cronograma
                      </Link>
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