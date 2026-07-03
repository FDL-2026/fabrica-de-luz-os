"use client";

import { useEffect } from "react";

type FdlToastProps = {
  mensagem: string;
  onFechar: () => void;
};

export default function FdlToast({ mensagem, onFechar }: FdlToastProps) {
  useEffect(() => {
    if (!mensagem) return;

    const timer = setTimeout(onFechar, 4000);
    return () => clearTimeout(timer);
  }, [mensagem, onFechar]);

  if (!mensagem) return null;

  return (
    <div className="fdl-toast fdl-toast-sucesso" role="status">
      <span aria-hidden="true">✓</span>
      {mensagem}
      <button
        type="button"
        onClick={onFechar}
        aria-label="Fechar aviso"
        className="ml-1 font-black opacity-60 transition hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
