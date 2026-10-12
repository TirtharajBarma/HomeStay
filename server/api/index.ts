import type { Request, Response } from "express";
import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";

export default async function handler(req: Request, res: Response) {
  try {
    await connectDB();
    return app(req, res);
  } catch (error: any) {
    console.error("Vercel Serverless database connection error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error during database connection",
      message: error?.message || "Unknown serverless error",
    });
  }
}
