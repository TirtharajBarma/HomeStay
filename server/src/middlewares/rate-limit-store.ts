import mongoose from "mongoose";
import type { Options, Store, ClientRateLimitInfo } from "express-rate-limit";
import { httpError } from "./error-handler.js";
import { connectDB } from "../config/db.js";

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
