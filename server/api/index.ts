import type { Request, Response } from "express";

export default async function handler(req: Request, res: Response) {
  try {
    // Dynamic import inside handler so module-load errors are caught and surfaced clearly
    let appModule: any;
    let dbModule: any;
    try {
      appModule = await import("../dist/app.js");
      dbModule = await import("../dist/config/db.js");
    } catch {
      appModule = await import("../src/app.js");
      dbModule = await import("../src/config/db.js");
    }

    const { connectDB } = dbModule;
    const app = appModule.default;

    await connectDB();
    return app(req, res);
  } catch (error: any) {
    console.error("Vercel Serverless invocation error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error in Serverless Handler",
      message: error?.message || "Unknown serverless error",
      tip: "Please verify that MONGODB_URI and JWT_SECRET are configured in your Vercel Project Settings -> Environment Variables.",
    });
  }
}
