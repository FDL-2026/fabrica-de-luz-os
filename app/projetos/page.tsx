import { requireUser } from "@/lib/auth/require-user";
import SidebarGestao from "@/components/gestao/sidebar-gestao";
import ProjetosListaClient from "./projetos-lista-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProjetoRow = {
  id: string;
  cliente: string | null;
  shopping: string | null;
  cidade: string | null;
  uf: string | null;
  temporada: string | null;
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  responsavel_comercial?: string | null;
};

export default async function ProjetosPage() {
  const { supabase, usuario } = await requireUser("/projetos");

  const projetosResult = await supabase
    .from("projetos")
    .select(
      "id, cliente, shopping, cidade, uf, temporada, status, data_inicio, data_fim, responsavel_comercial"
    )
    .order("criado_em", { ascending: false });

  let projetos = (projetosResult.data ?? []) as ProjetoRow[];

  if (projetosResult.error) {
    const fallbackResult = await supabase
      .from("projetos")
      .select(
        "id, cliente, shopping, cidade, uf, temporada, status, data_inicio, data_fim"
      )
      .order("criado_em", { ascending: false });

    projetos = (fallbackResult.data ?? []) as ProjetoRow[];
  }

  const totalProjetos = projetos.length;

  const projetosEmMontagem =
    projetos?.filter((projeto) => projeto.status === "em_montagem").length ?? 0;

  const projetosPlanejamento =
    projetos?.filter((projeto) => projeto.status === "planejamento").length ??
    0;

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="grid min-h-screen lg:grid-cols-[264px_1fr]">
        <SidebarGestao
          usuarioNome={usuario.nome}
          usuarioPerfil={usuario.perfil}
        />

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

          <ProjetosListaClient projetos={projetos} />
        </section>
      </div>
    </main>
  );
}