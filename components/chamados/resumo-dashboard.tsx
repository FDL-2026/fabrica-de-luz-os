"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Resumo = {
  abertos: number;
  em_andamento: number;
  aguardando: number;
  resolvidos: number;
  total: number;
};

// Faixa compacta no topo do dashboard: só aparece quando há chamados a tratar.
export default function ChamadosResumoDashboard() {
  const [resumo, setResumo] = useState<Resumo | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("fdl_resumo_chamados_gestao").then(({ data, error }) => {
      if (error) return;
      const r = Array.isArray(data) ? data[0] : data;
      setResumo((r ?? null) as Resumo | null);
    });
  }, []);

  const aTratar = (resumo?.abertos ?? 0) + (resumo?.em_andamento ?? 0);
  if (!resumo || aTratar === 0) return null;

  return (
    <Link
      href="/chamados"
      className="fdl-chamados-alerta mb-6 flex items-center justify-between gap-4 rounded-3xl p-5"
    >
      <div className="flex items-center gap-4">
        <span className="fdl-chamados-alerta-icone flex h-11 w-11 items-center justify-center rounded-2xl text-xl">
          🛠
        </span>
        <div>
          <p className="fdl-chamados-alerta-titulo text-sm font-semibold">
            {aTratar} chamado(s) de manutenção a tratar
          </p>
          <p className="fdl-chamados-alerta-sub mt-0.5 text-xs">
            {resumo.abertos} aberto(s) · {resumo.em_andamento} em andamento
          </p>
        </div>
      </div>
      <span className="fdl-chamados-alerta-cta shrink-0 text-sm font-semibold">
        Ver →
      </span>
    </Link>
  );
}
