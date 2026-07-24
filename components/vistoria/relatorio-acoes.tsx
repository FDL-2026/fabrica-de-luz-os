"use client";

export default function RelatorioAcoes({ wordHref }: { wordHref: string }) {
  return (
    <div className="no-print flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-primary"
      >
        Imprimir / Salvar PDF
      </button>
      <a href={wordHref} className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-secondary">
        Baixar Word
      </a>
    </div>
  );
}
