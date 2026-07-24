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
};

function novoUid() {
  return Math.random().toString(36).slice(2, 10);
}

function nomeProjeto(p: ProjetoBusca) {
  return [p.cliente || p.shopping, p.cidade, p.uf].filter(Boolean).join(" · ");
}

export default function CriarVistoria({
  onCriada,
}: {
  onCriada?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [titulo, setTitulo] = useState("");
  const [endereco, setEndereco] = useState("");
  const [eng, setEng] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");

  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ProjetoBusca[]>([]);
  const [projeto, setProjeto] = useState<{ id: string; nome: string } | null>(
    null
  );

  const [pontos, setPontos] = useState<PontoRascunho[]>([]);
  const [salvando, setSalvando] = useState(false);
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
    if (!titulo.trim()) setTitulo(p.cliente || p.shopping || "");
    setBusca("");
    setResultados([]);
  }

  function adicionarPonto() {
    const tipo = "fachada";
    setPontos((l) => [
      ...l,
      { uid: novoUid(), nome: "", tipo, itens: itensDoTipo(tipo) },
    ]);
  }

  function removerPonto(uid: string) {
    setPontos((l) => l.filter((p) => p.uid !== uid));
  }

  function alterarPonto(uid: string, patch: Partial<PontoRascunho>) {
    setPontos((l) => l.map((p) => (p.uid === uid ? { ...p, ...patch } : p)));
  }

  function trocarTipo(uid: string, tipo: string) {
    // Reaplica o checklist sugerido do novo tipo.
    alterarPonto(uid, { tipo, itens: itensDoTipo(tipo) });
  }

  function removerItem(uid: string, chave: string) {
    setPontos((l) =>
      l.map((p) =>
        p.uid === uid
          ? { ...p, itens: p.itens.filter((it) => it.chave !== chave) }
          : p
      )
    );
  }

  function adicionarItem(uid: string, label: string) {
    const texto = label.trim();
    if (!texto) return;
    setPontos((l) =>
      l.map((p) =>
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

  function restaurarChecklist(uid: string, tipo: string) {
    alterarPonto(uid, { itens: itensDoTipo(tipo) });
  }

  async function salvar() {
    setErro("");
    if (titulo.trim().length < 2) {
      setErro("Informe um título/identificação para a vistoria.");
      return;
    }
    if (pontos.length === 0) {
      setErro("Adicione pelo menos um ponto para vistoriar.");
      return;
    }
    setSalvando(true);
    try {
      const payloadPontos = pontos.map((p) => ({
        nome: p.nome.trim() || "Ponto",
        tipo: p.tipo,
        itens: p.itens,
        anotacoes: null,
      }));

      const { data, error } = await supabase.rpc("fdl_criar_vistoria", {
        p_projeto_id: projeto?.id ?? null,
        p_titulo: titulo,
        p_endereco: endereco || null,
        p_eng: eng || null,
        p_data_prevista: dataPrevista || null,
        p_pontos: payloadPontos,
      });
      if (error) throw new Error(error.message);

      const row = Array.isArray(data) ? data[0] : data;
      const token = (row as { token?: string } | null)?.token;
      const id = (row as { vistoria_id?: string } | null)?.vistoria_id;
      if (!token || !id) throw new Error("Não foi possível gerar o link.");

      setCriada({ token, id });
      onCriada?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a vistoria.");
    } finally {
      setSalvando(false);
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
    setTitulo("");
    setEndereco("");
    setEng("");
    setDataPrevista("");
    setProjeto(null);
    setPontos([]);
    setCriada(null);
    setErro("");
  }

  // --- Tela de sucesso: link pronto para compartilhar ---
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
        Pré-preencha os dados e os pontos. Cada tipo de decoração já traz um
        checklist sugerido para guiar a V.T.
      </p>

      {erro ? (
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {erro}
        </div>
      ) : null}

      {/* Cabeçalho */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="fdl-ui-label">Título / identificação *</label>
          <input
            className="fdl-field mt-1.5 w-full"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Natal do Bem — Shopping X"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="fdl-ui-label">Projeto (opcional)</label>
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
                placeholder="Buscar shopping/cliente (opcional)"
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

        <div className="sm:col-span-2">
          <label className="fdl-ui-label">Endereço</label>
          <input
            className="fdl-field mt-1.5 w-full"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Endereço do local"
          />
        </div>

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

      {/* Pontos */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Pontos a vistoriar ({pontos.length})
          </h3>
          <button
            type="button"
            onClick={adicionarPonto}
            className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-secondary"
          >
            Adicionar ponto
          </button>
        </div>

        {pontos.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm text-white/45">
            Nenhum ponto ainda. Adicione os locais/layouts que serão
            vistoriados.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {pontos.map((p, idx) => (
              <PontoEditor
                key={p.uid}
                indice={idx + 1}
                ponto={p}
                onNome={(nome) => alterarPonto(p.uid, { nome })}
                onTipo={(tipo) => trocarTipo(p.uid, tipo)}
                onRemoverItem={(chave) => removerItem(p.uid, chave)}
                onAdicionarItem={(label) => adicionarItem(p.uid, label)}
                onRestaurar={() => restaurarChecklist(p.uid, p.tipo)}
                onRemover={() => removerPonto(p.uid)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="fdl-ui-btn fdl-ui-btn-primary flex-1"
        >
          {salvando ? "Gerando link…" : "Criar vistoria e gerar link"}
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
}: {
  indice: number;
  ponto: PontoRascunho;
  onNome: (v: string) => void;
  onTipo: (v: string) => void;
  onRemoverItem: (chave: string) => void;
  onAdicionarItem: (label: string) => void;
  onRestaurar: () => void;
  onRemover: () => void;
}) {
  const [novoItem, setNovoItem] = useState("");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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

      <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3">
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
    </div>
  );
}
