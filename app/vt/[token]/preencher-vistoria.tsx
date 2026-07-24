"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { carimbarFoto } from "@/lib/foto/geo-carimbo";
import {
  conferenciaVazia,
  nomeTipo,
  type CampoVT,
  type Conferencia,
  type ItemVT,
} from "@/lib/vistoria/templates";

type FotoToken = { external_file_id: string | null; categoria?: string | null };

type PontoEstado = {
  id: string;
  nome: string;
  tipo: string;
  itens: ItemVT[];
  anotacoes: string;
  fotosRef: string[]; // referência (onde instalar) — só leitura
  fotos: string[]; // registros in loco feitos pelo responsável
};

type VistoriaToken = {
  id: string;
  titulo: string | null;
  endereco: string | null;
  eng_responsavel: string | null;
  data_prevista: string | null;
  status: string | null;
  projeto_nome: string | null;
  conferencia: Partial<Conferencia> | null;
  preenchido_por_nome: string | null;
  pontos: Array<{
    id: string;
    nome: string;
    tipo: string;
    itens: ItemVT[] | null;
    anotacoes: string | null;
    fotos: FotoToken[] | null;
  }>;
};

function SimNao({
  valor,
  onChange,
}: {
  valor: "sim" | "nao" | null | undefined;
  onChange: (v: "sim" | "nao") => void;
}) {
  return (
    <div className="flex gap-2">
      {(["sim", "nao"] as const).map((op) => (
        <button
          key={op}
          type="button"
          onClick={() => onChange(op)}
          className={
            valor === op
              ? op === "sim"
                ? "rounded-xl bg-green-500/25 px-4 py-1.5 text-sm font-semibold text-green-100 ring-1 ring-green-400/50"
                : "rounded-xl bg-red-500/25 px-4 py-1.5 text-sm font-semibold text-red-100 ring-1 ring-red-400/50"
              : "rounded-xl bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/60"
          }
        >
          {op === "sim" ? "Sim" : "Não"}
        </button>
      ))}
    </div>
  );
}

export default function PreencherVistoria({
  token,
  vistoria,
}: {
  token: string;
  vistoria: VistoriaToken;
}) {
  const supabase = useMemo(() => createClient(), []);

  const jaConcluida = vistoria.status === "concluida";

  const [conf, setConf] = useState<Conferencia>({
    ...conferenciaVazia(),
    ...(vistoria.conferencia ?? {}),
  });
  const [preenchidoPor, setPreenchidoPor] = useState(
    vistoria.preenchido_por_nome ?? ""
  );
  const [pontos, setPontos] = useState<PontoEstado[]>(
    vistoria.pontos.map((p) => {
      const fotos = (p.fotos ?? []).filter((f) => f && f.external_file_id);
      return {
        id: p.id,
        nome: p.nome,
        tipo: p.tipo,
        itens: (p.itens ?? []) as ItemVT[],
        anotacoes: p.anotacoes ?? "",
        fotosRef: fotos
          .filter((f) => f.categoria === "referencia")
          .map((f) => f.external_file_id as string),
        fotos: fotos
          .filter((f) => f.categoria !== "referencia")
          .map((f) => f.external_file_id as string),
      };
    })
  );

  const [enviando, setEnviando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<"rascunho" | "concluir" | null>(null);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [concluida, setConcluida] = useState(jaConcluida);
  const [lightbox, setLightbox] = useState<string | null>(null);

  function urlFoto(fileId: string, thumb = false) {
    const params = new URLSearchParams({ token, fileId });
    if (thumb) params.set("thumb", "1");
    return `/api/vistoria/anexo?${params.toString()}`;
  }

  function setItem(pontoId: string, idx: number, patch: Partial<ItemVT>) {
    setPontos((l) =>
      l.map((p) =>
        p.id === pontoId
          ? {
              ...p,
              itens: p.itens.map((it, i) =>
                i === idx ? { ...it, ...patch } : it
              ),
            }
          : p
      )
    );
  }

  function setCampo(
    pontoId: string,
    idx: number,
    campoIdx: number,
    patch: Partial<CampoVT>
  ) {
    setPontos((l) =>
      l.map((p) =>
        p.id === pontoId
          ? {
              ...p,
              itens: p.itens.map((it, i) =>
                i === idx
                  ? {
                      ...it,
                      campos: it.campos.map((c, ci) =>
                        ci === campoIdx ? { ...c, ...patch } : c
                      ),
                    }
                  : it
              ),
            }
          : p
      )
    );
  }

  function setAnotacoes(pontoId: string, v: string) {
    setPontos((l) =>
      l.map((p) => (p.id === pontoId ? { ...p, anotacoes: v } : p))
    );
  }

  async function adicionarFoto(pontoId: string, file: File | null) {
    if (!file) return;
    setErro("");
    setEnviando(pontoId);
    try {
      const carimbada = await carimbarFoto(file);
      const form = new FormData();
      form.append("token", token);
      form.append("pontoId", pontoId);
      form.append("categoria", "in_loco");
      form.append("file", carimbada);
      const r = await fetch("/api/vistoria/anexos/upload", {
        method: "POST",
        body: form,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Falha ao enviar a foto.");
      const fileId = j?.fileId as string | undefined;
      if (fileId) {
        setPontos((l) =>
          l.map((p) =>
            p.id === pontoId ? { ...p, fotos: [...p.fotos, fileId] } : p
          )
        );
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar a foto.");
    } finally {
      setEnviando(null);
    }
  }

  async function salvar(concluir: boolean) {
    setErro("");
    setOkMsg("");
    if (concluir && preenchidoPor.trim().length < 2) {
      setErro("Informe o nome de quem realizou a vistoria para concluir.");
      return;
    }
    setSalvando(concluir ? "concluir" : "rascunho");
    try {
      const payloadPontos = pontos.map((p) => ({
        id: p.id,
        itens: p.itens,
        anotacoes: p.anotacoes || null,
      }));
      const { error } = await supabase.rpc("fdl_salvar_vistoria_token", {
        p_token: token,
        p_conferencia: conf,
        p_preenchido_por: preenchidoPor || null,
        p_pontos: payloadPontos,
        p_concluir: concluir,
      });
      if (error) throw new Error(error.message);

      if (concluir) {
        setConcluida(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setOkMsg("Rascunho salvo. Você pode continuar depois pelo mesmo link.");
        setTimeout(() => setOkMsg(""), 4000);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(null);
    }
  }

  if (concluida) {
    return (
      <div className="rounded-3xl border border-green-400/25 bg-green-500/10 p-8 text-center">
        <h1 className="text-xl font-bold text-white">Vistoria concluída</h1>
        <p className="mt-3 text-sm text-white/70">
          Obrigado! O relatório da vistoria técnica foi enviado à equipe da
          Fábrica de Luz. Este link não aceita mais alterações.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--fdl-cream)]">
          Vistoria técnica
        </p>
        <h1 className="mt-1 text-xl font-bold text-white">{vistoria.titulo}</h1>
        <div className="mt-2 space-y-0.5 text-sm text-white/60">
          {vistoria.projeto_nome ? <p>{vistoria.projeto_nome}</p> : null}
          {vistoria.endereco ? <p>{vistoria.endereco}</p> : null}
          {vistoria.eng_responsavel ? (
            <p>Eng. responsável: {vistoria.eng_responsavel}</p>
          ) : null}
        </div>
      </header>

      {erro ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {erro}
        </div>
      ) : null}
      {okMsg ? (
        <div className="rounded-2xl border border-green-400/30 bg-green-500/10 p-3 text-sm text-green-100">
          {okMsg}
        </div>
      ) : null}

      {/* Conferência inicial */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-base font-bold text-white">Conferência inicial</h2>
        <div className="mt-4 space-y-4">
          <Campo label="Tamanho do depósito (A × L × C)">
            <input
              className="fdl-mobile-field w-full"
              value={conf.deposito}
              onChange={(e) => setConf({ ...conf, deposito: e.target.value })}
              placeholder="Ex.: 3m × 4m × 6m"
            />
          </Campo>

          <LinhaSimNao
            label="Iluminação no local"
            valor={conf.iluminacao}
            onChange={(v) => setConf({ ...conf, iluminacao: v })}
          />

          <div>
            <LinhaSimNao
              label="Ponto elétrico no local"
              valor={conf.ponto_eletrico}
              onChange={(v) => setConf({ ...conf, ponto_eletrico: v })}
            />
            {conf.ponto_eletrico === "sim" ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  className="fdl-mobile-field w-full"
                  value={conf.tensao}
                  onChange={(e) => setConf({ ...conf, tensao: e.target.value })}
                  placeholder="Tensão"
                />
                <input
                  className="fdl-mobile-field w-full"
                  value={conf.fase}
                  onChange={(e) => setConf({ ...conf, fase: e.target.value })}
                  placeholder="Fase"
                />
              </div>
            ) : null}
          </div>

          <LinhaSimNao
            label="Risco de molhar, sujar etc."
            valor={conf.risco}
            onChange={(v) => setConf({ ...conf, risco: v })}
          />

          <Campo label="Dimensões da porta do depósito">
            <input
              className="fdl-mobile-field w-full"
              value={conf.porta_deposito}
              onChange={(e) =>
                setConf({ ...conf, porta_deposito: e.target.value })
              }
            />
          </Campo>

          <Campo label="Porta de entrada dos materiais">
            <input
              className="fdl-mobile-field w-full"
              value={conf.porta_entrada}
              onChange={(e) =>
                setConf({ ...conf, porta_entrada: e.target.value })
              }
            />
          </Campo>

          <Campo label="Rotas de acesso (equipamentos internos)">
            <textarea
              className="fdl-mobile-field w-full"
              rows={2}
              value={conf.rotas_acesso}
              onChange={(e) =>
                setConf({ ...conf, rotas_acesso: e.target.value })
              }
            />
          </Campo>
        </div>
      </section>

      {/* Pontos */}
      {pontos.map((p) => (
        <section
          key={p.id}
          className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-white">{p.nome}</h2>
            <span className="text-xs font-semibold text-[var(--fdl-cream)]/80">
              {nomeTipo(p.tipo)}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {p.itens.map((it, idx) => (
              <div
                key={it.chave}
                className="rounded-xl border border-white/10 bg-black/10 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white/90">
                    {it.label}
                  </p>
                  {it.simNao ? (
                    <SimNao
                      valor={it.resposta}
                      onChange={(v) => setItem(p.id, idx, { resposta: v })}
                    />
                  ) : null}
                </div>

                {it.campos.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {it.campos.map((c, ci) =>
                      c.tipo === "check" ? (
                        <button
                          key={c.chave}
                          type="button"
                          onClick={() =>
                            setCampo(p.id, idx, ci, { marcado: !c.marcado })
                          }
                          className={
                            c.marcado
                              ? "rounded-lg bg-[var(--fdl-cream)]/25 px-3 py-1.5 text-xs font-semibold text-[var(--fdl-cream)] ring-1 ring-[var(--fdl-cream)]/40"
                              : "rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/55"
                          }
                        >
                          {c.marcado ? "✓ " : ""}
                          {c.label}
                        </button>
                      ) : (
                        <input
                          key={c.chave}
                          className="fdl-mobile-field w-32 grow"
                          value={c.valor ?? ""}
                          onChange={(e) =>
                            setCampo(p.id, idx, ci, { valor: e.target.value })
                          }
                          placeholder={c.label}
                        />
                      )
                    )}
                  </div>
                ) : null}
              </div>
            ))}

            <Campo label="Anotações do ponto">
              <textarea
                className="fdl-mobile-field w-full"
                rows={2}
                value={p.anotacoes}
                onChange={(e) => setAnotacoes(p.id, e.target.value)}
                placeholder="Observações relevantes…"
              />
            </Campo>

            {/* Fotos de referência (onde instalar) — enviadas pela gestão */}
            {p.fotosRef.length > 0 ? (
              <div className="rounded-xl border border-[var(--fdl-cream)]/25 bg-[var(--fdl-cream)]/[0.06] p-3">
                <p className="text-xs font-semibold text-[var(--fdl-cream)]">
                  Referência — onde instalar
                </p>
                <p className="mt-0.5 text-[11px] text-white/50">
                  Fotos enviadas pela equipe para orientar a vistoria.
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {p.fotosRef.map((fileId) => (
                    <button
                      key={fileId}
                      type="button"
                      onClick={() => setLightbox(urlFoto(fileId))}
                      className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={urlFoto(fileId, true)}
                        alt="Foto de referência"
                        loading="lazy"
                        className="h-20 w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Registros in loco (feitos pelo responsável, geo-carimbados) */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">
                  Registros in loco
                </p>
                <span className="text-xs text-white/40">
                  {p.fotos.length} foto(s)
                </span>
              </div>

              {p.fotos.length > 0 ? (
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {p.fotos.map((fileId) => (
                    <button
                      key={fileId}
                      type="button"
                      onClick={() => setLightbox(urlFoto(fileId))}
                      className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={urlFoto(fileId, true)}
                        alt="Foto do ponto"
                        loading="lazy"
                        className="h-20 w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              <label
                className={`fdl-mobile-btn fdl-mobile-btn-ghost mt-2 w-full ${
                  enviando === p.id ? "opacity-60" : "cursor-pointer"
                }`}
              >
                {enviando === p.id ? "Enviando…" : "Tirar foto"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={enviando === p.id}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    adicionarFoto(p.id, f);
                  }}
                />
              </label>
            </div>
          </div>
        </section>
      ))}

      {/* Encerramento */}
      <section className="rounded-3xl border border-[var(--fdl-cream)]/25 bg-white/[0.05] p-5">
        <Campo label="Responsável pela vistoria *">
          <input
            className="fdl-mobile-field w-full"
            value={preenchidoPor}
            onChange={(e) => setPreenchidoPor(e.target.value)}
            placeholder="Seu nome"
          />
        </Campo>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => salvar(true)}
            disabled={salvando !== null}
            className="fdl-mobile-btn fdl-mobile-btn-primary w-full"
          >
            {salvando === "concluir" ? "Concluindo…" : "Concluir V.T."}
          </button>
          <button
            type="button"
            onClick={() => salvar(false)}
            disabled={salvando !== null}
            className="fdl-mobile-btn fdl-mobile-btn-ghost w-full"
          >
            {salvando === "rascunho" ? "Salvando…" : "Salvar rascunho"}
          </button>
        </div>
      </section>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Foto do ponto"
            className="max-h-[92vh] max-w-full rounded-xl object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-white/70">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function LinhaSimNao({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: "sim" | "nao" | null | undefined;
  onChange: (v: "sim" | "nao") => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-white/85">{label}</p>
      <SimNao valor={valor} onChange={onChange} />
    </div>
  );
}
