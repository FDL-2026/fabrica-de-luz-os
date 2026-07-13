"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FdlToast from "@/components/ui/fdl-toast";
import { lerRpcComCache } from "@/lib/offline/cache";
import {
  contarFotosPendentesDaOs,
  enfileirarFoto,
  enfileirarRegistro,
  enfileirarStatus,
  ouvirFila,
} from "@/lib/offline/fila";
import {
  TIPOS_OCORRENCIA,
  ROTULO_OCORRENCIA,
  ehOcorrencia,
} from "@/lib/ocorrencias";

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

const MINIMO_REGISTROS_CONCLUSAO = 7;

function estaOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function ehFalhaDeRede(mensagem: string) {
  return /failed to fetch|load failed|networkerror|network request failed|fetch/i.test(
    mensagem
  );
}

// Extrai o id do arquivo do Drive do link de visualização (webViewLink).
function idDoDriveUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
  return m ? m[1] : null;
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

export default function OsDetalheClient({
  codigo,
  projetoId,
  osId,
}: OsDetalheClientProps) {
  const supabase = createClient();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvandoRegistro, setSalvandoRegistro] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [os, setOs] = useState<OsDetalhe | null>(null);
  const [registros, setRegistros] = useState<RegistroOs[]>([]);
  const [arquivos, setArquivos] = useState<ArquivoOs[]>([]);
  const [arquivosSelecionados, setArquivosSelecionados] = useState<File[]>([]);
  const [inputArquivosKey, setInputArquivosKey] = useState(0);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [progressoUpload, setProgressoUpload] = useState("");
  const [fotosPendentes, setFotosPendentes] = useState(0);
  const [lightbox, setLightbox] = useState<{ src: string; video: boolean } | null>(
    null
  );

  function adicionarArquivos(novos: FileList | null) {
    if (!novos || novos.length === 0) return;

    setArquivosSelecionados((atuais) => {
      const lista = [...atuais];

      for (const arquivo of Array.from(novos)) {
        const duplicado = lista.some(
          (item) => item.name === arquivo.name && item.size === arquivo.size
        );

        if (!duplicado) lista.push(arquivo);
      }

      return lista;
    });
  }

  function removerArquivoSelecionado(indice: number) {
    setArquivosSelecionados((atuais) =>
      atuais.filter((_, posicao) => posicao !== indice)
    );
  }
  const [usuarioId, setUsuarioId] = useState("");
  const [montadorNome, setMontadorNome] = useState("");
  const [observacao, setObservacao] = useState("");
  const [tipoRegistro, setTipoRegistro] = useState("acompanhamento");
  const [descricaoRegistro, setDescricaoRegistro] = useState("");
  const [percentualRegistro, setPercentualRegistro] = useState(0);

  async function carregarRegistros(usuarioIdMontador: string) {
    const { data, error } = await lerRpcComCache<RegistroOs>(
      supabase,
      "listar_registros_os_montador",
      {
        p_usuario_id: usuarioIdMontador,
        p_projeto_id: projetoId,
        p_os_id: osId,
      }
    );

    if (error) {
      setErro(error);
      setRegistros([]);
      return;
    }

    setRegistros(data ?? []);
  }

  async function carregarArquivos(usuarioIdMontador: string) {
    const { data, error } = await lerRpcComCache<ArquivoOs>(
      supabase,
      "listar_arquivos_os_montador",
      {
        p_usuario_id: usuarioIdMontador,
        p_projeto_id: projetoId,
        p_os_id: osId,
      }
    );

    if (error) {
      setErro(error);
      setArquivos([]);
      return;
    }

    setArquivos(data ?? []);
    setFotosPendentes(await contarFotosPendentesDaOs(osId));
  }

  async function carregarOs(usuarioIdMontador: string) {
    const { data, error } = await lerRpcComCache<OsDetalhe>(
      supabase,
      "obter_os_montador",
      {
        p_usuario_id: usuarioIdMontador,
        p_projeto_id: projetoId,
        p_os_id: osId,
      }
    );

    if (error) {
      setErro(error);
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
    setPercentualRegistro(
      typeof resultado.progresso === "number"
        ? Math.max(0, Math.min(100, Math.round(resultado.progresso)))
        : 0
    );

    await carregarRegistros(usuarioIdMontador);
    await carregarArquivos(usuarioIdMontador);

    setCarregando(false);
  }

  useEffect(() => {
    async function iniciar() {
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

      setUsuarioId(dados.usuarioId);
      setMontadorNome(dados.nome ?? "Montador");

      await carregarOs(dados.usuarioId);
    }

    iniciar();
  }, [codigo, projetoId, osId]);

  // Mantém o contador de fotos na fila em dia (ex.: quando a sync as envia).
  useEffect(() => {
    const recarregar = () => {
      contarFotosPendentesDaOs(osId).then(setFotosPendentes);
    };
    recarregar();
    return ouvirFila(recarregar);
  }, [osId]);

  async function atualizarStatus(novoStatus: "em_andamento" | "concluida") {
    if (!usuarioId || !os) return;

    setErro("");
    setSucesso("");
    setSalvando(true);

    const mensagemFila =
      novoStatus === "em_andamento"
        ? "OS marcada como iniciada. Será enviada quando a conexão voltar."
        : "OS marcada como concluída. Será enviada quando a conexão voltar.";

    if (estaOffline()) {
      await enfileirarStatus({
        usuarioId,
        projetoId,
        osId,
        status: novoStatus,
        observacao,
      });
      setSucesso(mensagemFila);
      setSalvando(false);
      return;
    }

    const { data, error } = await supabase.rpc("atualizar_status_os_montador", {
      p_usuario_id: usuarioId,
      p_projeto_id: projetoId,
      p_os_id: osId,
      p_status: novoStatus,
      p_observacao: observacao,
    });

    if (error) {
      if (ehFalhaDeRede(error.message)) {
        await enfileirarStatus({
          usuarioId,
          projetoId,
          osId,
          status: novoStatus,
          observacao,
        });
        setSucesso(mensagemFila);
        setSalvando(false);
        return;
      }
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

  async function salvarRegistro() {
    if (!usuarioId || !os) return;

    // Ocorrência exige ao menos 1 foto (evidência): enviada, na fila ou selecionada.
    const ehOcorr = ehOcorrencia(tipoRegistro);
    if (
      ehOcorr &&
      arquivos.length === 0 &&
      fotosPendentes === 0 &&
      arquivosSelecionados.length === 0
    ) {
      setSucesso("");
      setErro(
        'Para registrar uma ocorrência, anexe ao menos 1 foto na seção "Anexos" acima (📷 Tirar foto / 🖼 Da galeria).'
      );
      return;
    }

    setErro("");
    setSucesso("");
    setSalvandoRegistro(true);

    // Fotos apenas selecionadas: envia/enfileira antes de gravar a ocorrência.
    if (ehOcorr && arquivosSelecionados.length > 0) {
      await enviarArquivos();
      setErro("");
    }

    const enfileirarEsteRegistro = () =>
      enfileirarRegistro({
        usuarioId,
        projetoId,
        osId,
        tipoRegistro,
        descricao: descricaoRegistro,
        percentual: percentualRegistro,
      });

    if (estaOffline()) {
      await enfileirarEsteRegistro();
      setDescricaoRegistro("");
      setTipoRegistro("acompanhamento");
      setSucesso("Registro salvo no aparelho. Será enviado quando a conexão voltar.");
      setSalvandoRegistro(false);
      return;
    }

    const { data, error } = await supabase.rpc("criar_registro_os_montador", {
      p_usuario_id: usuarioId,
      p_projeto_id: projetoId,
      p_os_id: osId,
      p_tipo_registro: tipoRegistro,
      p_descricao: descricaoRegistro,
      p_percentual_execucao: percentualRegistro,
    });

    if (error) {
      if (ehFalhaDeRede(error.message)) {
        await enfileirarEsteRegistro();
        setDescricaoRegistro("");
        setTipoRegistro("acompanhamento");
        setSucesso(
          "Registro salvo no aparelho. Será enviado quando a conexão voltar."
        );
        setSalvandoRegistro(false);
        return;
      }
      setErro(error.message);
      setSalvandoRegistro(false);
      return;
    }

    const resultado = Array.isArray(data) ? data[0] : null;

    if (!resultado) {
      setErro("Não foi possível salvar o registro.");
      setSalvandoRegistro(false);
      return;
    }

    setDescricaoRegistro("");
    setTipoRegistro("acompanhamento");
    setSucesso("Registro salvo com sucesso.");

    await carregarRegistros(usuarioId);

    setSalvandoRegistro(false);
  }

  async function enviarArquivos() {
    if (!usuarioId || arquivosSelecionados.length === 0) return;

    setErro("");
    setSucesso("");
    setEnviandoArquivo(true);

    const total = arquivosSelecionados.length;

    // Offline: guarda tudo na fila de uma vez, sem tentar a rede.
    if (estaOffline()) {
      for (const arquivo of arquivosSelecionados) {
        await enfileirarFoto({
          usuarioId,
          projetoId,
          osId,
          arquivo,
          nomeArquivo: arquivo.name,
        });
      }
      setArquivosSelecionados([]);
      setInputArquivosKey((value) => value + 1);
      setFotosPendentes(await contarFotosPendentesDaOs(osId));
      setSucesso(
        total === 1
          ? "Foto salva no aparelho. Será enviada quando a conexão voltar."
          : `${total} arquivos salvos no aparelho. Serão enviados quando a conexão voltar.`
      );
      setEnviandoArquivo(false);
      return;
    }

    const naoEnviados: File[] = [];
    let enviados = 0;
    let enfileirados = 0;
    let ultimoErro = "";

    for (let indice = 0; indice < total; indice += 1) {
      const arquivo = arquivosSelecionados[indice];

      setProgressoUpload(`Enviando ${indice + 1} de ${total}: ${arquivo.name}`);

      const formData = new FormData();
      formData.append("usuarioId", usuarioId);
      formData.append("projetoId", projetoId);
      formData.append("osId", osId);
      formData.append("file", arquivo);

      try {
        const response = await fetch("/api/montador/os/anexos/upload", {
          method: "POST",
          body: formData,
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          naoEnviados.push(arquivo);
          ultimoErro = payload?.error ?? "Não foi possível enviar o arquivo.";
          continue;
        }

        enviados += 1;
      } catch {
        // Conexão caiu no meio do envio: guarda na fila para reenvio automático.
        await enfileirarFoto({
          usuarioId,
          projetoId,
          osId,
          arquivo,
          nomeArquivo: arquivo.name,
        });
        enfileirados += 1;
      }
    }

    setProgressoUpload("");
    setArquivosSelecionados(naoEnviados);
    setInputArquivosKey((value) => value + 1);
    setFotosPendentes(await contarFotosPendentesDaOs(osId));

    if (naoEnviados.length > 0) {
      setErro(
        `${enviados} de ${total} arquivo(s) enviado(s).${
          enfileirados ? ` ${enfileirados} guardado(s) para reenvio.` : ""
        } ${naoEnviados.length} falharam (${ultimoErro}). Os arquivos que falharam continuam selecionados — toque em enviar para tentar novamente.`
      );
    } else if (enfileirados > 0) {
      setSucesso(
        `${enviados} enviado(s) agora e ${enfileirados} guardado(s) no aparelho para envio automático.`
      );
    } else {
      setSucesso(
        enviados === 1
          ? "Arquivo enviado com sucesso."
          : `${enviados} arquivos enviados com sucesso.`
      );
    }

    await carregarArquivos(usuarioId);
    await carregarRegistros(usuarioId);

    setEnviandoArquivo(false);
  }

  if (carregando) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Carregando OS">
        <div className="fdl-skeleton h-44 w-full" />
        <div className="fdl-skeleton h-64 w-full" />
        <div className="fdl-skeleton h-52 w-full" />
      </div>
    );
  }

  if (erro && !os) {
    return (
      <div className="space-y-5">
        <div className="fdl-alert fdl-alert-error">
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

  const totalRegistrosConclusao =
    arquivos.filter(
      (arquivo) => arquivo.tipo === "foto" || arquivo.tipo === "video"
    ).length + fotosPendentes;

  const registrosFaltantesConclusao = Math.max(
    0,
    MINIMO_REGISTROS_CONCLUSAO - totalRegistrosConclusao
  );

  const temAnexosObrigatorios =
    totalRegistrosConclusao >= MINIMO_REGISTROS_CONCLUSAO;

  const podeConcluir = os.os_status !== "concluida" && temAnexosObrigatorios;

  return (
    <div className="space-y-6">
      {lightbox ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          {lightbox.video ? (
            <video
              src={lightbox.src}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] max-w-full rounded-xl"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.src}
              alt="Arquivo da OS"
              className="max-h-[92vh] max-w-full rounded-xl object-contain"
            />
          )}
          <button
            type="button"
            aria-label="Fechar"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
          >
            ✕
          </button>
        </div>
      ) : null}

      <header className="fdl-form-card p-6">
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

      <section className="fdl-form-card p-6">
        <div className="mb-5">
          <h2 className="fdl-section-title">Dados da OS</h2>
          <p className="fdl-section-subtitle">
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

      <section className="fdl-form-card p-6">
        <h2 className="fdl-section-title">Anexos obrigatórios</h2>
        <p className="fdl-section-subtitle">
          Para concluir a OS, envie no mínimo 7 registros de foto ou vídeo da execução.
          <span className="mt-2 block text-xs font-bold text-[var(--fdl-cream)]">
            {totalRegistrosConclusao}/{MINIMO_REGISTROS_CONCLUSAO} registros
            {registrosFaltantesConclusao > 0
              ? ` · faltam ${registrosFaltantesConclusao}`
              : " · mínimo atingido"}
          </span>
          {fotosPendentes > 0 ? (
            <span className="mt-1 block text-xs font-semibold text-yellow-200/90">
              {fotosPendentes} foto(s) aguardando envio no aparelho.
            </span>
          ) : null}
        </p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--fdl-cream)] text-sm font-bold text-[var(--fdl-purple-dark)] transition hover:brightness-95">
              📷 Tirar foto agora
              <input
                key={`camera-${inputArquivosKey}`}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => adicionarArquivos(event.target.files)}
                className="hidden"
              />
            </label>

            <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.06] text-sm font-bold text-white/85 transition hover:bg-white/10">
              🖼 Escolher da galeria
              <input
                key={`galeria-${inputArquivosKey}`}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(event) => adicionarArquivos(event.target.files)}
                className="hidden"
              />
            </label>
          </div>

          {arquivosSelecionados.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs font-semibold text-white/70">
                {arquivosSelecionados.length} arquivo(s) pronto(s) para envio:
              </p>

              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {arquivosSelecionados.map((arquivo, indice) => (
                  <div
                    key={`${arquivo.name}-${arquivo.size}-${indice}`}
                    className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]"
                  >
                    {arquivo.type.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={URL.createObjectURL(arquivo)}
                        alt={arquivo.name}
                        className="h-20 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-full items-center justify-center text-2xl">
                        🎬
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={enviandoArquivo}
                      onClick={() => removerArquivoSelecionado(indice)}
                      aria-label={`Remover ${arquivo.name}`}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white"
                    >
                      ✕
                    </button>

                    <p className="truncate px-1.5 py-1 text-[10px] text-white/50">
                      {formatBytes(arquivo.size)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {progressoUpload ? (
            <div className="mt-3 rounded-2xl border border-[var(--fdl-cream)]/30 bg-[var(--fdl-cream)]/10 px-4 py-3 text-sm font-semibold text-[var(--fdl-cream)]">
              {progressoUpload}
            </div>
          ) : null}

          <button
            type="button"
            onClick={enviarArquivos}
            disabled={arquivosSelecionados.length === 0 || enviandoArquivo}
            className="mt-4 h-12 w-full rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviandoArquivo
              ? "Enviando..."
              : `Enviar ${arquivosSelecionados.length || ""} foto(s)/vídeo(s)`.replace("  ", " ")}
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {arquivos.length > 0 ? (
            arquivos.map((arquivo) => {
              const fileId = idDoDriveUrl(arquivo.url_visualizacao);
              const ehVideo = arquivo.tipo === "video";
              const ehMidia =
                (arquivo.tipo === "foto" || ehVideo) && !!fileId;
              const base = `/api/montador/os/anexo?usuarioId=${usuarioId}&projetoId=${projetoId}&osId=${osId}&fileId=${fileId}`;

              return (
                <article
                  key={arquivo.arquivo_id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                >
                  <div className="flex items-center gap-3">
                    {ehMidia ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({ src: base, video: ehVideo })
                        }
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`${base}&thumb=1`}
                          alt={arquivo.nome_arquivo || "Arquivo"}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        {ehVideo ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-lg text-white">
                            ▶
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-2xl">
                        {ehVideo ? "🎬" : "📄"}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {formatTipoArquivo(arquivo.tipo)} ·{" "}
                        {arquivo.nome_arquivo || "Arquivo sem nome"}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {formatBytes(arquivo.tamanho_bytes)} ·{" "}
                        {formatDateTime(arquivo.criado_em)}
                      </p>
                      {!ehMidia && arquivo.url_visualizacao ? (
                        <a
                          href={arquivo.url_visualizacao}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs font-semibold text-[var(--fdl-cream)] hover:underline"
                        >
                          Abrir no Drive
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl border border-yellow-400/25 bg-yellow-500/10 p-4 text-sm text-yellow-100">
              Nenhuma foto ou vídeo enviado ainda. A conclusão da OS ficará
              bloqueada até o envio de no mínimo 7 registros.
            </div>
          )}
        </div>
      </section>

      <section className="fdl-form-card p-6">
        <h2 className="fdl-section-title">Status da OS</h2>
        <p className="fdl-section-subtitle">
          Inicie ou conclua a OS conforme o andamento da execução.
        </p>

        <label
          htmlFor="observacao"
          className="mt-5 block text-sm font-semibold text-white"
        >
          Observação rápida para iniciar/concluir
        </label>

        <textarea
          id="observacao"
          value={observacao}
          onChange={(event) => setObservacao(event.target.value)}
          rows={4}
          placeholder="Exemplo: OS iniciada sem pendências. Material conferido no local."
          className="mt-3 w-full rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)] focus:ring-4 focus:ring-[var(--fdl-cream)]/10"
        />

        {erro ? (
          <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            {erro}
          </div>
        ) : null}

        <FdlToast mensagem={sucesso} onFechar={() => setSucesso("")} />

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

        {!temAnexosObrigatorios && os.os_status !== "concluida" ? (
          <p className="mt-3 text-center text-xs text-yellow-100">
            {registrosFaltantesConclusao > 0
              ? `Para concluir a OS, envie mais ${registrosFaltantesConclusao} registro(s) de foto ou vídeo.`
              : "Mínimo de registros atingido. A OS já pode ser concluída."}
          </p>
        ) : null}
      </section>

      <section className="fdl-form-card p-6">
        <h2 className="fdl-section-title">Registro de execução</h2>
        <p className="fdl-section-subtitle">
          Use este campo para registrar andamento, pendências ou observações da
          OS durante a montagem.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_160px]">
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Tipo de registro
            </label>

            <select
              value={tipoRegistro}
              onChange={(event) => setTipoRegistro(event.target.value)}
              className="fdl-field"
            >
              <option className="text-black" value="acompanhamento">
                Acompanhamento
              </option>
              <option className="text-black" value="pendencia">
                Pendência
              </option>
              <option className="text-black" value="observacao">
                Observação
              </option>
              <optgroup className="text-black" label="Ocorrência (dia sem atividade / imprevisto)">
                {TIPOS_OCORRENCIA.map((t) => (
                  <option key={t.valor} className="text-black" value={t.valor}>
                    {t.rotulo}
                  </option>
                ))}
              </optgroup>
            </select>

            {ehOcorrencia(tipoRegistro) ? (
              <p className="mt-2 text-xs font-semibold text-amber-200/90">
                📎 Ocorrências exigem ao menos 1 foto — anexe na seção “Anexos”
                acima antes de salvar.
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Percentual
            </label>

            <input
              type="number"
              min={0}
              max={100}
              value={percentualRegistro}
              onChange={(event) =>
                setPercentualRegistro(Number(event.target.value))
              }
              className="fdl-field"
            />
          </div>
        </div>

        <textarea
          value={descricaoRegistro}
          onChange={(event) => setDescricaoRegistro(event.target.value)}
          rows={5}
          placeholder="Descreva o que foi executado, pendências encontradas, liberações necessárias ou qualquer ponto relevante."
          className="mt-4 w-full rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)] focus:ring-4 focus:ring-[var(--fdl-cream)]/10"
        />

        <button
          type="button"
          onClick={salvarRegistro}
          disabled={
            salvandoRegistro ||
            (!ehOcorrencia(tipoRegistro) && !descricaoRegistro.trim())
          }
          className="mt-4 h-12 w-full rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {salvandoRegistro ? "Salvando registro..." : "Salvar registro"}
        </button>
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
