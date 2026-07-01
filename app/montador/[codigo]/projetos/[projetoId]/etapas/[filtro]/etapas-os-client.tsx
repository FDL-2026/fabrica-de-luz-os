"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FiltroOs = "todas" | "pendentes" | "andamento" | "validacao" | "concluidas";

type EtapasOsClientProps = {
  codigo: string;
  projetoId: string;
  filtro: string;
};

type OsMontador = {
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
  projeto_status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  os_id: string;
  codigo_os: string | null;
  codigo_cronograma: string | null;
  etapa_nome: string | null;
  servico: string | null;
  local: string | null;
  equipe: string | null;
  os_status: string | null;
  inicio_previsto: string | null;
  termino_previsto: string | null;
  progresso: number | null;
};

type GrupoEtapa = {
  chave: string;
  codigo: string;
  titulo: string;
  inicio: string | null;
  termino: string | null;
  status: string | null;
  oss: OsMontador[];
};

const filtrosValidos: FiltroOs[] = [
  "todas",
  "pendentes",
  "andamento",
  "validacao",
  "concluidas",
];

const filtroLabels: Record<FiltroOs, string> = {
  todas: "Todas as OSs",
  pendentes: "OSs pendentes",
  andamento: "OSs em andamento",
  validacao: "OSs aguardando validação",
  concluidas: "OSs concluídas",
};

function filtroNormalizado(value: string): FiltroOs {
  return filtrosValidos.includes(value as FiltroOs)
    ? (value as FiltroOs)
    : "todas";
}

function formatDate(date: string | null) {
  if (!date) return "Não informado";

  const onlyDate = String(date).split("T")[0];
  const parts = onlyDate.split("-");

  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Não informado";
  }

  return parsed.toLocaleDateString("pt-BR");
}

function formatStatus(status: string | null) {
  if (!status) return "Sem status";

  const labels: Record<string, string> = {
    planejamento: "Planejamento",
    em_montagem: "Em montagem",
    pausado: "Pausado",
    concluido: "Concluído",
    cancelado: "Cancelado",
    pendente: "Pendente",
    em_andamento: "Em andamento",
    aguardando_validacao: "Aguardando validação",
    ajuste_solicitado: "Ajuste solicitado",
    concluida: "Concluída",
    aprovada: "Aprovada",
    bloqueada: "Bloqueada",
    atrasada: "Atrasada",
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "em_montagem":
    case "em_andamento":
      return "bg-green-100 text-green-700";

    case "aguardando_validacao":
      return "bg-amber-100 text-amber-800";

    case "planejamento":
    case "prevista":
      return "bg-blue-100 text-blue-700";

    case "pausado":
    case "pendente":
      return "bg-yellow-100 text-yellow-700";

    case "concluido":
    case "concluida":
    case "aprovada":
      return "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]";

    case "ajuste_solicitado":
    case "cancelado":
    case "bloqueada":
    case "atrasada":
      return "bg-red-100 text-red-700";

    default:
      return "bg-white/20 text-white";
  }
}

function codigoOs(os: OsMontador) {
  return os.codigo_cronograma || os.codigo_os || "sem código";
}

function codigoMae(os: OsMontador) {
  const codigo = String(os.codigo_cronograma || os.codigo_os || "").trim();

  if (codigo.includes(".")) {
    return codigo.split(".")[0];
  }

  if (os.etapa_nome) {
    return os.etapa_nome;
  }

  return codigo || os.os_id;
}

function dataTime(value: string | null) {
  if (!value) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.getTime();
}

function menorData(values: (string | null)[]) {
  const datas = values
    .map((value) => ({ value, time: dataTime(value) }))
    .filter((item): item is { value: string; time: number } => item.time !== null)
    .sort((a, b) => a.time - b.time);

  return datas[0]?.value ?? null;
}

function maiorData(values: (string | null)[]) {
  const datas = values
    .map((value) => ({ value, time: dataTime(value) }))
    .filter((item): item is { value: string; time: number } => item.time !== null)
    .sort((a, b) => b.time - a.time);

  return datas[0]?.value ?? null;
}

function statusDoGrupo(oss: OsMontador[]) {
  const statuses = oss.map((os) => os.os_status ?? "");

  if (statuses.some((status) => status === "ajuste_solicitado")) {
    return "ajuste_solicitado";
  }

  if (statuses.some((status) => status === "aguardando_validacao")) {
    return "aguardando_validacao";
  }

  if (statuses.some((status) => status === "em_andamento")) {
    return "em_andamento";
  }

  if (
    oss.length > 0 &&
    statuses.every((status) =>
      ["concluida", "concluido", "aprovada"].includes(status)
    )
  ) {
    return "concluida";
  }

  if (statuses.some((status) => status === "pendente")) {
    return "pendente";
  }

  return statuses[0] || null;
}

function passaNoFiltro(os: OsMontador, filtro: FiltroOs) {
  if (filtro === "todas") return true;

  if (filtro === "pendentes") {
    return os.os_status === "pendente";
  }

  if (filtro === "andamento") {
    return os.os_status === "em_andamento";
  }

  if (filtro === "validacao") {
    return os.os_status === "aguardando_validacao";
  }

  if (filtro === "concluidas") {
    return ["concluida", "concluido", "aprovada"].includes(os.os_status ?? "");
  }

  return true;
}

function agruparPorEtapa(ordens: OsMontador[]) {
  const mapa = new Map<string, OsMontador[]>();

  for (const os of ordens) {
    const chave = codigoMae(os);
    const grupoAtual = mapa.get(chave) ?? [];
    grupoAtual.push(os);
    mapa.set(chave, grupoAtual);
  }

  const grupos: GrupoEtapa[] = Array.from(mapa.entries()).map(
    ([chave, oss]) => {
      const primeira = oss[0];
      const codigo = String(chave);
      const titulo =
        primeira.etapa_nome ||
        (codigo.includes(".") ? `OS ${codigo}` : `Etapa ${codigo}`);

      return {
        chave,
        codigo,
        titulo,
        inicio: menorData(oss.map((os) => os.inicio_previsto)),
        termino: maiorData(oss.map((os) => os.termino_previsto)),
        status: statusDoGrupo(oss),
        oss: [...oss].sort((a, b) =>
          String(codigoOs(a)).localeCompare(String(codigoOs(b)), "pt-BR", {
            numeric: true,
          })
        ),
      };
    }
  );

  return grupos.sort((a, b) =>
    a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })
  );
}

function lerMontadorSession() {
  try {
    const raw = sessionStorage.getItem("fdl_montador");

    if (!raw) return null;

    return JSON.parse(raw) as {
      usuarioId?: string;
      nome?: string;
      codigo?: string;
    };
  } catch {
    return null;
  }
}

export default function EtapasOsClient({
  codigo,
  projetoId,
  filtro,
}: EtapasOsClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const filtroAtual = filtroNormalizado(filtro);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ordens, setOrdens] = useState<OsMontador[]>([]);
  const [montadorNome, setMontadorNome] = useState("");
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);

  const projeto = ordens[0] ?? null;

  const ordensFiltradas = useMemo(
    () => ordens.filter((os) => passaNoFiltro(os, filtroAtual)),
    [ordens, filtroAtual]
  );

  const grupos = useMemo(
    () => agruparPorEtapa(ordensFiltradas),
    [ordensFiltradas]
  );

  useEffect(() => {
    async function carregarOs() {
      setCarregando(true);
      setErro("");

      const montador = lerMontadorSession();

      if (!montador?.usuarioId) {
        setErro("Acesso expirado. Volte e informe o PIN novamente.");
        setCarregando(false);
        return;
      }

      if (montador?.codigo?.toUpperCase() !== codigo.toUpperCase()) {
        sessionStorage.removeItem("fdl_montador");
        setErro("Código de montador divergente. Informe o PIN novamente.");
        setCarregando(false);
        return;
      }

      setMontadorNome(montador.nome ?? "Montador");

      const { data, error } = await supabase.rpc("listar_os_montador", {
        p_usuario_id: montador.usuarioId,
        p_projeto_id: projetoId,
      });

      if (error) {
        setErro(error.message);
        setOrdens([]);
        setCarregando(false);
        return;
      }

      setOrdens((data ?? []) as OsMontador[]);
      setCarregando(false);
    }

    carregarOs();
  }, [codigo, projetoId, supabase]);

  if (carregando) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center text-white/60">
        Carregando OSs...
      </div>
    );
  }

  if (erro) {
    return (
      <div className="space-y-5">
        <div className="fdl-alert fdl-alert-error">{erro}</div>

        <a
          href={`/montador/${codigo}`}
          className="block h-12 rounded-2xl bg-[var(--fdl-cream)] px-5 py-3 text-center text-sm font-semibold text-[var(--fdl-purple-dark)]"
        >
          Voltar para acesso com PIN
        </a>
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
          Nenhuma OS encontrada para este projeto ou montador sem vínculo.
        </div>

        <a
          href={`/montador/${codigo}`}
          className="block h-12 rounded-2xl bg-[var(--fdl-cream)] px-5 py-3 text-center text-sm font-semibold text-[var(--fdl-purple-dark)]"
        >
          Voltar para meus projetos
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="fdl-form-card p-6">
        <a
          href={`/montador/${codigo}/projetos/${projetoId}`}
          className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
        >
          ← Voltar para o painel do projeto
        </a>

        <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          {filtroLabels[filtroAtual]}
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          {projeto.cliente || projeto.shopping}
        </h1>

        <p className="mt-2 text-sm text-white/60">
          {projeto.uf} · Temporada {projeto.temporada} · {montadorNome}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
              projeto.projeto_status
            )}`}
          >
            {formatStatus(projeto.projeto_status)}
          </span>

          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
            {grupos.length} etapa(s) · {ordensFiltradas.length} OS(s)
          </span>
        </div>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
        <div className="mb-5">
          <h2 className="fdl-section-title">Etapas do cronograma</h2>
          <p className="fdl-section-subtitle">
            Toque em uma etapa para visualizar as OSs relacionadas.
          </p>
        </div>

        {grupos.length > 0 ? (
          <div className="space-y-3">
            {grupos.map((grupo) => {
              const aberto = grupoAberto === grupo.chave;

              return (
                <article
                  key={grupo.chave}
                  className={`rounded-3xl border p-4 transition ${
                    aberto
                      ? "border-[var(--fdl-cream)]/45 bg-white/[0.08]"
                      : "border-white/10 bg-white/[0.045] hover:bg-white/[0.065]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setGrupoAberto(aberto ? null : grupo.chave)}
                    className="w-full text-left"
                    aria-expanded={aberto}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--fdl-cream)]">
                          Etapa {grupo.codigo}
                        </p>

                        <h3 className="mt-2 text-lg font-bold leading-snug text-white">
                          {grupo.titulo}
                        </h3>

                        <p className="mt-1 text-sm text-white/55">
                          {grupo.oss.length} OS(s) · Início{" "}
                          {formatDate(grupo.inicio)} · Fim{" "}
                          {formatDate(grupo.termino)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`w-fit rounded-full px-3 py-1 text-[11px] font-bold ${statusClass(
                            grupo.status
                          )}`}
                        >
                          {formatStatus(grupo.status)}
                        </span>

                        <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 px-4 text-xs font-bold text-white/75">
                          {aberto ? "Ocultar" : "Ver OSs"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {aberto ? (
                    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                      {grupo.oss.map((os) => (
                        <div
                          key={os.os_id}
                          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--fdl-cream)]">
                                OS {codigoOs(os)}
                              </p>

                              <h4 className="mt-1 font-bold text-white">
                                {os.servico || "OS sem descrição"}
                              </h4>

                              <p className="mt-1 text-sm text-white/55">
                                {os.local || "Local não informado"} · Equipe{" "}
                                {os.equipe || "não informada"}
                              </p>

                              <p className="mt-2 text-xs font-semibold text-white/50">
                                Início {formatDate(os.inicio_previsto)} · Fim{" "}
                                {formatDate(os.termino_previsto)}
                              </p>
                            </div>

                            <div className="flex shrink-0 flex-col gap-2 md:items-end">
                              <span
                                className={`w-fit rounded-full px-3 py-1 text-[11px] font-bold ${statusClass(
                                  os.os_status
                                )}`}
                              >
                                {formatStatus(os.os_status)}
                              </span>

                              <a
                                href={`/montador/${codigo}/projetos/${projetoId}/os/${os.os_id}`}
                                className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--fdl-cream)] px-5 text-xs font-bold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
                              >
                                Abrir OS
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
            <p className="font-semibold text-white">
              Nenhuma OS encontrada neste filtro.
            </p>
            <p className="mt-1 text-sm text-white/50">
              Volte ao painel do projeto e selecione outro card de resumo.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
