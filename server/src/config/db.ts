import mongoose from "mongoose";
import { config } from "./env.js";

let memoryServerInstance: any = null;

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  let uri = config.mongoUri;

  if (!uri) {
    console.warn("⚠️  No MONGODB_URI found in environment.");
    console.log("ℹ️  Starting local in-memory MongoDB instance for development & testing...");
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      memoryServerInstance = await MongoMemoryServer.create();
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

  return await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 15000,
  });
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
