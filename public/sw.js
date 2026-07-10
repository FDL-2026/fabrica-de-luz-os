/*
 * Fábrica de Luz — Service Worker (manual, sem bundler)
 * Estratégia conservadora e segura para app autenticado:
 *  - Só intercepta GET do MESMO domínio. Supabase, Google Drive e qualquer
 *    origem externa passam direto pela rede (nunca são cacheados aqui).
 *  - Navegações (páginas): network-first -> se offline, mostra a tela offline.
 *    (Não cacheamos HTML autenticado para não vazar dados entre sessões.)
 *  - Estáticos do build (/_next/static, ícones, marca): cache-first.
 */

const VERSION = "fdl-v5";
const STATIC_CACHE = `${VERSION}-static`;
// Páginas do montador (shells sem dados sensíveis — os dados vêm de RPC no
// cliente). Cacheadas para permitir navegar offline entre as telas de campo.
const PAGE_CACHE = `${VERSION}-montador-pages`;

// Estáticos úteis para pré-carregar. NÃO inclui a tela offline: o fallback
// abaixo é totalmente autossuficiente (HTML embutido), então nunca depende de
// precache nem de rede para funcionar.
const PRECACHE = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/brand/H_TAGLINE_SF_ROXO.png",
];

// Tela offline embutida no próprio SW. Independe de cache/rede — se a
// navegação falhar por falta de conexão, isto SEMPRE renderiza.
const OFFLINE_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Sem conexão · Fábrica de Luz</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 24px; padding: 32px;
    text-align: center; background: #16051f;
    color: #fff; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  img { width: 100%; max-width: 220px; height: auto; opacity: .9; }
  .kicker {
    margin: 0; font-size: 12px; font-weight: 600; letter-spacing: .18em;
    text-transform: uppercase; color: #f4e6c9;
  }
  h1 { margin: 8px 0 0; font-size: 24px; font-weight: 700; }
  p { margin: 12px 0 0; max-width: 22rem; font-size: 14px; line-height: 1.6; color: rgba(255,255,255,.6); }
  button {
    margin-top: 4px; height: 44px; padding: 0 24px; border: 0;
    border-radius: 16px; background: #f4e6c9; color: #2b123a;
    font-size: 14px; font-weight: 600; cursor: pointer;
  }
</style>
</head>
<body>
  <img src="/brand/H_TAGLINE_SF_ROXO.png" alt="Fábrica de Luz" />
  <div>
    <p class="kicker">Sem conexão</p>
    <h1>Você está offline</h1>
    <p>Não foi possível carregar esta tela. Verifique sua internet e tente novamente — o app volta assim que a conexão retornar.</p>
  </div>
  <button type="button" onclick="location.reload()">Tentar novamente</button>
</body>
</html>`;

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// Grava cada item individualmente: se um falhar, os demais entram assim mesmo,
// e a instalação NUNCA quebra. Reconstrói a Response para remover a flag
// "redirected" (a Cache API rejeita respostas redirecionadas).
async function precacheResiliente() {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(
    PRECACHE.map(async (url) => {
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) return;
        const body = await res.blob();
        await cache.put(
          url,
          new Response(body, {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
          })
        );
      } catch {
        // ignora item que falhar
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // O precache é best-effort e não pode impedir a ativação do SW.
      try {
        await precacheResiliente();
      } catch {
        // nunca falha o install
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// Permite atualizar o SW sem esperar (usado pelo botão de update, se houver)
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Guarda a resposta reconstruída (sem flag "redirected") no cache de páginas.
// Best-effort: falhas são ignoradas e não afetam a resposta ao usuário.
async function guardarPagina(chave, resposta) {
  try {
    const body = await resposta.blob();
    const cache = await caches.open(PAGE_CACHE);
    await cache.put(
      chave,
      new Response(body, {
        status: resposta.status,
        statusText: resposta.statusText,
        headers: resposta.headers,
      })
    );
  } catch {
    // ignora
  }
}

function ehRotaMontador(url) {
  return url.pathname === "/montador" || url.pathname.startsWith("/montador/");
}

// Estratégia de página do montador: network-first com fallback ao shell
// cacheado. Serve tanto navegações reais quanto documentos pré-buscados
// (prefetch) — em ambos, cacheamos o shell por URL exata (sem query).
function respostaPaginaMontador(request, url) {
  const chave = new Request(url.origin + url.pathname);
  return (async () => {
    try {
      const resposta = await fetch(request);
      if (resposta.ok) {
        // não bloqueia a resposta ao usuário
        guardarPagina(chave, resposta.clone());
      }
      return resposta;
    } catch {
      const cache = await caches.open(PAGE_CACHE);
      const cacheada = await cache.match(chave);
      return cacheada || offlineResponse();
    }
  })();
}

// Requisição de documento HTML feita por JS (prefetch), não uma navegação.
function ehPrefetchDocumento(request) {
  if (request.mode === "navigate") return false;
  if (request.destination === "document") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Só lidamos com o próprio domínio. Externo (Supabase/Drive) vai direto à rede.
  if (url.origin !== self.location.origin) return;

  // Páginas do montador (navegação real OU prefetch em segundo plano):
  // network-first, cacheia o shell e, offline, serve o shell cacheado
  // (a tela carrega os dados do IndexedDB). Sem cache -> tela offline.
  if (
    ehRotaMontador(url) &&
    (request.mode === "navigate" || ehPrefetchDocumento(request))
  ) {
    event.respondWith(respostaPaginaMontador(request, url));
    return;
  }

  // Demais páginas: network-first, fallback offline embutido.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          return offlineResponse();
        }
      })()
    );
    return;
  }

  // Estáticos: cache-first, com atualização em segundo plano.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return cached || Response.error();
        }
      })()
    );
  }
});
