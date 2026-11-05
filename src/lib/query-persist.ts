import type { Query } from "@tanstack/react-query";
import type { Persister } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { createStore, del, get, set } from "idb-keyval";

export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days
export const CACHE_BUSTER = "telefam-v1";

const noopPersister: Persister = {
  persistClient: async () => {},
  restoreClient: async () => undefined,
  removeClient: async () => {},
};

/** IndexedDB-backed persister on the client, a no-op during server rendering. */
export function createQueryPersister(): Persister {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return noopPersister;
  const store = createStore("telefam-cache", "queries");
  return createAsyncStoragePersister({
    key: "telefam-query-cache",
    throttleTime: 1000,
    storage: {
      getItem: async (key) => (await get<string>(key, store)) ?? null,
      setItem: (key, value) => set(key, value, store),
      removeItem: (key) => del(key, store),
    },
  });
}

/** Only keep data that's useful offline; skip one-off search results. */
export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== "success") return false;
  const [root, , search] = query.queryKey as unknown[];
  if (root === "contacts") return search === "";
  return root === "my-profile" || root === "contact-counts";
}
