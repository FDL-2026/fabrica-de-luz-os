"use client";

import { useMemo, useState } from "react";
import ProgressoPonderadoCardProjeto from "@/components/progresso/progresso-ponderado-card-projeto";
import { ehSomenteLeitura } from "@/lib/perfis";

type ProjetoLista = {
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
  is_chave?: boolean | null;
};

type ProjetosClientProps = {
  projetos: ProjetoLista[];
  usuarioPerfil?: string;
};

const statusOptions = [
  { value: "", label: "Todos os status" },
  { value: "planejamento", label: "Planejamento" },
  { value: "em_montagem", label: "Em montagem" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

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

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function ProjetosListaClient({
  projetos,
  usuarioPerfil = "",
}: ProjetosClientProps) {
  const somenteLeitura = ehSomenteLeitura(usuarioPerfil);
  const [busca, setBusca] = useState("");
  const [visao, setVisao] = useState<"cards" | "tabela">("cards");
  const [ufFiltro, setUfFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [gestorFiltro, setGestorFiltro] = useState("");

  const ufsDisponiveis = useMemo(() => {
    return Array.from(
      new Set(
        projetos
          .map((projeto) => projeto.uf?.trim())
          .filter((uf): uf is string => Boolean(uf))
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [projetos]);

  const gestoresDisponiveis = useMemo(() => {
    return Array.from(
      new Set(
        projetos
          .map((projeto) => projeto.responsavel_comercial?.trim())
          .filter((gestor): gestor is string => Boolean(gestor))
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [projetos]);

  const projetosFiltrados = useMemo(() => {
    const termo = normalizar(busca.trim());

    return projetos.filter((projeto) => {
      if (termo) {
        const alvo = normalizar(
          [projeto.cliente, projeto.shopping, projeto.cidade]
            .filter(Boolean)
            .join(" ")
        );

        if (!alvo.includes(termo)) return false;
      }

      if (ufFiltro && projeto.uf !== ufFiltro) return false;
      if (statusFiltro && projeto.status !== statusFiltro) return false;
      if (gestorFiltro && projeto.responsavel_comercial !== gestorFiltro) {
        return false;
      }

      return true;
    });
  }, [projetos, busca, ufFiltro, statusFiltro, gestorFiltro]);

  const filtrosAtivos = Boolean(
    busca.trim() || ufFiltro || statusFiltro || gestorFiltro
  );

  function limparFiltros() {
    setBusca("");
    setUfFiltro("");
    setStatusFiltro("");
    setGestorFiltro("");
  }

  return (
    <section className="mt-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Projetos cadastrados</h2>
          <p className="mt-1 text-sm text-white/50">
            Clique em um projeto para abrir o acompanhamento detalhado.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="fdl-ui-subtle-count">
            {projetosFiltrados.length} de {projetos.length} projeto(s)
          </span>

          <div className="flex overflow-hidden rounded-full border border-white/15">
            <button
              type="button"
              onClick={() => setVisao("cards")}
              aria-pressed={visao === "cards"}
              className={`px-4 py-2 text-xs font-bold transition ${
                visao === "cards"
                  ? "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setVisao("tabela")}
              aria-pressed={visao === "tabela"}
              className={`px-4 py-2 text-xs font-bold transition ${
                visao === "tabela"
                  ? "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              Tabela
            </button>
          </div>
        </div>
      </div>

      <div className="fdl-ui-filter-box mt-0">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.6fr_0.6fr_1fr_1fr_auto] xl:items-end">
          <div>
            <label className="fdl-ui-label">Buscar projeto</label>
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Cliente, shopping ou cidade..."
              className="fdl-field"
            />
          </div>

          <div>
            <label className="fdl-ui-label">UF</label>
            <select
              value={ufFiltro}
              onChange={(event) => setUfFiltro(event.target.value)}
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
            <label className="fdl-ui-label">Status</label>
            <select
              value={statusFiltro}
              onChange={(event) => setStatusFiltro(event.target.value)}
              className="fdl-ui-select"
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="fdl-ui-label">Gestor Comercial</label>
            <select
              value={gestorFiltro}
              onChange={(event) => setGestorFiltro(event.target.value)}
              className="fdl-ui-select"
            >
              <option value="">Todos os gestores</option>

              {gestoresDisponiveis.map((gestor) => (
                <option key={gestor} value={gestor}>
                  {gestor}
                </option>
              ))}
            </select>
          </div>

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

      <div className="mt-6">
        {projetosFiltrados.length > 0 && visao === "tabela" ? (
          <div className="fdl-ui-table-wrap mt-0">
            <div className="fdl-ui-table-scroll">
              <table className="min-w-[860px] fdl-ui-table">
                <thead>
                  <tr>
                    <th>Projeto</th>
                    <th>UF</th>
                    <th>Status</th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Gestor Comercial</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {projetosFiltrados.map((projeto) => (
                    <tr key={projeto.id}>
                      <td>
                        <p className="fdl-ui-table-primary">
                          {projeto.cliente || projeto.shopping}
                          {projeto.is_chave ? (
                            <span
                              className="ml-2 inline-block rounded-full bg-[var(--fdl-cream)] px-2 py-0.5 align-middle text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--fdl-purple-dark)]"
                              title="Projeto-chave com mundos (microprojetos)"
                            >
                              Projeto-chave
                            </span>
                          ) : null}
                        </p>
                        <p className="fdl-ui-table-secondary">
                          {[projeto.cidade, projeto.temporada]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </td>
                      <td className="font-bold text-white/80">
                        {projeto.uf || "-"}
                      </td>
                      <td>
                        <span
                          className={`fdl-ui-badge ${statusClass(projeto.status)}`}
                        >
                          {formatStatus(projeto.status)}
                        </span>
                      </td>
                      <td className="text-white/70">
                        {formatDate(projeto.data_inicio)}
                      </td>
                      <td className="text-white/70">
                        {formatDate(projeto.data_fim)}
                      </td>
                      <td className="text-white/70">
                        {projeto.responsavel_comercial || "-"}
                      </td>
                      <td className="text-right">
                        <div className="fdl-ui-table-actions">
                          <a
                            href={`/projetos/${projeto.id}`}
                            className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-secondary"
                          >
                            Abrir
                          </a>
                          {!somenteLeitura ? (
                            <a
                              href={`/projetos/${projeto.id}/cronograma`}
                              className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-ghost"
                            >
                              Cronograma
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : projetosFiltrados.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {projetosFiltrados.map((projeto) => (
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
                      {[projeto.cidade, projeto.uf].filter(Boolean).join(" · ")}
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

                  {!somenteLeitura ? (
                    <a
                      href={`/projetos/${projeto.id}/cronograma`}
                      className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      Cronograma
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-10 text-center">
            <p className="text-lg font-semibold">
              {filtrosAtivos
                ? "Nenhum projeto encontrado para os filtros selecionados."
                : "Nenhum projeto encontrado."}
            </p>
            <p className="mt-2 text-sm text-white/50">
              {filtrosAtivos
                ? "Ajuste a busca ou limpe os filtros para ver todos os projetos."
                : "Importe um cronograma ou cadastre um projeto para começar."}
            </p>

            {filtrosAtivos ? (
              <button
                type="button"
                onClick={limparFiltros}
                className="fdl-ui-btn fdl-ui-btn-ghost mt-5"
              >
                Limpar filtros
              </button>
            ) : !somenteLeitura ? (
              <a href="/importar" className="fdl-ui-btn fdl-ui-btn-primary mt-5">
                Importar cronograma
              </a>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
