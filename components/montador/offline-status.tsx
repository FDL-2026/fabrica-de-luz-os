"use client";

/*
 * Barra de status offline do montador.
 *  - Mostra aviso quando sem conexão.
 *  - Mostra quantas ações estão na fila e um botão "Sincronizar agora".
 *  - Dispara a sincronização automática (online / foco da aba).
 * Fica fixa no rodapé, acima da área segura do aparelho.
 */

import { useState } from "react";
import { useOnline, usePendentes, useSyncMontador } from "@/lib/offline/online";

export default function OfflineStatus() {
  const online = useOnline();
  const pendentes = usePendentes();
  const { sincronizar, sincronizando } = useSyncMontador();
  const [aviso, setAviso] = useState("");

  // Nada a mostrar: online e sem pendências.
  if (online && pendentes === 0) return null;

  async function aoSincronizar() {
    setAviso("");
    const resultado = await sincronizar();
    if (!resultado) return;
    if (resultado.restantes === 0 && resultado.processados > 0) {
      setAviso(
        resultado.processados === 1
          ? "1 ação sincronizada."
          : `${resultado.processados} ações sincronizadas.`
      );
      setTimeout(() => setAviso(""), 4000);
    } else if (resultado.falhas > 0) {
      setAviso("Algumas ações ainda não subiram. Tentaremos de novo.");
      setTimeout(() => setAviso(""), 5000);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 print:hidden">
      <div
        className={`mx-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${
          online
            ? "border-[var(--fdl-cream)]/25 bg-[#2b123a]/95 text-white"
            : "border-yellow-400/30 bg-[#3a2a12]/95 text-yellow-50"
        }`}
      >
        <span className="text-lg leading-none" aria-hidden="true">
          {online ? "☁️" : "📴"}
        </span>

        <div className="min-w-0 flex-1">
          {!online ? (
            <p className="text-sm font-semibold">Você está offline</p>
          ) : (
            <p className="text-sm font-semibold">
              {sincronizando ? "Sincronizando…" : "Ações aguardando envio"}
            </p>
          )}

          <p className="mt-0.5 text-xs leading-4 opacity-80">
            {aviso
              ? aviso
              : pendentes > 0
                ? `${pendentes} ação(ões) salva(s) no aparelho${
                    online ? "" : " — sobem quando a conexão voltar"
                  }.`
                : "Suas ações são salvas e enviadas automaticamente."}
          </p>
        </div>

        {online && pendentes > 0 ? (
          <button
            type="button"
            onClick={aoSincronizar}
            disabled={sincronizando}
            className="h-9 shrink-0 rounded-full bg-[var(--fdl-cream)] px-4 text-xs font-bold text-[var(--fdl-purple-dark)] disabled:opacity-50"
          >
            {sincronizando ? "Enviando…" : "Sincronizar"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
