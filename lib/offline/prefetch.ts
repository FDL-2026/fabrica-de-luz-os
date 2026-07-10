/*
 * Prefetch de telas do montador para uso offline.
 *
 * Enquanto o montador tem conexão, buscamos em segundo plano os shells das
 * telas que ele provavelmente vai abrir (páginas de projeto e de cada OS
 * listada). O service worker intercepta essas requisições de documento HTML e
 * guarda o shell no cache de páginas — assim, offline, essas telas abrem mesmo
 * que o montador ainda não as tenha aberto uma a uma.
 *
 * É best-effort: qualquer falha é ignorada. Só busca quando online e evita
 * repetir a mesma URL na sessão.
 */

const jaBuscadas = new Set<string>();

// Teto de segurança para não disparar centenas de requisições de uma vez.
const LIMITE_POR_CHAMADA = 60;

export function prefetchTelasMontador(caminhos: string[]): void {
  if (typeof window === "undefined") return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (!("serviceWorker" in navigator)) return;

  const alvos = caminhos
    .filter((c) => typeof c === "string" && c.startsWith("/montador"))
    .filter((c) => !jaBuscadas.has(c))
    .slice(0, LIMITE_POR_CHAMADA);

  for (const caminho of alvos) {
    jaBuscadas.add(caminho);
    // Accept text/html sinaliza ao SW que é um documento a ser cacheado.
    fetch(caminho, {
      headers: { Accept: "text/html" },
      credentials: "same-origin",
    }).catch(() => {
      // se falhar, libera para tentar de novo depois
      jaBuscadas.delete(caminho);
    });
  }
}
