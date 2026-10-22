import mongoose from "mongoose";
import app from "./app.js";
import { config } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { seedDatabase } from "./data/seeds/seed.js";
import { CronService } from "./services/cron.service.js";
async function bootstrap() {
  try {
    // 1. Connect to MongoDB Atlas (or in-memory fallback during dev)
    await connectDB();

    // Ensure legacy global unique constraints are dropped for multi-tenant compound indexing
    try {
      await mongoose.connection.collection("rooms").dropIndex("code_1");
    } catch {}
    try {
      await mongoose.connection.collection("rooms").dropIndex("slug_1");
    } catch {}

    // 2. Sample data only when explicitly allowed on a local/dev database
    if (process.env.ALLOW_SEED === "true") await seedDatabase(false);

    // 3. Start HTTP Server
    const server = app.listen(config.port, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Backend Server running on http://localhost:${config.port}`);
      console.log(`📡 Health Check: http://localhost:${config.port}/health`);
      console.log(`📚 API Root:     http://localhost:${config.port}/api/v1`);
      console.log(`🔒 Security:     Helmet, CORS, Rate-Limiting, Compression enabled`);
      console.log(`🗄️  Database:     MongoDB & Mongoose (Atlas ready)`);
      console.log(`⚡ Engine:       Node ${process.version} with tsx`);
      console.log(`======================================================\n`);

      // 4. Start automated background workers
      CronService.startIcalWorker(15);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Closing HTTP server & database...`);
      CronService.stopWorker();
      server.close(async () => {
        console.log("HTTP server closed.");
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    console.error("❌ Fatal error during server bootstrap:", err);
    process.exit(1);
  }
}

bootstrap();
