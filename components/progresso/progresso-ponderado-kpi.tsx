"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProgressoPonderadoKpiProps = {
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

export default function ProgressoPonderadoKpi({
  projetoId,
}: ProgressoPonderadoKpiProps) {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [progresso, setProgresso] = useState(0);

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
      const valor = toNumber(item?.progresso_validado);

      setProgresso(valor);
      setCarregando(false);
    }

    carregar();
  }, [projetoId, supabase]);

  const width = Math.max(0, Math.min(100, progresso));

  return (
    <>
      <p className="fdl-project-kpi-label">Progresso validado</p>

      <strong className="fdl-project-kpi-value">
        {carregando ? "..." : `${formatPercent(progresso)}%`}
      </strong>

      <div className="fdl-project-progress">
        <div
          className="fdl-project-progress-fill"
          style={{ width: carregando ? "0%" : `${width}%` }}
        />
      </div>

      <span className="fdl-project-kpi-help">aprovado pelo gestor</span>
    </>
  );
}
