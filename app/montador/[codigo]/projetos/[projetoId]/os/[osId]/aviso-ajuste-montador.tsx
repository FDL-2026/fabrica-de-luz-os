"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AvisoAjusteMontadorProps = {
  projetoId: string;
  osId: string;
};

type AjusteOs = {
  os_id: string;
  projeto_id: string;
  status: string | null;
  status_validacao: string | null;
  observacao_validacao: string | null;
  validado_em: string | null;
  validado_por_nome: string | null;
};

function formatDateTime(date: string | null) {
  if (!date) return "Data não informada";

  return new Date(date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function lerMontadorSession() {
  try {
    const raw = sessionStorage.getItem("fdl_montador");

    if (!raw) return null;

    return JSON.parse(raw) as {
      usuarioId?: string;
      nome?: string;
      codigo?: string;
    };
  } catch {
    return null;
  }
}

export default function AvisoAjusteMontador({
  projetoId,
  osId,
}: AvisoAjusteMontadorProps) {
  const supabase = useMemo(() => createClient(), []);

  const [ajuste, setAjuste] = useState<AjusteOs | null>(null);

  useEffect(() => {
    async function carregarAjuste() {
      const montador = lerMontadorSession();

      if (!montador?.usuarioId) return;

      const { data, error } = await supabase.rpc("fdl_obter_ajuste_os_montador", {
        p_usuario_id: montador.usuarioId,
        p_projeto_id: projetoId,
        p_os_id: osId,
      });

      if (error || !data) return;

      setAjuste(data as AjusteOs);
    }

    carregarAjuste();
  }, [osId, projetoId, supabase]);

  const deveMostrar =
    ajuste?.status_validacao === "ajuste_solicitado" ||
    ajuste?.status_validacao === "reaberta";

  if (!deveMostrar || !ajuste?.observacao_validacao) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-red-300/30 bg-red-500/10 p-5 text-white">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-red-100">
            Ajuste solicitado
          </p>

          <h2 className="mt-2 text-xl font-bold text-white">
            O gestor solicitou correção nesta OS
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-50/90">
            {ajuste.observacao_validacao}
          </p>
        </div>

        <span className="w-fit rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
          Corrigir e concluir novamente
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-xs text-white/60">
        Solicitado por {ajuste.validado_por_nome || "gestor"} em{" "}
        {formatDateTime(ajuste.validado_em)}.
      </div>
    </section>
  );
}
