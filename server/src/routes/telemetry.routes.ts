import { Router } from "express";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * Mobile / Web Client Error Beacon.
 * Receives frontend exceptions, React crashes, or network failures from the Expo app
 * and records them in the centralized stream logger with zero MongoDB storage impact.
 */
router.post("/report", (req, res) => {
  const body = req.body || {};
  const message = body.message || body.error || "Unknown client error";
  const screen = body.screen || body.route || "unknown";
  // Identity comes from the session (mounted behind the StayRide auth), never from the body
  const user = (req as any).stayrideUser || {};
  const tenantId = user.role === "driver" ? undefined : user.tenantKey;
  const driverId = user.role === "driver" ? user.id : undefined;
  const platform = body.platform || "expo";
  const appVersion = body.appVersion || "1.0.0";

  logger.error(`[Mobile Client Error] ${message} (Screen: ${screen})`, {
    tenantId: tenantId ? String(tenantId) : undefined,
    driverId: driverId ? String(driverId) : undefined,
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

export default router;
