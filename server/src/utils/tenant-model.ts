import mongoose from "mongoose";
import { dbNameFor } from "../config/env.js";

/**
 * Resolve a model bound to the correct physical database.
 *
 * Demo (isDemo=true) data lives ONLY in the "test" db; everything else lives ONLY in the live db
 * (config/env.ts liveDbName(): "production" on Vercel, guarded elsewhere). There is deliberately NO fallback to the default connection: the default
 * connection points at "production", so silently using it for a demo read/write would leak
 * demo data into production (and vice-versa). If the connection is not ready we fail closed
 * with a 503 instead of ever touching the wrong database.
 */
export function tenantDbModel<T = any>(
  isDemo: boolean,
  name: string,
  schema: mongoose.Schema
): mongoose.Model<T> {
  if (mongoose.connection.readyState !== 1) {
    throw Object.assign(
      new Error(isDemo ? "Demo database (test) is unavailable." : "Database unavailable."),
      { status: 503, code: "DB_UNAVAILABLE" }
    );
  }
  const conn = mongoose.connection.useDb(dbNameFor(isDemo), { useCache: true });
  return (conn.models[name] || conn.model(name, schema)) as mongoose.Model<T>;
}
