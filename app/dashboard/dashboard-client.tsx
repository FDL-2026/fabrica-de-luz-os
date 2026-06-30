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
  aguardando_validacao: number;
  concluidas: number;
  ult_registro: string | null;
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
  oss_aguardando_validacao: OsValidacaoDashboard[];
  ultimos_registros: RegistroDashboard[];
  filtros: DashboardFiltros;
};

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
  oss_aguardando_validacao: [],
  ultimos_registros: [],
  filtros: {
    gestores_comerciais: [],
    projetos_opcoes: [],
  },
};

const statusOperacionalOptions = [
  { value: "", label: "Todos" },
  { value: "com_validacao", label: "Com validação pendente" },
  { value: "em_andamento", label: "Com OS em andamento" },
  { value: "com_pendencias", label: "Com OS pendente" },
  { value: "sem_registro", label: "Sem movimentação" },
  { value: "concluido", label: "Concluído" },
];

function formatDateTime(date: string | null) {
  if (!date) return "Sem registro";

  return new Date(date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
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

  return labels[tipo] ?? tipo.replaceAll("_", " ");
}

function tipoRegistroClass(tipo: string | null) {
  switch (tipo) {
    case "pendencia":
      return "fdl-chip-red";

    case "conclusao_os":
      return "fdl-chip-green";

    case "inicio_os":
      return "fdl-chip-blue";

    case "anexo":
      return "fdl-chip-purple";

    default:
      return "fdl-chip-muted";
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

function progressoProjeto(projeto: ProjetoDashboard) {
  if (!projeto.total_os) return 0;

  return Math.round((projeto.concluidas / projeto.total_os) * 100);
}

function statusOperacionalProjeto(projeto: ProjetoDashboard) {
  if (projeto.aguardando_validacao > 0) return "com_validacao";
  if (projeto.em_andamento > 0) return "em_andamento";
  if (projeto.pendentes > 0) return "com_pendencias";
  if (!projeto.ult_registro) return "sem_registro";

  if (projeto.total_os > 0 && projeto.concluidas >= projeto.total_os) {
    return "concluido";
  }

  return "em_acompanhamento";
}

function statusOperacionalLabel(status: string) {
  const labels: Record<string, string> = {
    com_validacao: "Validação pendente",
    em_andamento: "Em andamento",
    com_pendencias: "Com pendências",
    sem_registro: "Sem movimentação",
    concluido: "Concluído",
    em_acompanhamento: "Em acompanhamento",
  };

  return labels[status] ?? status;
}

function statusOperacionalClass(status: string) {
  switch (status) {
    case "com_validacao":
      return "fdl-chip-yellow";

    case "em_andamento":
      return "fdl-chip-blue";

    case "com_pendencias":
      return "fdl-chip-orange";

    case "concluido":
      return "fdl-chip-green";

    case "sem_registro":
      return "fdl-chip-red";

    default:
      return "fdl-chip-muted";
  }
}

export default function DashboardClient() {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<DashboardData>(emptyDashboard);
  const [gestorSelecionado, setGestorSelecionado] = useState("");
  const [projetoSelecionado, setProjetoSelecionado] = useState("");
  const [ufSelecionada, setUfSelecionada] = useState("");
  const [statusOperacionalSelecionado, setStatusOperacionalSelecionado] =
    useState("");

  const progressoGeral = useMemo(() => {
    const total =
      dados.resumo.os_pendentes +
      dados.resumo.os_em_andamento +
      dados.resumo.os_aguardando_validacao +
      dados.resumo.os_concluidas;

    if (total === 0) return 0;

    return Math.round((dados.resumo.os_concluidas / total) * 100);
  }, [dados]);

  const projetosDisponiveisParaFiltro = useMemo(() => {
    if (!gestorSelecionado) {
      return dados.filtros.projetos_opcoes;
    }

    return dados.filtros.projetos_opcoes.filter(
      (projeto) => projeto.responsavel_comercial === gestorSelecionado
    );
  }, [dados.filtros.projetos_opcoes, gestorSelecionado]);

  const ufsDisponiveis = useMemo(() => {
    return Array.from(
      new Set(
        dados.projetos
          .map((projeto) => projeto.uf?.trim())
          .filter((uf): uf is string => Boolean(uf))
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [dados.projetos]);

  const projetosTabela = useMemo(() => {
    return dados.projetos.filter((projeto) => {
      const bateUf = !ufSelecionada || projeto.uf === ufSelecionada;

      const bateStatus =
        !statusOperacionalSelecionado ||
        statusOperacionalProjeto(projeto) === statusOperacionalSelecionado;

      return bateUf && bateStatus;
    });
  }, [dados.projetos, statusOperacionalSelecionado, ufSelecionada]);

  const filtrosAtivos = Boolean(
    gestorSelecionado ||
      projetoSelecionado ||
      ufSelecionada ||
      statusOperacionalSelecionado
  );

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

  function limparFiltros() {
    setGestorSelecionado("");
    setProjetoSelecionado("");
    setUfSelecionada("");
    setStatusOperacionalSelecionado("");
  }

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
            <h1 className="text-3xl font-bold">Central de controle</h1>
            <p className="mt-2 text-sm text-white/60">
              Acompanhe projetos, OSs, validações e movimentações da operação.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/projetos"
              className="fdl-btn fdl-btn-md fdl-btn-neutral"
            >
              Ver projetos
            </a>

            <a
              href="/importar"
              className="fdl-btn fdl-btn-md fdl-btn-primary"
            >
              Importar cronograma
            </a>
          </div>
        </div>

        <div className="mt-6 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 xl:grid-cols-[1fr_1fr_0.6fr_0.9fr_auto]">
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Gestor Comercial
            </label>

            <select
              value={gestorSelecionado}
              onChange={(event) => {
                setGestorSelecionado(event.target.value);
                setProjetoSelecionado("");
              }}
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

              {projetosDisponiveisParaFiltro.map((projeto) => (
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

          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              UF
            </label>

            <select
              value={ufSelecionada}
              onChange={(event) => setUfSelecionada(event.target.value)}
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)]"
            >
              <option className="text-black" value="">
                Todas
              </option>

              {ufsDisponiveis.map((uf) => (
                <option key={uf} className="text-black" value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Status operacional
            </label>

            <select
              value={statusOperacionalSelecionado}
              onChange={(event) =>
                setStatusOperacionalSelecionado(event.target.value)
              }
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)]"
            >
              {statusOperacionalOptions.map((status) => (
                <option
                  key={status.value}
                  className="text-black"
                  value={status.value}
                >
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={!filtrosAtivos}
              onClick={limparFiltros}
              className="fdl-btn fdl-btn-md fdl-btn-neutral w-full disabled:cursor-not-allowed disabled:opacity-40 xl:w-auto"
            >
              Limpar
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
          <p className="text-sm text-[#7d6488]">Validação</p>
          <strong className="mt-2 block text-4xl">
            {dados.resumo.os_aguardando_validacao}
          </strong>
          <p className="mt-2 text-xs text-[#7d6488]">aguardando gestor</p>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Concluídas</p>
          <strong className="mt-2 block text-4xl">
            {dados.resumo.os_concluidas}
          </strong>
          <p className="mt-2 text-xs text-[#7d6488]">aprovadas/finalizadas</p>
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
          <div className="mt-5 fdl-table-wrap">
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-sm fdl-data-table">
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
                          className="fdl-btn fdl-btn-sm fdl-btn-primary"
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

      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-bold">Tabela geral de projetos</h2>
            <p className="mt-1 text-sm text-white/55">
              Visão compacta para acompanhamento de grande volume de projetos.
            </p>
          </div>

          <span className="w-fit rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80">
            {projetosTabela.length} de {dados.projetos.length} projeto(s)
          </span>
        </div>

        {projetosTabela.length > 0 ? (
          <div className="fdl-table-wrap">
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full text-left text-sm fdl-data-table">
                <thead className="bg-white/10 text-white/70">
                  <tr>
                    <th className="px-4 py-3">Projeto</th>
                    <th className="px-4 py-3">UF</th>
                    <th className="px-4 py-3">Gestor Comercial</th>
                    <th className="px-4 py-3 text-center">Total</th>
                    <th className="px-4 py-3 text-center">Pend.</th>
                    <th className="px-4 py-3 text-center">And.</th>
                    <th className="px-4 py-3 text-center">Val.</th>
                    <th className="px-4 py-3 text-center">Conc.</th>
                    <th className="px-4 py-3">Progresso</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Último registro</th>
                    <th className="px-4 py-3 text-center">Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {projetosTabela.map((projeto) => {
                    const progresso = progressoProjeto(projeto);
                    const statusOperacional =
                      statusOperacionalProjeto(projeto);

                    return (
                      <tr
                        key={projeto.projeto_id}
                        className="border-t border-white/10"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white">
                            {projeto.cliente ||
                              projeto.shopping ||
                              "Projeto sem nome"}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            Temporada {projeto.temporada || "não informada"}
                          </p>
                        </td>

                        <td className="px-4 py-3 font-semibold text-white/75">
                          {projeto.uf || "-"}
                        </td>

                        <td className="px-4 py-3 text-white/70">
                          {projeto.responsavel_comercial || "Não informado"}
                        </td>

                        <td className="px-4 py-3 text-center font-bold text-white">
                          {projeto.total_os}
                        </td>

                        <td className="px-4 py-3 text-center text-yellow-100">
                          {projeto.pendentes}
                        </td>

                        <td className="px-4 py-3 text-center text-blue-100">
                          {projeto.em_andamento}
                        </td>

                        <td className="px-4 py-3 text-center text-yellow-100">
                          {projeto.aguardando_validacao}
                        </td>

                        <td className="px-4 py-3 text-center text-green-100">
                          {projeto.concluidas}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex min-w-[130px] items-center gap-3">
                            <div className="h-2 flex-1 rounded-full bg-white/10">
                              <div
                                className="h-2 rounded-full bg-[var(--fdl-cream)]"
                                style={{ width: `${progresso}%` }}
                              />
                            </div>
                            <span className="w-10 text-xs font-bold text-white">
                              {progresso}%
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`fdl-chip ${statusOperacionalClass(statusOperacional)}`}
                          >
                            {statusOperacionalLabel(statusOperacional)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-white/60">
                          {formatDateTime(projeto.ult_registro)}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <a
                            href={`/projetos/${projeto.projeto_id}`}
                            className="fdl-btn fdl-btn-sm fdl-btn-secondary"
                          >
                            Abrir
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/50">
            Nenhum projeto encontrado para os filtros selecionados.
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold">Últimos registros</h2>
          <p className="mt-1 text-sm text-white/55">
            Últimas atualizações enviadas pelos montadores.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
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
                      className="fdl-link text-sm"
                    >
                      Ver OS
                    </a>
                  ) : (
                    <a
                      href={`/projetos/${registro.projeto_id}`}
                      className="fdl-link text-sm"
                    >
                      Ver projeto
                    </a>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/50 xl:col-span-2">
              Nenhum registro encontrado para os filtros selecionados.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
