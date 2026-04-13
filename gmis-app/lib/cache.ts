/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

/**
 * In-memory stale-while-revalidate cache.
 *
 * Screens read from this before firing a network request,
 * so users see instant data on every navigation — no spinner
 * on screens they've already visited.
 *
 * Cache is keyed by `${slug}:${screen}:${userId}` so each
 * school + user combination is isolated.  It lives for the
 * app session and is cleared on logout via `cache.flush()`.
 */

type Entry<T> = { data: T; ts: number };
const store = new Map<string, Entry<unknown>>();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export const cache = {
  /** Returns cached data if it exists and hasn't expired, otherwise null. */
  get<T>(key: string, ttl = DEFAULT_TTL): T | null {
    const entry = store.get(key) as Entry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.ts > ttl) { store.delete(key); return null; }
    return entry.data;
  },

  /** Stores data under key, resetting the TTL clock. */
  set<T>(key: string, data: T): void {
    store.set(key, { data, ts: Date.now() });
  },

  /** Remove a single entry. */
  del(key: string): void {
    store.delete(key);
  },

  /** Remove all entries whose key starts with prefix (e.g. a whole school slug). */
  bust(prefix: string): void {
    for (const k of store.keys()) {
      if (k.startsWith(prefix)) store.delete(k);
    }
  },

  /** Wipe everything — call on logout to prevent cross-user leaks. */
  flush(): void {
    store.clear();
  },
};
