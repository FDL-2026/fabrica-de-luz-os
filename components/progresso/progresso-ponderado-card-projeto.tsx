"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProgressoPonderadoCardProjetoProps = {
  projetoId: string;
};

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatPercent(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function ProgressoPonderadoCardProjeto({
  projetoId,
}: ProgressoPonderadoCardProjetoProps) {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [validado, setValidado] = useState(0);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);

      const { data } = await supabase.rpc(
        "fdl_calcular_progresso_ponderado_projeto",
        {
          p_projeto_id: projetoId,
        }
      );

      const item = Array.isArray(data) ? data[0] : data;

      setValidado(toNumber(item?.progresso_validado));
      setCarregando(false);
    }

    carregar();
  }, [projetoId, supabase]);

  const widthValidado = Math.max(0, Math.min(100, validado));

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fdl-cream)]">
            Progresso validado
          </p>
          <p className="mt-1 text-xs font-medium text-white/45">
            aprovado pelo gestor
          </p>
        </div>

        <strong className="text-xl font-bold tabular-nums text-white">
          {carregando ? "..." : `${formatPercent(validado)}%`}
        </strong>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[var(--fdl-cream)]"
          style={{ width: carregando ? "0%" : `${widthValidado}%` }}
        />
      </div>
    </div>
  );
}
