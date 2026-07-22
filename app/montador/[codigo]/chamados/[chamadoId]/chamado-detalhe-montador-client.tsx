"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { carimbarFoto } from "@/lib/foto/geo-carimbo";

type Anexo = {
  id: string;
  tipo: string | null;
  fase?: string | null;
  nome_arquivo: string | null;
  external_file_id: string | null;
  criado_em: string;
};

type Chamado = {
  chamado_id: string;
  protocolo: string;
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
  categoria: string | null;
  prioridade: string | null;
  local_ponto: string | null;
  titulo: string | null;
  descricao: string | null;
  status: string | null;
  validado_em: string | null;
  solicitante_nome: string | null;
  solicitante_contato: string | null;
  criado_em: string | null;
};

type Detalhe = { chamado: Chamado; anexos: Anexo[] };

const CATEGORIA_LABEL: Record<string, string> = {
  manutencao: "Manutenção",
  eletrica: "Elétrica",
  iluminacao: "Iluminação",
  estrutura: "Estrutura",
  troca_peca: "Troca de peça",
  limpeza: "Limpeza",
  outro: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  cancelado: "Cancelado",
};

function prioridadeLabel(p: string | null) {
  if (p === "urgente") return "🔴 Urgente";
  if (p === "alta") return "🟠 Alta";
  if (p === "media") return "Média";
  return "Baixa";
}

type Props = { codigo: string; chamadoId: string };

export default function ChamadoDetalheMontadorClient({ codigo, chamadoId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [usuarioId, setUsuarioId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const [observacao, setObservacao] = useState("");
  const [enviandoFase, setEnviandoFase] = useState<"antes" | "depois" | null>(
    null
  );
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    async function iniciar() {
      setCarregando(true);
      setErro("");

      const storage = localStorage.getItem("fdl_montador");
      if (!storage) {
        setErro("Acesso expirado. Volte e informe o PIN novamente.");
        setCarregando(false);
        return;
      }

      let dados;
      try {
        dados = JSON.parse(storage);
      } catch {
        setErro("Acesso inválido. Volte e informe o PIN novamente.");
        setCarregando(false);
        return;
      }

      if (dados?.codigo?.toUpperCase() !== codigo.toUpperCase()) {
        setErro("Código de montador divergente. Informe o PIN novamente.");
        setCarregando(false);
        return;
      }

      setUsuarioId(dados.usuarioId);

      const { data, error } = await supabase.rpc("fdl_obter_chamado_montador", {
        p_usuario_id: dados.usuarioId,
        p_chamado_id: chamadoId,
      });

      if (error) {
        setErro(error.message);
        setCarregando(false);
        return;
      }

      setDetalhe(data as Detalhe);
      setCarregando(false);
    }

    iniciar();
  }, [supabase, codigo, chamadoId]);

  function urlAnexo(fileId: string, thumb = false) {
    const params = new URLSearchParams({ usuarioId, fileId });
    if (thumb) params.set("thumb", "1");
    return `/api/montador/chamado/anexo?${params.toString()}`;
  }

  async function recarregar() {
    if (!usuarioId) return;
    const { data, error } = await supabase.rpc("fdl_obter_chamado_montador", {
      p_usuario_id: usuarioId,
      p_chamado_id: chamadoId,
    });
    if (!error && data) setDetalhe(data as Detalhe);
  }

  async function enviarFoto(fase: "antes" | "depois", file: File | null) {
    if (!file || !usuarioId) return;

    setAviso("");
    setEnviandoFase(fase);

    try {
      // Carimba data/hora, coordenadas e endereço na imagem antes de subir.
      const carimbada = await carimbarFoto(file);

      const form = new FormData();
      form.append("usuarioId", usuarioId);
      form.append("chamadoId", chamadoId);
      form.append("fase", fase);
      form.append("file", carimbada);

      const resp = await fetch("/api/montador/chamado/anexos/upload", {
        method: "POST",
        body: form,
      });
      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json?.error ?? "Falha ao enviar a foto.");
      }

      await recarregar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Falha ao enviar a foto.");
    } finally {
      setEnviandoFase(null);
    }
  }

  async function atualizarChamado(novoStatus?: "em_andamento" | "resolvido") {
    if (!usuarioId) return;

    setAviso("");
    setSalvando(true);

    try {
      const { data, error } = await supabase.rpc(
        "fdl_atualizar_chamado_montador",
        {
          p_usuario_id: usuarioId,
          p_chamado_id: chamadoId,
          p_status: novoStatus ?? null,
          p_observacao: observacao.trim() || null,
        }
      );

      if (error) throw new Error(error.message);
      if (data) setDetalhe(data as Detalhe);
      setObservacao("");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="fdl-skeleton h-40 w-full" />
        <div className="fdl-skeleton h-56 w-full" />
      </div>
    );
  }

  if (erro || !detalhe) {
    return (
      <div className="space-y-5">
        <div className="fdl-alert fdl-alert-error">
          {erro || "Chamado não encontrado."}
        </div>
        <a
          href={`/montador/${codigo}`}
          className="block h-12 rounded-2xl bg-[var(--fdl-cream)] px-5 py-3 text-center text-sm font-semibold text-[var(--fdl-purple-dark)]"
        >
          Voltar
        </a>
      </div>
    );
  }

  const c = detalhe.chamado;
  const anexosFoto = detalhe.anexos.filter(
    (a) => a.tipo !== "video" && a.external_file_id
  );
  const fotosCliente = anexosFoto.filter((a) => !a.fase);
  const fotosAntes = anexosFoto.filter((a) => a.fase === "antes");
  const fotosDepois = anexosFoto.filter((a) => a.fase === "depois");
  const resolvido = c.status === "resolvido";
  const podeResolver = fotosAntes.length >= 1 && fotosDepois.length >= 1;

  return (
    <div className="space-y-6">
      {lightbox ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Foto do chamado"
            className="max-h-[92vh] max-w-full rounded-xl object-contain"
          />
          <button
            type="button"
            aria-label="Fechar imagem"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
          >
            ✕
          </button>
        </div>
      ) : null}

      <header className="fdl-form-card p-6">
        <a
          href={`/montador/${codigo}/projetos/${c.projeto_id}`}
          className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
        >
          ← Voltar para o projeto
        </a>

        <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          Chamado de manutenção
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          {c.titulo || CATEGORIA_LABEL[c.categoria ?? ""] || "Chamado"}
        </h1>

        <p className="mt-2 text-sm text-white/60">
          {c.shopping || c.cliente}
          {c.uf ? ` · ${c.uf}` : ""}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[var(--fdl-cream)]">
            {c.protocolo}
          </span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {STATUS_LABEL[c.status ?? ""] ?? c.status}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
            {prioridadeLabel(c.prioridade)}
          </span>
        </div>
      </header>

      <section className="fdl-form-card p-6">
        <h2 className="fdl-section-title">O que precisa ser feito</h2>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-white/40">
            Descrição do cliente
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/85">
            {c.descricao}
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/40">
              Local / ponto
            </p>
            <p className="mt-1 font-semibold text-white">
              {c.local_ponto || "Não informado"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/40">
              Categoria
            </p>
            <p className="mt-1 font-semibold text-white">
              {CATEGORIA_LABEL[c.categoria ?? ""] ?? c.categoria}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/40">
              Solicitante
            </p>
            <p className="mt-1 font-semibold text-white">
              {c.solicitante_nome || "Não informado"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/40">
              Contato
            </p>
            <p className="mt-1 font-semibold text-white">
              {c.solicitante_contato || "Não informado"}
            </p>
          </div>
        </div>
      </section>

      <section className="fdl-form-card p-6">
        <h2 className="fdl-section-title">Fotos do problema</h2>
        {fotosCliente.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {fotosCliente.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setLightbox(urlAnexo(a.external_file_id as string))}
                className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlAnexo(a.external_file_id as string, true)}
                  alt={a.nome_arquivo || "Foto do chamado"}
                  loading="lazy"
                  className="h-24 w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/50">
            O cliente não anexou fotos neste chamado.
          </p>
        )}
      </section>

      <section className="fdl-form-card p-6">
        <h2 className="fdl-section-title">Registrar atendimento</h2>
        <p className="mt-1 text-sm text-white/55">
          Anexe fotos de antes e depois. Cada foto tirada aqui recebe data,
          hora, coordenadas e endereço gravados na imagem.
        </p>

        {aviso ? (
          <div className="fdl-alert fdl-alert-error mt-4">{aviso}</div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-white/60">
            Status atual:{" "}
            <strong className="text-white">
              {STATUS_LABEL[c.status ?? ""] ?? c.status}
            </strong>
          </span>
          {!resolvido ? (
            <div className="flex flex-wrap gap-2">
              {c.status !== "em_andamento" ? (
                <button
                  type="button"
                  onClick={() => atualizarChamado("em_andamento")}
                  disabled={salvando}
                  className="h-9 rounded-xl border border-white/15 px-4 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                >
                  Marcar em andamento
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => atualizarChamado("resolvido")}
                disabled={salvando || !podeResolver}
                title={
                  podeResolver
                    ? undefined
                    : "Anexe 1 foto de antes e 1 de depois para resolver."
                }
                className="h-9 rounded-xl bg-green-500/90 px-4 text-xs font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Resolver chamado"}
              </button>
            </div>
          ) : c.validado_em ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              Resolvido e validado
            </span>
          ) : (
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
              Resolvido — aguardando validação da gestão
            </span>
          )}
        </div>

        {!resolvido && !podeResolver ? (
          <p className="mt-2 text-xs text-yellow-200/80">
            Para resolver, anexe pelo menos 1 foto de <strong>antes</strong> e 1
            de <strong>depois</strong>.
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["antes", "Fotos ANTES do atendimento", fotosAntes],
              ["depois", "Fotos DEPOIS do atendimento", fotosDepois],
            ] as const
          ).map(([fase, titulo, lista]) => {
            const enviando = enviandoFase === fase;
            return (
              <div
                key={fase}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{titulo}</p>
                  <span className="text-xs text-white/40">
                    {lista.length} foto(s)
                  </span>
                </div>

                <label
                  className={`mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] ${
                    enviando || resolvido
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer hover:brightness-95"
                  }`}
                >
                  {enviando ? "Enviando..." : "Tirar foto"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={enviando || resolvido}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      enviarFoto(fase, f);
                    }}
                  />
                </label>

                <label
                  className={`mt-2 flex h-9 items-center justify-center gap-2 rounded-xl border border-white/15 text-xs font-semibold text-white/70 ${
                    enviando || resolvido
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer hover:bg-white/10"
                  }`}
                >
                  Escolher da galeria
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={enviando || resolvido}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      enviarFoto(fase, f);
                    }}
                  />
                </label>

                {lista.length > 0 ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {lista.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          setLightbox(urlAnexo(a.external_file_id as string))
                        }
                        className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.06]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={urlAnexo(a.external_file_id as string, true)}
                          alt={titulo}
                          loading="lazy"
                          className="h-20 w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <label className="fdl-ui-label">Observação do montador</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            placeholder="O que foi encontrado / o que foi feito no atendimento…"
            className="fdl-field mt-2 w-full"
          />
          <button
            type="button"
            onClick={() => atualizarChamado()}
            disabled={salvando || observacao.trim().length === 0}
            className="mt-3 h-10 rounded-xl bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar observação"}
          </button>
        </div>
      </section>
    </div>
  );
}
