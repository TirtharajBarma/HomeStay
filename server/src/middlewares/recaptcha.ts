import type { NextFunction, Request, Response } from "express";
import { config } from "../config/env.js";

type RecaptchaResult = {
  success?: boolean;
  action?: string;
  score?: number;
  hostname?: string;
};

/** Verify a one-use reCAPTCHA v3 token for an anonymous form action. */
export function requireRecaptcha(action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const required = config.isDeployed || config.nodeEnv === "production";
    if (!required) return next();

    const secret = process.env.RECAPTCHA_SECRET_KEY?.trim() || "";
    // If reCAPTCHA is not configured or disabled on this deployment, bypass gracefully
    if (!secret || /^(replace-with-|your[-_]|none|disabled)/i.test(secret)) {
      return next();
    }

    const token = typeof req.body?.recaptchaToken === "string" ? req.body.recaptchaToken.trim() : "";
    if (!token || token.length > 4096) {
      return res.status(400).json({ success: false, error: "Complete the security check and try again." });
    }

    const allowedHostnames = (process.env.RECAPTCHA_ALLOWED_HOSTNAMES || "")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean);
    if (allowedHostnames.length === 0) {
      return next();
    }

    try {
      const body = new URLSearchParams({ secret, response: token });
      const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`reCAPTCHA returned HTTP ${response.status}`);

      const result = (await response.json()) as RecaptchaResult;
      const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
      const hostname = String(result.hostname || "").toLowerCase();
      if (
        !Number.isFinite(minScore) ||
        minScore < 0 ||
        minScore > 1 ||
        result.success !== true ||
        result.action !== action ||
        !Number.isFinite(result.score) ||
        Number(result.score) < minScore ||
        !allowedHostnames.includes(hostname)
      ) {
        return res.status(403).json({ success: false, error: "Security verification failed. Please try again." });
      }
      return next();
    } catch (error) {
      console.error("reCAPTCHA verification failed:", error);
      return res.status(503).json({ success: false, error: "Security verification is temporarily unavailable." });
    }
  };
}
