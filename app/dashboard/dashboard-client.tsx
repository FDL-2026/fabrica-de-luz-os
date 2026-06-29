"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ResumoDashboard = {
  projetos_ativos: number;
  total_projetos: number;
  os_pendentes: number;
  os_em_andamento: number;
  os_concluidas: number;
};

type ProjetoDashboard = {
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
  status: string | null;
  total_os: number;
  pendentes: number;
  em_andamento: number;
  concluidas: number;
  ult_registro: string | null;
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

type DashboardData = {
  resumo: ResumoDashboard;
  projetos: ProjetoDashboard[];
  ultimos_registros: RegistroDashboard[];
};

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
    concluida: "Concluída",
    cancelado: "Cancelado",
    cancelada: "Cancelada",
    pendente: "Pendente",
    em_andamento: "Em andamento",
    bloqueada: "Bloqueada",
    atrasada: "Atrasada",
  };

  return labels[status] ?? status.replace("_", " ");
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

  return labels[tipo] ?? tipo.replace("_", " ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "em_andamento":
    case "em_montagem":
      return "bg-blue-100 text-blue-700";

    case "pendente":
    case "planejamento":
      return "bg-yellow-100 text-yellow-700";

    case "concluida":
    case "concluido":
      return "bg-green-100 text-green-700";

    case "bloqueada":
    case "atrasada":
    case "cancelada":
    case "cancelado":
      return "bg-red-100 text-red-700";

    default:
      return "bg-white/20 text-white";
  }
}

function tipoRegistroClass(tipo: string | null) {
  switch (tipo) {
    case "pendencia":
      return "bg-red-100 text-red-700";

    case "conclusao_os":
      return "bg-green-100 text-green-700";

    case "inicio_os":
      return "bg-blue-100 text-blue-700";

    case "anexo":
      return "bg-[var(--fdl-lilac)] text-[var(--fdl-purple-dark)]";

    default:
      return "bg-white/15 text-white/80";
  }
}

const emptyDashboard: DashboardData = {
  resumo: {
    projetos_ativos: 0,
    total_projetos: 0,
    os_pendentes: 0,
    os_em_andamento: 0,
    os_concluidas: 0,
  },
  projetos: [],
  ultimos_registros: [],
};

export default function DashboardClient() {
  const supabase = createClient();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<DashboardData>(emptyDashboard);

  const progressoGeral = useMemo(() => {
    const total =
      dados.resumo.os_pendentes +
      dados.resumo.os_em_andamento +
      dados.resumo.os_concluidas;

    if (total === 0) return 0;

    return Math.round((dados.resumo.os_concluidas / total) * 100);
  }, [dados]);

  useEffect(() => {
    async function carregarDashboard() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase.rpc("fdl_dashboard_gestao");

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
  }, [supabase]);

  if (carregando) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center text-white/60">
        Carregando dashboard operacional...
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">
        {erro}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          Dashboard operacional
        </p>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Visão geral da montagem</h1>
            <p className="mt-2 text-sm text-white/60">
              Acompanhe projetos, OSs e registros enviados pelos montadores.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/projetos"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Ver projetos
            </a>

            <a
              href="/importar"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--fdl-cream)] px-5 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
            >
              Importar cronograma
            </a>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Projetos ativos</p>
          <strong className="mt-2 block text-4xl">
            {dados.resumo.projetos_ativos}
          </strong>
          <p className="mt-2 text-xs text-[#7d6488]">
            {dados.resumo.total_projetos} projeto(s) no total
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">OSs pendentes</p>
          <strong className="mt-2 block text-4xl">
            {dados.resumo.os_pendentes}
          </strong>
          <p className="mt-2 text-xs text-[#7d6488]">aguardando execução</p>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Em andamento</p>
          <strong className="mt-2 block text-4xl">
            {dados.resumo.os_em_andamento}
          </strong>
          <p className="mt-2 text-xs text-[#7d6488]">em execução</p>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Concluídas</p>
          <strong className="mt-2 block text-4xl">
            {dados.resumo.os_concluidas}
          </strong>
          <p className="mt-2 text-xs text-[#7d6488]">finalizadas com evidência</p>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Progresso geral</p>
          <strong className="mt-2 block text-4xl">{progressoGeral}%</strong>
          <div className="mt-4 h-2 rounded-full bg-[#eee7f3]">
            <div
              className="h-2 rounded-full bg-[var(--fdl-purple)]"
              style={{ width: `${progressoGeral}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <div className="mb-5">
            <h2 className="text-xl font-bold">Projetos em acompanhamento</h2>
            <p className="mt-1 text-sm text-white/55">
              Projetos ordenados por maior volume de OSs pendentes.
            </p>
          </div>

          <div className="space-y-4">
            {dados.projetos.length > 0 ? (
              dados.projetos.map((projeto) => {
                const total = projeto.total_os || 0;
                const progresso =
                  total > 0 ? Math.round((projeto.concluidas / total) * 100) : 0;

                return (
                  <article
                    key={projeto.projeto_id}
                    className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-[var(--fdl-cream)]">
                          {projeto.uf || "UF"} · Temporada{" "}
                          {projeto.temporada || "não informada"}
                        </p>

                        <h3 className="mt-2 text-lg font-bold text-white">
                          {projeto.cliente || projeto.shopping || "Projeto sem nome"}
                        </h3>

                        <p className="mt-2 text-sm text-white/50">
                          Último registro: {formatDateTime(projeto.ult_registro)}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          projeto.status
                        )}`}
                      >
                        {formatStatus(projeto.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Total OSs</p>
                        <p className="mt-1 font-semibold text-white">
                          {projeto.total_os}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Pendentes</p>
                        <p className="mt-1 font-semibold text-white">
                          {projeto.pendentes}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Andamento</p>
                        <p className="mt-1 font-semibold text-white">
                          {projeto.em_andamento}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/40">Progresso</p>
                        <p className="mt-1 font-semibold text-white">
                          {progresso}%
                        </p>
                      </div>
                    </div>

                    <a
                      href={`/projetos/${projeto.projeto_id}`}
                      className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
                    >
                      Abrir projeto
                    </a>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/50">
                Nenhum projeto encontrado.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <div className="mb-5">
            <h2 className="text-xl font-bold">Últimos registros</h2>
            <p className="mt-1 text-sm text-white/55">
              Últimas atualizações enviadas pelos montadores.
            </p>
          </div>

          <div className="space-y-4">
            {dados.ultimos_registros.length > 0 ? (
              dados.ultimos_registros.map((registro) => (
                <article
                  key={registro.registro_id}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${tipoRegistroClass(
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

                    <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
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
                        className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
                      >
                        Ver OS
                      </a>
                    ) : (
                      <a
                        href={`/projetos/${registro.projeto_id}`}
                        className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
                      >
                        Ver projeto
                      </a>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/50">
                Nenhum registro enviado ainda.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
