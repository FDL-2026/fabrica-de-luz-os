"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Row } from "exceljs";
import { createClient } from "@/lib/supabase/client";
import { MOTIVO_OCORRENCIA } from "@/lib/ocorrencias";

type Resumo = {
  total_projetos: number;
  total_os: number;
  os_concluidas: number;
  os_no_prazo: number;
  os_atrasadas: number;
  pct_sla_os: number;
  projetos_avaliados: number;
  projetos_no_prazo: number;
  pct_sla_projeto: number;
  dias_atraso_os: number;
  ocorrencias_total: number;
  ocorrencias_por_tipo: Record<string, number>;
  chamados_total: number;
  chamados_no_prazo: number;
  pct_sla_chamados: number;
};

type SlaOs = {
  projeto: string | null;
  uf: string | null;
  codigo: string | null;
  etapa: string | null;
  servico: string | null;
  termino_previsto: string | null;
  concluido_em: string | null;
  no_prazo: boolean | null;
  dias_atraso: number | null;
  status: string | null;
};

type SlaProjeto = {
  projeto: string | null;
  uf: string | null;
  gestor: string | null;
  data_fim: string | null;
  conclusao: string | null;
  no_prazo: boolean | null;
  dias_atraso: number | null;
  total_os: number;
  concluidas: number;
};

type Ocorrencia = {
  projeto: string | null;
  uf: string | null;
  data: string | null;
  tipo: string | null;
  descricao: string | null;
  montador: string | null;
};

type ChamadoSla = {
  protocolo: string | null;
  projeto: string | null;
  prioridade: string | null;
  aberto_em: string | null;
  resolvido_em: string | null;
  horas: number | null;
  prazo_horas: number | null;
  cumpriu: boolean | null;
};

type SlaGestor = {
  gestor: string | null;
  projetos: number;
  total_os: number;
  os_no_prazo: number;
  os_atrasadas: number;
  pct_sla_os: number;
  dias_atraso_os: number;
  projetos_avaliados: number;
  projetos_no_prazo: number;
  pct_sla_projeto: number;
  ocorrencias_total: number;
  chamados_total: number;
  chamados_no_prazo: number;
  pct_sla_chamados: number;
};

type Dados = {
  resumo: Resumo;
  slaOs: SlaOs[];
  slaProjeto: SlaProjeto[];
  ocorrencias: Ocorrencia[];
  chamados: ChamadoSla[];
  slaGestor: SlaGestor[];
};

function pct(v: number | null | undefined) {
  return `${Math.round(Number(v ?? 0))}%`;
}

function dataBR(v: string | null) {
  if (!v) return "";
  const somenteData = String(v).split("T")[0];
  const partes = somenteData.split("-");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return v;
}

function dataHoraBR(v: string | null) {
  if (!v) return "";
  return new Date(v).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function simNao(v: boolean | null) {
  if (v === null || v === undefined) return "—";
  return v ? "Sim" : "Não";
}

function corPct(v: number) {
  return v >= 90
    ? "bg-green-100 text-green-700"
    : v >= 70
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-700";
}

const PRIORIDADE_LABEL: Record<string, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export default function TemporadaClient() {
  const supabase = useMemo(() => createClient(), []);

  const [temporadas, setTemporadas] = useState<string[]>([]);
  const [temporada, setTemporada] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [gerandoExcel, setGerandoExcel] = useState(false);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<Dados | null>(null);

  useEffect(() => {
    supabase.rpc("fdl_listar_temporadas").then(({ data, error }) => {
      if (error) return;
      const lista = ((data ?? []) as { temporada: string }[]).map(
        (t) => t.temporada
      );
      setTemporadas(lista);
      if (lista.length > 0) setTemporada((atual) => atual || lista[0]);
    });
  }, [supabase]);

  const gerar = useCallback(async () => {
    if (!temporada) return;
    setCarregando(true);
    setErro("");
    setDados(null);

    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      supabase.rpc("fdl_relatorio_resumo_temporada", { p_temporada: temporada }),
      supabase.rpc("fdl_relatorio_sla_os", { p_temporada: temporada }),
      supabase.rpc("fdl_relatorio_sla_projeto", { p_temporada: temporada }),
      supabase.rpc("fdl_relatorio_ocorrencias", { p_temporada: temporada }),
      supabase.rpc("fdl_relatorio_sla_chamados", { p_temporada: temporada }),
      supabase.rpc("fdl_relatorio_sla_por_gestor", { p_temporada: temporada }),
    ]);

    // r6 (SLA por gestor) é opcional: se a RPC ainda não existir no banco,
    // o relatório continua funcionando sem essa quebra.
    const primeiroErro = r1.error || r2.error || r3.error || r4.error || r5.error;
    if (primeiroErro) {
      setErro(primeiroErro.message);
      setCarregando(false);
      return;
    }

    setDados({
      resumo: (Array.isArray(r1.data) ? r1.data[0] : r1.data) as Resumo,
      slaOs: (r2.data ?? []) as SlaOs[],
      slaProjeto: (r3.data ?? []) as SlaProjeto[],
      ocorrencias: (r4.data ?? []) as Ocorrencia[],
      chamados: (r5.data ?? []) as ChamadoSla[],
      slaGestor: (r6.data ?? []) as SlaGestor[],
    });
    setCarregando(false);
  }, [supabase, temporada]);

  async function baixarExcel() {
    if (!dados) return;
    setGerandoExcel(true);
    try {
      const { resumo, slaOs, slaProjeto, ocorrencias, chamados, slaGestor } =
        dados;
      const ExcelJS = (await import("exceljs")).default;

      const ROXO = "FF5A3583";
      const ROXO_ESC = "FF231329";
      const CREME = "FFEDE0B1";
      const CINZA = "FFF4F1F9";
      const BORDA = "FFDDD6E5";
      const thin = {
        top: { style: "thin" as const, color: { argb: BORDA } },
        left: { style: "thin" as const, color: { argb: BORDA } },
        bottom: { style: "thin" as const, color: { argb: BORDA } },
        right: { style: "thin" as const, color: { argb: BORDA } },
      };
      const solid = (argb: string) => ({
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb },
      });
      const corSla = (p: number) =>
        p >= 90
          ? { fill: "FFE8F5E9", font: "FF1B5E20" }
          : p >= 70
            ? { fill: "FFFFF3CD", font: "FF7A5A00" }
            : { fill: "FFFDECEA", font: "FFB71C1C" };

      const wb = new ExcelJS.Workbook();
      wb.creator = "Fábrica de Luz";
      wb.company = "Fábrica de Luz";
      wb.title = `Fechamento da Temporada ${temporada}`;
      wb.created = new Date();

      // ---------- Aba Dashboard ----------
      const ws = wb.addWorksheet("Dashboard", {
        views: [{ showGridLines: false }],
      });
      ws.properties.tabColor = { argb: CREME };
      ws.columns = [
        { width: 24 },
        { width: 14 },
        { width: 4 },
        { width: 24 },
        { width: 14 },
        { width: 4 },
        { width: 24 },
        { width: 14 },
      ];

      ws.mergeCells("A1:H1");
      const titulo = ws.getCell("A1");
      titulo.value = `Fechamento da Temporada — ${temporada}`;
      titulo.font = { bold: true, size: 18, color: { argb: CREME } };
      titulo.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      titulo.fill = solid(ROXO);
      ws.getRow(1).height = 34;

      ws.mergeCells("A2:H2");
      const sub = ws.getCell("A2");
      sub.value = `Gerado em ${new Date().toLocaleString("pt-BR")}`;
      sub.font = { italic: true, size: 9, color: { argb: "FF6F5F7C" } };
      sub.alignment = { indent: 1 };

      const tile = (
        labelRange: string,
        valueRange: string,
        label: string,
        valor: string,
        fill: string,
        font: string
      ) => {
        ws.mergeCells(labelRange);
        const l = ws.getCell(labelRange.split(":")[0]);
        l.value = label;
        l.font = { bold: true, size: 10, color: { argb: "FF6F5F7C" } };
        l.alignment = { horizontal: "center" };
        l.fill = solid(CINZA);
        l.border = thin;
        ws.mergeCells(valueRange);
        const v = ws.getCell(valueRange.split(":")[0]);
        v.value = valor;
        v.font = { bold: true, size: 22, color: { argb: font } };
        v.alignment = { horizontal: "center", vertical: "middle" };
        v.fill = solid(fill);
        v.border = thin;
      };

      const cOs = corSla(resumo.pct_sla_os);
      const cPr = corSla(resumo.pct_sla_projeto);
      const cCh = corSla(resumo.pct_sla_chamados);
      tile("A4:B4", "A5:B5", "SLA por OS", pct(resumo.pct_sla_os), cOs.fill, cOs.font);
      tile("D4:E4", "D5:E5", "SLA por projeto", pct(resumo.pct_sla_projeto), cPr.fill, cPr.font);
      tile("G4:H4", "G5:H5", "SLA de chamados", pct(resumo.pct_sla_chamados), cCh.fill, cCh.font);
      ws.getRow(5).height = 40;

      tile("A7:B7", "A8:B8", "Dias de atraso (OSs)", String(resumo.dias_atraso_os), CINZA, "FF231329");
      tile("D7:E7", "D8:E8", "Ocorrências (total)", String(resumo.ocorrencias_total), CINZA, "FF231329");
      tile("G7:H7", "G8:H8", "OSs concluídas", `${resumo.os_concluidas}/${resumo.total_os}`, CINZA, "FF231329");
      ws.getRow(8).height = 40;

      // Bloco: números da temporada
      const bloco = (linha: number, titulo2: string) => {
        ws.mergeCells(`A${linha}:H${linha}`);
        const c = ws.getCell(`A${linha}`);
        c.value = titulo2;
        c.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        c.fill = solid(ROXO);
        c.alignment = { indent: 1, vertical: "middle" };
        ws.getRow(linha).height = 22;
      };
      const par = (linha: number, chave: string, valor: string | number) => {
        const a = ws.getCell(`A${linha}`);
        a.value = chave;
        a.font = { color: { argb: "FF231329" } };
        a.border = thin;
        ws.mergeCells(`B${linha}:C${linha}`);
        const b = ws.getCell(`B${linha}`);
        b.value = valor;
        b.font = { bold: true, color: { argb: "FF231329" } };
        b.border = thin;
      };

      bloco(10, "SLA — detalhamento");
      par(11, "OSs no prazo", resumo.os_no_prazo);
      par(12, "OSs atrasadas", resumo.os_atrasadas);
      par(13, "Projetos avaliados", resumo.projetos_avaliados);
      par(14, "Projetos no prazo", resumo.projetos_no_prazo);
      par(15, "Chamados (total)", resumo.chamados_total);
      par(16, "Chamados no prazo", resumo.chamados_no_prazo);

      bloco(18, "Ocorrências por motivo");
      let linha = 19;
      const tipos = Object.entries(resumo.ocorrencias_por_tipo || {});
      if (tipos.length === 0) {
        par(linha, "Sem ocorrências registradas", "");
        linha += 1;
      } else {
        for (const [tipo, qtd] of tipos) {
          par(linha, MOTIVO_OCORRENCIA[tipo] ?? tipo, qtd as number);
          linha += 1;
        }
      }

      // ---------- Aba SLA por gestor ----------
      const wg = wb.addWorksheet("SLA por gestor", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      wg.properties.tabColor = { argb: ROXO };
      const gcols = [
        { h: "Gestor", w: 26, l: true },
        { h: "Projetos", w: 10 },
        { h: "SLA OS", w: 9 },
        { h: "OS no prazo", w: 12 },
        { h: "OS atrasadas", w: 13 },
        { h: "Dias atraso", w: 12 },
        { h: "SLA projeto", w: 12 },
        { h: "Proj. no prazo", w: 14 },
        { h: "SLA chamados", w: 13 },
        { h: "Chamados", w: 11 },
        { h: "Ocorrências", w: 12 },
      ];
      wg.columns = gcols.map((c) => ({ width: c.w }));
      const ghr = wg.addRow(gcols.map((c) => c.h));
      ghr.height = 30;
      ghr.eachCell((cell, col) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.fill = solid(ROXO);
        cell.alignment = {
          vertical: "middle",
          horizontal: col === 1 ? "left" : "center",
          wrapText: true,
        };
        cell.border = thin;
      });

      slaGestor.forEach((g, i) => {
        const row = wg.addRow([
          g.gestor ?? "—",
          g.projetos,
          g.pct_sla_os,
          g.os_no_prazo,
          g.os_atrasadas,
          g.dias_atraso_os,
          g.pct_sla_projeto,
          `${g.projetos_no_prazo}/${g.projetos_avaliados}`,
          g.pct_sla_chamados,
          g.chamados_total,
          g.ocorrencias_total,
        ]);
        row.height = 18;
        row.eachCell((cell, col) => {
          cell.border = thin;
          if (i % 2 === 1) cell.fill = solid(CINZA);
          cell.alignment = {
            vertical: "middle",
            horizontal: col === 1 ? "left" : "center",
          };
        });
        // Colore as células de SLA (%) por faixa
        (
          [
            [3, g.pct_sla_os],
            [7, g.pct_sla_projeto],
            [9, g.pct_sla_chamados],
          ] as const
        ).forEach(([col, valor]) => {
          const c = row.getCell(col);
          const cs = corSla(valor);
          c.fill = solid(cs.fill);
          c.font = { bold: true, color: { argb: cs.font } };
          c.numFmt = '0"%"';
        });
      });
      wg.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: gcols.length },
      };
      if (slaGestor.length === 0) {
        wg.addRow(["Sem dados para esta temporada."]);
      }

      // ---------- Abas de tabela ----------
      type Col = { header: string; width: number };
      const addTabela = (
        nome: string,
        cols: Col[],
        linhas: (string | number)[][],
        estilizar?: (row: Row, valores: (string | number)[]) => void
      ) => {
        const t = wb.addWorksheet(nome, {
          views: [{ state: "frozen", ySplit: 1 }],
        });
        t.properties.tabColor = { argb: ROXO_ESC };
        t.columns = cols.map((c) => ({ width: c.width }));
        const hr = t.addRow(cols.map((c) => c.header));
        hr.height = 20;
        hr.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = solid(ROXO);
          cell.alignment = { vertical: "middle" };
          cell.border = thin;
        });
        linhas.forEach((valores, i) => {
          const row = t.addRow(valores);
          row.eachCell((cell) => {
            cell.border = thin;
            if (i % 2 === 1) cell.fill = solid(CINZA);
            cell.alignment = { vertical: "middle", wrapText: false };
          });
          if (estilizar) estilizar(row, valores);
        });
        t.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: cols.length },
        };
      };

      const corNoPrazo = (row: Row, idx: number) => {
        const cell = row.getCell(idx);
        if (cell.value === "Não") {
          cell.font = { bold: true, color: { argb: "FFB71C1C" } };
        } else if (cell.value === "Sim") {
          cell.font = { bold: true, color: { argb: "FF1B5E20" } };
        }
      };

      addTabela(
        "SLA por OS",
        [
          { header: "Projeto", width: 28 },
          { header: "UF", width: 6 },
          { header: "OS", width: 16 },
          { header: "Serviço", width: 32 },
          { header: "Término previsto", width: 16 },
          { header: "Concluída em", width: 16 },
          { header: "No prazo", width: 10 },
          { header: "Dias de atraso", width: 14 },
          { header: "Status", width: 16 },
        ],
        slaOs.map((o) => [
          o.projeto ?? "",
          o.uf ?? "",
          o.codigo ?? "",
          o.servico ?? "",
          dataBR(o.termino_previsto),
          dataBR(o.concluido_em),
          simNao(o.no_prazo),
          o.dias_atraso ?? "",
          o.status ?? "",
        ]),
        (row) => corNoPrazo(row, 7)
      );

      addTabela(
        "SLA por projeto",
        [
          { header: "Projeto", width: 28 },
          { header: "UF", width: 6 },
          { header: "Gestor", width: 20 },
          { header: "Prazo (data fim)", width: 16 },
          { header: "Conclusão", width: 16 },
          { header: "No prazo", width: 10 },
          { header: "Dias de atraso", width: 14 },
          { header: "OSs concluídas", width: 16 },
        ],
        slaProjeto.map((p) => [
          p.projeto ?? "",
          p.uf ?? "",
          p.gestor ?? "",
          dataBR(p.data_fim),
          dataBR(p.conclusao),
          simNao(p.no_prazo),
          p.dias_atraso ?? "",
          `${p.concluidas}/${p.total_os}`,
        ]),
        (row) => corNoPrazo(row, 6)
      );

      addTabela(
        "Ocorrências",
        [
          { header: "Projeto", width: 28 },
          { header: "UF", width: 6 },
          { header: "Data", width: 18 },
          { header: "Motivo", width: 20 },
          { header: "Descrição", width: 44 },
          { header: "Montador", width: 20 },
        ],
        ocorrencias.map((o) => [
          o.projeto ?? "",
          o.uf ?? "",
          dataHoraBR(o.data),
          MOTIVO_OCORRENCIA[o.tipo ?? ""] ?? o.tipo ?? "",
          o.descricao ?? "",
          o.montador ?? "",
        ])
      );

      addTabela(
        "SLA de chamados",
        [
          { header: "Protocolo", width: 16 },
          { header: "Projeto", width: 28 },
          { header: "Prioridade", width: 12 },
          { header: "Aberto em", width: 18 },
          { header: "Resolvido em", width: 18 },
          { header: "Horas até resolver", width: 16 },
          { header: "Prazo (h)", width: 10 },
          { header: "Cumpriu", width: 10 },
        ],
        chamados.map((c) => [
          c.protocolo ?? "",
          c.projeto ?? "",
          PRIORIDADE_LABEL[c.prioridade ?? ""] ?? c.prioridade ?? "",
          dataHoraBR(c.aberto_em),
          dataHoraBR(c.resolvido_em),
          c.horas ?? "",
          c.prazo_horas ?? "",
          simNao(c.cumpriu),
        ]),
        (row) => corNoPrazo(row, 8)
      );

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Fechamento_temporada_${temporada || "geral"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGerandoExcel(false);
    }
  }

  const r = dados?.resumo;
  const gestores = dados?.slaGestor ?? [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          Relatórios
        </p>
        <h1 className="mt-1 text-3xl font-bold">Fechamento da temporada</h1>
        <p className="mt-2 text-sm text-white/60">
          Overview de SLA (por OS e por projeto), ocorrências e SLA de chamados,
          exportável em Excel.
        </p>
      </header>

      <section className="fdl-form-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-semibold text-white">
              Temporada
            </label>
            <select
              value={temporada}
              onChange={(e) => setTemporada(e.target.value)}
              className="fdl-field"
            >
              {temporadas.length === 0 ? (
                <option value="">Sem temporadas</option>
              ) : (
                temporadas.map((t) => (
                  <option key={t} value={t} className="text-black">
                    {t}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={gerar}
            disabled={carregando || !temporada}
            className="h-12 rounded-2xl bg-[var(--fdl-cream)] px-6 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:opacity-50"
          >
            {carregando ? "Gerando..." : "Gerar relatório"}
          </button>

          {dados ? (
            <button
              type="button"
              onClick={baixarExcel}
              disabled={gerandoExcel}
              className="h-12 rounded-2xl border border-[var(--fdl-cream)]/40 px-6 text-sm font-semibold text-[var(--fdl-cream)] transition hover:bg-white/10 disabled:opacity-50"
            >
              {gerandoExcel ? "Gerando Excel..." : "⬇ Baixar Excel"}
            </button>
          ) : null}
        </div>

        {erro ? (
          <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            {erro}
          </div>
        ) : null}
      </section>

      {r ? (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi titulo="SLA por OS" valor={pct(r.pct_sla_os)} sub={`${r.os_no_prazo}/${r.total_os} no prazo`} />
            <Kpi titulo="SLA por projeto" valor={pct(r.pct_sla_projeto)} sub={`${r.projetos_no_prazo}/${r.projetos_avaliados} no prazo`} />
            <Kpi titulo="SLA de chamados" valor={pct(r.pct_sla_chamados)} sub={`${r.chamados_no_prazo}/${r.chamados_total} no prazo`} />
            <Kpi titulo="Dias de atraso" valor={String(r.dias_atraso_os)} sub="soma das OSs" />
          </section>

          {gestores.length > 0 ? (
            <section className="fdl-form-card p-6">
              <h2 className="fdl-section-title">SLA por gestor</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {gestores.map((g) => (
                  <div
                    key={g.gestor ?? "sem"}
                    className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-semibold text-white">
                        {g.gestor || "Sem gestor"}
                      </p>
                      <span className="shrink-0 text-xs text-white/45">
                        {g.projetos} proj.
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${corPct(
                          g.pct_sla_os
                        )}`}
                      >
                        OS {pct(g.pct_sla_os)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${corPct(
                          g.pct_sla_projeto
                        )}`}
                      >
                        Projeto {pct(g.pct_sla_projeto)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${corPct(
                          g.pct_sla_chamados
                        )}`}
                      >
                        Chamados {pct(g.pct_sla_chamados)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-white/45">
                      {g.os_no_prazo}/{g.total_os} OSs no prazo ·{" "}
                      {g.ocorrencias_total} ocorrência(s) · {g.chamados_total}{" "}
                      chamado(s)
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="fdl-form-card p-6">
            <h2 className="fdl-section-title">Ocorrências ({r.ocorrencias_total})</h2>
            {Object.keys(r.ocorrencias_por_tipo || {}).length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(r.ocorrencias_por_tipo).map(([tipo, qtd]) => (
                  <span
                    key={tipo}
                    className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
                  >
                    {MOTIVO_OCORRENCIA[tipo] ?? tipo}: {qtd}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/50">
                Nenhuma ocorrência registrada nesta temporada.
              </p>
            )}
          </section>

          <p className="text-sm text-white/50">
            Detalhamento completo (SLA por OS/projeto, ocorrências e chamados) no
            arquivo Excel — clique em “Baixar Excel”.
          </p>
        </>
      ) : null}
    </div>
  );
}

function Kpi({
  titulo,
  valor,
  sub,
}: {
  titulo: string;
  valor: string;
  sub: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
      <p className="text-sm font-semibold text-white/60">{titulo}</p>
      <strong className="mt-2 block text-3xl font-bold tabular-nums text-white">
        {valor}
      </strong>
      <p className="mt-1 text-xs text-white/45">{sub}</p>
    </div>
  );
}
