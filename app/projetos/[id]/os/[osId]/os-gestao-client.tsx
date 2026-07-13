"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROTULO_OCORRENCIA, ehOcorrencia } from "@/lib/ocorrencias";

type OsGestaoClientProps = {
  projetoId: string;
  osId: string;
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
  descricao: string | null;
  equipe: string | null;
  os_status: string | null;
  prioridade: string | null;
  inicio_previsto: string | null;
  termino_previsto: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  progresso: number | null;
  observacao_montador: string | null;
  total_registros: number;
  total_arquivos: number;
  total_fotos_videos: number;
};

type RegistroOs = {
  registro_id: string;
  tipo_registro: string;
  status_informado: string | null;
  descricao: string | null;
  percentual_execucao: number | null;
  criado_em: string;
  usuario_nome: string | null;
  total_arquivos: number;
};

type ArquivoOs = {
  arquivo_id: string;
  registro_id: string;
  tipo: string;
  nome_arquivo: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  url_visualizacao: string | null;
  criado_em: string;
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
    planejamento: "Planejamento",
    em_montagem: "Em montagem",
    concluido: "Concluído",
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
    ...ROTULO_OCORRENCIA,
  };

  return labels[tipo] ?? tipo.replace("_", " ");
}

function formatTipoArquivo(tipo: string | null) {
  if (tipo === "video") return "Vídeo";
  if (tipo === "foto") return "Foto";
  if (tipo === "documento") return "Documento";
  return "Arquivo";
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "Tamanho não informado";

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      return "bg-red-100 text-red-700";

    default:
      return "bg-white/20 text-white";
  }
}

function tipoRegistroClass(tipo: string | null) {
  if (ehOcorrencia(tipo)) return "bg-amber-100 text-amber-800";

  switch (tipo) {
    case "pendencia":
      return "bg-red-100 text-red-700";

    case "conclusao_os":
      return "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]";

    case "inicio_os":
      return "bg-green-100 text-green-700";

    case "anexo":
      return "bg-blue-100 text-blue-700";

    default:
      return "bg-white/15 text-white/80";
  }
}

export default function OsGestaoClient({
  projetoId,
  osId,
}: OsGestaoClientProps) {
  const supabase = createClient();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [os, setOs] = useState<OsGestao | null>(null);
  const [registros, setRegistros] = useState<RegistroOs[]>([]);
  const [arquivos, setArquivos] = useState<ArquivoOs[]>([]);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = `/login?next=/projetos/${projetoId}/os/${osId}`;
        return;
      }

      const [osResult, registrosResult, arquivosResult] = await Promise.all([
        supabase.rpc("obter_os_gestao", {
          p_projeto_id: projetoId,
          p_os_id: osId,
        }),
        supabase.rpc("listar_registros_os_gestao", {
          p_projeto_id: projetoId,
          p_os_id: osId,
        }),
        supabase.rpc("listar_arquivos_os_gestao", {
          p_projeto_id: projetoId,
          p_os_id: osId,
        }),
      ]);

      if (osResult.error) {
        setErro(osResult.error.message);
        setCarregando(false);
        return;
      }

      if (registrosResult.error) {
        setErro(registrosResult.error.message);
        setCarregando(false);
        return;
      }

      if (arquivosResult.error) {
        setErro(arquivosResult.error.message);
        setCarregando(false);
        return;
      }

      const osData = Array.isArray(osResult.data)
        ? (osResult.data[0] as OsGestao | undefined)
        : undefined;

      if (!osData) {
        setErro("OS não encontrada ou você não tem acesso a este projeto.");
        setOs(null);
        setCarregando(false);
        return;
      }

      setOs(osData);
      setRegistros((registrosResult.data ?? []) as RegistroOs[]);
      setArquivos((arquivosResult.data ?? []) as ArquivoOs[]);
      setCarregando(false);
    }

    carregar();
  }, [projetoId, osId]);

  if (carregando) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center text-white/60">
        Carregando detalhe da OS...
      </div>
    );
  }

  if (erro || !os) {
    return (
      <div className="space-y-5">
        <div className="fdl-alert fdl-alert-error">
          {erro || "Não foi possível carregar a OS."}
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

  return (
    <div className="space-y-6">
      <header className="fdl-form-card p-6">
        <a
          href={`/projetos/${projetoId}`}
          className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
        >
          ← Voltar para o projeto
        </a>

        <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          Detalhe administrativo da OS
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          OS {os.codigo_cronograma || os.codigo_os}
        </h1>

        <p className="mt-2 text-sm text-white/60">
          {os.cliente || os.shopping} · {os.uf} · Temporada {os.temporada}
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
            {os.total_fotos_videos} foto/vídeo(s)
          </span>

          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
            {os.total_registros} registro(s)
          </span>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Progresso</p>
          <strong className="mt-2 block text-4xl">
            {Math.round(os.progresso ?? 0)}%
          </strong>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Registros</p>
          <strong className="mt-2 block text-4xl">{os.total_registros}</strong>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Arquivos</p>
          <strong className="mt-2 block text-4xl">{os.total_arquivos}</strong>
        </div>

        <div className="rounded-3xl bg-white p-5 text-[var(--fdl-text-dark)]">
          <p className="text-sm text-[#7d6488]">Fotos/vídeos</p>
          <strong className="mt-2 block text-4xl">
            {os.total_fotos_videos}
          </strong>
        </div>
      </section>

      <section className="fdl-form-card p-6">
        <h2 className="fdl-section-title">Dados da OS</h2>

        <div className="mt-5 grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/40">
              Serviço
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {os.servico || "OS sem descrição"}
            </p>
          </div>

          {os.descricao ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                Descrição
              </p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                {os.descricao}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-white/40">Etapa</p>
              <p className="mt-1 font-semibold text-white">
                {os.etapa_nome || "Etapa não informada"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-white/40">Equipe</p>
              <p className="mt-1 font-semibold text-white">
                {os.equipe || "Equipe não informada"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-white/40">Prioridade</p>
              <p className="mt-1 font-semibold text-white">
                {os.prioridade || "Não informada"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
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

          {os.observacao_montador ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                Observação do montador
              </p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                {os.observacao_montador}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="fdl-form-card p-6">
        <h2 className="fdl-section-title">Fotos e vídeos</h2>
        <p className="fdl-section-subtitle">
          Arquivos enviados pelo montador e armazenados no Google Drive.
        </p>

        <div className="mt-5 space-y-3">
          {arquivos.length > 0 ? (
            arquivos.map((arquivo) => (
              <article
                key={arquivo.arquivo_id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {formatTipoArquivo(arquivo.tipo)} ·{" "}
                      {arquivo.nome_arquivo || "Arquivo sem nome"}
                    </p>

                    <p className="mt-1 text-xs text-white/45">
                      {formatBytes(arquivo.tamanho_bytes)} ·{" "}
                      {formatDateTime(arquivo.criado_em)}
                    </p>
                  </div>

                  {arquivo.url_visualizacao ? (
                    <a
                      href={arquivo.url_visualizacao}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
                    >
                      Abrir no Drive
                    </a>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <div className="fdl-empty-state">
              Nenhum arquivo enviado para esta OS.
            </div>
          )}
        </div>
      </section>

      <section className="fdl-form-card p-6">
        <h2 className="fdl-section-title">Histórico da OS</h2>
        <p className="fdl-section-subtitle">
          Registros criados durante a execução desta ordem de serviço.
        </p>

        <div className="mt-5 space-y-4">
          {registros.length > 0 ? (
            registros.map((registro) => (
              <article
                key={registro.registro_id}
                className="fdl-form-section p-5"
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

                    <p className="mt-3 text-sm text-white/45">
                      {formatDateTime(registro.criado_em)} ·{" "}
                      {registro.usuario_nome || "Usuário não identificado"}
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                    {registro.percentual_execucao ?? 0}%
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-white/75">
                  {registro.descricao || "Sem descrição informada."}
                </p>

                {registro.total_arquivos > 0 ? (
                  <p className="mt-3 text-xs text-white/45">
                    {registro.total_arquivos} arquivo(s) vinculado(s)
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <div className="fdl-empty-state">
              Nenhum registro criado para esta OS ainda.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
