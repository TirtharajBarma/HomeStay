import type { Request, Response, NextFunction } from "express";
import { logger, safeUrl } from "../utils/logger.js";

// Errors may carry an HTTP `status` (4xx = client error, safe to show) and a machine `code`.
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = Number(err?.status) >= 400 && Number(err?.status) < 600 ? Number(err.status) : 500;
  if (status >= 500) {
    console.error("Unhandled Error:", err);
    try {
      const stayrideUser: any = (req as any).stayrideUser;
      const user: any = (req as any).user || stayrideUser;
      const url = safeUrl(req.originalUrl); // ?t=<JWT> and token paths never reach the logs
      logger.error(`[UNHANDLED SERVER 500] ${req.method} ${url}: ${err?.message || err}`, err, {
        method: req.method,
        route: url,
        statusCode: status,
        tenantId: stayrideUser?.tenantKey || user?.tenantId,
        driverId: stayrideUser?.role === "driver" ? stayrideUser?.id : user?.driverId,
        userId: user?._id || user?.id || stayrideUser?.id,
        userRole: user?.role || stayrideUser?.role,
        ip: req.ip,
      });
    } catch {
      // Logger must never break error response
    }
  }
  const message = status >= 500 && status !== 503 ? "Internal server error" : err?.message || "Request failed";
  if (res.headersSent) return;
  const stayride = req.originalUrl.startsWith("/v1") || req.originalUrl.startsWith("/api/v1/stayride") || req.originalUrl.startsWith("/api/v1/admin");
  res.status(status).json(
    stayride ? { success: false, error: { message, code: err?.code || undefined } } : { success: false, error: message }
  );
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export const httpError = (status: number, message: string, code?: string) => Object.assign(new Error(message), { status, code });
