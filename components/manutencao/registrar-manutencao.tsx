"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { carimbarFoto } from "@/lib/foto/geo-carimbo";

type Etapa = { id: string; nome: string };

type RegistrarManutencaoProps = {
  projetoId: string;
  // Mundos (projeto-chave) — quando presente, mostra o seletor de mundo.
  etapas?: Etapa[];
  // Montador (login por PIN). Ausente = gestão (sessão autenticada).
  usuarioId?: string;
  onCriada?: () => void;
};

export default function RegistrarManutencao({
  projetoId,
  etapas,
  usuarioId,
  onCriada,
}: RegistrarManutencaoProps) {
  const supabase = useMemo(() => createClient(), []);

  const [aberto, setAberto] = useState(false);
  const [etapaId, setEtapaId] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [antes, setAntes] = useState<File[]>([]);
  const [depois, setDepois] = useState<File[]>([]);
  const [carimbando, setCarimbando] = useState<"antes" | "depois" | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  async function adicionarFoto(fase: "antes" | "depois", file: File | null) {
    if (!file) return;
    setErro("");
    setCarimbando(fase);
    try {
      const carimbada = await carimbarFoto(file);
      if (fase === "antes") setAntes((l) => [...l, carimbada]);
      else setDepois((l) => [...l, carimbada]);
    } finally {
      setCarimbando(null);
    }
  }

  function limpar() {
    setEtapaId("");
    setLocal("");
    setDescricao("");
    setAntes([]);
    setDepois([]);
  }

  async function salvar() {
    setErro("");
    if (descricao.trim().length < 3) {
      setErro("Descreva o que foi feito no reparo.");
      return;
    }
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc("fdl_registrar_manutencao", {
        p_projeto_id: projetoId,
        p_etapa_id: etapaId || null,
        p_local: local || null,
        p_descricao: descricao,
        p_usuario_id: usuarioId || null,
      });
      if (error) throw new Error(error.message);

      const row = Array.isArray(data) ? data[0] : data;
      const manutencaoId = (row as { manutencao_id?: string } | null)
        ?.manutencao_id;
      if (!manutencaoId) throw new Error("Não foi possível registrar.");

      const grupos: Array<["antes" | "depois", File[]]> = [
        ["antes", antes],
        ["depois", depois],
      ];
      for (const [fase, lista] of grupos) {
        for (const file of lista) {
          const form = new FormData();
          if (usuarioId) form.append("usuarioId", usuarioId);
          form.append("manutencaoId", manutencaoId);
          form.append("fase", fase);
          form.append("file", file);
          const r = await fetch("/api/manutencao/anexos/upload", {
            method: "POST",
            body: form,
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j?.error ?? "Falha ao enviar uma foto.");
          }
        }
      }

      limpar();
      setAberto(false);
      setSucesso(true);
      onCriada?.();
      setTimeout(() => setSucesso(false), 5000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              Manutenção realizada
            </p>
            <p className="mt-0.5 text-xs text-white/55">
              Registre um reparo feito no local — vira histórico visível ao
              cliente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-primary shrink-0"
          >
            Registrar manutenção
          </button>
        </div>
        {sucesso ? (
          <p className="mt-3 text-xs font-semibold text-green-300">
            Manutenção registrada com sucesso.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--fdl-cream)]/25 bg-white/[0.05] p-5">
      <h3 className="text-base font-semibold text-white">
        Registrar manutenção
      </h3>

      {erro ? (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {erro}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {etapas && etapas.length > 0 ? (
          <div>
            <label className="fdl-ui-label">Mundo</label>
            <select
              className="fdl-select mt-1.5 w-full"
              value={etapaId}
              onChange={(e) => setEtapaId(e.target.value)}
            >
              <option value="">Não vincular a um mundo</option>
              {etapas.map((etapa) => (
                <option key={etapa.id} value={etapa.id}>
                  {etapa.nome}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="fdl-ui-label">Local / ponto</label>
          <input
            className="fdl-field mt-1.5 w-full"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Onde foi o reparo (ex.: fachada, entrada…)"
          />
        </div>

        <div>
          <label className="fdl-ui-label">O que foi feito *</label>
          <textarea
            className="fdl-field mt-1.5 w-full"
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva o reparo realizado…"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["antes", "Fotos ANTES", antes],
              ["depois", "Fotos DEPOIS", depois],
            ] as const
          ).map(([fase, titulo, lista]) => (
            <div
              key={fase}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">{titulo}</p>
                <span className="text-xs text-white/40">
                  {lista.length} foto(s)
                </span>
              </div>
              <label
                className={`fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-ghost mt-2 w-full ${
                  carimbando === fase ? "opacity-60" : "cursor-pointer"
                }`}
              >
                {carimbando === fase ? "Processando…" : "Tirar foto"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={carimbando === fase}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    adicionarFoto(fase, f);
                  }}
                />
              </label>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="fdl-ui-btn fdl-ui-btn-primary flex-1"
          >
            {salvando ? "Salvando…" : "Salvar manutenção"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAberto(false);
              setErro("");
            }}
            disabled={salvando}
            className="fdl-ui-btn fdl-ui-btn-ghost"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
