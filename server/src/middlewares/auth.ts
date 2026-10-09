import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

export interface AuthUserPayload {
  id: string;
  email: string;
  name: string;
  role: "guest" | "owner" | "admin";
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
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUserPayload;
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

export function requireRole(...allowedRoles: Array<"guest" | "owner" | "admin">) {
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
      const decoded = jwt.verify(token, config.jwtSecret) as AuthUserPayload;
      req.user = decoded;
    } catch {
      // Silently proceed for optional auth
    }
  }
  next();
}
