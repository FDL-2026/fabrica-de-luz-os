"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ResumoDashboard = {
  projetos_ativos: number;
  total_projetos: number;
  os_pendentes: number;
  os_em_andamento: number;
  os_concluidas: number;
  os_aguardando_validacao: number;
};

type ProjetoDashboard = {
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
  status: string | null;
  responsavel_comercial: string | null;
  total_os: number;
  pendentes: number;
  em_andamento: number;
  concluidas: number;
  ult_registro: string | null;
};

type RegistroDashboard = {
  registro_id: string;
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  os_id: string | null;
  codigo_os: string | null;
  servico: string | null;
  tipo_registro: string | null;
  status_informado: string | null;
  descricao: string | null;
  percentual_execucao: number | null;
  criado_em: string | null;
  usuario_nome: string | null;
  total_arquivos: number;
};

type OsValidacaoDashboard = {
  os_id: string;
  projeto_id: string;
  codigo_os: string | null;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
  responsavel_comercial: string | null;
  servico: string | null;
  local: string | null;
  equipe: string | null;
  status: string | null;
  status_validacao: string | null;
  concluido_em: string | null;
};

type ProjetoOpcao = {
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
  responsavel_comercial: string | null;
};

type DashboardFiltros = {
  gestores_comerciais: string[];
  projetos_opcoes: ProjetoOpcao[];
};

type DashboardData = {
  resumo: ResumoDashboard;
  projetos: ProjetoDashboard[];
  ultimos_registros: RegistroDashboard[];
  oss_aguardando_validacao: OsValidacaoDashboard[];
  filtros: DashboardFiltros;
};

function formatDateTime(date: string | null) {
  if (!date) return "Sem registro";

  return new Date(date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatStatus(status: string | null) {
  if (!status) return "Sem status";

  const labels: Record<string, string> = {
    planejamento: "Planejamento",
    em_montagem: "Em montagem",
    pausado: "Pausado",
    concluido: "Concluído",
    concluida: "Concluída",
    cancelado: "Cancelado",
    cancelada: "Cancelada",
    pendente: "Pendente",
    em_andamento: "Em andamento",
    bloqueada: "Bloqueada",
    atrasada: "Atrasada",
  };

  return labels[status] ?? status.replace("_", " ");
}

function formatTipoRegistro(tipo: string | null) {
  if (!tipo) return "Registro";

  const labels: Record<string, string> = {
    acompanhamento: "Acompanhamento",
    inicio_os: "Início da OS",
    conclusao_os: "Conclusão da OS",
    pendencia: "Pendência",
    observacao: "Observação",
    anexo: "Anexo",
  };

  return labels[tipo] ?? tipo.replace("_", " ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "em_andamento":
    case "em_montagem":
      return "bg-blue-100 text-blue-700";

    case "pendente":
    case "planejamento":
      return "bg-yellow-100 text-yellow-700";

    case "concluida":
    case "concluido":
      return "bg-green-100 text-green-700";

    case "bloqueada":
    case "atrasada":
    case "cancelada":
    case "cancelado":
      return "bg-red-100 text-red-700";

    default:
      return "bg-white/20 text-white";
  }
}

function tipoRegistroClass(tipo: string | null) {
  switch (tipo) {
    case "pendencia":
      return "bg-red-100 text-red-700";

    case "conclusao_os":
      return "bg-green-100 text-green-700";

    case "inicio_os":
      return "bg-blue-100 text-blue-700";

    case "anexo":
      return "bg-[var(--fdl-lilac)] text-[var(--fdl-purple-dark)]";

    default:
      return "bg-white/15 text-white/80";
  }
}

function nomeProjeto(projeto: {
  cliente: string | null;
  shopping: string | null;
  uf?: string | null;
}) {
  const nome = projeto.cliente || projeto.shopping || "Projeto sem nome";

  if (!projeto.uf) return nome;

  return `${nome} - ${projeto.uf}`;
}

const emptyDashboard: DashboardData = {
  resumo: {
    projetos_ativos: 0,
    total_projetos: 0,
    os_pendentes: 0,
    os_em_andamento: 0,
    os_concluidas: 0,
    os_aguardando_validacao: 0,
  },
  projetos: [],
  ultimos_registros: [],
  oss_aguardando_validacao: [],
  filtros: {
    gestores_comerciais: [],
    projetos_opcoes: [],
  },
};

export default function DashboardClient() {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<DashboardData>(emptyDashboard);
  const [gestorSelecionado, setGestorSelecionado] = useState("");
  const [projetoSelecionado, setProjetoSelecionado] = useState("");

  const progressoGeral = useMemo(() => {
    const total =
      dados.resumo.os_pendentes +
      dados.resumo.os_em_andamento +
      dados.resumo.os_concluidas;

    if (total === 0) return 0;

    return Math.round((dados.resumo.os_concluidas / total) * 100);
  }, [dados]);

  const filtrosAtivos = Boolean(gestorSelecionado || projetoSelecionado);

  useEffect(() => {
    async function carregarDashboard() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase.rpc("fdl_dashboard_gestao", {
        p_gestor_comercial: gestorSelecionado || null,
        p_projeto_id: projetoSelecionado || null,
      });

      if (error) {
        setErro(error.message);
        setDados(emptyDashboard);
        setCarregando(false);
        return;
      }

      setDados((data ?? emptyDashboard) as DashboardData);
      setCarregando(false);
    }

    carregarDashboard();
  }, [gestorSelecionado, projetoSelecionado, supabase]);

  if (carregando) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center text-white/60">
        Carregando dashboard operacional...
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">
        {erro}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          Dashboard operacional
        </p>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Visão geral da montagem</h1>
            <p className="mt-2 text-sm text-white/60">
              Acompanhe projetos, OSs e registros enviados pelos montadores.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/projetos"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Ver projetos
            </a>

            <a
              href="/importar"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--fdl-cream)] px-5 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
            >
              Importar cronograma
            </a>
          </div>
        </div>

        <div className="mt-6 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 lg:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Gestor Comercial
            </label>

            <select
              value={gestorSelecionado}
              onChange={(event) => setGestorSelecionado(event.target.value)}
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)]"
            >
              <option className="text-black" value="">
                Todos os gestores
              </option>

              {dados.filtros.gestores_comerciais.map((gestor) => (
                <option key={gestor} className="text-black" value={gestor}>
                  {gestor}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Projeto
            </label>

            <select
              value={projetoSelecionado}
              onChange={(event) => setProjetoSelecionado(event.target.value)}
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)]"
            >
              <option className="text-black" value="">
                Todos os projetos
              </option>

              {dados.filtros.projetos_opcoes.map((projeto) => (
                <option
                  key={projeto.projeto_id}
                  className="text-black"
                  value={projeto.projeto_id}
                >
                  {nomeProjeto(projeto)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={!filtrosAtivos}
              onClick={() => {
                setGestorSelecionado("");
                setProjetoSelecionado("");
              }}
              className="h-12 w-full rounded-2xl border border-white/15 px-5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Projetos ativos</p>
          <strong className="mt-2 block text-4xl">
            {dados.resumo.projetos_ativos}
          </strong>
          <p className="mt-2 text-xs text-[#7d6488]">
            {dados.resumo.total_projetos} projeto(s) no filtro
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">OSs pendentes</p>
          <strong className="mt-2 block text-4xl">
            {dados.resumo.os_pendentes}
          </strong>
          <p className="mt-2 text-xs text-[#7d6488]">aguardando execução</p>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Em andamento</p>
          <strong className="mt-2 block text-4xl">
            {dados.resumo.os_em_andamento}
          </strong>
          <p className="mt-2 text-xs text-[#7d6488]">em execução</p>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Concluídas</p>
          <strong className="mt-2 block text-4xl">
            {dados.resumo.os_concluidas}
          </strong>
          <p className="mt-2 text-xs text-[#7d6488]">finalizadas com evidência</p>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Progresso geral</p>
          <strong className="mt-2 block text-4xl">{progressoGeral}%</strong>
          <div className="mt-4 h-2 rounded-full bg-[#eee7f3]">
            <div
              className="h-2 rounded-full bg-[var(--fdl-purple)]"
              style={{ width: `${progressoGeral}%` }}
            />
          </div>
        </div>
      </section>


      <section className="rounded-3xl border border-yellow-300/30 bg-yellow-300/10 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--fdl-cream)]">
              Fila de validação
            </p>

            <h2 className="mt-2 text-xl font-bold">OSs aguardando validação</h2>

            <p className="mt-1 text-sm text-white/60">
              OSs concluídas pelos montadores e pendentes de aprovação do gestor.
            </p>
          </div>

          <span className="w-fit rounded-full bg-yellow-100 px-4 py-2 text-sm font-bold text-yellow-700">
            {dados.resumo.os_aguardando_validacao} pendente(s)
          </span>
        </div>

        {dados.oss_aguardando_validacao.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-sm">
                <thead className="bg-white/10 text-white/70">
                  <tr>
                    <th className="px-4 py-3">Projeto</th>
                    <th className="px-4 py-3">OS</th>
                    <th className="px-4 py-3">Local</th>
                    <th className="px-4 py-3">Serviço</th>
                    <th className="px-4 py-3">Equipe</th>
                    <th className="px-4 py-3">Concluída em</th>
                    <th className="px-4 py-3 text-center">Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {dados.oss_aguardando_validacao.map((os) => (
                    <tr key={os.os_id} className="border-t border-white/10">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">
                          {os.cliente || os.shopping || "Projeto sem nome"}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          {os.uf || "UF não informada"} · Gestor:{" "}
                          {os.responsavel_comercial || "Não informado"}
                        </p>
                      </td>

                      <td className="px-4 py-3 font-bold text-white">
                        {os.codigo_os || "-"}
                      </td>

                      <td className="px-4 py-3 text-white/75">
                        {os.local || "-"}
                      </td>

                      <td className="px-4 py-3 text-white/75">
                        {os.servico || "-"}
                      </td>

                      <td className="px-4 py-3 text-white/75">
                        {os.equipe || "-"}
                      </td>

                      <td className="px-4 py-3 text-white/60">
                        {formatDateTime(os.concluido_em)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <a
                          href={`/projetos/${os.projeto_id}/os/${os.os_id}/validacao`}
                          className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--fdl-cream)] px-5 text-xs font-bold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
                        >
                          Validar OS
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/55">
            Nenhuma OS aguardando validação para os filtros selecionados.
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <div className="mb-5">
            <h2 className="text-xl font-bold">Projetos em acompanhamento</h2>
            <p className="mt-1 text-sm text-white/55">
              Projetos ordenados por maior volume de OSs pendentes.
            </p>
          </div>

          <div className="space-y-4">
            {dados.projetos.length > 0 ? (
              dados.projetos.map((projeto) => {
                const total = projeto.total_os || 0;
                const progresso =
                  total > 0 ? Math.round((projeto.concluidas / total) * 100) : 0;

                return (
                  <article
                    key={projeto.projeto_id}
                    className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-[var(--fdl-cream)]">
                          {projeto.uf || "UF"} · Temporada{" "}
                          {projeto.temporada || "não informada"}
                        </p>

                        <h3 className="mt-2 text-lg font-bold text-white">
                          {projeto.cliente || projeto.shopping || "Projeto sem nome"}
                        </h3>

                        <p className="mt-2 text-sm text-white/50">
                          Gestor Comercial:{" "}
                          {projeto.responsavel_comercial || "Não informado"}
                        </p>

                        <p className="mt-1 text-sm text-white/50">
                          Último registro: {formatDateTime(projeto.ult_registro)}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          projeto.status
                        )}`}
                      >
                        {formatStatus(projeto.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Total OSs</p>
                        <p className="mt-1 font-semibold text-white">
                          {projeto.total_os}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Pendentes</p>
                        <p className="mt-1 font-semibold text-white">
                          {projeto.pendentes}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Andamento</p>
                        <p className="mt-1 font-semibold text-white">
                          {projeto.em_andamento}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Progresso</p>
                        <p className="mt-1 font-semibold text-white">
                          {progresso}%
                        </p>
                      </div>
                    </div>

                    <a
                      href={`/projetos/${projeto.projeto_id}`}
                      className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
                    >
                      Abrir projeto
                    </a>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/50">
                Nenhum projeto encontrado para os filtros selecionados.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <div className="mb-5">
            <h2 className="text-xl font-bold">Últimos registros</h2>
            <p className="mt-1 text-sm text-white/55">
              Últimas atualizações enviadas pelos montadores.
            </p>
          </div>

          <div className="space-y-4">
            {dados.ultimos_registros.length > 0 ? (
              dados.ultimos_registros.map((registro) => (
                <article
                  key={registro.registro_id}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${tipoRegistroClass(
                          registro.tipo_registro
                        )}`}
                      >
                        {formatTipoRegistro(registro.tipo_registro)}
                      </span>

                      <h3 className="mt-3 text-sm font-bold text-white">
                        {registro.cliente || registro.shopping} · OS{" "}
                        {registro.codigo_os || "sem código"}
                      </h3>

                      <p className="mt-1 text-xs text-white/45">
                        {formatDateTime(registro.criado_em)} ·{" "}
                        {registro.usuario_nome || "Usuário não identificado"}
                      </p>
                    </div>

                    <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                      {registro.percentual_execucao ?? 0}%
                    </span>
                  </div>

                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/70">
                    {registro.descricao || "Sem descrição informada."}
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-white/45">
                      {registro.total_arquivos} arquivo(s) vinculado(s)
                    </p>

                    {registro.os_id ? (
                      <a
                        href={`/projetos/${registro.projeto_id}/os/${registro.os_id}`}
                        className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
                      >
                        Ver OS
                      </a>
                    ) : (
                      <a
                        href={`/projetos/${registro.projeto_id}`}
                        className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
                      >
                        Ver projeto
                      </a>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/50">
                Nenhum registro encontrado para os filtros selecionados.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
