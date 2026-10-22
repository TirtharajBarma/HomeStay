import mongoose from "mongoose";
import dns from "node:dns";
import { config, liveDbName, markInMemoryDb } from "./env.js";

// Local/standalone only: some ISPs and home routers block Atlas SRV lookups. Never override DNS on Vercel.
if (!process.env.VERCEL) {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch {}
}

let memoryServerInstance: any = null;

// One shared connect per serverless instance: concurrent cold-start requests await the same promise
let connecting: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  connecting ??= openConnection().catch((err) => {
    connecting = null; // let the next request retry
    throw err;
  });
  return connecting;
}

async function openConnection(): Promise<typeof mongoose> {

  let uri = config.mongoUri;

  if (!uri) {
    if (config.isDeployed) {
      throw new Error(
        "FATAL: MONGODB_URI environment variable is required in production. In-memory database fallback is strictly disabled to prevent catastrophic data loss."
      );
    }
    console.warn("⚠️  No MONGODB_URI found in environment.");
    console.log("ℹ️  Starting local in-memory MongoDB instance for development & testing...");
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      memoryServerInstance = await MongoMemoryServer.create();
      markInMemoryDb();
      uri = memoryServerInstance.getUri();
      console.log(`📦 In-memory MongoDB running at: ${uri}`);
      console.log("👉 To use MongoDB Atlas, set MONGODB_URI in server/.env");
    } catch (err) {
      console.error("Failed to start in-memory MongoDB fallback:", err);
      throw err;
    }
  } else {
    // Mask credentials in logs for security
    const masked = uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
    console.log(`🔌 Connecting to MongoDB Atlas (${masked})...`);
  }

  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    console.log("✅ MongoDB connected successfully");
  });

  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️  MongoDB disconnected");
  });

  // Throws (before connecting) for a local "production" db without ALLOW_LOCAL_PRODUCTION_DB=true.
  const defaultDbName = liveDbName();

  const conn = await mongoose.connect(uri, {
    dbName: defaultDbName,
    autoIndex: true,
    // M0 allows 500 connections in total; keep each serverless instance small
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  });
  // A briefly-shipped 60-day TTL index purged audit history. Runs here (not server.ts) so Vercel
  // cold starts do it too; not awaited, so it never slows a request. ponytail: delete once deployed everywhere.
  for (const db of [defaultDbName, "test"]) {
    mongoose.connection.useDb(db, { useCache: true }).collection("auditlogs").dropIndex("createdAt_1").catch(() => {});
  }
  return conn;
}

export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    if (memoryServerInstance) {
      await memoryServerInstance.stop();
      memoryServerInstance = null;
    }
    console.log("MongoDB disconnected cleanly.");
  } catch (err) {
    console.error("Error during MongoDB disconnection:", err);
  }
}
