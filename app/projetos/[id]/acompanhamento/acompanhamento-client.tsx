"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AcompanhamentoClientProps = {
  projetoId: string;
};

type OsGestao = {
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
  iniciado_em: string | null;
  concluido_em: string | null;
  progresso: number | null;
  total_registros: number;
  total_arquivos: number;
  total_fotos_videos: number;
  ultimo_registro_em: string | null;
};

function formatDate(date: string | null) {
  if (!date) return "Não informado";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatDateTime(date: string | null) {
  if (!date) return "Sem registro";

  return new Date(date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
    cancelada: "Cancelada",
  };

  return labels[status] ?? status.replace("_", " ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "em_andamento":
    case "em_montagem":
      return "bg-green-100 text-green-700";

    case "pendente":
    case "planejamento":
      return "bg-yellow-100 text-yellow-700";

    case "concluida":
    case "concluido":
      return "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]";

    case "bloqueada":
    case "atrasada":
    case "cancelada":
    case "cancelado":
      return "bg-red-100 text-red-700";

    default:
      return "bg-white/20 text-white";
  }
}

export default function AcompanhamentoClient({
  projetoId,
}: AcompanhamentoClientProps) {
  const supabase = createClient();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ordens, setOrdens] = useState<OsGestao[]>([]);
  const [filtro, setFiltro] = useState("todos");

  const projeto = ordens[0] ?? null;

  const resumo = useMemo(() => {
    const total = ordens.length;
    const pendentes = ordens.filter((os) => os.os_status === "pendente").length;
    const andamento = ordens.filter(
      (os) => os.os_status === "em_andamento"
    ).length;
    const concluidas = ordens.filter(
      (os) => os.os_status === "concluida"
    ).length;
    const comAnexo = ordens.filter((os) => os.total_fotos_videos > 0).length;
    const semAnexo = ordens.filter((os) => os.total_fotos_videos === 0).length;
    const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    return {
      total,
      pendentes,
      andamento,
      concluidas,
      comAnexo,
      semAnexo,
      progresso,
    };
  }, [ordens]);

  const ordensFiltradas = useMemo(() => {
    if (filtro === "todos") return ordens;

    if (filtro === "sem_anexo") {
      return ordens.filter((os) => os.total_fotos_videos === 0);
    }

    if (filtro === "com_anexo") {
      return ordens.filter((os) => os.total_fotos_videos > 0);
    }

    return ordens.filter((os) => os.os_status === filtro);
  }, [filtro, ordens]);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = `/login?next=/projetos/${projetoId}/acompanhamento`;
        return;
      }

      const { data, error } = await supabase.rpc("listar_os_projeto_gestao", {
        p_projeto_id: projetoId,
      });

      if (error) {
        setErro(error.message);
        setOrdens([]);
        setCarregando(false);
        return;
      }

      setOrdens((data ?? []) as OsGestao[]);
      setCarregando(false);
    }

    carregar();
  }, [projetoId]);

  if (carregando) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center text-white/60">
        Carregando acompanhamento do projeto...
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
          href={`/projetos/${projetoId}`}
          className="block h-12 rounded-2xl bg-[var(--fdl-cream)] px-5 py-3 text-center text-sm font-semibold text-[var(--fdl-purple-dark)]"
        >
          Voltar para o projeto
        </a>
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
          Nenhuma OS encontrada ou você não tem acesso a este projeto.
        </div>

        <a
          href="/projetos"
          className="block h-12 rounded-2xl bg-[var(--fdl-cream)] px-5 py-3 text-center text-sm font-semibold text-[var(--fdl-purple-dark)]"
        >
          Voltar para projetos
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <a
          href={`/projetos/${projetoId}`}
          className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
        >
          ← Voltar para o projeto
        </a>

        <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          Acompanhamento operacional
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          {projeto.cliente || projeto.shopping}
        </h1>

        <p className="mt-2 text-sm text-white/60">
          {projeto.uf} · Temporada {projeto.temporada}
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
            Progresso geral: {resumo.progresso}%
          </span>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Total</p>
          <strong className="mt-2 block text-4xl">{resumo.total}</strong>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Pendentes</p>
          <strong className="mt-2 block text-4xl">{resumo.pendentes}</strong>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Andamento</p>
          <strong className="mt-2 block text-4xl">{resumo.andamento}</strong>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Concluídas</p>
          <strong className="mt-2 block text-4xl">{resumo.concluidas}</strong>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Com anexos</p>
          <strong className="mt-2 block text-4xl">{resumo.comAnexo}</strong>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Sem anexos</p>
          <strong className="mt-2 block text-4xl">{resumo.semAnexo}</strong>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold">Ordens de serviço</h2>
            <p className="mt-1 text-sm text-white/55">
              Acompanhe o andamento, registros e anexos enviados pelos
              montadores.
            </p>
          </div>

          <select
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
            className="h-12 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)]"
          >
            <option className="text-black" value="todos">
              Todas
            </option>
            <option className="text-black" value="pendente">
              Pendentes
            </option>
            <option className="text-black" value="em_andamento">
              Em andamento
            </option>
            <option className="text-black" value="concluida">
              Concluídas
            </option>
            <option className="text-black" value="com_anexo">
              Com anexos
            </option>
            <option className="text-black" value="sem_anexo">
              Sem anexos
            </option>
          </select>
        </div>

        <div className="mt-5 space-y-4">
          {ordensFiltradas.map((os) => (
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
                    {os.etapa_nome || "Etapa não informada"} ·{" "}
                    {os.equipe || "Equipe não informada"}
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

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-5">
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
                  <p className="text-white/40">Registros</p>
                  <p className="mt-1 font-semibold text-white">
                    {os.total_registros}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-white/40">Fotos/vídeos</p>
                  <p className="mt-1 font-semibold text-white">
                    {os.total_fotos_videos}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-white/40">Último registro</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatDateTime(os.ultimo_registro_em)}
                  </p>
                </div>
              </div>

              <a
                href={`/projetos/${projetoId}/os/${os.os_id}`}
                className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
              >
                Ver detalhe da OS
              </a>
            </article>
          ))}

          {ordensFiltradas.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/50">
              Nenhuma OS encontrada para este filtro.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
