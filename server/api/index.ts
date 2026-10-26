import type { Request, Response } from "express";
import mongoose from "mongoose";
import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";

export default async function handler(req: Request, res: Response) {
  try {
    await connectDB();
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connection.asPromise();
    }
    return app(req, res);
  } catch (error: any) {
    console.error("Vercel Serverless invocation error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error in Serverless Handler",
    });
  }
}
