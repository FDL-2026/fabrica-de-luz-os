"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OsDetalheClientProps = {
  codigo: string;
  projetoId: string;
  osId: string;
};

type OsDetalhe = {
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
  projeto_status: string | null;
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
  observacao_montador: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
};

function formatDate(date: string | null) {
  if (!date) return "Não informado";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatDateTime(date: string | null) {
  if (!date) return "Não registrado";

  return new Date(date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatStatus(status: string | null) {
  if (!status) return "Sem status";

  const labels: Record<string, string> = {
    pendente: "Pendente",
    em_andamento: "Em andamento",
    concluida: "Concluída",
    bloqueada: "Bloqueada",
    atrasada: "Atrasada",
    cancelada: "Cancelada",
  };

  return labels[status] ?? status.replace("_", " ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "em_andamento":
      return "bg-green-100 text-green-700";

    case "pendente":
      return "bg-yellow-100 text-yellow-700";

    case "concluida":
      return "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]";

    case "bloqueada":
    case "atrasada":
    case "cancelada":
      return "bg-red-100 text-red-700";

    default:
      return "bg-white/20 text-white";
  }
}

export default function OsDetalheClient({
  codigo,
  projetoId,
  osId,
}: OsDetalheClientProps) {
  const supabase = createClient();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [os, setOs] = useState<OsDetalhe | null>(null);
  const [usuarioId, setUsuarioId] = useState("");
  const [montadorNome, setMontadorNome] = useState("");
  const [observacao, setObservacao] = useState("");

  async function carregarOs(usuarioIdMontador: string) {
    const { data, error } = await supabase.rpc("obter_os_montador", {
      p_usuario_id: usuarioIdMontador,
      p_projeto_id: projetoId,
      p_os_id: osId,
    });

    if (error) {
      setErro(error.message);
      setOs(null);
      setCarregando(false);
      return;
    }

    const resultado = Array.isArray(data) ? (data[0] as OsDetalhe) : null;

    if (!resultado) {
      setErro("OS não encontrada ou montador sem vínculo com este projeto.");
      setOs(null);
      setCarregando(false);
      return;
    }

    setOs(resultado);
    setObservacao(resultado.observacao_montador ?? "");
    setCarregando(false);
  }

  useEffect(() => {
    async function iniciar() {
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

      setUsuarioId(dados.usuarioId);
      setMontadorNome(dados.nome ?? "Montador");

      await carregarOs(dados.usuarioId);
    }

    iniciar();
  }, [codigo, projetoId, osId]);

  async function atualizarStatus(novoStatus: "em_andamento" | "concluida") {
    if (!usuarioId || !os) return;

    setErro("");
    setSucesso("");
    setSalvando(true);

    const { data, error } = await supabase.rpc("atualizar_status_os_montador", {
      p_usuario_id: usuarioId,
      p_projeto_id: projetoId,
      p_os_id: osId,
      p_status: novoStatus,
      p_observacao: observacao,
    });

    if (error) {
      setErro(error.message);
      setSalvando(false);
      return;
    }

    const resultado = Array.isArray(data) ? data[0] : null;

    if (!resultado) {
      setErro("Não foi possível atualizar a OS.");
      setSalvando(false);
      return;
    }

    await carregarOs(usuarioId);

    setSucesso(
      novoStatus === "em_andamento"
        ? "OS iniciada com sucesso."
        : "OS concluída com sucesso."
    );

    setSalvando(false);
  }

  if (carregando) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center text-white/60">
        Carregando dados da OS...
      </div>
    );
  }

  if (erro && !os) {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">
          {erro}
        </div>

        <a
          href={`/montador/${codigo}/projetos/${projetoId}`}
          className="block h-12 rounded-2xl bg-[var(--fdl-cream)] px-5 py-3 text-center text-sm font-semibold text-[var(--fdl-purple-dark)]"
        >
          Voltar para OSs do projeto
        </a>
      </div>
    );
  }

  if (!os) return null;

  const podeIniciar = os.os_status === "pendente";
  const podeConcluir = os.os_status !== "concluida";

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <a
          href={`/montador/${codigo}/projetos/${projetoId}`}
          className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
        >
          ← Voltar para OSs do projeto
        </a>

        <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          Execução de OS
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          OS {os.codigo_cronograma || os.codigo_os}
        </h1>

        <p className="mt-2 text-sm text-white/60">
          {os.cliente || os.shopping} · {os.uf} · Temporada {os.temporada} ·{" "}
          {montadorNome}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
              os.os_status
            )}`}
          >
            {formatStatus(os.os_status)}
          </span>

          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
            {formatDate(os.inicio_previsto)} até {formatDate(os.termino_previsto)}
          </span>
        </div>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold">Dados da OS</h2>
          <p className="mt-1 text-sm text-white/55">
            Confira as informações antes de iniciar ou concluir.
          </p>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/40">
              Serviço
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {os.servico || "OS sem descrição"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/40">
              Etapa
            </p>
            <p className="mt-2 font-semibold text-white">
              {os.etapa_nome || "Etapa não informada"}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-white/40">Equipe</p>
              <p className="mt-1 font-semibold text-white">
                {os.equipe || "Não informada"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-white/40">Iniciada em</p>
              <p className="mt-1 font-semibold text-white">
                {formatDateTime(os.iniciado_em)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-white/40">Concluída em</p>
              <p className="mt-1 font-semibold text-white">
                {formatDateTime(os.concluido_em)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <label
          htmlFor="observacao"
          className="block text-sm font-semibold text-white"
        >
          Observação do montador
        </label>

        <textarea
          id="observacao"
          value={observacao}
          onChange={(event) => setObservacao(event.target.value)}
          rows={5}
          placeholder="Exemplo: OS iniciada sem pendências. Material conferido no local."
          className="mt-3 w-full rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)] focus:ring-4 focus:ring-[var(--fdl-cream)]/10"
        />

        {erro ? (
          <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            {erro}
          </div>
        ) : null}

        {sucesso ? (
          <div className="mt-4 rounded-2xl border border-green-400/30 bg-green-500/10 p-4 text-sm text-green-100">
            {sucesso}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            disabled={!podeIniciar || salvando}
            onClick={() => atualizarStatus("em_andamento")}
            className="h-12 rounded-2xl border border-white/15 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando ? "Salvando..." : "Iniciar OS"}
          </button>

          <button
            type="button"
            disabled={!podeConcluir || salvando}
            onClick={() => atualizarStatus("concluida")}
            className="h-12 rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Concluir OS"}
          </button>
        </div>
      </section>
    </div>
  );
}
