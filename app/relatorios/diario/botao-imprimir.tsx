"use client";

export default function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="fdl-ui-btn fdl-ui-btn-primary"
    >
      Baixar PDF
    </button>
  );
}
