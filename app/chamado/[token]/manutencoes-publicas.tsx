"use client";

import { useState } from "react";

type Foto = { external_file_id: string | null; fase: string | null };

type Manutencao = {
  id: string;
  mundo_nome: string | null;
  local_ponto: string | null;
  descricao: string | null;
  registrado_por_nome: string | null;
  criado_em: string | null;
  fotos: Foto[];
};

function formatarData(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function ManutencoesPublicas({
  token,
  manutencoes,
}: {
  token: string;
  manutencoes: Manutencao[];
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!manutencoes || manutencoes.length === 0) return null;

  function urlFoto(fileId: string, thumb = false) {
    const params = new URLSearchParams({ token, fileId });
    if (thumb) params.set("thumb", "1");
    return `/api/manutencao/anexo?${params.toString()}`;
  }

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
      <h2 className="text-lg font-bold text-white">Manutenções realizadas</h2>
      <p className="mt-1 text-sm text-white/55">
        Reparos feitos pela equipe, com foto de antes e depois.
      </p>

      <div className="mt-4 space-y-4">
        {manutencoes.map((m) => (
          <article
            key={m.id}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">
                  {m.mundo_nome || m.local_ponto || "Manutenção"}
                </p>
                {m.local_ponto && m.mundo_nome ? (
                  <p className="text-xs text-white/45">{m.local_ponto}</p>
                ) : null}
              </div>
              <span className="text-xs text-white/45">
                {formatarData(m.criado_em)}
              </span>
            </div>

            {m.descricao ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/80">
                {m.descricao}
              </p>
            ) : null}

            {(["antes", "depois"] as const).map((fase) => {
              const lista = (m.fotos ?? []).filter(
                (f) => f.fase === fase && f.external_file_id
              );
              if (lista.length === 0) return null;
              return (
                <div key={fase} className="mt-3">
                  <p className="mb-1 text-xs font-semibold text-white/60">
                    {fase === "antes" ? "Antes" : "Depois"}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {lista.map((f) => (
                      <button
                        key={f.external_file_id}
                        type="button"
                        onClick={() =>
                          setLightbox(urlFoto(f.external_file_id as string))
                        }
                        className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={urlFoto(f.external_file_id as string, true)}
                          alt={`Foto ${fase} da manutenção`}
                          loading="lazy"
                          className="h-20 w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {m.registrado_por_nome ? (
              <p className="mt-3 text-xs text-white/40">
                Registrado por {m.registrado_por_nome}
              </p>
            ) : null}
          </article>
        ))}
      </div>

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
    </section>
  );
}
