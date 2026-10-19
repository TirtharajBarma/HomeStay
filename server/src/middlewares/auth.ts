import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { config } from "../config/env.js";
import { User } from "../models/user.model.js";
import { tenantDbModel } from "../utils/tenant-model.js";
import { httpError } from "./error-handler.js";

export interface AuthUserPayload {
  id: string;
  email: string;
  name: string;
  role: "guest" | "owner" | "admin" | "driver";
  propertyId?: string;
  tv?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Authentication token missing or invalid format. Please use 'Bearer <token>'.",
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUserPayload & { aud?: string };
    // StayRide mobile tokens share the secret but are not valid for this API.
    if (decoded.aud === "stayride") throw new Error("Wrong audience");
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "JWT token has expired (15m validity). Please log in again to renew your session.",
        expired: true,
      });
    }
    return res.status(401).json({
      success: false,
      error: "Invalid authentication token.",
    });
  }
}

export function requireRole(...allowedRoles: Array<"guest" | "owner" | "admin" | "driver">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: role '${req.user.role}' lacks permission for this resource.`,
      });
    }
    next();
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as AuthUserPayload & { aud?: string };
      if (decoded.aud !== "stayride") req.user = decoded;
    } catch {
      // Silently proceed for optional auth
    }
  }
  next();
}

/**
 * Admin routes: re-check the admin in the database on EVERY request (S3), so blocking, demoting,
 * deleting or revoking an admin takes effect immediately, not when the token expires.
 */
export async function requireLiveAdmin(req: Request, _res: Response, next: NextFunction) {
  const id = String(req.user?.id || "");
  const user: any = mongoose.Types.ObjectId.isValid(id)
    ? await tenantDbModel(false, "User", User.schema).findById(id).select("role accountStatus tokenVersion").lean()
    : null;
  if (!user || (req.user?.tv ?? 0) !== (user.tokenVersion ?? 0)) throw httpError(401, "Session revoked. Please sign in again.", "SESSION_REVOKED");
  if (user.accountStatus === "BLOCKED") throw httpError(403, "This account is blocked.", "ACCOUNT_BLOCKED");
  if (user.role !== "admin") throw httpError(403, "Administrator access required.", "FORBIDDEN");
  next();
}
