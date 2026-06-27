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
  const inicioOperacoes = lerCelula(sheet, "D9");

  const clientePlanilhaGenerico =
    !clienteCelula ||
    clienteCelula.toLowerCase().includes("modelo") ||
    clienteCelula.toLowerCase().includes("cliente");

  const clienteFinal = clientePlanilhaGenerico
    ? infoArquivo.cliente
    : clienteCelula;

  const preview: CronogramaPreview = {
    arquivo: file.name,
    aba,
    cliente: clienteFinal || "Não identificado",
    shopping: clienteFinal || "Não identificado",
    uf: infoArquivo.uf || "Não identificado",
    responsavelComercial: responsavelComercial || "Não informado",
    equipe: equipe || "Não informada",
    inicioOperacoes: inicioOperacoes || "Não informado",
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
    const responsavelLinha = limparTexto(row[10]) || preview.responsavelComercial;
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
      "UF não identificada pelo nome do arquivo. Na próxima fase será possível revisar antes de gravar."
    );
  }

  return preview;
}

export default function ImportarClient() {
  const [preview, setPreview] = useState<CronogramaPreview | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

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

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--fdl-cream)]">
              Fase 1
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Ler cronograma e gerar prévia
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
              Nesta etapa o sistema apenas lê o Excel e mostra o que será
              importado. Nada é gravado no Supabase ainda.
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

            {erro ? (
              <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                {erro}
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h3 className="text-lg font-semibold">Como o sistema interpreta</h3>

            <div className="mt-4 space-y-3 text-sm text-white/65">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                IDs inteiros, como <strong>1</strong>, <strong>2</strong> e{" "}
                <strong>3</strong>, viram etapas.
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                IDs com ponto, como <strong>2.1</strong> e{" "}
                <strong>2.2</strong>, viram OSs.
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                Datas, equipe, responsável e progresso são puxados das colunas
                padrão do cronograma.
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
              <strong className="mt-3 block text-3xl">Prévia</strong>
              <span className="mt-2 block text-sm text-yellow-600">
                nada gravado ainda
              </span>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
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
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
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

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">OSs identificadas</h2>
                <p className="mt-1 text-sm text-white/50">
                  Amostra das primeiras OSs que serão criadas.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10">
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
                disabled
                className="mt-6 h-12 w-full cursor-not-allowed rounded-2xl bg-white/10 text-sm font-semibold text-white/45"
              >
                Confirmar importação será liberado na próxima etapa
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}