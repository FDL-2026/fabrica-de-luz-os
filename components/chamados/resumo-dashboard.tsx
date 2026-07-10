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

  const aTratar = (resumo?.abertos ?? 0) + (resumo?.em_andamento ?? 0) + (resumo?.aguardando ?? 0);
  if (!resumo || aTratar === 0) return null;

  return (
    <Link
      href="/chamados"
      className="mb-6 flex items-center justify-between gap-4 rounded-3xl border border-[var(--fdl-cream)]/25 bg-[var(--fdl-cream)]/[0.08] p-5 transition hover:bg-[var(--fdl-cream)]/[0.12]"
    >
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--fdl-cream)] text-xl text-[var(--fdl-purple-dark)]">
          🛠
        </span>
        <div>
          <p className="text-sm font-semibold text-white">
            {aTratar} chamado(s) de manutenção a tratar
          </p>
          <p className="mt-0.5 text-xs text-white/60">
            {resumo.abertos} aberto(s) · {resumo.em_andamento} em andamento ·{" "}
            {resumo.aguardando} aguardando peça
          </p>
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold text-[var(--fdl-cream)]">
        Ver →
      </span>
    </Link>
  );
}
