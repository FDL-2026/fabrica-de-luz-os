"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ExcluirProjetoClientProps = {
  projetoId: string;
  projetoNome: string;
};

export default function ExcluirProjetoClient({
  projetoId,
  projetoNome,
}: ExcluirProjetoClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  const nomeAlvo = (projetoNome || "").trim();
  const podeExcluir =
    confirmacao.trim().toLowerCase() === nomeAlvo.toLowerCase() &&
    nomeAlvo.length > 0;

  function abrir() {
    setConfirmacao("");
    setErro("");
    setAberto(true);
  }

  function fechar() {
    if (excluindo) return;
    setAberto(false);
  }

  async function excluir() {
    if (!podeExcluir || excluindo) return;

    setExcluindo(true);
    setErro("");

    const { error } = await supabase.rpc("fdl_excluir_projeto", {
      p_projeto_id: projetoId,
    });

    if (error) {
      setErro(error.message);
      setExcluindo(false);
      return;
    }

    // Projeto removido — volta para a listagem
    window.location.href = "/projetos";
  }

  return (
    <section className="mt-6 rounded-3xl border border-red-500/30 bg-red-500/[0.06] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-200">
            Zona administrativa
          </p>
          <h2 className="mt-2 text-lg font-bold text-white">Excluir projeto</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/60">
            Remove definitivamente este projeto e todos os dados vinculados
            (OSs, noites, registros, anexos e equipe). Esta ação não pode ser
            desfeita.
          </p>
        </div>

        <button
          type="button"
          onClick={abrir}
          className="h-11 shrink-0 rounded-2xl border border-red-400/40 bg-red-500/15 px-5 text-sm font-semibold text-red-100 transition hover:bg-red-500/25"
        >
          Excluir projeto
        </button>
      </div>

      {aberto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={fechar}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/15 bg-[var(--fdl-purple-deep)] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-200">
              Confirmar exclusão
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              Excluir “{projetoNome}”?
            </h3>

            <p className="mt-3 text-sm text-white/70">
              Isso apaga o projeto e <strong>todos</strong> os dados vinculados,
              de forma permanente. Para confirmar, digite o nome do projeto
              abaixo.
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-white/50">
              Nome do projeto
            </label>
            <input
              type="text"
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              placeholder={projetoNome}
              autoFocus
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-red-400/60 focus:ring-4 focus:ring-red-500/10"
            />

            {erro ? (
              <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                {erro}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={fechar}
                disabled={excluindo}
                className="h-11 flex-1 rounded-2xl border border-white/15 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={excluir}
                disabled={!podeExcluir || excluindo}
                className="h-11 flex-1 rounded-2xl bg-red-500 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {excluindo ? "Excluindo..." : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
