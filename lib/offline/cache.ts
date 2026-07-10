/*
 * Read-through cache para RPCs do montador.
 *
 * lerRpcComCache() tenta a rede primeiro. Se der certo, grava no IndexedDB e
 * devolve o dado fresco. Se falhar (offline / erro de rede), cai no último
 * snapshot salvo — assim o montador consegue consultar em campo sem sinal.
 *
 * Só cacheia leituras do montador (dados que ele mesmo já viu naquele
 * dispositivo). Nada aqui é compartilhado entre sessões.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { lerCache, salvarCache } from "./db";

export type OrigemLeitura = "rede" | "cache" | "vazio";

export type ResultadoLeitura<T> = {
  data: T | null;
  error: string | null;
  origem: OrigemLeitura;
  savedAt: number | null;
};

function ehErroDeRede(mensagem: string): boolean {
  const m = mensagem.toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("network request failed") ||
    m.includes("fetch")
  );
}

/**
 * Monta a chave de cache a partir do nome do RPC e dos parâmetros relevantes.
 * Ordena para ser estável independentemente da ordem das chaves.
 */
export function chaveCache(
  rpc: string,
  params: Record<string, unknown>
): string {
  const partes = Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k])}`);
  return `${rpc}:${partes.join(":")}`;
}

export async function lerRpcComCache<T>(
  supabase: SupabaseClient,
  rpc: string,
  params: Record<string, unknown>
): Promise<ResultadoLeitura<T[]>> {
  const key = chaveCache(rpc, params);

  try {
    const { data, error } = await supabase.rpc(rpc, params);

    if (error) {
      // Erro de rede -> tenta cache. Erro lógico (permissão etc.) -> propaga.
      if (ehErroDeRede(error.message)) {
        return await comFallback<T>(key, error.message);
      }

      // Ainda assim, se houver snapshot, é melhor mostrar algo do que nada;
      // mas priorizamos sinalizar o erro real de regra de negócio.
      return { data: null, error: error.message, origem: "vazio", savedAt: null };
    }

    const lista = (data ?? []) as T[];
    await salvarCache(key, lista);
    return { data: lista, error: null, origem: "rede", savedAt: Date.now() };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Falha de conexão.";
    return await comFallback<T>(key, mensagem);
  }
}

/**
 * Aquece (busca e cacheia) os dados de detalhe de uma OS, para que ela abra
 * offline mesmo sem ter sido aberta manualmente antes. Best-effort e só faz
 * sentido chamar quando online — cada leitura já se auto-cacheia.
 */
export async function aquecerDetalheOs(
  supabase: SupabaseClient,
  usuarioId: string,
  projetoId: string,
  osId: string
): Promise<void> {
  const params = {
    p_usuario_id: usuarioId,
    p_projeto_id: projetoId,
    p_os_id: osId,
  };
  await lerRpcComCache(supabase, "obter_os_montador", params);
  await lerRpcComCache(supabase, "listar_registros_os_montador", params);
  await lerRpcComCache(supabase, "listar_arquivos_os_montador", params);
}

/** Aquece uma lista de OSs em sequência, com teto de segurança. */
export async function aquecerDetalhesOs(
  supabase: SupabaseClient,
  usuarioId: string,
  projetoId: string,
  osIds: string[],
  limite = 40
): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  for (const osId of osIds.slice(0, limite)) {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    await aquecerDetalheOs(supabase, usuarioId, projetoId, osId);
  }
}

async function comFallback<T>(
  key: string,
  mensagemErro: string
): Promise<ResultadoLeitura<T[]>> {
  const registro = await lerCache<T[]>(key);

  if (registro) {
    return {
      data: registro.data,
      error: null,
      origem: "cache",
      savedAt: registro.savedAt,
    };
  }

  return { data: null, error: mensagemErro, origem: "vazio", savedAt: null };
}
