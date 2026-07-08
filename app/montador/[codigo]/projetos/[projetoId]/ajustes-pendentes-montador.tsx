"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AjustesPendentesMontadorProps = {
  codigo: string;
  projetoId: string;
};

type AjustePendente = {
  os_id: string;
  codigo_os: string | null;
  local: string | null;
  servico: string | null;
  equipe: string | null;
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
    const raw = localStorage.getItem("fdl_montador");

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

export default function AjustesPendentesMontador({
  codigo,
  projetoId,
}: AjustesPendentesMontadorProps) {
  const supabase = useMemo(() => createClient(), []);

  const [ajustes, setAjustes] = useState<AjustePendente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    async function carregarAjustes() {
      setCarregando(true);

      const montador = lerMontadorSession();

      if (!montador?.usuarioId) {
        setAjustes([]);
        setCarregando(false);
        return;
      }

      const { data, error } = await supabase.rpc("fdl_listar_ajustes_montador", {
        p_usuario_id: montador.usuarioId,
        p_projeto_id: projetoId,
      });

      if (error) {
        setAjustes([]);
        setCarregando(false);
        return;
      }

      setAjustes((data ?? []) as AjustePendente[]);
      setCarregando(false);
    }

    carregarAjustes();
  }, [projetoId, supabase]);

  if (carregando || ajustes.length === 0) {
    return null;
  }

  return (
    <section className="mb-5 rounded-3xl border border-red-300/30 bg-red-500/10 p-4 text-white">
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        className="w-full text-left"
        aria-expanded={aberto}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-100">
              Ajustes pendentes
            </p>

            <h2 className="mt-1 text-lg font-bold">
              {ajustes.length} OS{ajustes.length > 1 ? "s" : ""} precisa
              {ajustes.length > 1 ? "m" : ""} de correção
            </h2>

            <p className="mt-1 text-sm text-red-50/75">
              Toque para visualizar os ajustes solicitados pelo gestor.
            </p>
          </div>

          <span className="inline-flex h-10 w-fit items-center justify-center rounded-full bg-red-100 px-4 text-xs font-bold text-red-700">
            {aberto ? "Ocultar" : "Ver ajustes"}
          </span>
        </div>
      </button>

      {aberto ? (
        <div className="mt-4 space-y-3 border-t border-red-100/15 pt-4">
          {ajustes.map((ajuste) => (
            <article
              key={ajuste.os_id}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">
                    OS {ajuste.codigo_os || "sem código"} ·{" "}
                    {ajuste.servico || "Serviço não informado"}
                  </p>

                  <p className="mt-1 text-xs text-white/50">
                    {ajuste.local || "Local não informado"} · Equipe{" "}
                    {ajuste.equipe || "não informada"}
                  </p>

                  <div className="mt-3 rounded-2xl border border-red-100/15 bg-red-500/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-100">
                      Motivo do ajuste
                    </p>

                    <p className="mt-2 text-sm leading-6 text-red-50/90">
                      {ajuste.observacao_validacao ||
                        "O gestor solicitou ajuste, mas não informou observação."}
                    </p>
                  </div>

                  <p className="mt-3 text-xs text-white/45">
                    Solicitado por {ajuste.validado_por_nome || "gestor"} em{" "}
                    {formatDateTime(ajuste.validado_em)}
                  </p>
                </div>

                <a
                  href={`/montador/${codigo}/projetos/${projetoId}/os/${ajuste.os_id}`}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-red-100 px-5 text-xs font-bold text-red-700 transition hover:bg-white"
                >
                  Abrir OS
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
