"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "fdl_pwa_dismiss";

// O convite de instalação só faz sentido para quem usa o app instalado:
// o login da gestão e a área do montador. Não aparece no formulário público
// de chamado nem nas telas internas de navegação.
function podeMostrarEm(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/montador")
  );
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [mostrarIos, setMostrarIos] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (isStandalone()) return;

    // Não reexibir se o usuário dispensou há menos de ~2 semanas
    const dispensadoEm = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dispensadoEm < 14 * 24 * 60 * 60 * 1000) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisivel(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS não dispara beforeinstallprompt — mostra instruções manuais
    if (isIos()) {
      setMostrarIos(true);
      setVisivel(true);
    }

    const onInstalled = () => {
      setVisivel(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dispensar() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisivel(false);
  }

  async function instalar() {
    if (!deferred) return;
    await deferred.prompt();
    const escolha = await deferred.userChoice;
    if (escolha.outcome === "accepted") setVisivel(false);
    setDeferred(null);
  }

  if (!podeMostrarEm(pathname)) return null;
  if (!visivel) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 print:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-[#2b123a] p-3 text-white shadow-2xl">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#5a3583]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="h-full w-full" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instalar o app</p>
          {mostrarIos ? (
            <p className="mt-0.5 text-xs leading-4 text-white/70">
              No iPhone: toque em Compartilhar e depois em “Adicionar à Tela de
              Início”.
            </p>
          ) : (
            <p className="mt-0.5 text-xs leading-4 text-white/70">
              Acesso rápido na tela inicial, em tela cheia.
            </p>
          )}
        </div>

        {!mostrarIos ? (
          <button
            type="button"
            onClick={instalar}
            className="h-9 shrink-0 rounded-full bg-[var(--fdl-cream)] px-4 text-xs font-bold text-[var(--fdl-purple-dark)]"
          >
            Instalar
          </button>
        ) : null}

        <button
          type="button"
          onClick={dispensar}
          aria-label="Dispensar"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
