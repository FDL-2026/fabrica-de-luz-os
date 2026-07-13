"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
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

type Dados = {
  resumo: Resumo;
  slaOs: SlaOs[];
  slaProjeto: SlaProjeto[];
  ocorrencias: Ocorrencia[];
  chamados: ChamadoSla[];
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

    const [r1, r2, r3, r4, r5] = await Promise.all([
      supabase.rpc("fdl_relatorio_resumo_temporada", { p_temporada: temporada }),
      supabase.rpc("fdl_relatorio_sla_os", { p_temporada: temporada }),
      supabase.rpc("fdl_relatorio_sla_projeto", { p_temporada: temporada }),
      supabase.rpc("fdl_relatorio_ocorrencias", { p_temporada: temporada }),
      supabase.rpc("fdl_relatorio_sla_chamados", { p_temporada: temporada }),
    ]);

    const primeiroErro =
      r1.error || r2.error || r3.error || r4.error || r5.error;
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
    });
    setCarregando(false);
  }, [supabase, temporada]);

  function baixarExcel() {
    if (!dados) return;
    const { resumo, slaOs, slaProjeto, ocorrencias, chamados } = dados;
    const wb = XLSX.utils.book_new();

    // Aba Resumo
    const ocorrLinhas = Object.entries(resumo.ocorrencias_por_tipo || {}).map(
      ([tipo, qtd]) => [
        `Ocorrências — ${MOTIVO_OCORRENCIA[tipo] ?? tipo}`,
        qtd,
      ]
    );
    const resumoAoa: (string | number)[][] = [
      ["Fechamento da temporada", temporada],
      [],
      ["Projetos", resumo.total_projetos],
      ["OSs (total)", resumo.total_os],
      ["OSs concluídas", resumo.os_concluidas],
      [],
      ["SLA por OS — no prazo", resumo.os_no_prazo],
      ["SLA por OS — atrasadas", resumo.os_atrasadas],
      ["SLA por OS — % cumprido", pct(resumo.pct_sla_os)],
      ["Dias de atraso (soma das OSs)", resumo.dias_atraso_os],
      [],
      ["SLA por projeto — avaliados", resumo.projetos_avaliados],
      ["SLA por projeto — no prazo", resumo.projetos_no_prazo],
      ["SLA por projeto — % cumprido", pct(resumo.pct_sla_projeto)],
      [],
      ["Chamados (total)", resumo.chamados_total],
      ["Chamados no prazo", resumo.chamados_no_prazo],
      ["SLA de chamados — % cumprido", pct(resumo.pct_sla_chamados)],
      [],
      ["Ocorrências (total)", resumo.ocorrencias_total],
      ...ocorrLinhas,
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(resumoAoa),
      "Resumo"
    );

    // Aba SLA por OS
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        slaOs.map((o) => ({
          Projeto: o.projeto ?? "",
          UF: o.uf ?? "",
          OS: o.codigo ?? "",
          Etapa: o.etapa ?? "",
          Serviço: o.servico ?? "",
          "Término previsto": dataBR(o.termino_previsto),
          "Concluída em": dataBR(o.concluido_em),
          "No prazo": simNao(o.no_prazo),
          "Dias de atraso": o.dias_atraso ?? "",
          Status: o.status ?? "",
        }))
      ),
      "SLA por OS"
    );

    // Aba SLA por projeto
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        slaProjeto.map((p) => ({
          Projeto: p.projeto ?? "",
          UF: p.uf ?? "",
          Gestor: p.gestor ?? "",
          "Prazo (data fim)": dataBR(p.data_fim),
          "Conclusão": dataBR(p.conclusao),
          "No prazo": simNao(p.no_prazo),
          "Dias de atraso": p.dias_atraso ?? "",
          "OSs concluídas": `${p.concluidas}/${p.total_os}`,
        }))
      ),
      "SLA por projeto"
    );

    // Aba Ocorrências
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        ocorrencias.map((o) => ({
          Projeto: o.projeto ?? "",
          UF: o.uf ?? "",
          Data: dataHoraBR(o.data),
          Motivo: MOTIVO_OCORRENCIA[o.tipo ?? ""] ?? o.tipo ?? "",
          Descrição: o.descricao ?? "",
          Montador: o.montador ?? "",
        }))
      ),
      "Ocorrências"
    );

    // Aba SLA de chamados
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        chamados.map((c) => ({
          Protocolo: c.protocolo ?? "",
          Projeto: c.projeto ?? "",
          Prioridade: PRIORIDADE_LABEL[c.prioridade ?? ""] ?? c.prioridade ?? "",
          "Aberto em": dataHoraBR(c.aberto_em),
          "Resolvido em": dataHoraBR(c.resolvido_em),
          "Horas até resolver": c.horas ?? "",
          "Prazo (h)": c.prazo_horas ?? "",
          Cumpriu: simNao(c.cumpriu),
        }))
      ),
      "SLA de chamados"
    );

    XLSX.writeFile(wb, `Fechamento_temporada_${temporada || "geral"}.xlsx`);
  }

  const r = dados?.resumo;

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
              className="h-12 rounded-2xl border border-[var(--fdl-cream)]/40 px-6 text-sm font-semibold text-[var(--fdl-cream)] transition hover:bg-white/10"
            >
              ⬇ Baixar Excel
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
