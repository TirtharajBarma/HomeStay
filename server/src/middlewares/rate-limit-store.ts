import mongoose from "mongoose";
import type { Options, Store, ClientRateLimitInfo } from "express-rate-limit";
import { httpError } from "./error-handler.js";
import { connectDB } from "../config/db.js";

/**
 * High-performance in-memory rate-limit store for serverless instances.
 * Stores hits in local process memory with zero disk/database writes, completely eliminating
 * MongoDB IOPS overhead and connection contention on high-frequency API routes.
 */
export class MemoryRateLimitStore implements Store {
  localKeys = true;
  private hits = new Map<string, { count: number; resetTime: number }>();
  private windowMs = 15 * 60 * 1000;

  constructor(readonly prefix: string = "") {}

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = Date.now();
    const fullKey = this.prefix + key;
    const entry = this.hits.get(fullKey);

    // Garbage collect if map grows too large
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits.entries()) {
        if (v.resetTime <= now) this.hits.delete(k);
      }
    }

    if (!entry || entry.resetTime <= now) {
      const resetTime = now + this.windowMs;
      this.hits.set(fullKey, { count: 1, resetTime });
      return { totalHits: 1, resetTime: new Date(resetTime) };
    }

    entry.count += 1;
    return { totalHits: entry.count, resetTime: new Date(entry.resetTime) };
  }

  async decrement(key: string) {
    const fullKey = this.prefix + key;
    const entry = this.hits.get(fullKey);
    if (entry && entry.count > 0) entry.count -= 1;
  }

  async resetKey(key: string) {
    this.hits.delete(this.prefix + key);
  }
}

/**
 * express-rate-limit Store shared by every serverless instance: one Mongo document per client key
 * in the live database (`ratelimits`). Each hit is a single atomic findOneAndUpdate (pipeline update)
 * that either increments the counter or starts a new window; a TTL index removes expired windows.
 */
export class MongoRateLimitStore implements Store {
  localKeys = false;
  private windowMs = 15 * 60 * 1000;
  private indexes: Promise<unknown> | null = null;

  constructor(readonly prefix: string) {}

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  private async coll() {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      await connectDB().catch(() => {});
    }
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      throw httpError(503, "Service temporarily unavailable. Please retry.", "DB_UNAVAILABLE");
    }
    const coll = mongoose.connection.db.collection<{ _id: string; hits: number; resetTime: Date }>("ratelimits");
    this.indexes ??= coll.createIndex({ resetTime: 1 }, { expireAfterSeconds: 0 }).catch(() => (this.indexes = null));
    return coll;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = new Date();
    const live = { $gt: ["$resetTime", now] };
    const update = [
      {
        $set: {
          hits: { $cond: [live, { $add: ["$hits", 1] }, 1] },
          resetTime: { $cond: [live, "$resetTime", new Date(now.getTime() + this.windowMs)] },
        },
      },
    ];
    for (let attempt = 0; ; attempt++) {
      try {
        const collection = await this.coll();
        const doc = await collection.findOneAndUpdate({ _id: this.prefix + key }, update, { upsert: true, returnDocument: "after" });
        return { totalHits: doc?.hits ?? 1, resetTime: doc?.resetTime };
      } catch (err: any) {
        // Two first hits for the same key can race on the upsert; the loser simply retries.
        if (err?.code !== 11000 || attempt > 0) throw err;
      }
    }
  }

  async decrement(key: string) {
    try {
      const collection = await this.coll();
      await collection.updateOne({ _id: this.prefix + key, resetTime: { $gt: new Date() }, hits: { $gt: 0 } }, { $inc: { hits: -1 } });
    } catch {}
  }

  async resetKey(key: string) {
    try {
      const collection = await this.coll();
      await collection.deleteOne({ _id: this.prefix + key });
    } catch {}
  }
}
