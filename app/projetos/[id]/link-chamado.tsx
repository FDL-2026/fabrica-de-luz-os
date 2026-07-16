"use client";

import { useEffect, useState } from "react";

export default function LinkChamado({ token }: { token: string }) {
  const [origin, setOrigin] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}/chamado/${token}` : `/chamado/${token}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[var(--fdl-cream)]/25 bg-white/[0.05] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            Link de chamado do shopping
          </p>
          <p className="mt-1 text-xs text-white/55">
            Envie ao cliente. Ao abrir, o chamado já vem com este shopping
            selecionado.
          </p>
        </div>
        <span aria-hidden="true" className="text-lg">🔗</span>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none"
        />
        <button
          type="button"
          onClick={copiar}
          className="shrink-0 rounded-2xl bg-[var(--fdl-cream)] px-5 py-3 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
        >
          {copiado ? "Copiado ✓" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}
