/**
 * High-Performance Centralized Telemetry & Stream Logger
 * 
 * Features:
 * 1. Zero MongoDB Impact: Streams HTTP & error telemetry out of band (to Axiom / Better Stack).
 * 2. Non-Blocking: Asynchronously batches and flushes logs using a background worker (0 ms added to API requests).
 * 3. Multi-Tenant Tracking: Automatically captures tenantId (owner), driverId, userId, and latency.
 * 4. Graceful Fallback: Outputs clean, readable console logs if external cloud tokens are not set.
 */

import { Request, Response, NextFunction } from "express";

interface LogPayload {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  service: string;
  environment: string;
  action?: string;
  tenantId?: string;
  driverId?: string;
  userId?: string;
  userRole?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
}

class TelemetryLogger {
  private queue: LogPayload[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly batchSize = 30;
  private readonly flushIntervalMs = 2500;
  private readonly axiomToken = process.env.AXIOM_TOKEN || "";
  private readonly axiomDataset = process.env.AXIOM_DATASET || "platform-api";
  private readonly logtailToken = process.env.LOGTAIL_SOURCE_TOKEN || "";
  private readonly environment = process.env.NODE_ENV || "development";

  private isLiveToken(t: string): boolean {
    return Boolean(t && t !== "disabled" && t !== "none" && !t.includes("placeholder"));
  }

  constructor() {
    // Start background flusher if third-party streaming is configured
    if (this.isLiveToken(this.axiomToken) || this.isLiveToken(this.logtailToken)) {
      this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
      if (this.flushTimer.unref) this.flushTimer.unref();
    }
  }

  private dispatch(payload: LogPayload) {
    // 1. Always output to stdout/stderr in dev or fallback
    const ts = new Date().toLocaleTimeString("en-IN", { hour12: false });
    const levelBadge = payload.level.toUpperCase().padEnd(5);
    const tenantTag = payload.tenantId ? ` [owner:${payload.tenantId}]` : "";
    const driverTag = payload.driverId ? ` [driver:${payload.driverId}]` : "";

    if (payload.level === "error") {
      console.error(`[${ts}] ${levelBadge}${tenantTag}${driverTag} ${payload.message}`, payload.error || "");
    } else if (payload.level === "warn") {
      console.warn(`[${ts}] ${levelBadge}${tenantTag}${driverTag} ${payload.message}`);
    } else {
      console.log(`[${ts}] ${levelBadge}${tenantTag}${driverTag} ${payload.message}`);
    }

    // 2. Queue for background cloud streaming if tokens exist
    if (this.isLiveToken(this.axiomToken) || this.isLiveToken(this.logtailToken)) {
      // Memory safeguard: Cap queue size at 500 items to prevent RAM buildup if network is slow
      if (this.queue.length >= 500) {
        this.queue.splice(0, 50); // drop oldest to preserve latest critical events
      }
      this.queue.push(payload);
      if (this.queue.length >= this.batchSize || process.env.VERCEL) {
        this.flush();
      }
    }
  }

  public async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      if (this.isLiveToken(this.axiomToken)) {
        // Stream to Axiom (500 GB free tier)
        await fetch(`https://api.axiom.co/v1/datasets/${this.axiomDataset}/ingest`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.axiomToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(batch),
        }).catch(() => {});
      } else if (this.isLiveToken(this.logtailToken)) {
        // Stream to Better Stack / Logtail (1 GB free tier)
        await fetch("https://in.logtail.com", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.logtailToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(batch),
        }).catch(() => {});
      }
    } catch {
      // Never crash the application on telemetry network failures
    }
  }

  public info(message: string, meta?: Partial<LogPayload>) {
    this.dispatch({
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      service: "platform-api",
      environment: this.environment,
      ...meta,
    });
  }

  public warn(message: string, meta?: Partial<LogPayload>) {
    this.dispatch({
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      service: "platform-api",
      environment: this.environment,
      ...meta,
    });
  }

  public error(message: string, error?: any, meta?: Partial<LogPayload>) {
    this.dispatch({
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      service: "platform-api",
      environment: this.environment,
      error: error
        ? {
            message: error.message || String(error),
            stack: error.stack?.slice(0, 1000),
            code: error.code || error.status,
          }
        : undefined,
      ...meta,
    });
  }
}

export const logger = new TelemetryLogger();

/**
 * Express Request Telemetry Middleware.
 * Records route latency, status code, and identifies the tenant/driver/user.
 */
export function telemetryMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const url = String(req.originalUrl || req.url).replace(/\?.*$/, "");
    
    // Ignore static health checks to prevent noise
    if (url === "/health" || url === "/" || url === "/api/v1/health") {
      return;
    }

    const stayrideUser: any = (req as any).stayrideUser;
    const user: any = (req as any).user || stayrideUser;
    const tenantId =
      (req.headers["x-tenant-id"] as string) ||
      (req.headers["x-tenant-key"] as string) ||
      (req as any).tenantId ||
      stayrideUser?.tenantKey ||
      user?.tenantId ||
      user?.propertyId;
    const driverId =
      (req.headers["x-driver-id"] as string) ||
      (req as any).driverId ||
      (stayrideUser?.role === "driver" ? stayrideUser.id : undefined) ||
      user?.driverId;
    const userId = user?._id || user?.id || stayrideUser?.id;
    const userRole = user?.role || stayrideUser?.role;

    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level](`${req.method} ${url} ${res.statusCode} (${durationMs}ms)`, {
      method: req.method,
      route: url,
      statusCode: res.statusCode,
      durationMs,
      tenantId: tenantId ? String(tenantId) : undefined,
      driverId: driverId ? String(driverId) : undefined,
      userId: userId ? String(userId) : undefined,
      userRole: userRole ? String(userRole) : undefined,
      ip: req.ip || (req.headers["x-forwarded-for"] as string) || "",
    });
  });

  next();
}
