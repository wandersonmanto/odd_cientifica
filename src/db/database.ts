import { GameRecord } from '../../types';

// Singleton worker instance
let worker: Worker | null = null;
let pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();

// Helper to generate unique request IDs
const uuid = () => Math.random().toString(36).substring(2, 15);

// Initialize the worker and message handling
export async function initDB(): Promise<void> {
  if (worker) return;

  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

  worker.onmessage = (e) => {
    const { type, id, success, payload, error, log: logData } = e.data;

    // Handle logs from worker
    if (type === 'log') {
      console.log(`[Worker Log]`, logData.msg);
      return;
    }

    // Handle ready signal
    if (type === 'ready') {
      console.log('SQLite Worker is ready.');
      return;
    }

    // Handle standard request/response
    if (id && pendingRequests.has(id)) {
      const { resolve, reject } = pendingRequests.get(id)!;
      pendingRequests.delete(id);
      
      if (success) {
        resolve(payload);
      } else {
        const errMsg = error || 'Unknown worker error';
        console.error(`Worker Error [${id}]:`, errMsg);
        reject(new Error(errMsg));
      }
    }
  };

  // Wait for worker to be ready (optional, but good practice)
  // For now just assuming it starts up. We could implement a ping/pong.
}

// Generic execute function (INSERT, UPDATE, DELETE)
export async function exec(sql: string, params: object = {}): Promise<void> {
  if (!worker) await initDB();
  const id = uuid();
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker!.postMessage({ type: 'exec', id, sql, params });
  });
}

// Generic query function (SELECT)
export async function query<T = any>(sql: string, params: object = {}): Promise<T[]> {
  if (!worker) await initDB();
  const id = uuid();
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker!.postMessage({ type: 'query', id, sql, params });
  });
}

// --- Backup & Restore ---

// Request export of the .db file
export async function exportUserDb(): Promise<Uint8Array> {
  if (!worker) await initDB();
  const id = uuid();
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker!.postMessage({ type: 'export', id });
  });
}

// Request import/restore of a .db file
// Note: This requires the worker to handle file overwriting in OPFS
export async function importUserDb(fileBytes: Uint8Array): Promise<void> {
  if (!worker) await initDB();
  const id = uuid();
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker!.postMessage({ type: 'import', id, fileData: fileBytes });
  });
}
