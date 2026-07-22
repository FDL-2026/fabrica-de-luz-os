"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Resumo = {
  abertos: number;
  em_andamento: number;
  aguardando: number;
  resolvidos: number;
  aguardando_validacao: number;
  total: number;
};

type ChamadoLista = {
  chamado_id: string;
  protocolo: string;
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
  responsavel_comercial: string | null;
  solicitante_nome: string | null;
  solicitante_contato: string | null;
  categoria: string | null;
  prioridade: string | null;
  local_ponto: string | null;
  titulo: string | null;
  descricao: string | null;
  status: string | null;
  atribuido_usuario_id: string | null;
  atribuido_nome: string | null;
  total_anexos: number;
  criado_em: string | null;
  atualizado_em: string | null;
  resolvido_em: string | null;
  validado_em?: string | null;
};

type Anexo = {
  id: string;
  tipo: string | null;
  fase?: string | null;
  nome_arquivo: string | null;
  url_visualizacao: string | null;
  external_file_id: string | null;
  criado_em: string;
};

type Evento = {
  id: string;
  tipo: string;
  de_status: string | null;
  para_status: string | null;
  descricao: string | null;
  usuario_nome: string | null;
  criado_em: string;
};

type Detalhe = {
  chamado: ChamadoLista & { atribuido_nome: string | null };
  anexos: Anexo[];
  eventos: Evento[];
  montadores: string[];
};

type Montador = { usuario_id: string; nome: string };

const STATUS = [
  { valor: "aberto", rotulo: "Aberto" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "resolvido", rotulo: "Resolvido" },
  { valor: "cancelado", rotulo: "Cancelado" },
];

const CATEGORIA_LABEL: Record<string, string> = {
  manutencao: "Manutenção",
  eletrica: "Elétrica",
  iluminacao: "Iluminação",
  estrutura: "Estrutura",
  troca_peca: "Troca de peça",
  limpeza: "Limpeza",
  outro: "Outro",
};

function statusLabel(s: string | null) {
  return STATUS.find((x) => x.valor === s)?.rotulo ?? s ?? "—";
}

function statusClass(s: string | null) {
  switch (s) {
    case "aberto":
      return "bg-yellow-100 text-yellow-700";
    case "em_andamento":
      return "bg-blue-100 text-blue-700";
    case "resolvido":
      return "bg-green-100 text-green-700";
    case "cancelado":
      return "bg-red-100 text-red-700";
    default:
      return "bg-white/20 text-white";
  }
}

function prioridadeClass(p: string | null) {
  switch (p) {
    case "urgente":
      return "bg-red-100 text-red-700";
    case "alta":
      return "bg-orange-100 text-orange-700";
    case "media":
      return "bg-white/15 text-white/80";
    default:
      return "bg-white/10 text-white/55";
  }
}

function nomeProjeto(c: { shopping: string | null; cliente: string | null; uf: string | null }) {
  const base = c.shopping || c.cliente || "Projeto";
  return c.uf ? `${base} · ${c.uf}` : base;
}

function formatDateTime(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function ChamadosClient() {
  const supabase = useMemo(() => createClient(), []);

  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [chamados, setChamados] = useState<ChamadoLista[]>([]);
  const [montadores, setMontadores] = useState<Montador[]>([]);
  const [filtro, setFiltro] = useState<string>("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [obs, setObs] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");

    const [resResumo, resLista] = await Promise.all([
      supabase.rpc("fdl_resumo_chamados_gestao"),
      supabase.rpc("fdl_listar_chamados_gestao", {
        p_status: filtro || null,
        p_projeto_id: null,
      }),
    ]);

    if (resResumo.error || resLista.error) {
      setErro(resResumo.error?.message ?? resLista.error?.message ?? "Erro ao carregar.");
      setCarregando(false);
      return;
    }

    const r = Array.isArray(resResumo.data) ? resResumo.data[0] : resResumo.data;
    setResumo((r ?? null) as Resumo | null);
    setChamados((resLista.data ?? []) as ChamadoLista[]);
    setCarregando(false);
  }, [supabase, filtro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    supabase.rpc("fdl_listar_montadores_chamado").then(({ data }) => {
      setMontadores((data ?? []) as Montador[]);
    });
  }, [supabase]);

  async function abrirDetalhe(id: string) {
    setObs("");
    const { data, error } = await supabase.rpc("fdl_obter_chamado_gestao", {
      p_chamado_id: id,
    });
    if (error) {
      setErro(error.message);
      return;
    }
    setDetalhe(data as Detalhe);
  }

  async function atualizar(campos: {
    status?: string;
    atribuido?: string | null;
    observacao?: string;
  }) {
    if (!detalhe) return;
    setSalvando(true);
    const { data, error } = await supabase.rpc("fdl_atualizar_chamado_gestao", {
      p_chamado_id: detalhe.chamado.chamado_id,
      p_status: campos.status ?? null,
      p_atribuido_usuario_id: campos.atribuido ?? null,
      p_observacao: campos.observacao ?? null,
    });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setDetalhe(data as Detalhe);
    setObs("");
    carregar();
  }

  async function validar() {
    if (!detalhe) return;
    setSalvando(true);
    const { data, error } = await supabase.rpc("fdl_validar_chamado_gestao", {
      p_chamado_id: detalhe.chamado.chamado_id,
    });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setDetalhe(data as Detalhe);
    carregar();
  }

  const kpis = [
    { label: "Abertos", valor: resumo?.abertos ?? 0, filtro: "aberto" },
    { label: "Em andamento", valor: resumo?.em_andamento ?? 0, filtro: "em_andamento" },
    {
      label: "Aguardando validação",
      valor: resumo?.aguardando_validacao ?? 0,
      filtro: "resolvido",
    },
    { label: "Resolvidos", valor: resumo?.resolvidos ?? 0, filtro: "resolvido" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="fdl-ui-kicker text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          Manutenção
        </p>
        <h1 className="fdl-ui-title mt-1 text-3xl font-bold">Chamados</h1>
        <p className="mt-2 text-sm text-white/60">
          Solicitações de manutenção registradas pelos clientes nos seus projetos.
        </p>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-3 gap-3">
        {kpis.map((k) => {
          const ativo = filtro === k.filtro;
          return (
            <button
              key={k.filtro}
              type="button"
              onClick={() => setFiltro(ativo ? "" : k.filtro)}
              className={`rounded-3xl border p-5 text-left transition ${
                ativo
                  ? "border-[var(--fdl-cream)]/40 bg-[var(--fdl-cream)]/10"
                  : "border-white/10 bg-white/[0.06] hover:bg-white/[0.09]"
              }`}
            >
              <p className="text-sm font-semibold text-white/60">{k.label}</p>
              <strong className="mt-2 block text-3xl font-bold tabular-nums text-white">
                {k.valor}
              </strong>
            </button>
          );
        })}
      </section>

      {filtro ? (
        <button
          type="button"
          onClick={() => setFiltro("")}
          className="text-sm font-semibold text-[var(--fdl-cream)] underline"
        >
          Limpar filtro ({statusLabel(filtro)})
        </button>
      ) : null}

      {erro ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          {erro}
        </div>
      ) : null}

      {/* Lista */}
      {carregando ? (
        <div className="space-y-3" aria-busy="true">
          <div className="fdl-skeleton h-28 w-full" />
          <div className="fdl-skeleton h-28 w-full" />
          <div className="fdl-skeleton h-28 w-full" />
        </div>
      ) : chamados.length === 0 ? (
        <div className="fdl-empty-state">
          Nenhum chamado {filtro ? `com status "${statusLabel(filtro)}"` : ""} por
          aqui.
        </div>
      ) : (
        <div className="space-y-3">
          {chamados.map((c) => (
            <button
              key={c.chamado_id}
              type="button"
              onClick={() => abrirDetalhe(c.chamado_id)}
              className="block w-full rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.09]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[var(--fdl-cream)]">
                  {c.protocolo}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                    c.status
                  )}`}
                >
                  {statusLabel(c.status)}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${prioridadeClass(
                    c.prioridade
                  )}`}
                >
                  {c.prioridade === "urgente"
                    ? "🔴 Urgente"
                    : (c.prioridade ?? "média").replace(/^\w/, (m) => m.toUpperCase())}
                </span>
                {c.total_anexos > 0 ? (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                    📎 {c.total_anexos}
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-base font-semibold text-white">
                {c.titulo || CATEGORIA_LABEL[c.categoria ?? ""] || "Chamado"}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-white/60">{c.descricao}</p>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
                <span>{nomeProjeto(c)}</span>
                <span>· {formatDateTime(c.criado_em)}</span>
                {c.solicitante_nome ? <span>· {c.solicitante_nome}</span> : null}
                {c.atribuido_nome ? (
                  <span className="text-[var(--fdl-cream)]/80">
                    · Atribuído a {c.atribuido_nome}
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detalhe */}
      {detalhe ? (
        <DetalheModal
          detalhe={detalhe}
          montadores={montadores}
          salvando={salvando}
          obs={obs}
          setObs={setObs}
          onAtualizar={atualizar}
          onValidar={validar}
          onFechar={() => setDetalhe(null)}
        />
      ) : null}
    </div>
  );
}

function DetalheModal({
  detalhe,
  montadores,
  salvando,
  obs,
  setObs,
  onAtualizar,
  onValidar,
  onFechar,
}: {
  detalhe: Detalhe;
  montadores: Montador[];
  salvando: boolean;
  obs: string;
  setObs: (v: string) => void;
  onAtualizar: (campos: {
    status?: string;
    atribuido?: string | null;
    observacao?: string;
  }) => void;
  onValidar: () => void;
  onFechar: () => void;
}) {
  const c = detalhe.chamado;
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

  const temEquipe = detalhe.montadores.length > 0;
  const temResponsavel = Boolean(c.atribuido_usuario_id) || temEquipe;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={onFechar}
    >
      {lightbox ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(null);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Foto do chamado"
            className="max-h-[92vh] max-w-full rounded-xl object-contain"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            aria-label="Fechar imagem"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
          >
            ✕
          </button>
        </div>
      ) : null}
      <div
        className="fdl-content max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[var(--fdl-purple-dark)] p-6 text-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[var(--fdl-cream)]">
              {c.protocolo}
            </span>
            <h2 className="mt-3 text-2xl font-bold">
              {c.titulo || CATEGORIA_LABEL[c.categoria ?? ""] || "Chamado"}
            </h2>
            <p className="mt-1 text-sm text-white/60">
              {nomeProjeto(c)}
              {c.temporada ? ` · ${c.temporada}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(c.status)}`}>
            {statusLabel(c.status)}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${prioridadeClass(c.prioridade)}`}>
            Prioridade: {(c.prioridade ?? "média").replace(/^\w/, (m) => m.toUpperCase())}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
            {CATEGORIA_LABEL[c.categoria ?? ""] ?? c.categoria}
          </span>
          {c.status === "resolvido" && !c.validado_em ? (
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
              Aguardando validação
            </span>
          ) : null}
          {c.validado_em ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              Validado
            </span>
          ) : null}
        </div>

        {/* Dados */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Local / ponto" valor={c.local_ponto} />
          <Campo rotulo="Solicitante" valor={c.solicitante_nome} />
          <Campo rotulo="Contato" valor={c.solicitante_contato} />
          <Campo rotulo="Registrado em" valor={formatDateTime(c.criado_em)} />
        </div>

        {/* Montador responsável (automático pela equipe, ou atribuído) */}
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.22em] text-white/40">
              Montador responsável
            </p>
            <button
              type="button"
              onClick={() => setTrocando((v) => !v)}
              disabled={salvando}
              className="shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              {trocando
                ? "Cancelar"
                : temResponsavel
                  ? "Trocar montador"
                  : "Atribuir montador"}
            </button>
          </div>

          {c.atribuido_usuario_id ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--fdl-cream)]/20 px-3 py-1 text-xs font-semibold text-[var(--fdl-cream)]">
                {c.atribuido_nome}
              </span>
              <span className="text-xs text-white/45">atribuído</span>
            </div>
          ) : temEquipe ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {detalhe.montadores.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85"
                >
                  {m}
                </span>
              ))}
              <span className="text-xs text-white/45">equipe do projeto</span>
            </div>
          ) : (
            <p className="mt-1 text-sm font-semibold text-white/50">
              O sistema não encontrou montador no projeto.
            </p>
          )}

          {trocando ? (
            <select
              defaultValue={c.atribuido_usuario_id ?? ""}
              onChange={(e) => {
                onAtualizar({ atribuido: e.target.value || null });
                setTrocando(false);
              }}
              disabled={salvando}
              className="fdl-field mt-3"
            >
              <option value="" className="text-black">
                {temEquipe ? "— Usar equipe do projeto —" : "— Ninguém —"}
              </option>
              {montadores.map((m) => (
                <option key={m.usuario_id} value={m.usuario_id} className="text-black">
                  {m.nome}
                </option>
              ))}
            </select>
          ) : null}

          <p className="mt-2 text-xs text-white/40">
            {c.atribuido_usuario_id
              ? "Ao marcar “Em andamento”, o alerta vai apenas para o montador atribuído."
              : temEquipe
                ? "Ao marcar “Em andamento”, o alerta vai para os montadores do projeto."
                : "Atribua um montador para que ele receba o alerta ao entrar em andamento."}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-white/40">Descrição</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/85">
            {c.descricao}
          </p>
        </div>

        {/* Fotos — agrupadas por origem (cliente) e fase do montador */}
        {detalhe.anexos.length > 0 ? (
          <div className="mt-4 space-y-4">
            {(
              [
                ["Do cliente", detalhe.anexos.filter((a) => !a.fase)],
                [
                  "Antes (montador)",
                  detalhe.anexos.filter((a) => a.fase === "antes"),
                ],
                [
                  "Depois (montador)",
                  detalhe.anexos.filter((a) => a.fase === "depois"),
                ],
              ] as const
            ).map(([titulo, itens]) =>
              itens.length === 0 ? null : (
                <div key={titulo}>
                  <p className="mb-2 text-xs uppercase tracking-[0.22em] text-white/40">
                    {titulo} ({itens.length})
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {itens.map((a) => {
                      const ehFoto = a.tipo !== "video" && a.external_file_id;
                      if (ehFoto) {
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() =>
                              setLightbox(`/api/anexos/${a.external_file_id}`)
                            }
                            className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/anexos/${a.external_file_id}?thumb=1`}
                              alt={a.nome_arquivo || "Foto do chamado"}
                              loading="lazy"
                              className="h-24 w-full object-cover transition group-hover:opacity-90"
                            />
                          </button>
                        );
                      }
                      return a.url_visualizacao ? (
                        <a
                          key={a.id}
                          href={a.url_visualizacao}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-24 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-2xl hover:bg-white/10"
                        >
                          🎬
                        </a>
                      ) : null;
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        ) : null}

        {/* Validação da resolução */}
        {c.status === "resolvido" ? (
          c.validado_em ? (
            <div className="mt-4 rounded-2xl border border-green-400/30 bg-green-500/10 p-4 text-sm text-green-100">
              ✓ Resolução validada em {formatDateTime(c.validado_em)}. O cliente
              já consegue ver as fotos da resolução.
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4">
              <p className="text-sm font-semibold text-yellow-100">
                Resolução aguardando validação
              </p>
              <p className="mt-1 text-xs text-yellow-100/80">
                Revise as fotos de antes/depois. Ao validar, o cliente passa a
                ver o chamado como resolvido e as fotos-prova.
              </p>
              <button
                type="button"
                onClick={onValidar}
                disabled={salvando}
                className="mt-3 h-10 rounded-xl bg-green-500/90 px-5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
              >
                {salvando ? "Validando..." : "Validar resolução"}
              </button>
            </div>
          )
        ) : null}

        {/* Ações */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-semibold text-white">Atualizar chamado</p>

          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-semibold text-white/60">
              Status
            </label>
            <select
              value={c.status ?? "aberto"}
              onChange={(e) => onAtualizar({ status: e.target.value })}
              disabled={salvando}
              className="fdl-field"
            >
              {STATUS.map((s) => (
                <option key={s.valor} value={s.valor} className="text-black">
                  {s.rotulo}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-semibold text-white/60">
              Adicionar observação
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              placeholder="Anote uma tratativa, contato feito, previsão de resolução..."
              className="w-full rounded-2xl border border-white/10 bg-white/10 p-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)] focus:ring-4 focus:ring-[var(--fdl-cream)]/10"
            />
            <button
              type="button"
              onClick={() => onAtualizar({ observacao: obs })}
              disabled={salvando || obs.trim().length === 0}
              className="mt-2 h-10 rounded-2xl bg-[var(--fdl-cream)] px-5 text-sm font-semibold text-[var(--fdl-purple-dark)] disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar observação"}
            </button>
          </div>
        </div>

        {/* Histórico */}
        <div className="mt-6">
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-white/40">
            Histórico
          </p>
          <div className="space-y-3">
            {detalhe.eventos.map((e) => (
              <div
                key={e.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
              >
                <p className="text-sm text-white/80">
                  {e.tipo === "status"
                    ? `Status: ${statusLabel(e.de_status)} → ${statusLabel(e.para_status)}`
                    : e.descricao || e.tipo}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {formatDateTime(e.criado_em)}
                  {e.usuario_nome ? ` · ${e.usuario_nome}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs uppercase tracking-[0.22em] text-white/40">{rotulo}</p>
      <p className="mt-1 text-sm font-semibold text-white">{valor || "—"}</p>
    </div>
  );
}
