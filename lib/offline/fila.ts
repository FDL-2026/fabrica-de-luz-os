/*
 * Fila de sincronização — escritas offline do montador.
 *
 * Ações feitas sem conexão entram numa fila local (IndexedDB) e sobem em
 * ordem (FIFO) quando a rede volta. Três tipos:
 *   - "status":   atualizar_status_os_montador  (iniciar/concluir OS)
 *   - "registro": criar_registro_os_montador    (acompanhamento/pendência)
 *   - "foto":     upload de foto/vídeo p/ /api/montador/os/anexos/upload
 *
 * A foto guarda o próprio arquivo (Blob) no IndexedDB. O restante guarda só
 * os parâmetros do RPC. A ordem de inserção importa: o montador tira as fotos
 * e só depois conclui a OS, então as fotos são processadas antes da conclusão.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  atualizarFila,
  contarFila,
  inserirFila,
  listarFila,
  removerFila,
} from "./db";

export type TipoAcao = "status" | "registro" | "foto";

type Base = {
  id?: number;
  tipo: TipoAcao;
  criadoEm: number;
  tentativas: number;
  ultimoErro?: string;
  // Contexto para exibição na UI e para casar com a OS aberta
  usuarioId: string;
  projetoId: string;
  osId: string;
};

export type AcaoStatus = Base & {
  tipo: "status";
  status: "em_andamento" | "concluida";
  observacao: string;
};

export type AcaoRegistro = Base & {
  tipo: "registro";
  tipoRegistro: string;
  descricao: string;
  percentual: number;
};

export type AcaoFoto = Base & {
  tipo: "foto";
  arquivo: Blob;
  nomeArquivo: string;
};

export type FilaItem = AcaoStatus | AcaoRegistro | AcaoFoto;

// Evento simples para a UI reagir a mudanças na fila (sem libs de estado).
const CANAL = "fdl-fila-mudou";

export function notificarMudanca() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CANAL));
}

export function ouvirFila(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CANAL, callback);
  return () => window.removeEventListener(CANAL, callback);
}

// ---- Enfileirar ------------------------------------------------------------

async function enfileirar(
  item: Omit<FilaItem, "id" | "criadoEm" | "tentativas">
): Promise<number | null> {
  const id = await inserirFila({
    ...item,
    criadoEm: Date.now(),
    tentativas: 0,
  });
  notificarMudanca();
  return id;
}

export function enfileirarStatus(
  dados: Omit<AcaoStatus, "id" | "criadoEm" | "tentativas" | "tipo">
) {
  return enfileirar({ tipo: "status", ...dados });
}

export function enfileirarRegistro(
  dados: Omit<AcaoRegistro, "id" | "criadoEm" | "tentativas" | "tipo">
) {
  return enfileirar({ tipo: "registro", ...dados });
}

export function enfileirarFoto(
  dados: Omit<AcaoFoto, "id" | "criadoEm" | "tentativas" | "tipo">
) {
  return enfileirar({ tipo: "foto", ...dados });
}

// ---- Consultas para a UI ---------------------------------------------------

export function contarPendentes(): Promise<number> {
  return contarFila();
}

export async function listarPendentes(): Promise<FilaItem[]> {
  return listarFila<FilaItem>();
}

/** Fotos pendentes de uma OS específica (para o contador dos 7 registros). */
export async function contarFotosPendentesDaOs(osId: string): Promise<number> {
  const itens = await listarFila<FilaItem>();
  return itens.filter((i) => i.tipo === "foto" && i.osId === osId).length;
}

// ---- Processamento --------------------------------------------------------

export type ResultadoSync = {
  processados: number;
  falhas: number;
  restantes: number;
};

let sincronizando = false;

async function processarItem(
  supabase: SupabaseClient,
  item: FilaItem
): Promise<boolean> {
  if (item.tipo === "status") {
    const { error } = await supabase.rpc("atualizar_status_os_montador", {
      p_usuario_id: item.usuarioId,
      p_projeto_id: item.projetoId,
      p_os_id: item.osId,
      p_status: item.status,
      p_observacao: item.observacao,
    });
    if (error) throw new Error(error.message);
    return true;
  }

  if (item.tipo === "registro") {
    const { error } = await supabase.rpc("criar_registro_os_montador", {
      p_usuario_id: item.usuarioId,
      p_projeto_id: item.projetoId,
      p_os_id: item.osId,
      p_tipo_registro: item.tipoRegistro,
      p_descricao: item.descricao,
      p_percentual_execucao: item.percentual,
    });
    if (error) throw new Error(error.message);
    return true;
  }

  // foto
  const formData = new FormData();
  formData.append("usuarioId", item.usuarioId);
  formData.append("projetoId", item.projetoId);
  formData.append("osId", item.osId);
  formData.append(
    "file",
    item.arquivo,
    item.nomeArquivo || `foto-${item.criadoEm}.jpg`
  );

  const resposta = await fetch("/api/montador/os/anexos/upload", {
    method: "POST",
    body: formData,
  });

  if (!resposta.ok) {
    const payload = await resposta.json().catch(() => null);
    throw new Error(payload?.error ?? "Falha ao enviar arquivo.");
  }

  return true;
}

/**
 * Processa a fila em ordem. Para no primeiro item que falhar por rede
 * (provavelmente offline de novo), preservando a ordem. Erros lógicos
 * marcam tentativas mas seguem em frente para não travar a fila inteira.
 */
export async function processarFila(
  supabase: SupabaseClient
): Promise<ResultadoSync> {
  if (sincronizando) {
    return { processados: 0, falhas: 0, restantes: await contarFila() };
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { processados: 0, falhas: 0, restantes: await contarFila() };
  }

  sincronizando = true;
  let processados = 0;
  let falhas = 0;

  try {
    const itens = await listarFila<FilaItem>();

    for (const item of itens) {
      try {
        await processarItem(supabase, item);
        if (typeof item.id === "number") await removerFila(item.id);
        processados += 1;
        notificarMudanca();
      } catch (e) {
        const mensagem = e instanceof Error ? e.message : "Erro ao sincronizar.";
        const offlineDeNovo =
          typeof navigator !== "undefined" && navigator.onLine === false;

        // Atualiza tentativas/erro do item
        const atualizado = {
          ...item,
          tentativas: (item.tentativas ?? 0) + 1,
          ultimoErro: mensagem,
        };
        await atualizarFila(atualizado);
        falhas += 1;

        // Se caiu a conexão, para para preservar a ordem e tentar depois.
        if (offlineDeNovo || /failed to fetch|fetch|network/i.test(mensagem)) {
          break;
        }
        // Erro lógico: segue para o próximo item.
      }
    }
  } finally {
    sincronizando = false;
    notificarMudanca();
  }

  return { processados, falhas, restantes: await contarFila() };
}
