import { Router } from "express";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * Mobile / Web Client Error Beacon.
 * Receives frontend exceptions, React crashes, or network failures
 * and records them in the centralized stream logger with zero MongoDB storage impact.
 */
router.post("/report", (req, res) => {
  const body = req.body || {};
  const message = body.message || body.error || "Unknown client error";
  const screen = body.screen || body.route || "unknown";
  const user = (req as any).stayrideUser || (req as any).user || {};
  const tenantId = user.role === "driver" ? undefined : (user.tenantKey || body.tenantId);
  const driverId = user.role === "driver" ? user.id : body.driverId;
  const userId = user.id || user._id || body.userId;
  const platform = body.platform || "unknown";
  const appVersion = body.appVersion || "1.0.0";
  const level = body.level === "info" ? "info" : "error";

  logger[level](`[Client ${level === "info" ? "Notice" : "Error"}] ${message} (Screen: ${screen})`, {
    action: level === "info" ? "client_notice" : "client_error",
    tenantId: tenantId ? String(tenantId) : undefined,
    driverId: driverId ? String(driverId) : undefined,
    userId: userId ? String(userId) : undefined,
    userRole: user.role || body.userRole,
    metadata: {
      screen,
      platform,
      appVersion,
      stack: body.stack,
      extra: body.extra,
    },
  });

  res.status(204).end();
});

/**
 * Mobile / Web Screen Transition & Action Telemetry.
 * Tracks screen views and critical user gestures across mobile and web interfaces.
 */
router.post("/event", (req, res) => {
  const body = req.body || {};
  const event = body.event || "screen_view";
  const screen = body.screen || body.route || "unknown";
  const user = (req as any).stayrideUser || (req as any).user || {};
  const tenantId = user.role === "driver" ? undefined : (user.tenantKey || body.tenantId);
  const driverId = user.role === "driver" ? user.id : body.driverId;
  const userId = user.id || user._id || body.userId;
  const platform = body.platform || "unknown";

  logger.info(`[UI Navigation] ${event} -> ${screen}`, {
    action: "screen_transition",
    tenantId: tenantId ? String(tenantId) : undefined,
    driverId: driverId ? String(driverId) : undefined,
    userId: userId ? String(userId) : undefined,
    userRole: user.role || body.userRole,
    metadata: {
      event,
      screen,
      platform,
      details: body.details,
    },
  });

  res.status(204).end();
});

export default router;
