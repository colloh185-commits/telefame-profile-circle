import { useEffect, useState } from "react";
import { createStore, get, set } from "idb-keyval";

// Avatar files are stored under random, never-reused names, so the storage path
// is a safe permanent cache key: once downloaded, a photo works offline forever.
const store =
  typeof window !== "undefined" && typeof indexedDB !== "undefined"
    ? createStore("telefam-images", "avatars")
    : null;
const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

async function load(key: string, url: string | null | undefined): Promise<string | null> {
  try {
    let blob = store ? await get<Blob>(key, store) : undefined;
    if (!blob && url && (typeof navigator === "undefined" || navigator.onLine)) {
      const res = await fetch(url);
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.startsWith("image/")) {
        blob = await res.blob();
        if (store) void set(key, blob, store).catch(() => {});
      }
    }
    if (!blob) return null;
    const objectUrl = URL.createObjectURL(blob);
    memory.set(key, objectUrl);
    return objectUrl;
  } catch {
    return null;
  }
}

/** Returns a local object URL for a cached image, downloading it once when online. */
export function useCachedImage(key: string | null | undefined, url: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(() => (key ? (memory.get(key) ?? null) : null));

  useEffect(() => {
    if (!key) {
      setSrc(null);
      return;
    }
    const hit = memory.get(key);
    if (hit) {
      setSrc(hit);
      return;
    }
    let cancelled = false;
    let p = inflight.get(key);
    if (!p) {
      p = load(key, url).finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    void p.then((value) => {
      if (!cancelled) setSrc(value);
    });
    return () => {
      cancelled = true;
    };
  }, [key, url]);

  return src;
}
