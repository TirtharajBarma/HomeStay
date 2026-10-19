// Expo push notifications (no SDK). Best effort: never throws, never logs tokens or PII.
// Callers await it inside the request (Vercel may freeze the function after the response),
// so every network call is bounded by a 4s timeout.
import { User } from '../models/user.model.js';
import { tenantDbModel } from '../utils/tenant-model.js';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const TIMEOUT_MS = 4000;
const BATCH = 100;

export interface PushMessage {
  title: string;
  body: string;
  data: { type: string; reference?: string; tripId?: number };
}

const disabled = () => process.env.NODE_ENV === 'test' || process.env.PUSH_DISABLED === 'true';

async function sendBatch(messages: Array<PushMessage & { to: string }>): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(EXPO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.map((m) => ({ ...m, sound: 'default' }))),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json: any = await res.json().catch(() => null);
    const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
    // Tickets come back in the same order as the messages.
    return tickets.flatMap((t, i) => (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered' && messages[i] ? [messages[i].to] : []));
  } finally {
    clearTimeout(timer);
  }
}

/** Push `msg` to every user matching `filter` (production users only; demo is skipped). */
export async function notify(isDemo: boolean, filter: Record<string, any>, msg: PushMessage): Promise<void> {
  if (isDemo || disabled()) return;
  try {
    const Users = tenantDbModel(false, 'User', User.schema);
    const users: any[] = await Users.find({ ...filter, 'pushTokens.0': { $exists: true } }).select('+pushTokens').limit(2000).lean();
    const tokens = [...new Set(users.flatMap((u) => (u.pushTokens || []).map((t: any) => t.token)).filter(Boolean))] as string[];
    if (!tokens.length) return;
    const batches: string[][] = [];
    for (let i = 0; i < tokens.length; i += BATCH) batches.push(tokens.slice(i, i + BATCH));
    const results = await Promise.allSettled(batches.map((b) => sendBatch(b.map((to) => ({ to, ...msg })))));
    const dead = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    if (dead.length) {
      await Users.updateMany({ _id: { $in: users.map((u) => u._id) } }, { $pull: { pushTokens: { token: { $in: dead } } } });
    }
  } catch {
    console.warn(`[push] ${msg.data.type} notification failed`);
  }
}
