"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "@/components/brand-logo";

type ProjetoOpcao = {
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  cidade: string | null;
  uf: string | null;
  temporada: string | null;
};

const CATEGORIAS = [
  { valor: "manutencao", rotulo: "Manutenção geral" },
  { valor: "eletrica", rotulo: "Elétrica" },
  { valor: "iluminacao", rotulo: "Iluminação / lâmpadas" },
  { valor: "estrutura", rotulo: "Estrutura / fixação" },
  { valor: "troca_peca", rotulo: "Troca de peça" },
  { valor: "limpeza", rotulo: "Limpeza" },
  { valor: "outro", rotulo: "Outro" },
];

const PRIORIDADES = [
  { valor: "baixa", rotulo: "Baixa" },
  { valor: "media", rotulo: "Média" },
  { valor: "alta", rotulo: "Alta" },
  { valor: "urgente", rotulo: "Urgente" },
];

function IconeCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.2a1 1 0 0 0 .8-.4l.9-1.2a1 1 0 0 1 .8-.4h3.6a1 1 0 0 1 .8.4l.9 1.2a1 1 0 0 0 .8.4h1.2A1.5 1.5 0 0 1 20 8.5v8A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12.2" r="2.9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconeImagem() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <path d="m5 17 4.5-4.2a1 1 0 0 1 1.35-.03L14 15l1.8-1.6a1 1 0 0 1 1.3-.02L20 16" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function nomeProjeto(p: ProjetoOpcao) {
  const base = p.shopping || p.cliente || "Projeto";
  const local = [p.cidade, p.uf].filter(Boolean).join("/");
  return local ? `${base} — ${local}` : base;
}

type ChamadoHistorico = {
  protocolo: string;
  titulo: string | null;
  categoria: string | null;
  prioridade: string | null;
  status: string;
  criado_em: string;
  resolvido_em: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_peca: "Aguardando peça",
  resolvido: "Resolvido",
};

function statusLabel(s: string | null) {
  return (s && STATUS_LABEL[s]) || s || "—";
}

// Mínimo de fotos que o shopping precisa anexar para abrir um chamado.
const MIN_FOTOS = 3;

function statusClass(s: string | null) {
  switch (s) {
    case "resolvido":
      return "bg-green-100 text-green-700";
    case "em_andamento":
      return "bg-blue-100 text-blue-700";
    case "aguardando_peca":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-white/15 text-white";
  }
}

function dataCurta(v: string | null) {
  if (!v) return "";
  return new Date(v).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ChamadoClient({
  projetoFixo = null,
  historico = null,
}: {
  projetoFixo?: ProjetoOpcao | null;
  historico?: ChamadoHistorico[] | null;
}) {
  const supabase = useMemo(() => createClient(), []);

  // Seleção de projeto (autocomplete). Quando o chamado vem por um link
  // individual do shopping, o projeto já vem fixo e o campo fica travado.
  const [busca, setBusca] = useState("");
  const [opcoes, setOpcoes] = useState<ProjetoOpcao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [projeto, setProjeto] = useState<ProjetoOpcao | null>(projetoFixo);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const buscaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  // Campos
  const [solicitante, setSolicitante] = useState("");
  const [contato, setContato] = useState("");
  const [categoria, setCategoria] = useState("manutencao");
  const [prioridade, setPrioridade] = useState("media");
  const [local, setLocal] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);

  // Estado de envio
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [progresso, setProgresso] = useState("");
  const [protocolo, setProtocolo] = useState<string | null>(null);

  useEffect(() => {
    if (projeto) return; // já selecionado, não busca mais
    if (buscaTimer.current) clearTimeout(buscaTimer.current);

    const termo = busca.trim();
    if (termo.length < 2) {
      setOpcoes([]);
      return;
    }

    buscaTimer.current = setTimeout(async () => {
      setBuscando(true);
      const { data, error } = await supabase.rpc("fdl_buscar_projetos_chamado", {
        p_busca: termo,
      });
      if (!error) setOpcoes((data ?? []) as ProjetoOpcao[]);
      setBuscando(false);
    }, 350);

    return () => {
      if (buscaTimer.current) clearTimeout(buscaTimer.current);
    };
  }, [busca, projeto, supabase]);

  function adicionarArquivos(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setArquivos((atuais) => {
      const nova = [...atuais];
      for (const f of Array.from(lista)) {
        if (!nova.some((x) => x.name === f.name && x.size === f.size)) nova.push(f);
      }
      return nova.slice(0, 10);
    });
  }

  function removerArquivo(indice: number) {
    setArquivos((atuais) => atuais.filter((_, i) => i !== indice));
  }

  async function enviar() {
    setErro("");

    if (!projeto) {
      setErro("Selecione o projeto/shopping da lista.");
      return;
    }
    if (descricao.trim().length < 5) {
      setErro("Descreva o problema com um pouco mais de detalhe.");
      return;
    }
    if (arquivos.length < MIN_FOTOS) {
      setErro(
        `Anexe pelo menos ${MIN_FOTOS} fotos do problema para registrar o chamado.`
      );
      return;
    }

    setEnviando(true);
    setProgresso("Registrando o chamado...");

    const { data, error } = await supabase.rpc("fdl_criar_chamado", {
      p_projeto_id: projeto.projeto_id,
      p_solicitante_nome: solicitante,
      p_solicitante_contato: contato,
      p_categoria: categoria,
      p_prioridade: prioridade,
      p_local_ponto: local,
      p_titulo: titulo,
      p_descricao: descricao,
    });

    const resultado = Array.isArray(data) ? data[0] : null;

    if (error || !resultado) {
      setErro(error?.message ?? "Não foi possível registrar o chamado.");
      setEnviando(false);
      setProgresso("");
      return;
    }

    const chamadoId = resultado.chamado_id as string;

    // Envia as fotos (best-effort: falha em uma não perde o chamado)
    let falhasFoto = 0;
    for (let i = 0; i < arquivos.length; i += 1) {
      setProgresso(`Enviando foto ${i + 1} de ${arquivos.length}...`);
      const fd = new FormData();
      fd.append("chamadoId", chamadoId);
      fd.append("file", arquivos[i]);
      try {
        const r = await fetch("/api/chamado/anexos/upload", {
          method: "POST",
          body: fd,
        });
        if (!r.ok) falhasFoto += 1;
      } catch {
        falhasFoto += 1;
      }
    }

    setProgresso("");
    setEnviando(false);
    setProtocolo(resultado.protocolo as string);

    if (falhasFoto > 0) {
      setErro(
        `Chamado registrado, mas ${falhasFoto} foto(s) não subiram. Você pode reenviá-las informando o protocolo ao gestor.`
      );
    }
  }

  function novoChamado() {
    setProjeto(null);
    setBusca("");
    setOpcoes([]);
    setSolicitante("");
    setContato("");
    setCategoria("manutencao");
    setPrioridade("media");
    setLocal("");
    setTitulo("");
    setDescricao("");
    setArquivos([]);
    setInputKey((k) => k + 1);
    setErro("");
    setProtocolo(null);
  }

  // ---- Tela de sucesso ----
  if (protocolo) {
    return (
      <section className="fdl-mobile-card fdl-mobile-card-strong text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--fdl-cream)] text-3xl text-[var(--fdl-purple-dark)]">
          ✓
        </div>
        <h1 className="fdl-mobile-title">Chamado registrado!</h1>
        <p className="fdl-mobile-description mt-2">
          Sua solicitação foi enviada ao gestor responsável pelo projeto. Guarde
          o protocolo para acompanhar.
        </p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">
            Protocolo
          </p>
          <p className="mt-1 text-2xl font-extrabold tracking-wide text-[var(--fdl-cream)]">
            {protocolo}
          </p>
        </div>

        {erro ? (
          <div className="mt-4 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
            {erro}
          </div>
        ) : null}

        <a
          href={`/chamado/acompanhar?p=${encodeURIComponent(protocolo)}`}
          className="mt-6 block h-12 rounded-2xl bg-[var(--fdl-cream)] px-5 text-center text-sm font-semibold leading-[3rem] text-[var(--fdl-purple-dark)] transition hover:brightness-95"
        >
          Acompanhar este chamado
        </a>

        <button
          type="button"
          onClick={novoChamado}
          className="mt-3 h-12 w-full rounded-2xl border border-white/15 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          Registrar outro chamado
        </button>
      </section>
    );
  }

  // ---- Formulário ----
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center">
        <BrandLogo className="h-auto w-52 sm:w-64" />
        <p className="fdl-mobile-kicker mt-5">Manutenção</p>
        <h1 className="fdl-mobile-title">Abrir chamado</h1>
        <p className="fdl-mobile-description mt-1">
          Registre uma solicitação de manutenção. Ela vai direto para o gestor
          responsável pelo projeto.
        </p>
        {!projetoFixo ? (
          <a
            href="/chamado/acompanhar"
            className="mt-3 inline-flex items-center gap-1 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Já tem um chamado? Acompanhe pelo protocolo →
          </a>
        ) : null}
      </div>

      {projetoFixo ? (
        <section className="fdl-mobile-card">
          <button
            type="button"
            onClick={() => setMostrarHistorico((v) => !v)}
            className="flex w-full items-center justify-between gap-3"
            aria-expanded={mostrarHistorico}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-white">
              📋 Histórico de chamados
              {historico && historico.length > 0 ? (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white/80">
                  {historico.length}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs font-semibold text-[var(--fdl-cream)]">
              {mostrarHistorico ? "Ocultar ▲" : "Ver ▼"}
            </span>
          </button>

          {mostrarHistorico && historico && historico.length > 0 ? (
            <div className="mt-3 space-y-2">
              {historico.map((h) => (
                <a
                  key={h.protocolo}
                  href={`/chamado/acompanhar?p=${encodeURIComponent(h.protocolo)}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.05] p-3 transition hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-semibold text-white">
                      {h.titulo || "Chamado"}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                        h.status
                      )}`}
                    >
                      {statusLabel(h.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/45">
                    {h.protocolo} · aberto em {dataCurta(h.criado_em)}
                    {h.status === "resolvido" && h.resolvido_em
                      ? ` · resolvido em ${dataCurta(h.resolvido_em)}`
                      : ""}
                  </p>
                </a>
              ))}
            </div>
          ) : mostrarHistorico ? (
            <p className="mt-3 text-sm text-white/50">
              Ainda não há chamados para este shopping. Use o formulário abaixo
              para registrar o primeiro.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="fdl-mobile-card space-y-4">
        {/* Projeto */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            Projeto / Shopping <span className="text-[var(--fdl-cream)]">*</span>
          </label>

          {projeto ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/[0.05] p-3">
              <span className="min-w-0 text-sm font-semibold text-white">
                {nomeProjeto(projeto)}
                {projeto.temporada ? (
                  <span className="text-white/50"> · {projeto.temporada}</span>
                ) : null}
              </span>
              {!projetoFixo ? (
                <button
                  type="button"
                  onClick={() => {
                    setProjeto(null);
                    setBusca("");
                  }}
                  className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Trocar
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite o nome do shopping (ex.: Recife)"
                className="fdl-field"
                autoComplete="off"
              />
              {buscando ? (
                <p className="mt-2 text-xs text-white/45">Buscando...</p>
              ) : null}
              {!buscando && opcoes.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {opcoes.map((o) => (
                    <button
                      key={o.projeto_id}
                      type="button"
                      onClick={() => {
                        setProjeto(o);
                        setOpcoes([]);
                      }}
                      className="block w-full rounded-xl border border-white/10 bg-white/[0.05] p-3 text-left text-sm text-white transition hover:bg-white/10"
                    >
                      <span className="font-semibold">{nomeProjeto(o)}</span>
                      {o.temporada ? (
                        <span className="text-white/45"> · {o.temporada}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
              {!buscando && busca.trim().length >= 2 && opcoes.length === 0 ? (
                <p className="mt-2 text-xs text-white/45">
                  Nenhum projeto encontrado. Confira o nome ou fale com o gestor.
                </p>
              ) : null}
            </>
          )}
        </div>

        {/* Solicitante */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Seu nome
            </label>
            <input
              type="text"
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              placeholder="Quem está solicitando"
              className="fdl-field"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Contato (WhatsApp/e-mail)
            </label>
            <input
              type="text"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="Para retorno do gestor"
              className="fdl-field"
            />
          </div>
        </div>

        {/* Categoria + prioridade */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Categoria
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="fdl-field"
            >
              {CATEGORIAS.map((c) => (
                <option key={c.valor} value={c.valor} className="text-black">
                  {c.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Prioridade
            </label>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
              className="fdl-field"
            >
              {PRIORIDADES.map((p) => (
                <option key={p.valor} value={p.valor} className="text-black">
                  {p.rotulo}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Local */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            Local / ponto
          </label>
          <input
            type="text"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Ex.: Praça central, entrada L2, árvore principal"
            className="fdl-field"
          />
        </div>

        {/* Título */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            Resumo do problema
          </label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Lâmpadas apagadas no túnel de luz"
            className="fdl-field"
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            Descrição <span className="text-[var(--fdl-cream)]">*</span>
          </label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={5}
            placeholder="Descreva o que está acontecendo, desde quando, e qualquer detalhe que ajude a equipe."
            className="w-full rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)] focus:ring-4 focus:ring-[var(--fdl-cream)]/10"
          />
        </div>

        {/* Fotos */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-white">
            Fotos do problema (mínimo {MIN_FOTOS}) *
          </label>
          <p
            className={`mb-2 text-xs ${
              arquivos.length >= MIN_FOTOS
                ? "text-green-300"
                : "text-[var(--fdl-cream)]"
            }`}
          >
            {arquivos.length >= MIN_FOTOS
              ? `✓ ${arquivos.length} foto(s) anexada(s).`
              : `Anexe pelo menos ${MIN_FOTOS} fotos — faltam ${
                  MIN_FOTOS - arquivos.length
                }.`}
          </p>
          <input
            ref={camRef}
            key={`cam-${inputKey}`}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => adicionarArquivos(e.target.files)}
            className="hidden"
          />
          <input
            ref={galRef}
            key={`gal-${inputKey}`}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => adicionarArquivos(e.target.files)}
            className="hidden"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => camRef.current?.click()}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--fdl-cream)] text-sm font-bold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
            >
              <IconeCamera /> Tirar foto
            </button>
            <button
              type="button"
              onClick={() => galRef.current?.click()}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.06] text-sm font-bold text-white/85 transition hover:bg-white/10"
            >
              <IconeImagem /> Da galeria
            </button>
          </div>

          {arquivos.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {arquivos.map((a, i) => (
                <div
                  key={`${a.name}-${a.size}-${i}`}
                  className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]"
                >
                  {a.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={URL.createObjectURL(a)}
                      alt={a.name}
                      className="h-20 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center text-2xl">
                      🎬
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removerArquivo(i)}
                    aria-label={`Remover ${a.name}`}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {erro ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
            {erro}
          </div>
        ) : null}

        {progresso ? (
          <div className="rounded-2xl border border-[var(--fdl-cream)]/30 bg-[var(--fdl-cream)]/10 px-4 py-3 text-sm font-semibold text-[var(--fdl-cream)]">
            {progresso}
          </div>
        ) : null}

        <button
          type="button"
          onClick={enviar}
          disabled={enviando || arquivos.length < MIN_FOTOS}
          className="h-12 w-full rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando
            ? "Enviando..."
            : arquivos.length < MIN_FOTOS
              ? `Anexe ${MIN_FOTOS} fotos para enviar`
              : "Enviar chamado"}
        </button>
      </section>
    </div>
  );
}
