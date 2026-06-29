"use client";

import { useMemo, useState } from "react";

type OrdemServico = {
  id: string;
  codigo_os: string | null;
  codigo_cronograma?: string | null;
  local: string | null;
  servico: string | null;
  equipe: string | null;
  status: string | null;
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
  { value: "concluido", label: "Concluído" },
  { value: "cancelada", label: "Cancelada" },
  { value: "cancelado", label: "Cancelado" },
  { value: "bloqueada", label: "Bloqueada" },
  { value: "atrasada", label: "Atrasada" },
];

function formatStatus(status: string | null) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    em_andamento: "Em andamento",
    aguardando_validacao: "Aguardando validação",
    concluida: "Concluída",
    concluido: "Concluído",
    cancelada: "Cancelada",
    cancelado: "Cancelado",
    bloqueada: "Bloqueada",
    atrasada: "Atrasada",
    pausada: "Pausada",
    pausado: "Pausado",
  };

  if (!status) return "Sem status";

  return labels[status] ?? status.replaceAll("_", " ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "concluida":
    case "concluido":
      return "bg-green-100 text-green-700";

    case "em_andamento":
      return "bg-blue-100 text-blue-700";

    case "aguardando_validacao":
    case "pendente":
      return "bg-yellow-100 text-yellow-700";

    case "cancelada":
    case "cancelado":
    case "bloqueada":
    case "atrasada":
      return "bg-red-100 text-red-700";

    default:
      return "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]";
  }
}

function normalizar(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function OsTableClient({
  projetoId,
  ordensServico,
}: OsTableClientProps) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [equipeFiltro, setEquipeFiltro] = useState("");

  const equipes = useMemo(() => {
    return Array.from(
      new Set(
        ordensServico
          .map((os) => os.equipe?.trim())
          .filter((equipe): equipe is string => Boolean(equipe))
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [ordensServico]);

  const ordensFiltradas = useMemo(() => {
    const termo = normalizar(busca);

    return ordensServico.filter((os) => {
      const codigo = os.codigo_cronograma || os.codigo_os || "";

      const bateBusca =
        !termo ||
        normalizar(codigo).includes(termo) ||
        normalizar(os.local).includes(termo) ||
        normalizar(os.servico).includes(termo);

      const bateStatus = !statusFiltro || os.status === statusFiltro;

      const bateEquipe = !equipeFiltro || os.equipe === equipeFiltro;

      return bateBusca && bateStatus && bateEquipe;
    });
  }, [busca, equipeFiltro, ordensServico, statusFiltro]);

  const filtrosAtivos = Boolean(busca || statusFiltro || equipeFiltro);

  function limparFiltros() {
    setBusca("");
    setStatusFiltro("");
    setEquipeFiltro("");
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold">Ordens de serviço</h2>
          <p className="mt-1 text-sm text-white/55">
            Busque e filtre as OSs por status, equipe, local ou serviço.
          </p>
        </div>

        <span className="w-fit rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80">
          {ordensFiltradas.length} de {ordensServico.length} OS(s)
        </span>
      </div>

      <div className="mt-5 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto]">
        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            Buscar
          </label>

          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Código, local ou serviço"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            Status
          </label>

          <select
            value={statusFiltro}
            onChange={(event) => setStatusFiltro(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)]"
          >
            {statusOptions.map((status) => (
              <option key={status.value} className="text-black" value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            Equipe
          </label>

          <select
            value={equipeFiltro}
            onChange={(event) => setEquipeFiltro(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)]"
          >
            <option className="text-black" value="">
              Todas as equipes
            </option>

            {equipes.map((equipe) => (
              <option key={equipe} className="text-black" value={equipe}>
                {equipe}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            disabled={!filtrosAtivos}
            onClick={limparFiltros}
            className="h-12 w-full rounded-2xl border border-white/15 px-5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
          >
            Limpar
          </button>
        </div>
      </div>

      {ordensFiltradas.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-white/10 text-white/70">
                <tr>
                  <th className="px-4 py-3">OS</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Serviço</th>
                  <th className="px-4 py-3">Equipe</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>

              <tbody>
                {ordensFiltradas.map((os) => (
                  <tr key={os.id} className="border-t border-white/10">
                    <td className="px-4 py-3 font-bold text-white">
                      {os.codigo_cronograma || os.codigo_os || "-"}
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

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          os.status
                        )}`}
                      >
                        {formatStatus(os.status)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-center gap-2">
                        <a
                          href={`/projetos/${projetoId}/os/${os.id}`}
                          className="inline-flex h-8 w-[86px] items-center justify-center whitespace-nowrap rounded-full bg-[var(--fdl-lilac)] px-3 text-xs font-semibold leading-none text-[var(--fdl-purple-dark)] transition hover:bg-white"
                        >
                          Detalhes
                        </a>

                        {os.status === "aguardando_validacao" ? (
                          <a
                            href={`/projetos/${projetoId}/os/${os.id}/validacao`}
                            className="inline-flex h-8 w-[78px] items-center justify-center whitespace-nowrap rounded-full bg-[var(--fdl-cream)] px-3 text-xs font-semibold leading-none text-[var(--fdl-purple-dark)] transition hover:brightness-95"
                          >
                            Validar
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
      ) : (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/50">
          Nenhuma OS encontrada para os filtros selecionados.
        </div>
      )}
    </section>
  );
}
