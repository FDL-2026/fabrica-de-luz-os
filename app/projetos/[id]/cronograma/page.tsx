import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Projeto = {
  id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
  status: string | null;
};

type OrdemServico = {
  id: string;
  codigo_os: string | null;
  codigo_cronograma: string | null;
  servico: string | null;
  local: string | null;
  equipe: string | null;
  status: string | null;
  progresso: number | null;
  inicio_previsto: string | null;
  termino_previsto: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatStatus(status: string | null) {
  const normalized = String(status ?? "").toLowerCase();

  const labels: Record<string, string> = {
    planejamento: "Planejamento",
    pendente: "Pendente",
    em_andamento: "Em andamento",
    aguardando_validacao: "Aguardando validação",
    ajuste_solicitado: "Ajuste solicitado",
    concluida: "Concluída",
    concluido: "Concluída",
    aprovada: "Aprovada",
    cancelada: "Cancelada",
  };

  return labels[normalized] ?? status ?? "Não informado";
}

function statusClass(status: string | null) {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized.includes("validacao")) {
    return "bg-amber-100 text-amber-800";
  }

  if (normalized.includes("andamento")) {
    return "bg-blue-100 text-blue-700";
  }

  if (normalized.includes("conclu") || normalized.includes("aprov")) {
    return "bg-green-100 text-green-700";
  }

  if (normalized.includes("ajuste")) {
    return "bg-red-100 text-red-700";
  }

  if (normalized.includes("planejamento")) {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-[var(--fdl-lilac)] text-[var(--fdl-purple-dark)]";
}

function compararOS(a: OrdemServico, b: OrdemServico) {
  const dataA = a.inicio_previsto ? new Date(a.inicio_previsto).getTime() : Number.MAX_SAFE_INTEGER;
  const dataB = b.inicio_previsto ? new Date(b.inicio_previsto).getTime() : Number.MAX_SAFE_INTEGER;

  if (dataA !== dataB) return dataA - dataB;

  return String(a.codigo_cronograma ?? a.codigo_os ?? "").localeCompare(
    String(b.codigo_cronograma ?? b.codigo_os ?? ""),
    "pt-BR",
    { numeric: true }
  );
}

export default async function CronogramaProjetoPage({ params }: PageProps) {
  const { id } = await params;
  const { usuario } = await requireUser();
  const supabase = await createClient();

  const { data: projeto, error: projetoError } = await supabase
    .from("projetos")
    .select("id, cliente, shopping, uf, temporada, status")
    .eq("id", id)
    .maybeSingle<Projeto>();

  if (projetoError || !projeto) {
    notFound();
  }

  const { data: ordens, error: ordensError } = await supabase
    .from("ordens_servico")
    .select(
      "id, codigo_os, codigo_cronograma, servico, local, equipe, status, progresso, inicio_previsto, termino_previsto"
    )
    .eq("projeto_id", id)
    .order("inicio_previsto", { ascending: true, nullsFirst: false })
    .order("codigo_cronograma", { ascending: true });

  if (ordensError) {
    throw new Error(ordensError.message);
  }

  const oss = [...((ordens ?? []) as OrdemServico[])].sort(compararOS);

  const totalOS = oss.length;
  const comData = oss.filter((os) => os.inicio_previsto || os.termino_previsto).length;
  const semData = totalOS - comData;

  const primeiraData = oss.find((os) => os.inicio_previsto)?.inicio_previsto ?? null;
  const ultimaData =
    [...oss].reverse().find((os) => os.termino_previsto)?.termino_previsto ??
    [...oss].reverse().find((os) => os.inicio_previsto)?.inicio_previsto ??
    null;

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="grid min-h-screen lg:grid-cols-[264px_1fr]">
        <aside className="hidden border-r border-white/10 bg-[var(--fdl-purple)] p-6 lg:block">
          <div className="mb-10 flex items-center justify-center rounded-3xl bg-white/5 p-4">
            <img
              src="/brand/H_TAGLINE_SF_ROXO.png"
              alt="Fábrica de Luz"
              className="h-auto w-full max-w-[180px]"
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

        <section className="p-6 sm:p-8">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link
                href={`/projetos/${projeto.id}`}
                className="fdl-project-back-link"
              >
                ← Voltar para o projeto
              </Link>

              <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
                Cronograma
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                {projeto.cliente || projeto.shopping || "Projeto"}
              </h1>

              <p className="mt-2 text-sm text-white/60">
                {projeto.uf || "UF não informada"} · Temporada{" "}
                {projeto.temporada || "Não informada"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${statusClass(
                  projeto.status
                )}`}
              >
                {formatStatus(projeto.status)}
              </span>

              <Link
                href={`/projetos/${projeto.id}`}
                className="fdl-ui-btn fdl-ui-btn-primary"
              >
                Abrir projeto
              </Link>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="fdl-project-kpi-card">
              <p className="fdl-project-kpi-label">Total de OSs</p>
              <strong className="fdl-project-kpi-value">{totalOS}</strong>
              <span className="fdl-project-kpi-help">cadastradas no projeto</span>
            </div>

            <div className="fdl-project-kpi-card">
              <p className="fdl-project-kpi-label">Com data</p>
              <strong className="fdl-project-kpi-value">{comData}</strong>
              <span className="fdl-project-kpi-help">com planejamento definido</span>
            </div>

            <div className="fdl-project-kpi-card">
              <p className="fdl-project-kpi-label">Sem data</p>
              <strong className="fdl-project-kpi-value">{semData}</strong>
              <span className="fdl-project-kpi-help fdl-project-kpi-warning">
                precisam de revisão
              </span>
            </div>

            <div className="fdl-project-kpi-card">
              <p className="fdl-project-kpi-label">Período</p>
              <strong className="fdl-project-kpi-value text-[1.25rem]">
                {formatDate(primeiraData)}
              </strong>
              <span className="fdl-project-kpi-help">
                até {formatDate(ultimaData)}
              </span>
            </div>
          </div>

          <section className="fdl-ui-page-block mt-8 p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="fdl-section-title">OSs planejadas</h2>
                <p className="fdl-section-subtitle">
                  Visão executiva das ordens de serviço cadastradas e suas datas planejadas.
                </p>
              </div>

              <span className="fdl-ui-badge bg-white/10 text-white">
                {totalOS} OS(s)
              </span>
            </div>

            {oss.length > 0 ? (
              <div className="fdl-ui-table-wrap">
                <div className="fdl-ui-table-scroll">
                  <table className="fdl-ui-table min-w-[1040px]">
                    <thead>
                      <tr>
                        <th>OS</th>
                        <th>Serviço</th>
                        <th>Local</th>
                        <th>Equipe</th>
                        <th>Início planejado</th>
                        <th>Término planejado</th>
                        <th>Status</th>
                        <th>Ação</th>
                      </tr>
                    </thead>

                    <tbody>
                      {oss.map((os) => (
                        <tr key={os.id}>
                          <td>
                            <p className="fdl-ui-table-primary">
                              {os.codigo_os || os.codigo_cronograma || "OS sem código"}
                            </p>
                            {os.codigo_cronograma ? (
                              <p className="fdl-ui-table-secondary">
                                Cronograma {os.codigo_cronograma}
                              </p>
                            ) : null}
                          </td>

                          <td>{os.servico || "Não informado"}</td>
                          <td>{os.local || "Não informado"}</td>
                          <td>{os.equipe || "Não informado"}</td>

                          <td>
                            <span className={os.inicio_previsto ? "" : "text-amber-200"}>
                              {formatDateTime(os.inicio_previsto)}
                            </span>
                          </td>

                          <td>
                            <span className={os.termino_previsto ? "" : "text-amber-200"}>
                              {formatDateTime(os.termino_previsto)}
                            </span>
                          </td>

                          <td>
                            <span className={`fdl-ui-badge ${statusClass(os.status)}`}>
                              {formatStatus(os.status)}
                            </span>
                          </td>

                          <td>
                            <div className="fdl-ui-table-actions">
                              <Link
                                href={`/projetos/${projeto.id}/os/${os.id}`}
                                className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-primary"
                              >
                                Abrir
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="fdl-empty-state">
                Nenhuma OS cadastrada para este projeto.
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
