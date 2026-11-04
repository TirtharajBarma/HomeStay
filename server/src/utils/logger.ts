/**
 * High-Performance Centralized Telemetry & Stream Logger
 * 
 * Features:
 * 1. Zero MongoDB Impact: Streams HTTP & error telemetry out of band (to Axiom / Better Stack).
 * 2. Batched: logs are queued and sent in batches. On Vercel the function can freeze right after the
 *    response, so telemetryMiddleware holds res.end until the queue is flushed (the whole flush, retry
 *    included, capped at FLUSH_TIMEOUT_MS). Elsewhere a background timer flushes (0 ms added to API requests).
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

// Upper bound on what one flush can add to a Vercel response (a healthy Axiom ingest is ~50-150 ms).
const FLUSH_TIMEOUT_MS = 1500;

class TelemetryLogger {
  private queue: LogPayload[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> | null = null;
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
      if (this.queue.length >= this.batchSize) {
        this.flush();
      }
    }
  }

  /** Sends everything queued. Concurrent callers share one drain, so awaiting it always means "delivered". */
  public flush(): Promise<void> {
    this.flushing ??= this.drain().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async drain(): Promise<void> {
    // whole queue per POST (capped at 500 entries); loops for anything logged while a POST was in flight, but the whole
    // drain shares one FLUSH_TIMEOUT_MS so a busy instance can't hold a response for several cycles (the rest goes next flush)
    const deadline = Date.now() + FLUSH_TIMEOUT_MS;
    while (this.queue.length && Date.now() < deadline) await this.send(this.queue.splice(0), deadline);
  }

  /** One POST, retried once within the deadline. A batch that still fails is dropped with a one-line console.error trace. */
  private async send(batch: LogPayload[], deadline: number): Promise<void> {
    const axiom = this.isLiveToken(this.axiomToken);
    const token = axiom ? this.axiomToken : this.logtailToken;
    if (!this.isLiveToken(token)) return;
    // Axiom (500 GB free tier), else Better Stack / Logtail (1 GB free tier)
    const url = axiom ? `https://api.axiom.co/v1/datasets/${this.axiomDataset}/ingest` : "https://in.logtail.com";
    let failure = "flush time used up";
    for (let attempt = 0; attempt < 2 && Date.now() < deadline; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(batch),
          signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
        });
        if (res.ok) return;
        failure = `HTTP ${res.status}`;
      } catch (err: any) {
        failure = err?.name || String(err);
      }
    }
    // Never crash on telemetry failures, but leave a trace in the platform's own logs (Vercel keeps stderr)
    const actions = [...new Set(batch.map((p) => p.action || p.route || "-"))].slice(0, 5).join(",");
    console.error(`[Telemetry] dropped ${batch.length} log(s) for ${axiom ? "Axiom" : "Logtail"}: ${failure}; first actions: ${actions}`);
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

const SECRET_SEGMENT = /^(?:[A-Za-z0-9_-]{32,}(?:\.\w+)?|eyJ[\w-]*\.[\w-]+\.[\w-]*)$/; // random base64url tokens (guest links, iCal) or a JWT
const SECRET_PARAM = /([?&](?:t|token|phone)=)[^&#]*/gi;

/** A URL safe to log: guest-link / token path segments and t / token / phone query values become [token]. */
export function safeUrl(url: string): string {
  const q = url.indexOf("?");
  const path = (q < 0 ? url : url.slice(0, q))
    .split("/")
    .map((seg, i, all) => (all[i - 1] === "guest-links" || SECRET_SEGMENT.test(seg) ? (seg ? "[token]" : seg) : seg))
    .join("/");
  return q < 0 ? path : path + url.slice(q).replace(SECRET_PARAM, "$1[token]");
}

/**
 * Express Request Telemetry Middleware.
 * Records route latency, status code, and identifies the tenant/driver/user.
 */
export function telemetryMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  let logged = false;

  const logRequest = () => {
    if (logged) return;
    logged = true;
    const durationMs = Date.now() - start;
    const url = safeUrl(String(req.originalUrl || req.url).replace(/\?.*$/, ""));
    
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
  };

  if (process.env.VERCEL) {
    // Vercel may freeze the function as soon as the response ends, dropping anything still queued (cron and
    // webhook logs included). Log the request and deliver the queue first, then end. Costs one Axiom POST per
    // request (capped at FLUSH_TIMEOUT_MS); without a live token flush() returns at once.
    const end = res.end.bind(res) as (...a: any[]) => Response;
    let ending = false;
    (res as any).end = (...args: any[]) => {
      if (ending) return res; // a second end() while the first waits on the flush would end twice (write after end)
      ending = true;
      logRequest();
      logger.flush().finally(() => end(...args));
      return res;
    };
  } else {
    res.on("finish", logRequest);
  }

  next();
}
