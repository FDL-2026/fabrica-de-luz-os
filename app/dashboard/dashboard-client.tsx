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
  { value: "com_validacao", label: "Validação pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "com_pendencias", label: "Com pendências" },
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

function nomeProjeto(projeto: {
  cliente: string | null;
  shopping: string | null;
  uf?: string | null;
}) {
  const nome = projeto.cliente || projeto.shopping || "Projeto sem nome";
  return projeto.uf ? `${nome} - ${projeto.uf}` : nome;
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

function statusBadgeClass(status: string) {
  switch (status) {
    case "com_validacao":
      return "fdl-ui-badge-yellow";
    case "em_andamento":
      return "fdl-ui-badge-blue";
    case "com_pendencias":
      return "fdl-ui-badge-orange";
    case "sem_registro":
      return "fdl-ui-badge-red";
    case "concluido":
      return "fdl-ui-badge-green";
    default:
      return "fdl-ui-badge-muted";
  }
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

function registroBadgeClass(tipo: string | null) {
  switch (tipo) {
    case "pendencia":
      return "fdl-ui-badge-red";
    case "conclusao_os":
      return "fdl-ui-badge-green";
    case "inicio_os":
      return "fdl-ui-badge-blue";
    case "anexo":
      return "fdl-ui-badge-purple";
    default:
      return "fdl-ui-badge-muted";
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
    if (!gestorSelecionado) return dados.filtros.projetos_opcoes;

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
      <div className="fdl-ui-section text-center text-white/60">
        Carregando dashboard operacional...
      </div>
    );
  }

  if (erro) {
    return <div className="fdl-alert fdl-alert-error">{erro}</div>;
  }

  return (
    <div className="fdl-ui-dashboard space-y-6">
      <header className="fdl-ui-panel fdl-ui-header">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="fdl-ui-kicker">Dashboard operacional</p>
            <h1 className="fdl-ui-title">Central de controle</h1>
            <p className="fdl-ui-description">
              Acompanhe projetos, OSs, validações e movimentações da operação.
            </p>
          </div>

          <div className="fdl-ui-actions xl:justify-end">
            <a href="/projetos" className="fdl-ui-btn fdl-ui-btn-secondary">
              Ver projetos
            </a>

            <a href="/importar" className="fdl-ui-btn fdl-ui-btn-primary">
              Importar cronograma
            </a>
          </div>
        </div>

        <div className="fdl-ui-filter-box">
          <div className="fdl-ui-filter-grid">
            <div>
              <label className="fdl-ui-label">Gestor Comercial</label>
              <select
                value={gestorSelecionado}
                onChange={(event) => {
                  setGestorSelecionado(event.target.value);
                  setProjetoSelecionado("");
                }}
                className="fdl-ui-select"
              >
                <option value="">Todos os gestores</option>

                {dados.filtros.gestores_comerciais.map((gestor) => (
                  <option key={gestor} value={gestor}>
                    {gestor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="fdl-ui-label">Projeto</label>
              <select
                value={projetoSelecionado}
                onChange={(event) => setProjetoSelecionado(event.target.value)}
                className="fdl-ui-select"
              >
                <option value="">Todos os projetos</option>

                {projetosDisponiveisParaFiltro.map((projeto) => (
                  <option key={projeto.projeto_id} value={projeto.projeto_id}>
                    {nomeProjeto(projeto)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="fdl-ui-label">UF</label>
              <select
                value={ufSelecionada}
                onChange={(event) => setUfSelecionada(event.target.value)}
                className="fdl-ui-select"
              >
                <option value="">Todas</option>

                {ufsDisponiveis.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="fdl-ui-label">Status operacional</label>
              <select
                value={statusOperacionalSelecionado}
                onChange={(event) =>
                  setStatusOperacionalSelecionado(event.target.value)
                }
                className="fdl-ui-select"
              >
                {statusOperacionalOptions.map((status) => (
                  <option key={status.value} value={status.value}>
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
                className="fdl-ui-btn fdl-ui-btn-ghost w-full xl:w-auto"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="fdl-ui-kpi-grid">
        <div className="fdl-ui-kpi">
          <p className="fdl-ui-kpi-label">Projetos ativos</p>
          <strong className="fdl-ui-kpi-value">
            {dados.resumo.projetos_ativos}
          </strong>
          <p className="fdl-ui-kpi-help">
            {dados.resumo.total_projetos} projeto(s) no filtro
          </p>
        </div>

        <div className="fdl-ui-kpi">
          <p className="fdl-ui-kpi-label">OSs pendentes</p>
          <strong className="fdl-ui-kpi-value">
            {dados.resumo.os_pendentes}
          </strong>
          <p className="fdl-ui-kpi-help">Aguardando execução</p>
        </div>

        <div className="fdl-ui-kpi">
          <p className="fdl-ui-kpi-label">Em andamento</p>
          <strong className="fdl-ui-kpi-value">
            {dados.resumo.os_em_andamento}
          </strong>
          <p className="fdl-ui-kpi-help">Em execução</p>
        </div>

        <div className="fdl-ui-kpi">
          <p className="fdl-ui-kpi-label">Validação</p>
          <strong className="fdl-ui-kpi-value">
            {dados.resumo.os_aguardando_validacao}
          </strong>
          <p className="fdl-ui-kpi-help">Aguardando gestor</p>
        </div>

        <div className="fdl-ui-kpi">
          <p className="fdl-ui-kpi-label">Concluídas</p>
          <strong className="fdl-ui-kpi-value">
            {dados.resumo.os_concluidas}
          </strong>
          <p className="fdl-ui-kpi-help">Aprovadas/finalizadas</p>
        </div>

        <div className="fdl-ui-kpi">
          <p className="fdl-ui-kpi-label">Progresso geral</p>
          <strong className="fdl-ui-kpi-value">{progressoGeral}%</strong>

          <div className="mt-4 h-2 rounded-full bg-[#eee7f3]">
            <div
              className="h-2 rounded-full bg-[var(--fdl-purple)]"
              style={{ width: `${progressoGeral}%` }}
            />
          </div>
        </div>
      </section>

      <section className="fdl-ui-section fdl-ui-section-warning">
        <div className="fdl-ui-section-head">
          <div>
            <p className="fdl-ui-kicker">Fila de validação</p>
            <h2 className="fdl-ui-section-title">OSs aguardando validação</h2>
            <p className="fdl-ui-section-desc">
              OSs concluídas pelos montadores e pendentes de aprovação do gestor.
            </p>
          </div>

          <span className="fdl-ui-badge fdl-ui-badge-yellow">
            {dados.resumo.os_aguardando_validacao} pendente(s)
          </span>
        </div>

        {dados.oss_aguardando_validacao.length > 0 ? (
          <div className="fdl-ui-table-wrap">
            <div className="fdl-ui-table-scroll">
              <table className="min-w-[1050px] fdl-ui-table">
                <thead>
                  <tr>
                    <th>Projeto</th>
                    <th>OS</th>
                    <th>Local</th>
                    <th>Serviço</th>
                    <th>Equipe</th>
                    <th>Concluída em</th>
                    <th className="text-right">Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {dados.oss_aguardando_validacao.map((os) => (
                    <tr key={os.os_id}>
                      <td>
                        <p className="fdl-ui-table-primary">
                          {os.cliente || os.shopping || "Projeto sem nome"}
                        </p>
                        <p className="fdl-ui-table-secondary">
                          {os.uf || "UF não informada"} · Gestor:{" "}
                          {os.responsavel_comercial || "Não informado"}
                        </p>
                      </td>

                      <td className="fdl-ui-table-primary">
                        {os.codigo_os || "-"}
                      </td>

                      <td className="text-white/74">{os.local || "-"}</td>
                      <td className="text-white/74">{os.servico || "-"}</td>
                      <td className="text-white/74">{os.equipe || "-"}</td>
                      <td className="text-white/58">
                        {formatDateTime(os.concluido_em)}
                      </td>

                      <td className="text-right">
                        <a
                          href={`/projetos/${os.projeto_id}/os/${os.os_id}/validacao`}
                          className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-primary"
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
          <div className="fdl-ui-empty">
            Nenhuma OS aguardando validação para os filtros selecionados.
          </div>
        )}
      </section>

      <section className="fdl-ui-section">
        <div className="fdl-ui-section-head mb-5">
          <div>
            <h2 className="fdl-ui-section-title">Tabela geral de projetos</h2>
            <p className="fdl-ui-section-desc">
              Visão compacta para acompanhamento de grande volume de projetos.
            </p>
          </div>

          <span className="fdl-ui-badge fdl-ui-badge-muted">
            {projetosTabela.length} de {dados.projetos.length} projeto(s)
          </span>
        </div>

        {projetosTabela.length > 0 ? (
          <div className="fdl-ui-table-wrap mt-0">
            <div className="fdl-ui-table-scroll">
              <table className="min-w-[1280px] fdl-ui-table">
                <thead>
                  <tr>
                    <th>Projeto</th>
                    <th>UF</th>
                    <th>Gestor Comercial</th>
                    <th className="text-center">Total</th>
                    <th className="text-center">Pend.</th>
                    <th className="text-center">And.</th>
                    <th className="text-center">Val.</th>
                    <th className="text-center">Conc.</th>
                    <th>Progresso</th>
                    <th>Status</th>
                    <th>Último registro</th>
                    <th className="text-right">Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {projetosTabela.map((projeto) => {
                    const progresso = progressoProjeto(projeto);
                    const statusOperacional =
                      statusOperacionalProjeto(projeto);

                    return (
                      <tr key={projeto.projeto_id}>
                        <td>
                          <p className="fdl-ui-table-primary">
                            {projeto.cliente ||
                              projeto.shopping ||
                              "Projeto sem nome"}
                          </p>
                          <p className="fdl-ui-table-secondary">
                            Temporada {projeto.temporada || "não informada"}
                          </p>
                        </td>

                        <td className="font-bold text-white/80">
                          {projeto.uf || "-"}
                        </td>

                        <td className="text-white/70">
                          {projeto.responsavel_comercial || "Não informado"}
                        </td>

                        <td className="text-center font-black text-white">
                          {projeto.total_os}
                        </td>

                        <td className="text-center text-yellow-100">
                          {projeto.pendentes}
                        </td>

                        <td className="text-center text-blue-100">
                          {projeto.em_andamento}
                        </td>

                        <td className="text-center text-yellow-100">
                          {projeto.aguardando_validacao}
                        </td>

                        <td className="text-center text-green-100">
                          {projeto.concluidas}
                        </td>

                        <td>
                          <div className="flex min-w-[135px] items-center gap-3">
                            <div className="fdl-ui-progress">
                              <div
                                className="fdl-ui-progress-fill"
                                style={{ width: `${progresso}%` }}
                              />
                            </div>
                            <span className="w-10 text-xs font-black text-white">
                              {progresso}%
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`fdl-ui-badge ${statusBadgeClass(
                              statusOperacional
                            )}`}
                          >
                            {statusOperacionalLabel(statusOperacional)}
                          </span>
                        </td>

                        <td className="text-white/58">
                          {formatDateTime(projeto.ult_registro)}
                        </td>

                        <td className="text-right">
                          <a
                            href={`/projetos/${projeto.projeto_id}`}
                            className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-secondary"
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
          <div className="fdl-ui-empty">
            Nenhum projeto encontrado para os filtros selecionados.
          </div>
        )}
      </section>

      <section className="fdl-ui-section">
        <div className="mb-5">
          <h2 className="fdl-ui-section-title">Últimos registros</h2>
          <p className="fdl-ui-section-desc">
            Últimas atualizações enviadas pelos montadores.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {dados.ultimos_registros.length > 0 ? (
            dados.ultimos_registros.map((registro) => (
              <article
                key={registro.registro_id}
                className="rounded-3xl border border-white/10 bg-white/[0.045] p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <span
                      className={`fdl-ui-badge ${registroBadgeClass(
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

                  <span className="fdl-ui-badge fdl-ui-badge-muted">
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
                      className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-secondary"
                    >
                      Ver OS
                    </a>
                  ) : (
                    <a
                      href={`/projetos/${registro.projeto_id}`}
                      className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-secondary"
                    >
                      Ver projeto
                    </a>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="fdl-ui-empty xl:col-span-2">
              Nenhum registro encontrado para os filtros selecionados.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
