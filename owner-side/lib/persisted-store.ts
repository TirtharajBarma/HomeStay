"use client";

/**
 * A tiny external store backed by localStorage, shaped for
 * `useSyncExternalStore` so the server render, the hydration render and every
 * later read agree on one value without an effect.
 */

type Listener = () => void;

export type PersistedStore<T> = {
  subscribe: (listener: Listener) => () => void;
  /** Cached snapshot — referentially stable until `set` is called. */
  get: () => T;
  /** Used during SSR and for the hydration render. */
  getServer: () => T;
  /** Accepts a value or an updater, like `useState`. */
  set: (next: T | ((current: T) => T)) => void;
  clear: () => void;
};

export function createPersistedStore<T>(
  key: string,
  seed: T,
  /** JSON has no date type, so re-hydrate the `Date` fields a slice relies on. */
  revive?: (parsed: unknown) => T,
): PersistedStore<T> {
  const listeners = new Set<Listener>();
  let cache: T | undefined;
  const server = seed;

  const get = (): T => {
    if (cache !== undefined) return cache;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        cache = seed;
      } else {
        const parsed: unknown = JSON.parse(raw);
        cache = revive ? revive(parsed) : (parsed as T);
      }
    } catch {
      cache = seed;
    }
    return cache;
  };

  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        window.addEventListener("storage", notify);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          window.removeEventListener("storage", notify);
        }
      };
    },
    get,
    getServer: () => server,
    set(next) {
      const value =
        typeof next === "function" ? (next as (current: T) => T)(get()) : next;
      cache = value;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage blocked — the value still holds for this session */
      }
      notify();
    },
    clear() {
      cache = undefined;
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* nothing to clear */
      }
      notify();
    },
  };
}
