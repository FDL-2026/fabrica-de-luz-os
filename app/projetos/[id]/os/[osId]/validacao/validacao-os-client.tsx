"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FdlToast from "@/components/ui/fdl-toast";

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

type ImpactoValidacao = {
  projeto_id: string;
  os_id: string;
  codigo_os: string | null;
  codigo_cronograma: string | null;
  servico: string | null;
  status: string | null;
  status_validacao: string | null;
  inicio_previsto: string | null;
  termino_previsto: string | null;
  duracao_dias: number | null;
  total_dias_ponderados: number | null;
  peso_percentual: number | null;
  progresso_validado_atual: number | null;
  progresso_validado_se_aprovar: number | null;
  impacto_aprovacao: number | null;
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

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatPercent(value: unknown) {
  return `${toNumber(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function formatNumber(value: unknown) {
  return toNumber(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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
  const [acaoConfirmacao, setAcaoConfirmacao] = useState<AcaoValidacao | null>(
    null
  );
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [observacao, setObservacao] = useState("");
  const [dados, setDados] = useState<PayloadValidacao>({
    os: null,
    arquivos: [],
    registros: [],
  });
  const [impacto, setImpacto] = useState<ImpactoValidacao | null>(null);
  const [arquivoAberto, setArquivoAberto] = useState<number | null>(null);

  const totalArquivos = dados.arquivos.length;

  useEffect(() => {
    if (arquivoAberto === null) return;

    function aoTeclar(event: KeyboardEvent) {
      if (event.key === "Escape") setArquivoAberto(null);

      if (event.key === "ArrowRight") {
        setArquivoAberto((atual) =>
          atual === null ? null : (atual + 1) % totalArquivos
        );
      }

      if (event.key === "ArrowLeft") {
        setArquivoAberto((atual) =>
          atual === null ? null : (atual - 1 + totalArquivos) % totalArquivos
        );
      }
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [arquivoAberto, totalArquivos]);

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
      setImpacto(null);
      setCarregando(false);
      return;
    }

    const payload = data as PayloadValidacao | null;

    setDados({
      os: payload?.os ?? null,
      arquivos: payload?.arquivos ?? [],
      registros: payload?.registros ?? [],
    });

    const { data: impactoData, error: impactoError } = await supabase.rpc(
      "fdl_obter_impacto_validacao_os",
      {
        p_projeto_id: projetoId,
        p_os_id: osId,
      }
    );

    if (impactoError) {
      console.error("Erro ao carregar impacto da validação", impactoError);
      setImpacto(null);
    } else {
      const impactoItem = Array.isArray(impactoData)
        ? impactoData[0]
        : impactoData;

      setImpacto((impactoItem ?? null) as ImpactoValidacao | null);
    }

    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, [projetoId, osId, supabase]);

  function solicitarConfirmacao(acao: AcaoValidacao) {
    setErro("");
    setSucesso("");

    if (acao === "solicitar_ajuste" && !observacao.trim()) {
      setErro("Informe o ajuste que precisa ser feito antes de solicitar correção.");
      return;
    }

    setAcaoConfirmacao(acao);
  }

  async function executarAcao(acao: AcaoValidacao) {
    setAcaoConfirmacao(null);
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
      <div className="space-y-6" aria-busy="true" aria-label="Carregando validação">
        <div className="fdl-skeleton h-40 w-full" />
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="fdl-skeleton h-96" />
          <div className="fdl-skeleton h-96" />
        </div>
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

            {impacto ? (
              <div className="mt-4 rounded-2xl border border-[var(--fdl-cream)]/30 bg-[var(--fdl-cream)]/10 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fdl-cream)]">
                      Impacto no progresso validado
                    </p>

                    <h3 className="mt-2 text-2xl font-black text-white">
                      +{formatPercent(impacto.impacto_aprovacao)}
                    </h3>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                      {toNumber(impacto.impacto_aprovacao) > 0
                        ? "Ao aprovar esta OS, este será o avanço oficial no progresso validado do projeto."
                        : "Esta OS já está aprovada ou não gera impacto adicional no progresso validado."}
                    </p>
                  </div>

                  <div className="grid min-w-[260px] gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                        Duração
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {formatNumber(impacto.duracao_dias)} dia(s)
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                        Peso da OS
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {formatPercent(impacto.peso_percentual)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                        Atual
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {formatPercent(impacto.progresso_validado_atual)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                        Após aprovação
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {formatPercent(impacto.progresso_validado_se_aprovar)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

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
            <div className="flex items-center justify-between gap-3">
              <h2 className="fdl-section-title">Fotos e vídeos enviados</h2>

              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                {dados.arquivos.length} registro(s)
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {dados.arquivos.length > 0 ? (
                dados.arquivos.map((arquivo, indice) => {
                  const miniatura = arquivo.external_file_id
                    ? `/api/anexos/${arquivo.external_file_id}?thumb=1`
                    : null;

                  const ehVideo =
                    arquivo.tipo === "video" ||
                    (arquivo.mime_type ?? "").startsWith("video/");

                  return (
                    <button
                      key={arquivo.id}
                      type="button"
                      onClick={() => setArquivoAberto(indice)}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:border-[var(--fdl-cream)]/60"
                    >
                      <div className="relative flex h-32 w-full items-center justify-center bg-white/[0.03]">
                        {miniatura ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={miniatura}
                            alt={arquivo.nome_arquivo || "Registro da OS"}
                            loading="lazy"
                            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-3xl">
                            {ehVideo ? "🎬" : "📷"}
                          </span>
                        )}

                        {ehVideo ? (
                          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                            ▶ vídeo
                          </span>
                        ) : null}
                      </div>

                      <p className="truncate px-3 py-2 text-xs font-semibold text-white/70">
                        {arquivo.nome_arquivo || "Arquivo"}
                      </p>
                    </button>
                  );
                })
              ) : (
                <div className="col-span-full rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/50">
                  Nenhuma foto ou vídeo vinculado a esta OS.
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-white/40">
              Clique em um registro para visualizar aqui mesmo. Use as setas do
              teclado para alternar entre os anexos.
            </p>
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

            <FdlToast mensagem={sucesso} onFechar={() => setSucesso("")} />

            <div className="mt-5 space-y-3">
              <button
                type="button"
                disabled={Boolean(processando) || osAprovada}
                onClick={() => solicitarConfirmacao("aprovar")}
                className="h-12 w-full rounded-2xl bg-green-100 text-sm font-semibold text-green-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processando === "aprovar" ? "Aprovando..." : "Aprovar OS"}
              </button>

              <button
                type="button"
                disabled={Boolean(processando) || osAprovada}
                onClick={() => solicitarConfirmacao("solicitar_ajuste")}
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

      {arquivoAberto !== null && dados.arquivos[arquivoAberto] ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Visualizador de anexos"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {dados.arquivos[arquivoAberto].nome_arquivo || "Arquivo"}
              </p>
              <p className="text-xs text-white/50">
                {arquivoAberto + 1} de {totalArquivos} anexo(s)
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {dados.arquivos[arquivoAberto].url_visualizacao ? (
                <a
                  href={dados.arquivos[arquivoAberto].url_visualizacao ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-ghost"
                >
                  Abrir original
                </a>
              ) : null}

              <button
                type="button"
                onClick={() => setArquivoAberto(null)}
                aria-label="Fechar visualizador"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white transition hover:bg-white/25"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="relative flex-1">
            {dados.arquivos[arquivoAberto].external_file_id ? (
              (dados.arquivos[arquivoAberto].tipo === "video" ||
                (dados.arquivos[arquivoAberto].mime_type ?? "").startsWith(
                  "video/"
                )) ? (
                <video
                  key={dados.arquivos[arquivoAberto].id}
                  src={`/api/anexos/${dados.arquivos[arquivoAberto].external_file_id}`}
                  controls
                  autoPlay
                  playsInline
                  className="absolute bottom-4 left-14 right-14 top-0 sm:left-16 sm:right-16 h-auto rounded-2xl border border-white/10 bg-black object-contain"
                />
              ) : (
                <div className="absolute bottom-4 left-14 right-14 top-0 sm:left-16 sm:right-16 flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={dados.arquivos[arquivoAberto].id}
                    src={`/api/anexos/${dados.arquivos[arquivoAberto].external_file_id}`}
                    alt={dados.arquivos[arquivoAberto].nome_arquivo || "Anexo"}
                    className="h-full w-full object-contain"
                  />
                </div>
              )
            ) : (
              <div className="absolute bottom-4 left-14 right-14 top-0 sm:left-16 sm:right-16 flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] text-white/60">
                <span className="text-4xl">📄</span>
                <p className="text-sm">
                  Este arquivo não tem pré-visualização disponível.
                </p>
              </div>
            )}

            {totalArquivos > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setArquivoAberto(
                      (arquivoAberto - 1 + totalArquivos) % totalArquivos
                    )
                  }
                  aria-label="Anexo anterior"
                  className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl font-black text-white transition hover:bg-[var(--fdl-cream)] hover:text-[var(--fdl-purple-dark)]"
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setArquivoAberto((arquivoAberto + 1) % totalArquivos)
                  }
                  aria-label="Próximo anexo"
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl font-black text-white transition hover:bg-[var(--fdl-cream)] hover:text-[var(--fdl-purple-dark)]"
                >
                  ›
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {acaoConfirmacao ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[var(--fdl-purple-deep)] p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--fdl-cream)]">
              Confirmação
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              {acaoConfirmacao === "aprovar"
                ? "Aprovar esta OS?"
                : "Solicitar ajuste desta OS?"}
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/65">
              {acaoConfirmacao === "aprovar"
                ? "A OS será marcada como aprovada e o progresso validado do projeto será atualizado. Esta ação bloqueia novas validações da OS."
                : "A OS voltará para o montador com a orientação escrita na observação."}
            </p>

            {acaoConfirmacao === "aprovar" && impacto?.impacto_aprovacao ? (
              <p className="mt-3 rounded-2xl border border-[var(--fdl-cream)]/30 bg-[var(--fdl-cream)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--fdl-cream)]">
                Impacto: +{formatNumber(impacto.impacto_aprovacao)} p.p. no
                progresso do projeto ({formatPercent(
                  impacto.progresso_validado_atual
                )}{" "}
                → {formatPercent(impacto.progresso_validado_se_aprovar)})
              </p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setAcaoConfirmacao(null)}
                className="h-12 flex-1 rounded-2xl border border-white/15 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => executarAcao(acaoConfirmacao)}
                className={`h-12 flex-1 rounded-2xl text-sm font-bold transition hover:brightness-95 ${
                  acaoConfirmacao === "aprovar"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {acaoConfirmacao === "aprovar"
                  ? "Confirmar aprovação"
                  : "Confirmar ajuste"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
