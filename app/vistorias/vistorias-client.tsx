"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import CriarVistoria from "@/components/vistoria/criar-vistoria";

type VistoriaLista = {
  id: string;
  projeto_id: string | null;
  projeto_nome: string | null;
  titulo: string | null;
  endereco: string | null;
  eng_responsavel: string | null;
  data_prevista: string | null;
  token: string | null;
  status: string | null;
  total_pontos: number;
  total_fotos: number;
  preenchido_por_nome: string | null;
  criado_em: string | null;
  concluida_em: string | null;
};

function formatarData(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR", { dateStyle: "short" });
}

export default function VistoriasClient() {
  const supabase = useMemo(() => createClient(), []);

  const [modo, setModo] = useState<"lista" | "nova">("lista");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState<VistoriaLista[]>([]);
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.rpc("fdl_listar_vistorias_gestao", {
      p_projeto_id: null,
    });
    if (error) setErro(error.message);
    else setLista((data ?? []) as VistoriaLista[]);
    setCarregando(false);
  }, [supabase]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function copiarLink(token: string) {
    try {
      const url = `${window.location.origin}/vt/${token}`;
      await navigator.clipboard.writeText(url);
      setCopiado(token);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setCopiado(null);
    }
  }

  if (modo === "nova") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setModo("lista")}
          className="text-sm font-semibold text-white/60 hover:text-white"
        >
          ← Voltar para a lista
        </button>
        <CriarVistoria
          onCriada={() => {
            carregar();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setModo("nova")}
          className="fdl-ui-btn fdl-ui-btn-primary"
        >
          Nova vistoria
        </button>
      </div>

      {carregando ? (
        <div className="fdl-skeleton h-40 w-full" aria-busy="true" />
      ) : erro ? (
        <div className="fdl-alert fdl-alert-error">
          Não foi possível carregar as vistorias. Verifique se as funções foram
          criadas no banco.
        </div>
      ) : lista.length === 0 ? (
        <div className="fdl-empty-state">
          Nenhuma vistoria criada ainda. Clique em “Nova vistoria” para começar.
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((v) => {
            const concluida = v.status === "concluida";
            return (
              <article
                key={v.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">
                        {v.titulo}
                      </p>
                      <span
                        className={
                          concluida
                            ? "rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-200"
                            : "rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-200"
                        }
                      >
                        {concluida ? "Concluída" : "Aguardando"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-white/50">
                      {v.projeto_nome ? `${v.projeto_nome} · ` : ""}
                      {v.total_pontos} ponto(s) · {v.total_fotos} foto(s)
                      {v.data_prevista
                        ? ` · prevista ${formatarData(v.data_prevista)}`
                        : ""}
                    </p>
                    {concluida ? (
                      <p className="mt-1 text-xs text-white/40">
                        Preenchida por {v.preenchido_por_nome || "—"} em{" "}
                        {formatarData(v.concluida_em)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      href={`/vistorias/${v.id}`}
                      className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-secondary"
                    >
                      Relatório
                    </Link>
                    {v.token ? (
                      <button
                        type="button"
                        onClick={() => copiarLink(v.token as string)}
                        className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-ghost"
                      >
                        {copiado === v.token ? "Copiado" : "Copiar link"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
