"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ManutencaoLista = {
  id: string;
  projeto_id: string;
  projeto_nome: string | null;
  etapa_id: string | null;
  mundo_nome: string | null;
  local_ponto: string | null;
  descricao: string | null;
  registrado_por_nome: string | null;
  total_fotos: number;
  criado_em: string | null;
};

type AnexoDetalhe = {
  id: string;
  fase: string | null;
  external_file_id: string | null;
};

type ManutencaoDetalhe = {
  descricao: string | null;
  anexos: AnexoDetalhe[];
};

function formatarData(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function ManutencoesClient() {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState<ManutencaoLista[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<Record<string, ManutencaoDetalhe>>(
    {}
  );
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      const { data, error } = await supabase.rpc(
        "fdl_listar_manutencoes_gestao",
        { p_projeto_id: null }
      );
      if (!ativo) return;
      if (error) setErro(error.message);
      else setLista((data ?? []) as ManutencaoLista[]);
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [supabase]);

  async function abrir(id: string) {
    if (aberto === id) {
      setAberto(null);
      return;
    }
    setAberto(id);
    if (!detalhes[id]) {
      const { data } = await supabase.rpc("fdl_obter_manutencao_gestao", {
        p_id: id,
      });
      if (data) {
        setDetalhes((prev) => ({
          ...prev,
          [id]: data as ManutencaoDetalhe,
        }));
      }
    }
  }

  if (carregando) {
    return (
      <div className="fdl-skeleton h-40 w-full" aria-busy="true" />
    );
  }

  if (erro) {
    return (
      <div className="fdl-alert fdl-alert-error">
        Não foi possível carregar as manutenções. Verifique se as funções foram
        criadas no banco.
      </div>
    );
  }

  if (lista.length === 0) {
    return (
      <div className="fdl-empty-state">
        Nenhuma manutenção registrada ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lista.map((m) => {
        const estaAberto = aberto === m.id;
        const det = detalhes[m.id];
        return (
          <article
            key={m.id}
            className="rounded-2xl border border-white/10 bg-white/[0.04]"
          >
            <button
              type="button"
              onClick={() => abrir(m.id)}
              aria-expanded={estaAberto}
              className="flex w-full items-start justify-between gap-3 p-4 text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {m.projeto_nome}
                  {m.mundo_nome ? ` · ${m.mundo_nome}` : ""}
                </p>
                <p className="mt-0.5 truncate text-sm text-white/60">
                  {m.descricao}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {m.local_ponto ? `${m.local_ponto} · ` : ""}
                  {m.registrado_por_nome
                    ? `por ${m.registrado_por_nome} · `
                    : ""}
                  {formatarData(m.criado_em)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white/70">
                  {m.total_fotos} foto(s)
                </span>
                <span
                  aria-hidden="true"
                  className={`text-white/40 transition-transform ${
                    estaAberto ? "rotate-180" : ""
                  }`}
                >
                  ▾
                </span>
              </div>
            </button>

            {estaAberto ? (
              <div className="border-t border-white/10 p-4">
                {m.descricao ? (
                  <p className="whitespace-pre-wrap text-sm leading-6 text-white/85">
                    {m.descricao}
                  </p>
                ) : null}

                {det ? (
                  (["antes", "depois"] as const).map((fase) => {
                    const fotos = (det.anexos ?? []).filter(
                      (a) => a.fase === fase && a.external_file_id
                    );
                    if (fotos.length === 0) return null;
                    return (
                      <div key={fase} className="mt-3">
                        <p className="mb-1 text-xs font-semibold text-white/60">
                          {fase === "antes" ? "Antes" : "Depois"}
                        </p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                          {fotos.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() =>
                                setLightbox(`/api/anexos/${a.external_file_id}`)
                              }
                              className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/anexos/${a.external_file_id}?thumb=1`}
                                alt={`Foto ${fase}`}
                                loading="lazy"
                                className="h-20 w-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="mt-3 text-sm text-white/45">Carregando fotos…</p>
                )}
              </div>
            ) : null}
          </article>
        );
      })}

      {lightbox ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Foto da manutenção"
            className="max-h-[92vh] max-w-full rounded-xl object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
