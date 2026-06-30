"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OrdemServico = {
  id: string;
  codigo_os: string | null;
  codigo_cronograma?: string | null;
  local: string | null;
  servico: string | null;
  equipe: string | null;
  status: string | null;
  status_validacao?: string | null;
};

type OsTableClientProps = {
  projetoId: string;
  ordensServico: OrdemServico[];
};

const statusOptions = [
  { value: "", label: "Todos os status" },
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando_validacao", label: "Aguardando validação" },
  { value: "concluida", label: "Concluída" },
];

function formatStatus(status: string | null) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    em_andamento: "Em andamento",
    aguardando_validacao: "Aguardando validação",
    concluida: "Concluída",
    concluido: "Concluída",
  };

  if (!status) return "Sem status";

  return labels[status] ?? status.replaceAll("_", " ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "pendente":
      return "fdl-ui-status-pendente";

    case "em_andamento":
      return "fdl-ui-status-andamento";

    case "aguardando_validacao":
      return "fdl-ui-status-validacao";

    case "concluida":
    case "concluido":
      return "fdl-ui-status-concluida";

    default:
      return "fdl-ui-status-neutro";
  }
}

function codigoOs(os: OrdemServico) {
  return os.codigo_cronograma || os.codigo_os || "Sem código";
}

export default function OsTableClient({
  projetoId,
  ordensServico,
}: OsTableClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [statusFiltro, setStatusFiltro] = useState("");
  const [podeValidarProjeto, setPodeValidarProjeto] = useState(false);

  const ordensFiltradas = useMemo(() => {
    if (!statusFiltro) return ordensServico;

    return ordensServico.filter((os) => os.status === statusFiltro);
  }, [ordensServico, statusFiltro]);

  const filtrosAtivos = Boolean(statusFiltro);

  useEffect(() => {
    async function carregarPermissaoValidacao() {
      const { data } = await supabase.rpc("fdl_usuario_pode_validar_projeto", {
        p_projeto_id: projetoId,
      });

      setPodeValidarProjeto(Boolean(data));
    }

    carregarPermissaoValidacao();
  }, [projetoId, supabase]);

  function limparFiltros() {
    setStatusFiltro("");
  }

  return (
    <section className="fdl-ui-page-block">
      <div className="fdl-ui-section-head">
        <div>
          <h2 className="fdl-ui-section-title">Ordens de serviço</h2>
          <p className="fdl-ui-section-desc">
            Filtre as OSs pelo status atual da execução.
          </p>
        </div>

        <span className="fdl-ui-subtle-count">
          {ordensFiltradas.length} de {ordensServico.length} OS(s)
        </span>
      </div>

      <div className="fdl-ui-project-toolbar">
        <div className="fdl-ui-project-toolbar-grid">
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

          <div className="flex items-end justify-end">
            <button
              type="button"
              disabled={!filtrosAtivos}
              onClick={limparFiltros}
              className="fdl-ui-btn fdl-ui-btn-ghost w-full md:w-auto"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {ordensFiltradas.length > 0 ? (
        <div className="fdl-ui-table-wrap">
          <div className="fdl-ui-table-scroll">
            <table className="min-w-[980px] fdl-ui-table">
              <thead>
                <tr>
                  <th>OS</th>
                  <th>Local</th>
                  <th>Serviço</th>
                  <th>Equipe</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>

              <tbody>
                {ordensFiltradas.map((os) => {
                  const podeValidarOs =
                    podeValidarProjeto && os.status === "aguardando_validacao";

                  return (
                    <tr key={os.id}>
                      <td className="fdl-ui-table-primary">{codigoOs(os)}</td>

                      <td className="text-white/74">{os.local || "-"}</td>

                      <td className="text-white/74">{os.servico || "-"}</td>

                      <td className="text-white/74">{os.equipe || "-"}</td>

                      <td>
                        <span
                          className={`fdl-ui-badge ${statusClass(os.status)}`}
                        >
                          {formatStatus(os.status)}
                        </span>
                      </td>

                      <td>
                        <div className="fdl-ui-table-actions">
                          <a
                            href={`/projetos/${projetoId}/os/${os.id}`}
                            className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-secondary"
                          >
                            Detalhes
                          </a>

                          {podeValidarOs ? (
                            <a
                              href={`/projetos/${projetoId}/os/${os.id}/validacao`}
                              className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-primary"
                            >
                              Validar
                            </a>
                          ) : null}
                        </div>
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
          Nenhuma OS encontrada para o filtro selecionado.
        </div>
      )}
    </section>
  );
}
