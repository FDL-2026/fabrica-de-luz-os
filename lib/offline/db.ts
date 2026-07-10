/*
 * Camada offline — armazenamento local (IndexedDB puro, sem dependências).
 *
 * Dois object stores:
 *  - "cache": respostas de leitura (RPCs do montador) para consulta offline.
 *      key: string (ex.: "listar_os_montador:<usuarioId>:<projetoId>")
 *      valor: { key, data, savedAt }
 *  - "fila": ações de escrita pendentes de sincronização.
 *      keyPath "id" autoIncrement; valor descrito em FilaItem (fila.ts).
 *
 * Tudo aqui roda só no navegador. Chamadas em ambiente sem IndexedDB
 * (SSR, browsers antigos) degradam de forma silenciosa.
 */

const DB_NAME = "fdl-offline";
const DB_VERSION = 1;

export const STORE_CACHE = "cache";
export const STORE_FILA = "fila";

export type CacheRegistro<T = unknown> = {
  key: string;
  data: T;
  savedAt: number;
};

function temIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (!temIndexedDB()) {
    return Promise.reject(new Error("IndexedDB indisponível"));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(STORE_FILA)) {
        const fila = db.createObjectStore(STORE_FILA, {
          keyPath: "id",
          autoIncrement: true,
        });
        fila.createIndex("por_criacao", "criadoEm", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir IndexedDB"));
  });

  return dbPromise;
}

function promisificar<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Erro em operação IndexedDB"));
  });
}

function esperarTx(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Transação abortada"));
    tx.onerror = () => reject(tx.error ?? new Error("Erro na transação"));
  });
}

// ---- Cache (leituras) ------------------------------------------------------

export async function salvarCache<T>(key: string, data: T): Promise<void> {
  try {
    const db = await abrir();
    const tx = db.transaction(STORE_CACHE, "readwrite");
    tx.objectStore(STORE_CACHE).put({ key, data, savedAt: Date.now() });
    await esperarTx(tx);
  } catch {
    // best-effort: nunca quebrar a UI por causa do cache
  }
}

export async function lerCache<T>(key: string): Promise<CacheRegistro<T> | null> {
  try {
    const db = await abrir();
    const tx = db.transaction(STORE_CACHE, "readonly");
    const registro = await promisificar<CacheRegistro<T> | undefined>(
      tx.objectStore(STORE_CACHE).get(key) as IDBRequest<CacheRegistro<T> | undefined>
    );
    return registro ?? null;
  } catch {
    return null;
  }
}

// ---- Fila (escritas) -------------------------------------------------------

export async function inserirFila<T extends object>(item: T): Promise<number | null> {
  try {
    const db = await abrir();
    const tx = db.transaction(STORE_FILA, "readwrite");
    const id = await promisificar<IDBValidKey>(
      tx.objectStore(STORE_FILA).add(item)
    );
    await esperarTx(tx);
    return Number(id);
  } catch {
    return null;
  }
}

export async function listarFila<T>(): Promise<T[]> {
  try {
    const db = await abrir();
    const tx = db.transaction(STORE_FILA, "readonly");
    const itens = await promisificar<T[]>(
      tx.objectStore(STORE_FILA).getAll() as IDBRequest<T[]>
    );
    return (itens ?? []).sort(
      (a, b) =>
        Number((a as { id?: number }).id ?? 0) -
        Number((b as { id?: number }).id ?? 0)
    );
  } catch {
    return [];
  }
}

export async function atualizarFila<T extends { id?: number }>(
  item: T
): Promise<void> {
  try {
    const db = await abrir();
    const tx = db.transaction(STORE_FILA, "readwrite");
    tx.objectStore(STORE_FILA).put(item);
    await esperarTx(tx);
  } catch {
    // best-effort
  }
}

export async function removerFila(id: number): Promise<void> {
  try {
    const db = await abrir();
    const tx = db.transaction(STORE_FILA, "readwrite");
    tx.objectStore(STORE_FILA).delete(id);
    await esperarTx(tx);
  } catch {
    // best-effort
  }
}

export async function contarFila(): Promise<number> {
  try {
    const db = await abrir();
    const tx = db.transaction(STORE_FILA, "readonly");
    return await promisificar<number>(tx.objectStore(STORE_FILA).count());
  } catch {
    return 0;
  }
}
