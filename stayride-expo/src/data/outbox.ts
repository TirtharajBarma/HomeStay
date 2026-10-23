import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './api';

// Offline mutation queue. Every write the app makes is appended here first, then an attempt is
// made to push it to the server (the ultimate source of truth). Entries survive app restarts and
// are replayed strictly in sequence so the server sees the same order the user performed them.

export type OutboxMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OutboxEntry {
  seq: number;
  id: string;
  method: OutboxMethod;
  path: string;
  body?: unknown;
  attempts: number;
  lastError?: string;
  enqueuedAt: number;
  nextAttemptAt?: number;
}

export type EntryStatus = 'ok' | 'terminal' | 'queued';

export interface EntryResult {
  status: EntryStatus;
  /** Server entity for 2xx responses (used by the store to adopt server truth). */
  entity?: unknown;
  error?: string;
  code?: string;
}

export interface FlushOutcome {
  /** True when the queue was fully drained. */
  flushed: boolean;
  /** True when the loop stopped because the connection is down (retry later). */
  stoppedOffline: boolean;
  /** Outcome per entry id that was attempted (or blocked by an earlier failure). */
  results: Record<string, EntryResult>;
}

interface OutboxShape {
  seq: number;
  entries: OutboxEntry[];
}

// The api.ts request helper surface the outbox needs. Kept structural so it can be swapped in tests.
interface ApiClient {
  post(path: string, body?: unknown): Promise<unknown>;
  put(path: string, body?: unknown): Promise<unknown>;
  patch(path: string, body?: unknown): Promise<unknown>;
  delete(path: string, body?: unknown): Promise<unknown>;
}

const BACKOFF_BASE_MS = 3000;
const BACKOFF_MAX_MS = 60000;

// Server returns HTTP 410 {error:{code:'GONE'}} for POST /trips/:id/commission/pay: commission is
// settled by the admin through payouts, so retrying can never succeed. Surface a friendly message.
const GONE_MESSAGE = 'Commission is settled by the admin.';

function backoffDelay(attempts: number): number {
  const exp = BACKOFF_BASE_MS * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(exp, BACKOFF_MAX_MS);
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

/** Map an entity family to the store row list that protects optimistic rows from a snapshot. */
export function familyOfPath(path: string): string {
  const seg = path.replace(/^\//, '').split(/[/?]/)[0];
  return seg || '';
}

class Outbox {
  private storageKey: string | null = null;
  private entries: OutboxEntry[] = [];
  private seqCounter = 0;
  private loaded = false;
  private flushing: Promise<FlushOutcome> | null = null;
  private listeners = new Set<() => void>();

  /** Point the outbox at the current account's storage bucket (call on login/bootstrap/logout). */
  configure(storageKey: string) {
    if (this.storageKey === storageKey) return;
    this.storageKey = storageKey;
    this.entries = [];
    this.seqCounter = 0;
    this.loaded = false;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.warn('[outbox] listener failed:', e);
      }
    });
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded || !this.storageKey) return;
    try {
      const raw = await AsyncStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as OutboxShape;
        this.entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
        this.seqCounter =
          typeof parsed?.seq === 'number'
            ? parsed.seq
            : this.entries.reduce((max, e) => Math.max(max, e.seq), 0);
      } else {
        this.entries = [];
        this.seqCounter = 0;
      }
    } catch (e) {
      console.warn('[outbox] failed to load queue, starting empty:', e);
      this.entries = [];
      this.seqCounter = 0;
    }
    this.loaded = true;
  }

  private async persistQueue(): Promise<void> {
    if (!this.storageKey) return;
    try {
      const shape: OutboxShape = { seq: this.seqCounter, entries: this.entries };
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(shape));
    } catch (e) {
      // Never let a storage failure break the user's flow, but never hide it either.
      console.warn('[outbox] failed to persist queue:', e);
    }
  }

  async enqueue(method: OutboxMethod, path: string, body?: unknown): Promise<OutboxEntry> {
    await this.ensureLoaded();
    this.seqCounter += 1;
    const entry: OutboxEntry = {
      seq: this.seqCounter,
      id: `${Date.now().toString(36)}-${this.seqCounter}-${Math.random().toString(36).slice(2, 8)}`,
      method,
      path,
      body,
      attempts: 0,
      enqueuedAt: Date.now(),
    };
    this.entries.push(entry);
    await this.persistQueue();
    this.emit();
    return entry;
  }

  async list(): Promise<OutboxEntry[]> {
    await this.ensureLoaded();
    return [...this.entries].sort((a, b) => a.seq - b.seq);
  }

  /** Synchronous count of currently-known entries (for the sync banner). */
  count(): number {
    return this.entries.length;
  }

  async remove(id: string): Promise<void> {
    await this.ensureLoaded();
    const next = this.entries.filter((e) => e.id !== id);
    if (next.length === this.entries.length) return;
    this.entries = next;
    await this.persistQueue();
    this.emit();
  }

  async clear(): Promise<void> {
    await this.ensureLoaded();
    if (this.entries.length === 0) return;
    this.entries = [];
    await this.persistQueue();
    this.emit();
  }

  /** Entity families (path first segment) that still have a pending mutation. */
  pendingFamilies(): Set<string> {
    const families = new Set<string>();
    for (const entry of this.entries) {
      const fam = familyOfPath(entry.path);
      if (fam) families.add(fam);
    }
    return families;
  }

  /**
   * Single-flight flush. Concurrent callers are serialized: each call runs its own pass after any
   * in-flight pass completes, so an entry enqueued right before the call is always attempted.
   */
  flush(client: ApiClient = api): Promise<FlushOutcome> {
    const previous = this.flushing;
    const run = (previous ? previous.catch(() => undefined) : Promise.resolve(undefined)).then(() =>
      this.doFlush(client)
    );
    this.flushing = run;
    run
      .catch(() => undefined)
      .then(() => {
        if (this.flushing === run) this.flushing = null;
      });
    return run;
  }

  private call(client: ApiClient, entry: OutboxEntry): Promise<unknown> {
    switch (entry.method) {
      case 'POST':
        return client.post(entry.path, entry.body);
      case 'PUT':
        return client.put(entry.path, entry.body);
      case 'PATCH':
        return client.patch(entry.path, entry.body);
      case 'DELETE':
        return client.delete(entry.path, entry.body);
    }
  }

  private async doFlush(client: ApiClient): Promise<FlushOutcome> {
    await this.ensureLoaded();
    const outcome: FlushOutcome = { flushed: false, stoppedOffline: false, results: {} };
    const ordered = [...this.entries].sort((a, b) => a.seq - b.seq);

    for (const entry of ordered) {
      // Respect backoff: if the head entry is not due yet, everything behind it waits too.
      if (entry.nextAttemptAt && entry.nextAttemptAt > Date.now()) {
        outcome.results[entry.id] = { status: 'queued', error: entry.lastError };
        outcome.stoppedOffline = true;
        break;
      }

      try {
        const entity = await this.call(client, entry);
        await this.remove(entry.id);
        outcome.results[entry.id] = { status: 'ok', entity };
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.status === 410) {
            // Terminal but friendly: the server will never accept this mutation again.
            await this.remove(entry.id);
            outcome.results[entry.id] = { status: 'terminal', error: GONE_MESSAGE, code: 'GONE' };
            continue;
          }
          if (isRetryableStatus(e.status)) {
            await this.recordFailure(entry, e.message);
            outcome.results[entry.id] = { status: 'queued', error: e.message };
            outcome.stoppedOffline = true;
            break;
          }
          if (e.status === 401) {
            // Auth hiccup (access token refresh failed or session is being renewed). Never discard
            // the user's write: keep it queued and retry after re-auth, exactly like a 5xx.
            await this.recordFailure(entry, e.message);
            outcome.results[entry.id] = { status: 'queued', error: e.message };
            outcome.stoppedOffline = true;
            break;
          }
          // Other 4xx: terminal (validation/auth/etc). It can never succeed, so drop it and report.
          await this.remove(entry.id);
          outcome.results[entry.id] = { status: 'terminal', error: e.message, code: e.code };
          continue;
        }
        // Network error / timeout / abort: the connection is down. Stop and retry later.
        const message = (e as { message?: string })?.message || 'Network unavailable';
        await this.recordFailure(entry, message);
        outcome.results[entry.id] = { status: 'queued', error: message };
        outcome.stoppedOffline = true;
        break;
      }
    }

    outcome.flushed = this.entries.length === 0;
    return outcome;
  }

  private async recordFailure(entry: OutboxEntry, message: string): Promise<void> {
    entry.attempts += 1;
    entry.lastError = message;
    entry.nextAttemptAt = Date.now() + backoffDelay(entry.attempts);
    const idx = this.entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) this.entries[idx] = { ...entry };
    await this.persistQueue();
    this.emit();
  }
}

export const outbox = new Outbox();
