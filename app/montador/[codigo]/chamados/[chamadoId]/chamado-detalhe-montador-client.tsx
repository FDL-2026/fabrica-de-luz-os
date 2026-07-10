"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Anexo = {
  id: string;
  tipo: string | null;
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

function formatDateTime(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

type Props = { codigo: string; chamadoId: string };

export default function ChamadoDetalheMontadorClient({ codigo, chamadoId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [usuarioId, setUsuarioId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

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
  const fotos = detalhe.anexos.filter(
    (a) => a.tipo !== "video" && a.external_file_id
  );

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
        {fotos.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {fotos.map((a) => (
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
    </div>
  );
}
