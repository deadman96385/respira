import {
  createJSONStorage,
  type PersistStorage,
  type StorageValue,
} from "zustand/middleware";

const DATABASE = "respira-artwork";
const STORE = "workspaces";

async function accessDatabase<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = operation(transaction.objectStore(STORE));
    transaction.oncomplete = () => {
      db.close();
      resolve(request.result as T);
    };
    transaction.onabort = transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? request.error);
    };
  });
}

/** IndexedDB keeps large stitch arrays and Uint8Arrays without JSON duplication. */
export function createWorkspaceStorage<T>(): PersistStorage<T> {
  const fallback = createJSONStorage<T>(
    () => {
      const storage = window.localStorage;
      if (!storage) throw new Error("Local storage unavailable");
      return storage;
    },
    {
      replacer: (_key, value) =>
        value instanceof Uint8Array ? { uint8: Array.from(value) } : value,
      reviver: (_key, value) =>
        value &&
        typeof value === "object" &&
        "uint8" in value &&
        Array.isArray(value.uint8)
          ? new Uint8Array(value.uint8)
          : value,
    },
  );
  return {
    async getItem(name) {
      if (typeof indexedDB === "undefined")
        return fallback?.getItem(name) ?? null;
      try {
        const value = await accessDatabase<StorageValue<T> | undefined>(
          "readonly",
          (store) => store.get(name),
        );
        return value ?? (await fallback?.getItem(name)) ?? null;
      } catch (error) {
        console.warn("[Workspace] Artwork storage unavailable:", error);
        return fallback?.getItem(name) ?? null;
      }
    },
    async setItem(name, value) {
      try {
        if (typeof indexedDB === "undefined") {
          await fallback?.setItem(name, value);
        } else {
          await accessDatabase("readwrite", (store) => store.put(value, name));
        }
      } catch (error) {
        console.warn("[Workspace] Could not save artwork:", error);
        try {
          await fallback?.setItem(name, value);
        } catch (fallbackError) {
          console.warn(
            "[Workspace] Artwork fallback also unavailable:",
            fallbackError,
          );
        }
      }
    },
    async removeItem(name) {
      await fallback?.removeItem(name);
      if (typeof indexedDB !== "undefined") {
        await accessDatabase("readwrite", (store) => store.delete(name));
      }
    },
  };
}
