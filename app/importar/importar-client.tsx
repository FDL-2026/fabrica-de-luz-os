"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type CellValue = string | number | boolean | Date | null | undefined;
type RowValue = CellValue[];

type EtapaPreview = {
  id: string;
  tarefa: string;
  inicioPrevisto: string;
  terminoPrevisto: string;
  responsavelComercial: string;
  equipe: string;
};

type OsPreview = {
  id: string;
  etapaId: string;
  etapaNome: string;
  tarefa: string;
  inicioPrevisto: string;
  duracaoPrevista: string;
  terminoPrevisto: string;
  inicioReal: string;
  duracaoReal: string;
  terminoReal: string;
  progresso: string;
  responsavelComercial: string;
  equipe: string;
};

type CronogramaPreview = {
  arquivo: string;
  aba: string;
  cliente: string;
  shopping: string;
  uf: string;
  responsavelComercial: string;
  equipe: string;
  inicioOperacoes: string;
  etapas: EtapaPreview[];
  ordensServico: OsPreview[];
  avisos: string[];
};

type ResultadoImportacao = {
  projeto_id: string;
  projeto_nome: string;
  etapas_processadas: number;
  os_criadas: number;
  os_atualizadas: number;
};

type VinculosImportacao = {
  gestor: string | null;
  montadores: string[];
};

type AlertasImportacao = {
  gestorNaoReconhecido: string | null;
  equipesNaoReconhecidas: string[];
};

type RevisaoImportacao = {
  projetoId: string;
  vinculos: VinculosImportacao;
  alertas: AlertasImportacao;
};

function limparTexto(valor: CellValue) {
  if (valor === null || valor === undefined) return "";

  return String(valor)
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function lerCelula(sheet: XLSX.WorkSheet, endereco: string) {
  const celula = sheet[endereco];

  if (!celula) return "";

  return limparTexto(celula.w ?? celula.v);
}

function formatarData(valor: CellValue) {
  if (valor === null || valor === undefined || valor === "") return "";

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toLocaleDateString("pt-BR");
  }

  if (typeof valor === "number") {
    const parsed = XLSX.SSF.parse_date_code(valor);

    if (parsed) {
      const dia = String(parsed.d).padStart(2, "0");
      const mes = String(parsed.m).padStart(2, "0");
      const ano = String(parsed.y);

      return `${dia}/${mes}/${ano}`;
    }
  }

  return limparTexto(valor);
}

function formatarNumero(valor: CellValue) {
  if (valor === null || valor === undefined || valor === "") return "";

  if (typeof valor === "number") {
    return String(valor).replace(".", ",");
  }

  return limparTexto(valor);
}

function formatarProgresso(valor: CellValue) {
  if (valor === null || valor === undefined || valor === "") return "0%";

  if (typeof valor === "number") {
    if (valor <= 1) {
      return `${Math.round(valor * 100)}%`;
    }

    return `${Math.round(valor)}%`;
  }

  const texto = limparTexto(valor);

  if (!texto) return "0%";

  return texto.includes("%") ? texto : `${texto}%`;
}

function extrairClienteDaCelula(valor: string) {
  const texto = valor.trim();

  if (!texto) return "";

  return texto
    .replace(/^cliente\s*:/i, "")
    .replace(/^shopping\s*:/i, "")
    .trim();
}

function extrairInfoDoNomeArquivo(nomeArquivo: string) {
  const semExtensao = nomeArquivo.replace(/\.(xlsx|xlsm|xls)$/i, "");

  const limpo = semExtensao
    .replace(/^cronograma\s*-\s*/i, "")
    .replace(/\s*-\s*em andamento$/i, "")
    .trim();

  const partes = limpo
    .split(" - ")
    .map((parte) => parte.trim())
    .filter(Boolean);

  let uf = "";

  if (partes.length > 1 && /^[A-Z]{2}$/i.test(partes[partes.length - 1])) {
    uf = partes.pop()?.toUpperCase() ?? "";
  }

  const cliente = partes.join(" - ").trim();

  return {
    cliente,
    uf,
  };
}

function ehLinhaEtapa(id: string) {
  return /^\d+$/.test(id);
}

function ehLinhaOs(id: string) {
  return /^\d+\.\d+/.test(id);
}

function encontrarAbaCronograma(workbook: XLSX.WorkBook) {
  const abaCronograma = workbook.SheetNames.find(
    (nome) => nome.toLowerCase().trim() === "cronograma"
  );

  return abaCronograma ?? workbook.SheetNames[0];
}

function interpretarCronograma(file: File, workbook: XLSX.WorkBook) {
  const aba = encontrarAbaCronograma(workbook);
  const sheet = workbook.Sheets[aba];

  if (!sheet) {
    throw new Error("Não foi possível localizar uma aba válida no arquivo.");
  }

  const rows = XLSX.utils.sheet_to_json<RowValue>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  const infoArquivo = extrairInfoDoNomeArquivo(file.name);

  const responsavelComercial = lerCelula(sheet, "B2");
  const equipe = lerCelula(sheet, "B3");
  const clienteCelula = extrairClienteDaCelula(lerCelula(sheet, "B7"));

  const clientePlanilhaGenerico =
    !clienteCelula ||
    clienteCelula.toLowerCase().includes("modelo") ||
    clienteCelula.toLowerCase().includes("cliente");

  const clienteFinal = clientePlanilhaGenerico
    ? infoArquivo.cliente
    : clienteCelula;

  let dataDesembarqueCliente = "";

  rows.forEach((row, index) => {
    const numeroLinhaExcel = index + 1;

    if (numeroLinhaExcel < 13) return;

    const tarefa = limparTexto(row[1])
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (
      !dataDesembarqueCliente &&
      tarefa.includes("desembarque") &&
      tarefa.includes("cliente")
    ) {
      dataDesembarqueCliente = formatarData(row[3]);
    }
  });

  const inicioOperacoes =
    dataDesembarqueCliente || lerCelula(sheet, "D9") || "Não informado";

  const preview: CronogramaPreview = {
    arquivo: file.name,
    aba,
    cliente: clienteFinal || "Não identificado",
    shopping: clienteFinal || "Não identificado",
    uf: infoArquivo.uf || "Não identificado",
    responsavelComercial: responsavelComercial || "Não informado",
    equipe: equipe || "Não informada",
    inicioOperacoes,
    etapas: [],
    ordensServico: [],
    avisos: [],
  };

  let etapaAtual: EtapaPreview | null = null;

  rows.forEach((row, index) => {
    const numeroLinhaExcel = index + 1;

    if (numeroLinhaExcel < 13) return;

    const id = limparTexto(row[0]);
    const tarefa = limparTexto(row[1]);

    if (!id || !tarefa) return;

    const inicioPrevisto = formatarData(row[3]);
    const duracaoPrevista = formatarNumero(row[4]);
    const terminoPrevisto = formatarData(row[5]);
    const inicioReal = formatarData(row[6]);
    const duracaoReal = formatarNumero(row[7]);
    const terminoReal = formatarData(row[8]);
    const progresso = formatarProgresso(row[9]);
    const responsavelLinha =
      limparTexto(row[10]) || preview.responsavelComercial;
    const equipeLinha = limparTexto(row[11]) || preview.equipe;

    if (ehLinhaEtapa(id)) {
      etapaAtual = {
        id,
        tarefa,
        inicioPrevisto,
        terminoPrevisto,
        responsavelComercial: responsavelLinha,
        equipe: equipeLinha,
      };

      preview.etapas.push(etapaAtual);
      return;
    }

    if (ehLinhaOs(id)) {
      const etapaId = id.split(".")[0];

      const etapaDaOs =
        preview.etapas.find((etapa) => etapa.id === etapaId) ?? etapaAtual;

      preview.ordensServico.push({
        id,
        etapaId,
        etapaNome: etapaDaOs?.tarefa ?? "Etapa não identificada",
        tarefa,
        inicioPrevisto,
        duracaoPrevista,
        terminoPrevisto,
        inicioReal,
        duracaoReal,
        terminoReal,
        progresso,
        responsavelComercial: responsavelLinha,
        equipe: equipeLinha,
      });

      if (!etapaDaOs) {
        preview.avisos.push(
          `Linha ${numeroLinhaExcel}: OS ${id} sem etapa principal identificada.`
        );
      }
    }
  });

  if (preview.etapas.length === 0) {
    preview.avisos.push("Nenhuma etapa principal foi identificada.");
  }

  if (preview.ordensServico.length === 0) {
    preview.avisos.push("Nenhuma OS foi identificada.");
  }

  if (preview.uf === "Não identificado") {
    preview.avisos.push(
      "UF não identificada pelo nome do arquivo. Revise antes de confirmar a importação."
    );
  }

  if (!dataDesembarqueCliente) {
    preview.avisos.push(
      "Não foi encontrada uma linha com 'Desembarque no cliente'. O início previsto do projeto pode precisar de revisão."
    );
  }

  return preview;
}

export default function ImportarClient() {
  const [preview, setPreview] = useState<CronogramaPreview | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [revisao, setRevisao] = useState<RevisaoImportacao | null>(null);

  const resumo = useMemo(() => {
    if (!preview) {
      return {
        etapas: 0,
        ordensServico: 0,
        equipes: 0,
      };
    }

    const equipes = new Set(
      preview.ordensServico
        .map((os) => os.equipe)
        .filter((item) => item && item !== "Não informada")
    );

    return {
      etapas: preview.etapas.length,
      ordensServico: preview.ordensServico.length,
      equipes: equipes.size,
    };
  }, [preview]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setErro("");
    setPreview(null);
    setResultado(null);
    setRevisao(null);

    if (!file) return;

    const extensaoValida = /\.(xlsx|xlsm|xls)$/i.test(file.name);

    if (!extensaoValida) {
      setErro("Envie um arquivo Excel válido: .xlsx, .xlsm ou .xls.");
      return;
    }

    setCarregando(true);

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      const cronograma = interpretarCronograma(file, workbook);

      setPreview(cronograma);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível ler o arquivo enviado.";

      setErro(message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleConfirmarImportacao() {
    if (!preview) return;

    setErro("");
    setResultado(null);
    setRevisao(null);
    setConfirmando(true);

    try {
      const response = await fetch("/importar/confirmar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preview),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Não foi possível confirmar a importação.");
      }

      const resultadoImportacao = json?.resultado as ResultadoImportacao | null;

      if (!resultadoImportacao?.projeto_id) {
        throw new Error("A importação foi concluída, mas o projeto não foi retornado.");
      }

      const vinculos: VinculosImportacao = json?.vinculos ?? {
        gestor: null,
        montadores: [],
      };

      const alertas: AlertasImportacao = json?.alertas ?? {
        gestorNaoReconhecido: null,
        equipesNaoReconhecidas: [],
      };

      // Ao concluir, o preview (etapas/OSs) some e sobe o card de "Projeto
      // criado" com os detalhes — sem redirecionar automaticamente.
      setResultado(resultadoImportacao);
      setRevisao({
        projetoId: resultadoImportacao.projeto_id,
        vinculos,
        alertas,
      });
      setPreview(null);
      setConfirmando(false);

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar a importação.";

      setErro(message);
      setConfirmando(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="fdl-form-card p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <h2 className="text-2xl font-bold">
              Ler cronograma e confirmar importação
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
              O sistema lê o Excel, mostra a prévia e, ao confirmar, cria ou
              atualiza o projeto, etapas e OSs automaticamente no Supabase.
            </p>

            <div className="mt-6">
              <label
                htmlFor="arquivo-cronograma"
                className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--fdl-cream)]/50 bg-white/[0.04] px-6 py-10 text-center transition hover:bg-white/[0.07]"
              >
                <span className="text-4xl">📄</span>

                <span className="mt-4 text-lg font-semibold text-white">
                  Selecionar arquivo Excel
                </span>

                <span className="mt-2 text-sm text-white/50">
                  Formatos aceitos: .xlsx, .xlsm ou .xls
                </span>

                <input
                  id="arquivo-cronograma"
                  type="file"
                  accept=".xlsx,.xlsm,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {carregando ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/60">
                Lendo cronograma...
              </div>
            ) : null}

            {confirmando ? (
              <div className="mt-5 rounded-2xl border border-[var(--fdl-cream)]/30 bg-[var(--fdl-cream)]/10 p-4 text-sm text-[var(--fdl-cream)]">
                Confirmando importação e criando dados do projeto...
              </div>
            ) : null}

            {erro ? (
              <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                {erro}
              </div>
            ) : null}

            {resultado ? (
              <div className="mt-5 space-y-4 rounded-2xl border border-green-400/30 bg-green-500/10 p-5">
                <div>
                  <p className="text-lg font-bold text-white">
                    ✓ Projeto criado
                  </p>
                  <p className="mt-1 text-sm text-white/70">
                    <strong>{resultado.projeto_nome}</strong> foi{" "}
                    {resultado.os_atualizadas > 0 && resultado.os_criadas === 0
                      ? "atualizado"
                      : "criado"}{" "}
                    com sucesso.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3 text-center">
                    <p className="text-2xl font-black text-white">
                      {resultado.etapas_processadas}
                    </p>
                    <p className="text-xs text-white/55">etapas</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3 text-center">
                    <p className="text-2xl font-black text-white">
                      {resultado.os_criadas}
                    </p>
                    <p className="text-xs text-white/55">OSs criadas</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3 text-center">
                    <p className="text-2xl font-black text-white">
                      {resultado.os_atualizadas}
                    </p>
                    <p className="text-xs text-white/55">OSs atualizadas</p>
                  </div>
                </div>

                {revisao?.vinculos.gestor ? (
                  <p className="text-sm text-green-100">
                    Gestor vinculado:{" "}
                    <strong>{revisao.vinculos.gestor}</strong>
                  </p>
                ) : null}

                {revisao && revisao.vinculos.montadores.length > 0 ? (
                  <p className="text-sm text-green-100">
                    Montadores vinculados:{" "}
                    <strong>{revisao.vinculos.montadores.join(", ")}</strong>
                  </p>
                ) : null}

                {revisao?.alertas.gestorNaoReconhecido ? (
                  <div className="rounded-xl border border-yellow-400/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
                    Gestor não reconhecido:{" "}
                    <strong>{revisao.alertas.gestorNaoReconhecido}</strong>.
                    Defina o gestor na tela de Equipe do projeto.
                  </div>
                ) : null}

                {revisao && revisao.alertas.equipesNaoReconhecidas.length > 0 ? (
                  <div className="rounded-xl border border-yellow-400/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
                    <p>
                      Equipes sem montador reconhecido — cadastre em Usuários e
                      vincule na Equipe do projeto:
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-yellow-100/85">
                      {revisao.alertas.equipesNaoReconhecidas.map((nome) => (
                        <li key={nome}>{nome}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <a
                    href={`/projetos/${resultado.projeto_id}`}
                    className="h-11 flex-1 rounded-2xl bg-[var(--fdl-cream)] px-5 text-center text-sm font-semibold leading-[2.75rem] text-[var(--fdl-purple-dark)] transition hover:brightness-95"
                  >
                    Abrir projeto
                  </a>

                  <a
                    href={`/projetos/${resultado.projeto_id}/equipe`}
                    className="h-11 flex-1 rounded-2xl border border-white/15 px-5 text-center text-sm font-semibold leading-[2.75rem] text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    Ir para Equipe do projeto
                  </a>
                </div>
              </div>
            ) : null}
          </div>

          <div className="fdl-form-section p-5">
            <h3 className="text-lg font-semibold">Como o sistema grava</h3>

            <div className="mt-4 space-y-3 text-sm text-white/65">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                IDs inteiros viram etapas do projeto.
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                IDs com ponto viram OSs vinculadas à etapa correspondente.
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                Se o projeto já existir, as etapas e OSs são atualizadas em vez
                de duplicadas.
              </div>
            </div>
          </div>
        </div>
      </section>

      {preview ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Etapas</p>
              <strong className="mt-3 block text-4xl">{resumo.etapas}</strong>
              <span className="mt-2 block text-sm text-[#7d6488]">
                identificadas no arquivo
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">OSs</p>
              <strong className="mt-3 block text-4xl">
                {resumo.ordensServico}
              </strong>
              <span className="mt-2 block text-sm text-[#7d6488]">
                serão criadas automaticamente
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Equipes</p>
              <strong className="mt-3 block text-4xl">{resumo.equipes}</strong>
              <span className="mt-2 block text-sm text-[#7d6488]">
                encontradas nas OSs
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Status</p>
              <strong className="mt-3 block text-3xl">Pronto</strong>
              <span className="mt-2 block text-sm text-green-600">
                prévia gerada
              </span>
            </div>
          </section>

          <section className="fdl-form-card p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Dados do projeto</h2>
              <p className="mt-1 text-sm text-white/50">
                Informações identificadas automaticamente no cronograma.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                  Arquivo
                </p>
                <p className="mt-2 font-semibold">{preview.arquivo}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                  Cliente / shopping
                </p>
                <p className="mt-2 font-semibold">{preview.cliente}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                  UF
                </p>
                <p className="mt-2 font-semibold">{preview.uf}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                  Responsável comercial
                </p>
                <p className="mt-2 font-semibold">
                  {preview.responsavelComercial}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                  Equipe
                </p>
                <p className="mt-2 font-semibold">{preview.equipe}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                  Início das operações
                </p>
                <p className="mt-2 font-semibold">{preview.inicioOperacoes}</p>
              </div>
            </div>

            {preview.avisos.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4">
                <p className="font-semibold text-yellow-100">
                  Pontos para revisar
                </p>

                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-yellow-100/80">
                  {preview.avisos.map((aviso) => (
                    <li key={aviso}>{aviso}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="fdl-form-card p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">Etapas identificadas</h2>
                <p className="mt-1 text-sm text-white/50">
                  IDs inteiros do cronograma.
                </p>
              </div>

              <div className="space-y-3">
                {preview.etapas.map((etapa) => (
                  <article
                    key={etapa.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--fdl-cream)]">
                      Etapa {etapa.id}
                    </p>

                    <h3 className="mt-2 font-semibold">{etapa.tarefa}</h3>

                    <p className="mt-2 text-sm text-white/50">
                      {etapa.inicioPrevisto || "Sem início"} até{" "}
                      {etapa.terminoPrevisto || "sem término"}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <div className="fdl-form-card p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">OSs identificadas</h2>
                <p className="mt-1 text-sm text-white/50">
                  Amostra das primeiras OSs que serão criadas ou atualizadas.
                </p>
              </div>

              <div className="fdl-table-wrap">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-white/10 text-white/70">
                    <tr>
                      <th className="px-4 py-3">OS</th>
                      <th className="px-4 py-3">Tarefa</th>
                      <th className="px-4 py-3">Período</th>
                      <th className="px-4 py-3">Equipe</th>
                      <th className="px-4 py-3">Progresso</th>
                    </tr>
                  </thead>

                  <tbody>
                    {preview.ordensServico.slice(0, 25).map((os) => (
                      <tr key={os.id} className="border-t border-white/10">
                        <td className="px-4 py-3 font-semibold">{os.id}</td>

                        <td className="px-4 py-3 text-white/70">
                          <p>{os.tarefa}</p>
                          <p className="mt-1 text-xs text-white/40">
                            {os.etapaNome}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-white/70">
                          {os.inicioPrevisto || "-"} até{" "}
                          {os.terminoPrevisto || "-"}
                        </td>

                        <td className="px-4 py-3 text-white/70">
                          {os.equipe || "Não informada"}
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[var(--fdl-cream)] px-3 py-1 text-xs font-semibold text-[var(--fdl-purple-dark)]">
                            {os.progresso}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.ordensServico.length > 25 ? (
                <p className="mt-3 text-sm text-white/45">
                  Exibindo 25 de {preview.ordensServico.length} OSs
                  identificadas.
                </p>
              ) : null}

              <button
                type="button"
                onClick={handleConfirmarImportacao}
                disabled={
                  confirmando ||
                  preview.ordensServico.length === 0 ||
                  Boolean(revisao)
                }
                className="mt-6 h-12 w-full rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {confirmando
                  ? "Confirmando importação..."
                  : revisao
                    ? "Importação concluída"
                    : "Confirmar importação e criar projeto"}
              </button>

              <p className="mt-3 text-center text-xs text-white/40">
                Após confirmar, o sistema abrirá automaticamente a página do
                projeto criado ou atualizado.
              </p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}