/*
 * Ocorrências da temporada — tipos que o montador lança no registro da OS
 * (dias sem atividade / imprevistos) e que alimentam o relatório de
 * fechamento. Compartilhado entre montador, gestão e relatório.
 */

export type TipoOcorrencia = {
  valor: string;
  rotulo: string;
};

export const TIPOS_OCORRENCIA: TipoOcorrencia[] = [
  { valor: "ocorr_chuva", rotulo: "Chuva" },
  { valor: "ocorr_logistica", rotulo: "Logística" },
  { valor: "ocorr_acesso", rotulo: "Acesso negado" },
  { valor: "ocorr_material", rotulo: "Falta de material" },
  { valor: "ocorr_retrabalho", rotulo: "Retrabalho" },
  { valor: "ocorr_erro_projeto", rotulo: "Erro de projeto" },
  { valor: "ocorr_evento", rotulo: "Evento do shopping" },
  { valor: "ocorr_outro", rotulo: "Outro motivo" },
];

// "ocorr_chuva" -> "Ocorrência — Chuva"
export const ROTULO_OCORRENCIA: Record<string, string> = Object.fromEntries(
  TIPOS_OCORRENCIA.map((t) => [t.valor, `Ocorrência — ${t.rotulo}`])
);

// Rótulo curto (só o motivo), útil em tabelas/relatório
export const MOTIVO_OCORRENCIA: Record<string, string> = Object.fromEntries(
  TIPOS_OCORRENCIA.map((t) => [t.valor, t.rotulo])
);

export function ehOcorrencia(tipo: string | null | undefined): boolean {
  return typeof tipo === "string" && tipo.startsWith("ocorr_");
}
