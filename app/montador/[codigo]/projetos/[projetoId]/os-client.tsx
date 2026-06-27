"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OsClientProps = {
  codigo: string;
  projetoId: string;
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
  equipe: string | null;
  os_status: string | null;
  inicio_previsto: string | null;
  termino_previsto: string | null;
  progresso: number | null;
};

function formatDate(date: string | null) {
  if (!date) return "Não informado";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
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
    concluida: "Concluída",
    bloqueada: "Bloqueada",
    atrasada: "Atrasada",
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
      return "bg-yellow-100 text-yellow-700";

    case "concluido":
    case "concluida":
      return "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]";

    case "cancelado":
    case "bloqueada":
    case "atrasada":
      return "bg-red-100 text-red-700";

    default:
      return "bg-white/20 text-white";
  }
}

export default function OsClient({ codigo, projetoId }: OsClientProps) {
  const supabase = createClient();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ordens, setOrdens] = useState<OsMontador[]>([]);
  const [montadorNome, setMontadorNome] = useState("");

  const projeto = ordens[0] ?? null;

  const resumo = useMemo(() => {
    const total = ordens.length;
    const concluidas = ordens.filter(
      (os) => os.os_status === "concluida"
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
        <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">
          {erro}
        </div>

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
      <header className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
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
        <div className="rounded-3xl border border-white/10 bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Total de OSs</p>
          <strong className="mt-2 block text-4xl">{resumo.total}</strong>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Pendentes</p>
          <strong className="mt-2 block text-4xl">{resumo.pendentes}</strong>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Em andamento</p>
          <strong className="mt-2 block text-4xl">{resumo.andamento}</strong>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Concluídas</p>
          <strong className="mt-2 block text-4xl">{resumo.concluidas}</strong>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
        <div className="mb-5">
          <h2 className="text-xl font-bold">Ordens de serviço</h2>
          <p className="mt-1 text-sm text-white/55">
            OSs importadas automaticamente do cronograma.
          </p>
        </div>

        <div className="space-y-4">
          {ordens.map((os) => (
            <article
              key={os.os_id}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--fdl-cream)]">
                    OS {os.codigo_cronograma || os.codigo_os}
                  </p>

                  <h3 className="mt-2 text-lg font-bold text-white">
                    {os.servico || "OS sem descrição"}
                  </h3>

                  <p className="mt-2 text-sm text-white/50">
                    {os.etapa_nome || "Etapa não informada"}
                  </p>
                </div>

                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                    os.os_status
                  )}`}
                >
                  {formatStatus(os.os_status)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
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
              </div>

              <button
                type="button"
                disabled
                className="mt-4 h-12 w-full cursor-not-allowed rounded-2xl bg-white/10 text-sm font-semibold text-white/45"
              >
                Registro e conclusão na próxima etapa
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
