"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProgressoPonderadoProjetoProps = {
  projetoId: string;
};

type ResultadoProgresso = {
  projeto_id: string;
  total_os: number;
  total_os_com_data: number;
  total_os_sem_data: number;
  total_dias_ponderados: number;
  progresso_executado: number;
  progresso_validado: number;
  progresso_simples: number;
  os_concluidas: number;
  os_aguardando_validacao: number;
  os_pendentes: number;
  os_em_andamento: number;
};

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

function ProgressBar({
  label,
  value,
  description,
  variant = "default",
}: {
  label: string;
  value: number;
  description: string;
  variant?: "default" | "validado" | "simples";
}) {
  const width = Math.max(0, Math.min(100, value));

  const barClass =
    variant === "validado"
      ? "bg-green-200"
      : variant === "simples"
        ? "bg-white/50"
        : "bg-[var(--fdl-cream)]";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="mt-1 text-xs font-semibold text-white/50">
            {description}
          </p>
        </div>

        <strong className="text-2xl font-black text-white">
          {formatPercent(value)}
        </strong>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function ProgressoPonderadoProjeto({
  projetoId,
}: ProgressoPonderadoProjetoProps) {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<ResultadoProgresso | null>(null);

  useEffect(() => {
    async function carregarProgresso() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase.rpc(
        "fdl_calcular_progresso_ponderado_projeto",
        {
          p_projeto_id: projetoId,
        }
      );

      if (error) {
        setErro(error.message);
        setResultado(null);
        setCarregando(false);
        return;
      }

      const item = Array.isArray(data) ? data[0] : data;

      if (!item) {
        setResultado(null);
        setCarregando(false);
        return;
      }

      setResultado({
        projeto_id: String(item.projeto_id),
        total_os: toNumber(item.total_os),
        total_os_com_data: toNumber(item.total_os_com_data),
        total_os_sem_data: toNumber(item.total_os_sem_data),
        total_dias_ponderados: toNumber(item.total_dias_ponderados),
        progresso_executado: toNumber(item.progresso_executado),
        progresso_validado: toNumber(item.progresso_validado),
        progresso_simples: toNumber(item.progresso_simples),
        os_concluidas: toNumber(item.os_concluidas),
        os_aguardando_validacao: toNumber(item.os_aguardando_validacao),
        os_pendentes: toNumber(item.os_pendentes),
        os_em_andamento: toNumber(item.os_em_andamento),
      });

      setCarregando(false);
    }

    carregarProgresso();
  }, [projetoId, supabase]);

  if (carregando) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-white/60">
        Calculando progresso ponderado...
      </section>
    );
  }

  if (erro) {
    return (
      <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">
        Erro ao calcular progresso ponderado: {erro}
      </section>
    );
  }

  if (!resultado) {
    return (
      <section className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
        Nenhum dado de progresso encontrado para este projeto.
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 text-white shadow-2xl shadow-black/10">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--fdl-cream)]">
          Progresso ponderado
        </p>

        <h2 className="mt-2 text-2xl font-black">
          Evolução por duração planejada
        </h2>

        <p className="mt-2 text-sm font-medium text-white/55">
          O peso de cada OS é calculado pela duração prevista em relação à soma
          total de dias-OS do projeto.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ProgressBar
          label="Executado"
          value={resultado.progresso_executado}
          description="Inclui OSs concluídas, aguardando validação e percentual em andamento."
        />

        <ProgressBar
          label="Validado"
          value={resultado.progresso_validado}
          description="Considera apenas OSs aprovadas pela gestão."
          variant="validado"
        />

        <ProgressBar
          label="Modelo anterior"
          value={resultado.progresso_simples}
          description="Cálculo antigo: OSs concluídas divididas pelo total de OSs."
          variant="simples"
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
            Total de OSs
          </p>
          <strong className="mt-2 block text-2xl font-black">
            {formatNumber(resultado.total_os)}
          </strong>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
            Dias-OS
          </p>
          <strong className="mt-2 block text-2xl font-black">
            {formatNumber(resultado.total_dias_ponderados)}
          </strong>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
            Aguardando validação
          </p>
          <strong className="mt-2 block text-2xl font-black">
            {formatNumber(resultado.os_aguardando_validacao)}
          </strong>
        </div>

        <div
          className={`rounded-2xl border p-4 ${
            resultado.total_os_sem_data > 0
              ? "border-yellow-300/30 bg-yellow-500/10"
              : "border-white/10 bg-white/[0.04]"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
            OSs sem data
          </p>
          <strong className="mt-2 block text-2xl font-black">
            {formatNumber(resultado.total_os_sem_data)}
          </strong>
        </div>
      </div>
    </section>
  );
}
