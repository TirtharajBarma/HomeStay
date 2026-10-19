// O1: Idempotency-Key storage. One small collection per database (demo -> "test"), unique on
// {tenantId, key}, TTL 24h. The unique insert is the lock, so concurrent duplicates can't both run.
import mongoose, { Schema } from 'mongoose';
import { tenantDbModel } from '../utils/tenant-model.js';
import { httpError } from '../middlewares/error-handler.js';

const IdempotencyKeySchema = new Schema({
  tenantId: { type: String, required: true },
  key: { type: String, required: true },
  route: { type: String, required: true },
  state: { type: String, enum: ['PENDING', 'DONE'], default: 'PENDING' },
  status: { type: Number, default: 0 },
  body: { type: Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now, expires: 24 * 3600 },
  lockedAt: { type: Date, default: Date.now },
});
IdempotencyKeySchema.index({ tenantId: 1, key: 1 }, { unique: true, name: 'tenant_key_unique' });

const model = (isDemo: boolean) => tenantDbModel(isDemo, 'IdempotencyKey', IdempotencyKeySchema) as mongoose.Model<any>;
// A PENDING record older than this belongs to a request that died mid-way; a retry may take it over.
const STALE_LOCK_MS = 5 * 60 * 1000;

type Outcome =
  | { kind: 'none' }
  | { kind: 'replay'; status: number; body: any }
  | { kind: 'run'; finish: (status: number, body: any) => Promise<void> };

export async function beginIdempotent(rawKey: unknown, tenantId: string, isDemo: boolean, route: string): Promise<Outcome> {
  if (rawKey === undefined || rawKey === '') return { kind: 'none' };
  const key = String(rawKey).trim();
  if (!key || key.length > 100) throw httpError(400, 'Idempotency-Key must be 1-100 characters.', 'VALIDATION_ERROR');
  const Model = model(isDemo);
  // The unique index IS the lock: make sure it exists before the first insert on a fresh collection.
  await Model.init();
  let id: any;
  try {
    id = (await Model.create({ tenantId, key, route }))._id;
  } catch (err: any) {
    if (err?.code !== 11000) throw err;
    const existing: any = await Model.findOne({ tenantId, key }).lean();
    if (!existing) throw httpError(409, 'Request with this Idempotency-Key is in progress. Retry shortly.', 'IDEMPOTENCY_IN_PROGRESS');
    if (existing.route !== route) throw httpError(409, 'This Idempotency-Key was already used for a different request.', 'IDEMPOTENCY_KEY_REUSED');
    if (existing.state === 'DONE') return { kind: 'replay', status: existing.status, body: existing.body };
    const takeover: any = await Model.findOneAndUpdate(
      { _id: existing._id, state: 'PENDING', lockedAt: { $lt: new Date(Date.now() - STALE_LOCK_MS) } },
      { $set: { lockedAt: new Date() } }
    ).lean();
    if (!takeover) throw httpError(409, 'Request with this Idempotency-Key is in progress. Retry shortly.', 'IDEMPOTENCY_IN_PROGRESS');
    id = existing._id;
  }
  return {
    kind: 'run',
    // Only successful results are stored; on any error the key is released so the client can retry.
    finish: async (status, body) => {
      if (status >= 200 && status < 300) {
        await Model.updateOne({ _id: id }, { $set: { state: 'DONE', status, body: JSON.parse(JSON.stringify(body ?? null)) } });
      } else {
        await Model.deleteOne({ _id: id, state: 'PENDING' });
      }
    },
  };
}
