"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ValidacaoOsClientProps = {
  projetoId: string;
  osId: string;
};

type OsValidacao = {
  id: string;
  projeto_id: string;
  codigo_os: string | null;
  codigo_cronograma: string | null;
  servico: string | null;
  local: string | null;
  equipe: string | null;
  status: string | null;
  status_validacao: string | null;
  observacao_validacao: string | null;
  validado_em: string | null;
  validado_por_nome: string | null;
  progresso: number | null;
  observacao_montador: string | null;
  inicio_previsto: string | null;
  termino_previsto: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
};

type ArquivoOs = {
  id: string;
  tipo: string | null;
  nome_arquivo: string | null;
  mime_type: string | null;
  url_visualizacao: string | null;
  external_file_id: string | null;
};

type RegistroOs = {
  id: string;
  tipo_registro: string | null;
  status_informado: string | null;
  descricao: string | null;
  percentual_execucao: number | null;
  criado_em: string | null;
  usuario_nome: string | null;
};

type PayloadValidacao = {
  os: OsValidacao | null;
  arquivos: ArquivoOs[];
  registros: RegistroOs[];
};

type AcaoValidacao = "aprovar" | "solicitar_ajuste";

function formatStatus(status: string | null) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    em_andamento: "Em andamento",
    aguardando_validacao: "Aguardando validação",
    concluida: "Concluída",
    concluido: "Concluído",
    ajuste_solicitado: "Ajuste solicitado",
    reaberta: "Reaberta",
    aprovada: "Aprovada",
    nao_enviada: "Não enviada",
  };

  if (!status) return "Sem status";

  return labels[status] ?? status.replaceAll("_", " ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "aguardando_validacao":
      return "bg-yellow-100 text-yellow-700";

    case "concluida":
    case "concluido":
    case "aprovada":
      return "bg-green-100 text-green-700";

    case "em_andamento":
    case "reaberta":
      return "bg-blue-100 text-blue-700";

    case "ajuste_solicitado":
      return "bg-red-100 text-red-700";

    default:
      return "bg-white/15 text-white/75";
  }
}

function formatDateTime(date: string | null) {
  if (!date) return "Não informado";

  return new Date(date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function nomeProjeto(os: OsValidacao) {
  const nome = os.cliente || os.shopping || "Projeto sem nome";

  if (!os.uf) return nome;

  return `${nome} - ${os.uf}`;
}

export default function ValidacaoOsClient({
  projetoId,
  osId,
}: ValidacaoOsClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<AcaoValidacao | null>(null);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [observacao, setObservacao] = useState("");
  const [dados, setDados] = useState<PayloadValidacao>({
    os: null,
    arquivos: [],
    registros: [],
  });

  async function carregar() {
    setCarregando(true);
    setErro("");

    const { data, error } = await supabase.rpc(
      "fdl_obter_validacao_os_gestao",
      {
        p_projeto_id: projetoId,
        p_os_id: osId,
      }
    );

    if (error) {
      setErro(error.message);
      setDados({
        os: null,
        arquivos: [],
        registros: [],
      });
      setCarregando(false);
      return;
    }

    const payload = data as PayloadValidacao | null;

    setDados({
      os: payload?.os ?? null,
      arquivos: payload?.arquivos ?? [],
      registros: payload?.registros ?? [],
    });

    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, [projetoId, osId, supabase]);

  async function executarAcao(acao: AcaoValidacao) {
    setErro("");
    setSucesso("");

    if (acao === "solicitar_ajuste" && !observacao.trim()) {
      setErro("Informe o ajuste que precisa ser feito antes de solicitar correção.");
      return;
    }

    const confirmar = window.confirm(
      acao === "aprovar"
        ? "Aprovar esta OS?"
        : "Solicitar ajuste para esta OS?"
    );

    if (!confirmar) return;

    setProcessando(acao);

    const { error } = await supabase.rpc("fdl_validar_os_gestao", {
      p_projeto_id: projetoId,
      p_os_id: osId,
      p_acao: acao,
      p_observacao: observacao.trim() || null,
    });

    if (error) {
      setErro(error.message);
      setProcessando(null);
      return;
    }

    setSucesso(
      acao === "aprovar"
        ? "OS aprovada com sucesso."
        : "Ajuste solicitado com sucesso."
    );

    setObservacao("");

    await carregar();

    setProcessando(null);
  }

  if (carregando) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center text-white/60">
        Carregando validação da OS...
      </div>
    );
  }

  if (!dados.os) {
    return (
      <div className="fdl-ui-alert fdl-ui-alert-error">
        OS não encontrada ou sem permissão de acesso.
      </div>
    );
  }

  const os = dados.os;
  const osAprovada = os.status_validacao === "aprovada";

  return (
    <div className="space-y-6">
      <header className="fdl-form-card p-6">
        <a
          href={`/projetos/${projetoId}/os/${osId}`}
          className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
        >
          ← Voltar para detalhes da OS
        </a>

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
              Validação da OS
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              OS {os.codigo_cronograma || os.codigo_os || "sem código"}
            </h1>

            <p className="mt-2 text-sm text-white/60">
              {nomeProjeto(os)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                os.status
              )}`}
            >
              {formatStatus(os.status)}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                os.status_validacao
              )}`}
            >
              {formatStatus(os.status_validacao)}
            </span>
          </div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <section className="fdl-form-card p-6">
            <h2 className="fdl-section-title">Dados da OS</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-white/40">Serviço</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {os.servico || "Não informado"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-white/40">Local</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {os.local || "Não informado"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-white/40">Equipe</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {os.equipe || "Não informado"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-white/40">Progresso</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {os.progresso ?? 0}%
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-white/40">Iniciado em</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {formatDateTime(os.iniciado_em)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-white/40">Concluído pelo montador</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {formatDateTime(os.concluido_em)}
                </p>
              </div>
            </div>

            {os.observacao_montador ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-white/40">Observação do montador</p>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  {os.observacao_montador}
                </p>
              </div>
            ) : null}

            {os.observacao_validacao ? (
              <div className="mt-4 rounded-2xl border border-[var(--fdl-cream)]/30 bg-[var(--fdl-cream)]/10 p-4">
                <p className="text-xs text-[var(--fdl-cream)]">
                  Última observação de validação
                </p>
                <p className="mt-2 text-sm leading-6 text-white/80">
                  {os.observacao_validacao}
                </p>
                <p className="mt-2 text-xs text-white/45">
                  {os.validado_por_nome || "Gestor"} ·{" "}
                  {formatDateTime(os.validado_em)}
                </p>
              </div>
            ) : null}
          </section>

          <section className="fdl-form-card p-6">
            <h2 className="fdl-section-title">Fotos e vídeos enviados</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {dados.arquivos.length > 0 ? (
                dados.arquivos.map((arquivo) => (
                  <article
                    key={arquivo.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <p className="text-sm font-semibold text-white">
                      {arquivo.nome_arquivo || "Arquivo"}
                    </p>

                    <p className="mt-1 text-xs text-white/45">
                      {arquivo.tipo || arquivo.mime_type || "Arquivo"}
                    </p>

                    {arquivo.url_visualizacao ? (
                      <a
                        href={arquivo.url_visualizacao}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-[var(--fdl-cream)] px-4 text-xs font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
                      >
                        Abrir arquivo
                      </a>
                    ) : (
                      <p className="mt-4 text-xs text-white/40">
                        Link de visualização não disponível.
                      </p>
                    )}
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/50 md:col-span-2">
                  Nenhuma foto ou vídeo vinculado a esta OS.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-[var(--fdl-cream)]/30 bg-white/[0.08] p-6">
            <h2 className="fdl-section-title">Ação do gestor</h2>

            <p className="mt-2 text-sm text-white/60">
              Aprove a OS se a execução estiver correta ou solicite ajuste com
              uma orientação clara para o montador.
            </p>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-white">
                Observação
              </label>

              <textarea
                value={observacao}
                onChange={(event) => setObservacao(event.target.value)}
                rows={5}
                disabled={osAprovada}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)] disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={
                  osAprovada
                    ? "OS já aprovada. Ações bloqueadas."
                    : "Descreva o ajuste necessário ou uma observação da aprovação..."
                }
              />
            </div>

            {osAprovada ? (
              <div className="mt-4 rounded-2xl border border-green-400/30 bg-green-500/10 p-4 text-sm text-green-100">
                Esta OS já foi aprovada. As ações de validação foram bloqueadas.
              </div>
            ) : null}

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

            <div className="mt-5 space-y-3">
              <button
                type="button"
                disabled={Boolean(processando) || osAprovada}
                onClick={() => executarAcao("aprovar")}
                className="h-12 w-full rounded-2xl bg-green-100 text-sm font-semibold text-green-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processando === "aprovar" ? "Aprovando..." : "Aprovar OS"}
              </button>

              <button
                type="button"
                disabled={Boolean(processando) || osAprovada}
                onClick={() => executarAcao("solicitar_ajuste")}
                className="h-12 w-full rounded-2xl bg-red-100 text-sm font-semibold text-red-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processando === "solicitar_ajuste"
                  ? "Solicitando..."
                  : "Solicitar ajuste"}
              </button>


            </div>
          </section>

          <section className="fdl-form-card p-6">
            <h2 className="fdl-section-title">Histórico</h2>

            <div className="mt-5 space-y-3">
              {dados.registros.length > 0 ? (
                dados.registros.map((registro) => (
                  <article
                    key={registro.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <p className="text-xs text-[var(--fdl-cream)]">
                      {formatStatus(registro.status_informado)}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-white/75">
                      {registro.descricao || "Sem descrição."}
                    </p>

                    <p className="mt-2 text-xs text-white/40">
                      {registro.usuario_nome || "Usuário"} ·{" "}
                      {formatDateTime(registro.criado_em)}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/50">
                  Nenhum registro encontrado.
                </div>
              )}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
