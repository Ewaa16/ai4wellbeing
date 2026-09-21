import { useCallback, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();
const snapCache = new Map<string, { raw: string | null; value: unknown }>();

function getListeners(key: string): Set<() => void> {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  return set;
}

function subscribe(key: string, callback: () => void): () => void {
  getListeners(key).add(callback);
  return () => {
    getListeners(key).delete(callback);
  };
}

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function announce(key: string): void {
  getListeners(key).forEach((cb) => cb());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key && listeners.has(e.key)) {
      getListeners(e.key).forEach((cb) => cb());
    }
  });
}

function cachedObject<T>(key: string, fallback: T): T {
  const raw = safeGet(key);
  const prev = snapCache.get(key) as { raw: string | null; value: T } | undefined;
  if (prev && prev.raw === raw) return prev.value;

  let value = fallback;
  if (raw) {
    try {
      value = { ...fallback, ...JSON.parse(raw) };
    } catch {
      /* data korup — gunakan fallback */
    }
  }
  snapCache.set(key, { raw, value });
  return value;
}

export function useLocalStorage(
  key: string
): [string, (updater: string | ((prev: string) => string)) => void] {
  const value = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => safeGet(key) ?? "",
    () => ""
  );

  const set = useCallback(
    (updater: string | ((prev: string) => string)) => {
      const prev = safeGet(key) ?? "";
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        localStorage.setItem(key, next);
      } catch {
        /* storage penuh/diblokir — abaikan */
      }
      announce(key);
    },
    [key]
  );

  return [value, set];
}

export function useLocalStorageObject<T>(
  key: string,
  fallback: T
): [T, (updater: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => cachedObject(key, fallback),
    () => fallback
  );

  const set = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const prev = cachedObject(key, fallback);
      const next =
        typeof updater === "function"
          ? (updater as (p: T) => T)(prev)
          : updater;
      const raw = JSON.stringify(next);
      snapCache.set(key, { raw, value: next });
      try {
        localStorage.setItem(key, raw);
      } catch {
        /* storage penuh/diblokir — abaikan */
      }
      announce(key);
    },
    [key, fallback]
  );

  return [value, set];
}