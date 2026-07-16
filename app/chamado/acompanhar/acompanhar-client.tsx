"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "@/components/brand-logo";

type Evento = {
  tipo: string;
  para_status: string | null;
  descricao: string | null;
  criado_em: string;
};

type Chamado = {
  protocolo: string;
  status: string;
  categoria: string | null;
  prioridade: string | null;
  titulo: string | null;
  shopping: string | null;
  criado_em: string;
  resolvido_em: string | null;
  linha_tempo: Evento[];
};

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  cancelado: "Cancelado",
};

function statusLabel(s: string | null) {
  return (s && STATUS_LABEL[s]) || s || "—";
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

function formatDateTime(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AcompanharClient() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();

  function voltar() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/chamado");
    }
  }

  const [protocolo, setProtocolo] = useState("");
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const consultar = useCallback(
    async (valor: string) => {
      const termo = valor.trim();
      if (!termo) {
        setErro("Informe o número do protocolo (ex.: CH-2026-0001).");
        return;
      }
      setCarregando(true);
      setErro("");
      setChamado(null);

      const { data, error } = await supabase.rpc("fdl_acompanhar_chamado", {
        p_protocolo: termo,
      });

      setCarregando(false);
      if (error) {
        setErro(error.message);
        return;
      }
      setChamado(data as Chamado);
    },
    [supabase]
  );

  // Auto-consulta quando chega da tela de sucesso com ?p=PROTOCOLO
  useEffect(() => {
    const p = searchParams.get("p");
    if (p) {
      setProtocolo(p);
      consultar(p);
    }
  }, [searchParams, consultar]);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={voltar}
        className="inline-flex items-center gap-1 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        ← Voltar
      </button>

      <div className="flex flex-col items-center text-center">
        <BrandLogo className="h-auto w-48 sm:w-56" />
        <p className="fdl-mobile-kicker mt-5">Manutenção</p>
        <h1 className="fdl-mobile-title">Acompanhar chamado</h1>
        <p className="fdl-mobile-description mt-1">
          Digite o protocolo que você recebeu ao abrir o chamado.
        </p>
      </div>

      <section className="fdl-mobile-card space-y-3">
        <label className="block text-sm font-semibold text-white">Protocolo</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={protocolo}
            onChange={(e) => setProtocolo(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && consultar(protocolo)}
            placeholder="CH-2026-0001"
            className="fdl-field flex-1"
          />
          <button
            type="button"
            onClick={() => consultar(protocolo)}
            disabled={carregando}
            className="h-12 shrink-0 rounded-2xl bg-[var(--fdl-cream)] px-5 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:opacity-50"
          >
            {carregando ? "..." : "Consultar"}
          </button>
        </div>

        {erro ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
            {erro}
          </div>
        ) : null}
      </section>

      {chamado ? (
        <section className="fdl-mobile-card space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--fdl-cream)]">
                {chamado.protocolo}
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">
                {chamado.titulo || "Chamado de manutenção"}
              </h2>
              <p className="mt-1 text-sm text-white/55">{chamado.shopping}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                chamado.status
              )}`}
            >
              {statusLabel(chamado.status)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                Aberto em
              </p>
              <p className="mt-1 font-semibold text-white">
                {formatDateTime(chamado.criado_em)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                {chamado.status === "resolvido" ? "Resolvido em" : "Situação"}
              </p>
              <p className="mt-1 font-semibold text-white">
                {chamado.resolvido_em
                  ? formatDateTime(chamado.resolvido_em)
                  : "Em acompanhamento"}
              </p>
            </div>
          </div>

          {chamado.linha_tempo.length > 0 ? (
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/40">
                Andamento
              </p>
              <ol className="space-y-3">
                {chamado.linha_tempo.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--fdl-cream)]" />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {e.tipo === "criado"
                          ? "Chamado registrado"
                          : `Status: ${statusLabel(e.para_status)}`}
                      </p>
                      <p className="text-xs text-white/45">
                        {formatDateTime(e.criado_em)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}

      {!chamado ? (
        <div className="text-center">
          <a
            href="/chamado"
            className="text-sm font-semibold text-[var(--fdl-cream)] underline"
          >
            Abrir um novo chamado
          </a>
        </div>
      ) : null}
    </div>
  );
}
