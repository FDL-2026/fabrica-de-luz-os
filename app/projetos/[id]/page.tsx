import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import SidebarGestao from "@/components/gestao/sidebar-gestao";
import OsTableClient from "./os-table-client";
import FilaValidacaoProjetoClient from "./fila-validacao-projeto-client";
import HistoricoProjetoClient from "./historico-projeto-client";
import ProgressoPonderadoProjeto from "@/components/progresso/progresso-ponderado-projeto";
import ProgressoPonderadoKpi from "@/components/progresso/progresso-ponderado-kpi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type MembroEquipe = {
  usuario_id: string;
  nome: string | null;
  email: string | null;
  perfil: string | null;
  ativo: boolean;
  tipo_login: string | null;
  codigo_acesso: string | null;
  funcao: string | null;
};

function primeiroNome(nome: string | null) {
  if (!nome) return "Sem nome";
  return nome.trim().split(/\s+/)[0];
}

function formatDate(date: string | null) {
  if (!date) return "Não informado";

  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatTime(time: string | null) {
  if (!time) return "--h";

  const [hour, minute] = time.split(":");

  if (minute === "00") {
    return `${hour}h`;
  }

  return `${hour}h${minute}`;
}

function formatStatus(status: string | null) {
  if (!status) return "Sem status";

  const labels: Record<string, string> = {
    planejamento: "Planejamento",
    em_montagem: "Em montagem",
    pausado: "Pausado",
    concluido: "Concluído",
    cancelado: "Cancelado",
    prevista: "Prevista",
    em_andamento: "Em andamento",
    concluida: "Concluída",
    atrasada: "Atrasada",
    pendente: "Pendente",
    bloqueada: "Bloqueada",
  };

  return labels[status] ?? status.replace("_", " ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "em_montagem":
    case "em_andamento":
      return "bg-green-100 text-green-700";

    case "planejamento":
    case "prevista":
      return "bg-blue-100 text-blue-700";

    case "pausado":
    case "pendente":
    case "aguardando_validacao":
      return "bg-yellow-100 text-yellow-700";

    case "concluido":
    case "concluida":
      return "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]";

    case "cancelado":
    case "atrasada":
    case "bloqueada":
      return "bg-red-100 text-red-700";

    default:
      return "bg-white/20 text-white";
  }
}

export default async function ProjetoDetalhePage({ params }: PageProps) {
  const { id } = await params;

  const { supabase, usuario } = await requireUser(`/projetos/${id}`);

  const { data: projeto } = await supabase
    .from("projetos")
    .select(
      "id, cliente, shopping, cidade, uf, temporada, status, data_inicio, data_fim, observacoes"
    )
    .eq("id", id)
    .single();

  if (!projeto) {
    notFound();
  }

  const { data: noites } = await supabase
    .from("noites_montagem")
    .select("id, numero_noite, data, horario_inicio, horario_fim, status")
    .eq("projeto_id", id)
    .order("numero_noite", { ascending: true });

  const { data: ordensServico } = await supabase
    .from("ordens_servico")
    .select("id, codigo_os, local, servico, equipe, status, prioridade")
    .eq("projeto_id", id)
    .order("codigo_os", { ascending: true });

  const { data: dadosComerciais } = await supabase
    .from("projetos")
    .select("responsavel_comercial")
    .eq("id", id)
    .maybeSingle();

  const gestorComercial = dadosComerciais?.responsavel_comercial ?? null;

  const { data: equipeProjeto } = await supabase.rpc(
    "fdl_listar_equipe_projeto",
    { p_projeto_id: id }
  );

  const montadoresEquipe = ((equipeProjeto ?? []) as MembroEquipe[]).filter(
    (membro) => membro.perfil === "montador"
  );

  const nomesMontadores = montadoresEquipe
    .slice(0, 3)
    .map((membro) => primeiroNome(membro.nome));

  const montadoresRestantes = montadoresEquipe.length - nomesMontadores.length;

  const totalNoites = noites?.length ?? 0;

  const noitesConcluidas =
    noites?.filter((noite) => noite.status === "concluida").length ?? 0;

  const totalOS = ordensServico?.length ?? 0;

  const osConcluidas =
    ordensServico?.filter((os) => os.status === "concluida").length ?? 0;

  const osPendentes =
    ordensServico?.filter((os) => os.status === "pendente").length ?? 0;

  const progresso =
    totalOS > 0 ? Math.round((osConcluidas / totalOS) * 100) : 0;


  const ordensServicoSeguras = ordensServico ?? [];
  const ordensAguardandoValidacao = ordensServicoSeguras.filter(
    (os) => os.status === "aguardando_validacao"
  );

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="grid min-h-screen lg:grid-cols-[264px_1fr]">
        <SidebarGestao
          usuarioNome={usuario.nome}
          usuarioPerfil={usuario.perfil}
        />

        <section className="p-4 pb-12 sm:p-6 lg:p-8">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <a
                href="/projetos"
                className="fdl-project-back-link"
              >
                ← Voltar para projetos
              </a>

              <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
                Projeto
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                {projeto.cliente || projeto.shopping}
              </h1>

              <p className="mt-2 text-sm text-white/60">
                 {projeto.uf} · Temporada {projeto.temporada}
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

              <a
                href={`/projetos/${projeto.id}/cronograma`}
                className="fdl-ui-btn fdl-ui-btn-primary"
              >
                Ver cronograma
              </a>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <div className="fdl-project-kpi-card">
              <p className="fdl-project-kpi-label">Noites previstas</p>
              <strong className="fdl-project-kpi-value">{totalNoites}</strong>
              <span className="fdl-project-kpi-help">
                {noitesConcluidas} concluídas
              </span>
            </div>

            <div className="fdl-project-kpi-card">
              <p className="fdl-project-kpi-label">Total de OSs</p>
              <strong className="fdl-project-kpi-value">{totalOS}</strong>
              <span className="fdl-project-kpi-help">
                cadastradas no projeto
              </span>
            </div>

            <div className="fdl-project-kpi-card">
              <p className="fdl-project-kpi-label">OSs pendentes</p>
              <strong className="fdl-project-kpi-value">{osPendentes}</strong>
              <span className="fdl-project-kpi-help fdl-project-kpi-warning">
                aguardando execução
              </span>
            </div>

            <div className="fdl-project-kpi-card">
              <ProgressoPonderadoKpi projetoId={projeto.id} />
            </div>
          </div>

          <div className="mt-6">
            <ProgressoPonderadoProjeto projetoId={projeto.id} />
          </div>

          <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <div className="fdl-form-card p-6">
              <div className="mb-5">
                <h2 className="fdl-ui-section-title">Dados do projeto</h2>
                <p className="mt-1 text-sm text-white/50">
                  Informações principais do contrato/montagem.
                </p>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-white/45">Cliente</p>
                    <p className="mt-1 font-semibold">{projeto.cliente}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-white/45">Shopping</p>
                    <p className="mt-1 font-semibold">
                      {projeto.shopping || "Não informado"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-white/45">Cidade</p>
                    <p className="mt-1 font-semibold">
                      {projeto.cidade || "Não informada"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-white/45">UF</p>
                    <p className="mt-1 font-semibold">{projeto.uf || "--"}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-white/45">Temporada</p>
                    <p className="mt-1 font-semibold">
                      {projeto.temporada || "--"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-white/45">Início previsto</p>
                    <p className="mt-1 font-semibold">
                      {formatDate(projeto.data_inicio)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-white/45">Fim previsto</p>
                    <p className="mt-1 font-semibold">
                      {formatDate(projeto.data_fim)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-white/45">Gestor Comercial</p>
                  <p className="mt-1 font-semibold">
                    {gestorComercial || "Não informado"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white/45">Equipe de Montagem</p>
                      <p className="mt-1 font-semibold">
                        👷{" "}
                        {montadoresEquipe.length > 0
                          ? `${montadoresEquipe.length} ${
                              montadoresEquipe.length === 1
                                ? "montador"
                                : "montadores"
                            }`
                          : "Nenhum montador vinculado"}
                      </p>
                      {montadoresEquipe.length > 0 ? (
                        <p className="mt-1 truncate text-white/70">
                          {nomesMontadores.join(" • ")}
                          {montadoresRestantes > 0
                            ? ` • +${montadoresRestantes}`
                            : ""}
                        </p>
                      ) : null}
                    </div>

                    <a
                      href={`/projetos/${projeto.id}/equipe`}
                      className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-secondary shrink-0"
                    >
                      Gerenciar
                    </a>
                  </div>
                </div>

                {projeto.observacoes ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-white/45">Observações</p>
                    <p className="mt-1 text-white/80">{projeto.observacoes}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="fdl-form-card p-6">
              <div className="mb-5">
                <h2 className="fdl-ui-section-title">
                  Cronograma noite a noite
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  Visão geral das noites de montagem.
                </p>
              </div>

              <div className="space-y-3">
                {noites && noites.length > 0 ? (
                  noites.map((noite) => (
                    <div
                      key={noite.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold">
                          Noite {String(noite.numero_noite).padStart(2, "0")}
                        </p>
                        <p className="mt-1 text-sm text-white/50">
                          {formatDate(noite.data)} ·{" "}
                          {formatTime(noite.horario_inicio)} às{" "}
                          {formatTime(noite.horario_fim)}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          noite.status
                        )}`}
                      >
                        {formatStatus(noite.status)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-white/50">
                    Nenhuma noite cadastrada ainda.
                  </div>
                )}
              </div>
            </div>
          </section>

          <FilaValidacaoProjetoClient
        projetoId={projeto.id}
        ordensAguardandoValidacao={ordensAguardandoValidacao}
      />

      <OsTableClient
        projetoId={projeto.id}
        ordensServico={ordensServicoSeguras}
      />

      <HistoricoProjetoClient projetoId={projeto.id} />

        </section>
      </div>
    </main>
  );
}
