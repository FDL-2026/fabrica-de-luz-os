/*
 * Hooks de estado de conexão e sincronização automática.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  contarPendentes,
  ouvirFila,
  processarFila,
  type ResultadoSync,
} from "./fila";

/** true/false conforme a conexão do navegador. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, []);

  return online;
}

/** Quantidade de ações aguardando sincronização, reativa a mudanças na fila. */
export function usePendentes(): number {
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    let ativo = true;

    const recarregar = () => {
      contarPendentes().then((n) => {
        if (ativo) setPendentes(n);
      });
    };

    recarregar();
    const parar = ouvirFila(recarregar);

    return () => {
      ativo = false;
      parar();
    };
  }, []);

  return pendentes;
}

/**
 * Dispara a sincronização e devolve um gatilho manual + estado "sincronizando".
 * Reprocessa automaticamente quando a conexão volta e quando a aba reganha foco.
 */
export function useSyncMontador() {
  const [sincronizando, setSincronizando] = useState(false);

  const sincronizar = useCallback(async (): Promise<ResultadoSync | null> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return null;
    setSincronizando(true);
    try {
      const supabase = createClient();
      return await processarFila(supabase);
    } finally {
      setSincronizando(false);
    }
  }, []);

  useEffect(() => {
    // Tenta assim que montar (pode haver pendências de uma sessão anterior).
    sincronizar();

    const aoVoltarOnline = () => sincronizar();
    const aoFocar = () => {
      if (document.visibilityState === "visible") sincronizar();
    };

    window.addEventListener("online", aoVoltarOnline);
    document.addEventListener("visibilitychange", aoFocar);

    return () => {
      window.removeEventListener("online", aoVoltarOnline);
      document.removeEventListener("visibilitychange", aoFocar);
    };
  }, [sincronizar]);

  return { sincronizar, sincronizando };
}
