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

function cardResumoClass(tipo: "default" | "warning" | "success" | "validation") {
  const base =
    "group block rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.09]";

  if (tipo === "validation") {
    return `${base} border-amber-300/30 bg-amber-500/10`;
  }

  if (tipo === "warning") {
    return `${base} border-yellow-300/20 bg-white/[0.06]`;
  }

  if (tipo === "success") {
    return `${base} border-green-300/20 bg-white/[0.06]`;
  }

  return `${base} border-white/10 bg-white/[0.06]`;
}

export default function OsClient({ codigo, projetoId }: OsClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ordens, setOrdens] = useState<OsMontador[]>([]);
  const [montadorNome, setMontadorNome] = useState("");

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

    const aguardandoValidacao = ordens.filter(
      (os) => os.os_status === "aguardando_validacao"
    ).length;

    return {
      total,
      concluidas,
      pendentes,
      andamento,
      aguardandoValidacao,
    };
  }, [ordens]);

  useEffect(() => {
    async function carregarOs() {
      setCarregando(true);
      setErro("");

      const storage = localStorage.getItem("fdl_montador");

      if (!storage) {
        setErro("Acesso expirado. Volte e informe o PIN novamente.");
        setCarregando(false);
        return;
      }

      let dados;

      try {
        dados = JSON.parse(storage);
      } catch {
        localStorage.removeItem("fdl_montador");
        setErro("Acesso inválido. Volte e informe o PIN novamente.");
        setCarregando(false);
        return;
      }

      const sessaoExpirada =
        typeof dados?.expiraEm === "number" && dados.expiraEm < Date.now();

      if (sessaoExpirada || dados?.codigo?.toUpperCase() !== codigo.toUpperCase()) {
        localStorage.removeItem("fdl_montador");
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

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <a
          href={`/montador/${codigo}/projetos/${projetoId}/etapas/todas`}
          className={cardResumoClass("default")}
        >
          <p className="text-sm font-semibold text-white/60">Total de OSs</p>
          <strong className="mt-2 block text-3xl font-black text-white md:text-4xl">
            {resumo.total}
          </strong>
          <span className="mt-2 block text-xs font-semibold text-white/45">
            Ver todas
          </span>
        </a>

        <a
          href={`/montador/${codigo}/projetos/${projetoId}/etapas/pendentes`}
          className={cardResumoClass("warning")}
        >
          <p className="text-sm font-semibold text-white/60">Pendentes</p>
          <strong className="mt-2 block text-3xl font-black text-white md:text-4xl">
            {resumo.pendentes}
          </strong>
          <span className="mt-2 block text-xs font-semibold text-yellow-100/70">
            Aguardando execução
          </span>
        </a>

        <a
          href={`/montador/${codigo}/projetos/${projetoId}/etapas/andamento`}
          className={cardResumoClass("success")}
        >
          <p className="text-sm font-semibold text-white/60">Em andamento</p>
          <strong className="mt-2 block text-3xl font-black text-white md:text-4xl">
            {resumo.andamento}
          </strong>
          <span className="mt-2 block text-xs font-semibold text-green-100/70">
            Em execução
          </span>
        </a>

        <a
          href={`/montador/${codigo}/projetos/${projetoId}/etapas/validacao`}
          className={cardResumoClass("validation")}
        >
          <p className="text-sm font-semibold text-amber-50/75">
            Aguardando validação
          </p>
          <strong className="mt-2 block text-3xl font-black text-white md:text-4xl">
            {resumo.aguardandoValidacao}
          </strong>
          <span className="mt-2 block text-xs font-semibold text-amber-100/75">
            Enviadas ao gestor
          </span>
        </a>

        <a
          href={`/montador/${codigo}/projetos/${projetoId}/etapas/concluidas`}
          className={cardResumoClass("default")}
        >
          <p className="text-sm font-semibold text-white/60">Concluídas</p>
          <strong className="mt-2 block text-3xl font-black text-white md:text-4xl">
            {resumo.concluidas}
          </strong>
          <span className="mt-2 block text-xs font-semibold text-[var(--fdl-cream)]/80">
            Finalizadas
          </span>
        </a>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-center">
        <p className="font-semibold text-white">
          Selecione um card acima para visualizar as OSs.
        </p>
        <p className="mt-1 text-sm text-white/50">
          As OSs serão exibidas por etapa do cronograma, reduzindo a rolagem na tela do montador.
        </p>
      </section>
    </div>
  );
}
