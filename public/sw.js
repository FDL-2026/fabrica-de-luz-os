/*
 * Fábrica de Luz — Service Worker (manual, sem bundler)
 * Estratégia conservadora e segura para app autenticado:
 *  - Só intercepta GET do MESMO domínio. Supabase, Google Drive e qualquer
 *    origem externa passam direto pela rede (nunca são cacheados aqui).
 *  - Navegações (páginas): network-first -> se offline, mostra /offline.
 *    (Não cacheamos HTML autenticado para não vazar dados entre sessões.)
 *  - Estáticos do build (/_next/static, ícones, marca): cache-first.
 */

const VERSION = "fdl-v2";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/brand/H_TAGLINE_SF_ROXO.png",
];

// Grava cada item individualmente: se um falhar, os demais entram assim mesmo,
// e a instalação nunca quebra. Reconstrói a Response para remover a flag
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
      await precacheResiliente();
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

  // Páginas: network-first, fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ||
            new Response("Offline", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
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
