"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ChamadoMontador = {
  chamado_id: string;
  protocolo: string;
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  categoria: string | null;
  prioridade: string | null;
  local_ponto: string | null;
  titulo: string | null;
  descricao: string | null;
  status: string | null;
  criado_em: string | null;
};

const CATEGORIA_LABEL: Record<string, string> = {
  manutencao: "Manutenção",
  eletrica: "Elétrica",
  iluminacao: "Iluminação",
  estrutura: "Estrutura",
  troca_peca: "Troca de peça",
  limpeza: "Limpeza",
  outro: "Outro",
};

function prioridadeLabel(p: string | null) {
  if (p === "urgente") return "🔴 Urgente";
  if (p === "alta") return "🟠 Alta";
  if (p === "media") return "Média";
  return "Baixa";
}

type Props = {
  usuarioId: string;
  codigo: string;
};

// Alerta de chamados de manutenção que o gestor colocou "em andamento" nos
// projetos deste montador. Aparece na tela inicial do montador.
export default function ChamadosAlertaMontador({ usuarioId, codigo }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [chamados, setChamados] = useState<ChamadoMontador[]>([]);

  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    supabase
      .rpc("fdl_listar_chamados_montador", { p_usuario_id: usuarioId })
      .then(({ data, error }) => {
        if (!ativo || error) return;
        setChamados((data ?? []) as ChamadoMontador[]);
      });
    return () => {
      ativo = false;
    };
  }, [supabase, usuarioId]);

  if (chamados.length === 0) return null;

  return (
    <div className="rounded-3xl border border-amber-400/40 bg-amber-500/[0.12] p-5">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">
          🛠
        </span>
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-amber-100">
          {chamados.length === 1
            ? "1 chamado de manutenção em andamento"
            : `${chamados.length} chamados de manutenção em andamento`}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {chamados.map((c) => (
          <a
            key={c.chamado_id}
            href={`/montador/${codigo}/projetos/${c.projeto_id}`}
            className="block rounded-2xl border border-amber-300/25 bg-black/15 p-4 transition hover:bg-black/25"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-200/20 px-3 py-1 text-xs font-bold text-amber-100">
                {c.protocolo}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                {prioridadeLabel(c.prioridade)}
              </span>
            </div>

            <p className="mt-2 text-base font-semibold text-white">
              {c.titulo || CATEGORIA_LABEL[c.categoria ?? ""] || "Chamado"}
            </p>
            {c.descricao ? (
              <p className="mt-1 line-clamp-2 text-sm text-white/70">
                {c.descricao}
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/50">
              <span>{c.shopping || c.cliente}</span>
              {c.uf ? <span>· {c.uf}</span> : null}
              {c.local_ponto ? <span>· {c.local_ponto}</span> : null}
            </div>

            <p className="mt-2 text-xs font-semibold text-amber-100">
              Abrir projeto →
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
