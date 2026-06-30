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

export default function AjustesPendentesMontador({
  codigo,
  projetoId,
}: AjustesPendentesMontadorProps) {
  const supabase = useMemo(() => createClient(), []);

  const [ajustes, setAjustes] = useState<AjustePendente[]>([]);
  const [carregando, setCarregando] = useState(true);

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
    <section className="mb-6 rounded-3xl border border-red-300/30 bg-red-500/10 p-5 text-white">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-red-100">
            Ajustes solicitados
          </p>

          <h2 className="mt-2 text-xl font-bold">
            OSs que precisam de correção
          </h2>

          <p className="mt-1 text-sm text-red-50/80">
            O gestor solicitou ajuste nas OSs abaixo. Abra a OS, corrija e
            conclua novamente com nova evidência.
          </p>
        </div>

        <span className="w-fit rounded-full bg-red-100 px-4 py-2 text-sm font-bold text-red-700">
          {ajustes.length} pendente(s)
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {ajustes.map((ajuste) => (
          <article
            key={ajuste.os_id}
            className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-bold text-white">
                  OS {ajuste.codigo_os || "sem código"} ·{" "}
                  {ajuste.servico || "Serviço não informado"}
                </p>

                <p className="mt-1 text-xs text-white/50">
                  {ajuste.local || "Local não informado"} · Equipe{" "}
                  {ajuste.equipe || "não informada"}
                </p>

                <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
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
                className="inline-flex h-10 items-center justify-center rounded-full bg-red-100 px-5 text-xs font-bold text-red-700 transition hover:bg-white"
              >
                Abrir OS
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
