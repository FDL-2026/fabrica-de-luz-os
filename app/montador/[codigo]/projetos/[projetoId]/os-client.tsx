"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OsClientProps = {
  codigo: string;
  projetoId: string;
};

type FiltroOs = "todas" | "pendentes" | "andamento" | "concluidas";

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

export default function OsClient({ codigo, projetoId }: OsClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ordens, setOrdens] = useState<OsMontador[]>([]);
  const [montadorNome, setMontadorNome] = useState("");
  const [osAbertaId, setOsAbertaId] = useState<string | null>(null);
  const [filtroOs, setFiltroOs] = useState<FiltroOs>("todas");

  const projeto = ordens[0] ?? null;

  const resumo = useMemo(() => {
    const total = ordens.length;
    const concluidas = ordens.filter((os) =>
      ["concluida", "concluido", "aprovada"].includes(os.os_status ?? "")
    ).length;
    const pendentes = ordens.filter((os) => os.os_status === "pendente").length;
    const andamento = ordens.filter(
      (os) => os.os_status === "em_andamento"
    ).length;
    const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    return {
      total,
      concluidas,
      pendentes,
      andamento,
      progresso,
    };
  }, [ordens]);

  const ordensFiltradas = useMemo(() => {
    switch (filtroOs) {
      case "pendentes":
        return ordens.filter((os) => os.os_status === "pendente");

      case "andamento":
        return ordens.filter((os) => os.os_status === "em_andamento");

      case "concluidas":
        return ordens.filter((os) =>
          ["concluida", "concluido", "aprovada"].includes(os.os_status ?? "")
        );

      case "todas":
      default:
        return ordens;
    }
  }, [ordens, filtroOs]);

  const filtroLabel = {
    todas: "Todas as OSs",
    pendentes: "OSs pendentes",
    andamento: "OSs em andamento",
    concluidas: "OSs concluídas",
  }[filtroOs];

  function alterarFiltro(novoFiltro: FiltroOs) {
    setFiltroOs(novoFiltro);
    setOsAbertaId(null);
  }

  function cardResumoClass(ativo: boolean) {
    return [
      "rounded-3xl border p-5 text-left transition",
      "hover:-translate-y-0.5 hover:bg-white/[0.09]",
      ativo
        ? "border-[var(--fdl-cream)]/55 bg-white/[0.09] shadow-[0_0_0_1px_rgba(237,224,177,0.12)]"
        : "border-white/10 bg-white/[0.06]",
    ].join(" ");
  }

  useEffect(() => {
    async function carregarOs() {
      setCarregando(true);
      setErro("");

      const storage = sessionStorage.getItem("fdl_montador");

      if (!storage) {
        setErro("Acesso expirado. Volte e informe o PIN novamente.");
        setCarregando(false);
        return;
      }

      let dados;

      try {
        dados = JSON.parse(storage);
      } catch {
        sessionStorage.removeItem("fdl_montador");
        setErro("Acesso inválido. Volte e informe o PIN novamente.");
        setCarregando(false);
        return;
      }

      if (dados?.codigo?.toUpperCase() !== codigo.toUpperCase()) {
        sessionStorage.removeItem("fdl_montador");
        setErro("Código de montador divergente. Informe o PIN novamente.");
        setCarregando(false);
        return;
      }

      setMontadorNome(dados.nome ?? "Montador");

      const { data, error } = await supabase.rpc("listar_os_montador", {
        p_usuario_id: dados.usuarioId,
        p_projeto_id: projetoId,
      });

      if (error) {
        setErro(error.message);
        setOrdens([]);
        setCarregando(false);
        return;
      }

      setOrdens((data ?? []) as OsMontador[]);
      setOsAbertaId(null);
      setCarregando(false);
    }

    carregarOs();
  }, [codigo, projetoId, supabase]);

  if (carregando) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center text-white/60">
        Carregando OSs do projeto...
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
    <div className="space-y-6">
      <header className="fdl-form-card p-6">
        <a
          href={`/montador/${codigo}`}
          className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
        >
          ← Voltar para meus projetos
        </a>

        <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          Painel do montador
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
            {formatDate(projeto.data_inicio)} até {formatDate(projeto.data_fim)}
          </span>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <button
          type="button"
          onClick={() => alterarFiltro("todas")}
          className={cardResumoClass(filtroOs === "todas")}
        >
          <p className="text-sm font-semibold text-white/60">Total de OSs</p>
          <strong className="mt-2 block text-4xl font-black text-white">
            {resumo.total}
          </strong>
          <span className="mt-2 block text-xs font-semibold text-white/45">
            Ver todas
          </span>
        </button>

        <button
          type="button"
          onClick={() => alterarFiltro("pendentes")}
          className={cardResumoClass(filtroOs === "pendentes")}
        >
          <p className="text-sm font-semibold text-white/60">Pendentes</p>
          <strong className="mt-2 block text-4xl font-black text-white">
            {resumo.pendentes}
          </strong>
          <span className="mt-2 block text-xs font-semibold text-yellow-100/70">
            Aguardando execução
          </span>
        </button>

        <button
          type="button"
          onClick={() => alterarFiltro("andamento")}
          className={cardResumoClass(filtroOs === "andamento")}
        >
          <p className="text-sm font-semibold text-white/60">Em andamento</p>
          <strong className="mt-2 block text-4xl font-black text-white">
            {resumo.andamento}
          </strong>
          <span className="mt-2 block text-xs font-semibold text-green-100/70">
            Em execução
          </span>
        </button>

        <button
          type="button"
          onClick={() => alterarFiltro("concluidas")}
          className={cardResumoClass(filtroOs === "concluidas")}
        >
          <p className="text-sm font-semibold text-white/60">Concluídas</p>
          <strong className="mt-2 block text-4xl font-black text-white">
            {resumo.concluidas}
          </strong>
          <span className="mt-2 block text-xs font-semibold text-[var(--fdl-cream)]/80">
            Finalizadas
          </span>
        </button>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
        <div className="mb-5">
          <h2 className="fdl-section-title">Ordens de serviço</h2>
          <p className="fdl-section-subtitle">
            {filtroLabel}: toque em uma OS para ver os detalhes e abrir a execução.
          </p>
        </div>

        {ordensFiltradas.length > 0 ? (
          <div className="space-y-3">
            {ordensFiltradas.map((os) => {
            const aberta = osAbertaId === os.os_id;

            return (
              <article
                key={os.os_id}
                className={`rounded-3xl border p-4 transition ${
                  aberta
                    ? "border-[var(--fdl-cream)]/45 bg-white/[0.08]"
                    : "border-white/10 bg-white/[0.045] hover:bg-white/[0.065]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOsAbertaId(aberta ? null : os.os_id)}
                  className="w-full text-left"
                  aria-expanded={aberta}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--fdl-cream)]">
                          OS {codigoOs(os)}
                        </p>

                        <span
                          className={`w-fit rounded-full px-3 py-1 text-[11px] font-bold ${statusClass(
                            os.os_status
                          )}`}
                        >
                          {formatStatus(os.os_status)}
                        </span>
                      </div>

                      <h3 className="mt-2 text-base font-bold leading-snug text-white sm:text-lg">
                        {os.servico || "OS sem descrição"}
                      </h3>

                      <p className="mt-1 text-sm text-white/55">
                        {os.local || os.etapa_nome || "Local/etapa não informado"}
                      </p>

                      <p className="mt-2 text-xs font-semibold text-white/50">
                        Início {formatDate(os.inicio_previsto)} · Fim{" "}
                        {formatDate(os.termino_previsto)}
                      </p>
                    </div>

                    <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 px-4 text-xs font-bold text-white/75">
                      {aberta ? "Ocultar" : "Detalhes"}
                    </span>
                  </div>
                </button>

                {aberta ? (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Serviço</p>
                        <p className="mt-1 font-semibold text-white">
                          {os.servico || "Não informado"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Local</p>
                        <p className="mt-1 font-semibold text-white">
                          {os.local || "Não informado"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Início previsto</p>
                        <p className="mt-1 font-semibold text-white">
                          {formatDate(os.inicio_previsto)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Término previsto</p>
                        <p className="mt-1 font-semibold text-white">
                          {formatDate(os.termino_previsto)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Equipe</p>
                        <p className="mt-1 font-semibold text-white">
                          {os.equipe || "Não informada"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Etapa</p>
                        <p className="mt-1 font-semibold text-white">
                          {os.etapa_nome || "Não informada"}
                        </p>
                      </div>
                    </div>

                    <a
                      href={`/montador/${codigo}/projetos/${projetoId}/os/${os.os_id}`}
                      className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
                    >
                      Abrir OS
                    </a>
                  </div>
                ) : null}
              </article>
            );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
            <p className="font-semibold text-white">Nenhuma OS neste filtro.</p>
            <p className="mt-1 text-sm text-white/50">
              Toque em outro card de resumo para visualizar outras OSs.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
