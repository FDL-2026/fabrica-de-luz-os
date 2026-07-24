"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  TIPOS_DECORACAO,
  itensDoTipo,
  type ItemVT,
} from "@/lib/vistoria/templates";

type ProjetoBusca = {
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  cidade: string | null;
  uf: string | null;
};

type PontoRascunho = {
  uid: string;
  nome: string;
  tipo: string;
  itens: ItemVT[];
  fotosRef: File[]; // fotos de referência (onde instalar)
};

type LocalRascunho = {
  uid: string;
  nome: string;
  endereco: string;
  pontos: PontoRascunho[];
};

function novoUid() {
  return Math.random().toString(36).slice(2, 10);
}

function nomeProjeto(p: ProjetoBusca) {
  return [p.cliente || p.shopping, p.cidade, p.uf].filter(Boolean).join(" · ");
}

function novoPonto(): PontoRascunho {
  const tipo = "fachada";
  return { uid: novoUid(), nome: "", tipo, itens: itensDoTipo(tipo), fotosRef: [] };
}

export default function CriarVistoria({ onCriada }: { onCriada?: () => void }) {
  const supabase = useMemo(() => createClient(), []);

  const [identificacao, setIdentificacao] = useState("");
  const [eng, setEng] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");

  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ProjetoBusca[]>([]);
  const [projeto, setProjeto] = useState<{ id: string; nome: string } | null>(
    null
  );

  const [locais, setLocais] = useState<LocalRascunho[]>([
    { uid: novoUid(), nome: "", endereco: "", pontos: [] },
  ]);
  const [salvando, setSalvando] = useState(false);
  const [fase, setFase] = useState<"criando" | "fotos" | null>(null);
  const [erro, setErro] = useState("");
  const [criada, setCriada] = useState<{ token: string; id: string } | null>(
    null
  );
  const [copiado, setCopiado] = useState(false);

  const linkVT =
    criada && typeof window !== "undefined"
      ? `${window.location.origin}/vt/${criada.token}`
      : "";

  async function buscarProjeto(v: string) {
    setBusca(v);
    if (v.trim().length < 2) {
      setResultados([]);
      return;
    }
    const { data } = await supabase.rpc("fdl_buscar_projetos_chamado", {
      p_busca: v,
    });
    setResultados((data ?? []) as ProjetoBusca[]);
  }

  function escolherProjeto(p: ProjetoBusca) {
    setProjeto({ id: p.projeto_id, nome: nomeProjeto(p) });
    setBusca("");
    setResultados([]);
  }

  // --- Locais ---
  function adicionarLocal() {
    setLocais((l) => [
      ...l,
      { uid: novoUid(), nome: "", endereco: "", pontos: [] },
    ]);
  }
  function removerLocal(uid: string) {
    setLocais((l) => (l.length <= 1 ? l : l.filter((x) => x.uid !== uid)));
  }
  function alterarLocal(uid: string, patch: Partial<LocalRascunho>) {
    setLocais((l) => l.map((x) => (x.uid === uid ? { ...x, ...patch } : x)));
  }

  // --- Pontos dentro de um local ---
  function mutPontos(
    localUid: string,
    fn: (pontos: PontoRascunho[]) => PontoRascunho[]
  ) {
    setLocais((l) =>
      l.map((x) => (x.uid === localUid ? { ...x, pontos: fn(x.pontos) } : x))
    );
  }
  function adicionarPonto(localUid: string) {
    mutPontos(localUid, (ps) => [...ps, novoPonto()]);
  }
  function removerPonto(localUid: string, uid: string) {
    mutPontos(localUid, (ps) => ps.filter((p) => p.uid !== uid));
  }
  function alterarPonto(
    localUid: string,
    uid: string,
    patch: Partial<PontoRascunho>
  ) {
    mutPontos(localUid, (ps) =>
      ps.map((p) => (p.uid === uid ? { ...p, ...patch } : p))
    );
  }
  function trocarTipo(localUid: string, uid: string, tipo: string) {
    alterarPonto(localUid, uid, { tipo, itens: itensDoTipo(tipo) });
  }
  function removerItem(localUid: string, uid: string, chave: string) {
    mutPontos(localUid, (ps) =>
      ps.map((p) =>
        p.uid === uid
          ? { ...p, itens: p.itens.filter((it) => it.chave !== chave) }
          : p
      )
    );
  }
  function adicionarItem(localUid: string, uid: string, label: string) {
    const texto = label.trim();
    if (!texto) return;
    mutPontos(localUid, (ps) =>
      ps.map((p) =>
        p.uid === uid
          ? {
              ...p,
              itens: [
                ...p.itens,
                {
                  chave: `custom_${novoUid()}`,
                  label: texto,
                  simNao: true,
                  resposta: null,
                  campos: [],
                },
              ],
            }
          : p
      )
    );
  }
  function restaurarChecklist(localUid: string, uid: string, tipo: string) {
    alterarPonto(localUid, uid, { itens: itensDoTipo(tipo) });
  }
  function adicionarFotoRef(
    localUid: string,
    uid: string,
    files: FileList | null
  ) {
    if (!files || files.length === 0) return;
    const novas = Array.from(files);
    mutPontos(localUid, (ps) =>
      ps.map((p) =>
        p.uid === uid ? { ...p, fotosRef: [...p.fotosRef, ...novas] } : p
      )
    );
  }
  function removerFotoRef(localUid: string, uid: string, idx: number) {
    mutPontos(localUid, (ps) =>
      ps.map((p) =>
        p.uid === uid
          ? { ...p, fotosRef: p.fotosRef.filter((_, i) => i !== idx) }
          : p
      )
    );
  }

  async function salvar() {
    setErro("");
    if (!projeto && identificacao.trim().length < 2) {
      setErro("Selecione um projeto ou informe uma identificação.");
      return;
    }
    const totalPontos = locais.reduce((n, l) => n + l.pontos.length, 0);
    if (totalPontos === 0) {
      setErro("Adicione pelo menos um ponto para vistoriar.");
      return;
    }
    setSalvando(true);
    setFase("criando");
    try {
      const payloadLocais = locais.map((l, i) => ({
        nome: l.nome.trim() || `Local ${i + 1}`,
        endereco: l.endereco.trim() || null,
        pontos: l.pontos.map((p) => ({
          nome: p.nome.trim() || "Ponto",
          tipo: p.tipo,
          itens: p.itens,
          anotacoes: null,
        })),
      }));

      const { data, error } = await supabase.rpc("fdl_criar_vistoria", {
        p_projeto_id: projeto?.id ?? null,
        p_titulo: projeto ? null : identificacao,
        p_endereco: null,
        p_eng: eng || null,
        p_data_prevista: dataPrevista || null,
        p_locais: payloadLocais,
      });
      if (error) throw new Error(error.message);

      const row = Array.isArray(data) ? data[0] : data;
      const token = (row as { token?: string } | null)?.token;
      const id = (row as { vistoria_id?: string } | null)?.vistoria_id;
      if (!token || !id) throw new Error("Não foi possível gerar o link.");

      // Sobe fotos de referência, casando local/ponto por ordem.
      const temFotos = locais.some((l) =>
        l.pontos.some((p) => p.fotosRef.length > 0)
      );
      if (temFotos) {
        setFase("fotos");
        const { data: det } = await supabase.rpc("fdl_obter_vistoria_gestao", {
          p_id: id,
        });
        const locaisSalvos = (
          (det as {
            locais?: Array<{
              ordem: number;
              pontos?: Array<{ id: string; ordem: number }>;
            }>;
          })?.locais ?? []
        )
          .slice()
          .sort((a, b) => a.ordem - b.ordem);

        for (let li = 0; li < locais.length; li++) {
          const pontosSalvos = (locaisSalvos[li]?.pontos ?? [])
            .slice()
            .sort((a, b) => a.ordem - b.ordem);
          for (let pi = 0; pi < locais[li].pontos.length; pi++) {
            const pontoId = pontosSalvos[pi]?.id;
            if (!pontoId) continue;
            for (const file of locais[li].pontos[pi].fotosRef) {
              const form = new FormData();
              form.append("token", token);
              form.append("pontoId", pontoId);
              form.append("categoria", "referencia");
              form.append("file", file);
              await fetch("/api/vistoria/anexos/upload", {
                method: "POST",
                body: form,
              });
            }
          }
        }
      }

      setCriada({ token, id });
      onCriada?.();
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível criar a vistoria."
      );
    } finally {
      setSalvando(false);
      setFase(null);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(linkVT);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  function novaVistoria() {
    setIdentificacao("");
    setEng("");
    setDataPrevista("");
    setProjeto(null);
    setLocais([{ uid: novoUid(), nome: "", endereco: "", pontos: [] }]);
    setCriada(null);
    setErro("");
  }

  if (criada) {
    return (
      <div className="rounded-3xl border border-[var(--fdl-cream)]/25 bg-[var(--fdl-cream)]/[0.08] p-6">
        <p className="text-sm font-bold text-[var(--fdl-cream)]">
          Vistoria criada. Compartilhe o link com o responsável.
        </p>
        <p className="mt-1 text-xs text-white/60">
          Ao abrir, ele preenche o checklist no local. Você é avisado quando a
          V.T. for concluída.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={linkVT}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={copiar}
            className="fdl-ui-btn fdl-ui-btn-primary shrink-0"
          >
            {copiado ? "Copiado" : "Copiar link"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`/vistorias/${criada.id}`}
            className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-secondary"
          >
            Ver relatório
          </a>
          <button
            type="button"
            onClick={novaVistoria}
            className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-ghost"
          >
            Nova vistoria
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <h2 className="text-lg font-bold text-white">Nova vistoria técnica</h2>
      <p className="mt-1 text-sm text-white/55">
        Vincule ao projeto, adicione os locais/praças e, em cada um, os pontos a
        vistoriar. Cada tipo de decoração já traz um checklist sugerido.
      </p>

      {erro ? (
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {erro}
        </div>
      ) : null}

      {/* Cabeçalho */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="fdl-ui-label">Projeto</label>
          {projeto ? (
            <div className="mt-1.5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
              <span className="text-sm text-white">{projeto.nome}</span>
              <button
                type="button"
                onClick={() => setProjeto(null)}
                className="text-xs font-semibold text-white/60 hover:text-white"
              >
                Trocar
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                className="fdl-field mt-1.5 w-full"
                value={busca}
                onChange={(e) => buscarProjeto(e.target.value)}
                placeholder="Buscar shopping/cliente"
              />
              {resultados.length > 0 ? (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#3a2456] shadow-xl">
                  {resultados.map((p) => (
                    <button
                      key={p.projeto_id}
                      type="button"
                      onClick={() => escolherProjeto(p)}
                      className="block w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/10"
                    >
                      {nomeProjeto(p)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {!projeto ? (
          <div className="sm:col-span-2">
            <label className="fdl-ui-label">
              Identificação (se não vincular projeto)
            </label>
            <input
              className="fdl-field mt-1.5 w-full"
              value={identificacao}
              onChange={(e) => setIdentificacao(e.target.value)}
              placeholder="Ex.: Prefeitura de Goiânia — Natal 2026"
            />
          </div>
        ) : null}

        <div>
          <label className="fdl-ui-label">Eng. responsável</label>
          <input
            className="fdl-field mt-1.5 w-full"
            value={eng}
            onChange={(e) => setEng(e.target.value)}
          />
        </div>

        <div>
          <label className="fdl-ui-label">Data prevista da V.T.</label>
          <input
            type="date"
            className="fdl-field mt-1.5 w-full"
            value={dataPrevista}
            onChange={(e) => setDataPrevista(e.target.value)}
          />
        </div>
      </div>

      {/* Locais */}
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Locais / praças ({locais.length})
          </h3>
          <button
            type="button"
            onClick={adicionarLocal}
            className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-secondary"
          >
            Adicionar local
          </button>
        </div>

        {locais.map((local, li) => (
          <div
            key={local.uid}
            className="rounded-2xl border border-[var(--fdl-cream)]/20 bg-white/[0.03] p-4"
          >
            <div className="flex items-start gap-3">
              <span className="mt-2 flex h-6 shrink-0 items-center justify-center rounded-full bg-[var(--fdl-cream)]/15 px-2 text-xs font-bold text-[var(--fdl-cream)]">
                Local {li + 1}
              </span>
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="fdl-ui-label">Nome do local / praça</label>
                  <input
                    className="fdl-field mt-1.5 w-full"
                    value={local.nome}
                    onChange={(e) =>
                      alterarLocal(local.uid, { nome: e.target.value })
                    }
                    placeholder="Ex.: Praça Cívica"
                  />
                </div>
                <div>
                  <label className="fdl-ui-label">Endereço</label>
                  <input
                    className="fdl-field mt-1.5 w-full"
                    value={local.endereco}
                    onChange={(e) =>
                      alterarLocal(local.uid, { endereco: e.target.value })
                    }
                    placeholder="Endereço do local"
                  />
                </div>
              </div>
              {locais.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removerLocal(local.uid)}
                  className="mt-1 shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-200/80 hover:bg-red-500/10"
                >
                  Remover
                </button>
              ) : null}
            </div>

            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-white/80">
                  Pontos ({local.pontos.length})
                </p>
                <button
                  type="button"
                  onClick={() => adicionarPonto(local.uid)}
                  className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-ghost"
                >
                  Adicionar ponto
                </button>
              </div>

              {local.pontos.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-white/15 p-4 text-center text-xs text-white/45">
                  Nenhum ponto neste local ainda.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {local.pontos.map((p, pi) => (
                    <PontoEditor
                      key={p.uid}
                      indice={pi + 1}
                      ponto={p}
                      onNome={(nome) => alterarPonto(local.uid, p.uid, { nome })}
                      onTipo={(tipo) => trocarTipo(local.uid, p.uid, tipo)}
                      onRemoverItem={(chave) =>
                        removerItem(local.uid, p.uid, chave)
                      }
                      onAdicionarItem={(label) =>
                        adicionarItem(local.uid, p.uid, label)
                      }
                      onRestaurar={() =>
                        restaurarChecklist(local.uid, p.uid, p.tipo)
                      }
                      onRemover={() => removerPonto(local.uid, p.uid)}
                      onAdicionarFotoRef={(files) =>
                        adicionarFotoRef(local.uid, p.uid, files)
                      }
                      onRemoverFotoRef={(idx) =>
                        removerFotoRef(local.uid, p.uid, idx)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="fdl-ui-btn fdl-ui-btn-primary flex-1"
        >
          {salvando
            ? fase === "fotos"
              ? "Enviando fotos de referência…"
              : "Gerando link…"
            : "Criar vistoria e gerar link"}
        </button>
      </div>
    </div>
  );
}

function PontoEditor({
  indice,
  ponto,
  onNome,
  onTipo,
  onRemoverItem,
  onAdicionarItem,
  onRestaurar,
  onRemover,
  onAdicionarFotoRef,
  onRemoverFotoRef,
}: {
  indice: number;
  ponto: PontoRascunho;
  onNome: (v: string) => void;
  onTipo: (v: string) => void;
  onRemoverItem: (chave: string) => void;
  onAdicionarItem: (label: string) => void;
  onRestaurar: () => void;
  onRemover: () => void;
  onAdicionarFotoRef: (files: FileList | null) => void;
  onRemoverFotoRef: (idx: number) => void;
}) {
  const [novoItem, setNovoItem] = useState("");

  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/70">
          {indice}
        </span>
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="fdl-ui-label">Nome do ponto</label>
            <input
              className="fdl-field mt-1.5 w-full"
              value={ponto.nome}
              onChange={(e) => onNome(e.target.value)}
              placeholder="Ex.: Rotatória Araguaia"
            />
          </div>
          <div>
            <label className="fdl-ui-label">Tipo de decoração</label>
            <select
              className="fdl-select mt-1.5 w-full"
              value={ponto.tipo}
              onChange={(e) => onTipo(e.target.value)}
            >
              {TIPOS_DECORACAO.map((t) => (
                <option key={t.chave} value={t.chave}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemover}
          className="mt-1 shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-200/80 hover:bg-red-500/10"
        >
          Remover
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-white/70">
            Checklist sugerido ({ponto.itens.length})
          </p>
          <button
            type="button"
            onClick={onRestaurar}
            className="text-xs font-semibold text-[var(--fdl-cream)]/80 hover:text-[var(--fdl-cream)]"
          >
            Restaurar sugestão
          </button>
        </div>

        <ul className="mt-2 space-y-1.5">
          {ponto.itens.map((it) => (
            <li
              key={it.chave}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5"
            >
              <span className="text-sm text-white/85">
                {it.label}
                {it.campos.length > 0 ? (
                  <span className="text-white/40">
                    {" "}
                    · {it.campos.map((c) => c.label).join(", ")}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => onRemoverItem(it.chave)}
                aria-label="Remover item"
                className="shrink-0 rounded px-2 text-white/40 hover:text-red-200"
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex gap-2">
          <input
            className="fdl-field flex-1"
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdicionarItem(novoItem);
                setNovoItem("");
              }
            }}
            placeholder="Adicionar item personalizado…"
          />
          <button
            type="button"
            onClick={() => {
              onAdicionarItem(novoItem);
              setNovoItem("");
            }}
            className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-ghost shrink-0"
          >
            Adicionar
          </button>
        </div>
      </div>

      {/* Fotos de referência (onde instalar) */}
      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-white/70">
            Fotos de referência ({ponto.fotosRef.length})
          </p>
          <span className="text-[11px] text-white/40">onde instalar</span>
        </div>

        {ponto.fotosRef.length > 0 ? (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ponto.fotosRef.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(file)}
                  alt="Referência"
                  className="h-20 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoverFotoRef(idx)}
                  aria-label="Remover foto"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <label className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-ghost mt-2 w-full cursor-pointer">
          Anexar fotos de referência
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onAdicionarFotoRef(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
