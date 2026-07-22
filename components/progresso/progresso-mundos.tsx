"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProgressoMundosProps = {
  projetoId: string;
};

type MundoRow = {
  etapa_id: string;
  codigo: string | null;
  nome: string | null;
  equipe: string | null;
  id_espaco: string | null;
  contrato: string | null;
  status_producao: string | null;
  total_os: number;
  os_validadas: number;
  os_aguardando: number;
  os_em_andamento: number;
  os_pendentes: number;
  peso_total: number;
  peso_validado: number;
  progresso_validado: number;
};

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function Barra({ valor }: { valor: number }) {
  const largura = Math.max(0, Math.min(100, valor));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--fdl-cream)] to-[#caa94f]"
        style={{ width: `${largura}%` }}
      />
    </div>
  );
}

export default function ProgressoMundos({ projetoId }: ProgressoMundosProps) {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mundos, setMundos] = useState<MundoRow[]>([]);

  useEffect(() => {
    let ativo = true;

    (async () => {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase.rpc("fdl_progresso_mundos", {
        p_projeto_id: projetoId,
      });

      if (!ativo) return;

      if (error) {
        setErro(error.message);
        setMundos([]);
      } else {
        setMundos(
          ((data ?? []) as MundoRow[]).map((m) => ({
            ...m,
            total_os: toNumber(m.total_os),
            os_validadas: toNumber(m.os_validadas),
            os_aguardando: toNumber(m.os_aguardando),
            os_em_andamento: toNumber(m.os_em_andamento),
            os_pendentes: toNumber(m.os_pendentes),
            peso_total: toNumber(m.peso_total),
            peso_validado: toNumber(m.peso_validado),
            progresso_validado: toNumber(m.progresso_validado),
          }))
        );
      }

      setCarregando(false);
    })();

    return () => {
      ativo = false;
    };
  }, [projetoId, supabase]);

  const total = useMemo(() => {
    const pesoTotal = mundos.reduce((soma, m) => soma + m.peso_total, 0);
    const pesoValidado = mundos.reduce((soma, m) => soma + m.peso_validado, 0);
    const totalOs = mundos.reduce((soma, m) => soma + m.total_os, 0);
    const validadas = mundos.reduce((soma, m) => soma + m.os_validadas, 0);
    const progresso = pesoTotal > 0 ? (pesoValidado / pesoTotal) * 100 : 0;
    return { progresso, totalOs, validadas, mundos: mundos.length };
  }, [mundos]);

  if (carregando) {
    return (
      <section className="fdl-form-card p-6" aria-busy="true">
        <p className="text-sm text-white/50">Carregando progresso dos mundos…</p>
      </section>
    );
  }

  if (erro) {
    return (
      <section className="fdl-form-card p-6">
        <p className="text-sm text-red-200">
          Não foi possível carregar o progresso por mundo. Verifique se a função
          fdl_progresso_mundos foi criada no banco.
        </p>
      </section>
    );
  }

  if (mundos.length === 0) return null;

  return (
    <section className="fdl-form-card p-6">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
            Progresso do projeto-chave
          </p>
          <h2 className="mt-2 text-2xl font-bold">Mundos (microprojetos)</h2>
          <p className="mt-1 text-sm text-white/55">
            {total.mundos} mundos · {total.validadas} de {total.totalOs} OSs
            validadas
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
            Progresso validado total
          </p>
          <p className="text-4xl font-black text-[var(--fdl-cream)]">
            {formatPercent(total.progresso)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Barra valor={total.progresso} />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {mundos.map((mundo) => (
          <article
            key={mundo.etapa_id}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--fdl-cream)]">
                  Mundo {mundo.codigo}
                  {mundo.id_espaco ? ` · ${mundo.id_espaco}` : ""}
                </p>
                <h3 className="mt-1 font-semibold">{mundo.nome}</h3>
                <p className="mt-1 text-xs text-white/50">
                  Equipe: {mundo.equipe || "Não informada"}
                </p>
              </div>
              <span className="whitespace-nowrap text-2xl font-black text-white">
                {formatPercent(mundo.progresso_validado)}
              </span>
            </div>

            <div className="mt-3">
              <Barra valor={mundo.progresso_validado} />
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
              <span>{mundo.total_os} OSs</span>
              <span className="text-[var(--fdl-cream)]">
                {mundo.os_validadas} validadas
              </span>
              {mundo.os_aguardando > 0 ? (
                <span className="text-yellow-200/80">
                  {mundo.os_aguardando} aguardando
                </span>
              ) : null}
              {mundo.os_em_andamento > 0 ? (
                <span>{mundo.os_em_andamento} em andamento</span>
              ) : null}
              {mundo.os_pendentes > 0 ? (
                <span className="text-white/40">
                  {mundo.os_pendentes} pendentes
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
