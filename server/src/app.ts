import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config } from "./config/env.js";
import apiRouter from "./routes/index.js";
import adminRoutes from "./routes/admin.routes.js";
import stayrideV1Router from "./stayride/routes.js";
import { errorHandler, notFoundHandler, httpError } from "./middlewares/error-handler.js";
import { MongoRateLimitStore, MemoryRateLimitStore } from "./middlewares/rate-limit-store.js";
import { mongoSanitize } from "./middlewares/sanitize.js";
import { telemetryMiddleware } from "./utils/logger.js";

const app = express();

// 1. Security Headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Vercel sits in front as one proxy hop; needed so rate limits key on the real client IP
app.set("trust proxy", 1);

// 2. HTTP Request Logging & Cloud Telemetry Stream (Axiom / Better Stack)
// Guest-link tokens travel in the path/query; never write them to logs
morgan.token("safe-url", (req: any) =>
  String(req.originalUrl || req.url).replace(/\?.*$/, "").replace(/(\/guest-links\/)[^/]+/, "$1[token]")
);
app.use(morgan(':remote-addr :method :safe-url :status :res[content-length] - :response-time ms'));
app.use(telemetryMiddleware);


// 3. HTTP Compression
app.use(compression());

// 4. CORS: only configured origins (CORS_ORIGIN + the guest web page), plus localhost when not deployed.
// A rejected origin gets a 403 (never a 500). Runs before the rate limiters so rejects cost no DB call.
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(
  cors({
    origin: (origin, callback) => {
      // Requests without an Origin (mobile apps, curl, server-to-server) are not CORS requests.
      if (!origin || config.corsOrigins.includes(origin) || (!config.isDeployed && LOCAL_ORIGIN.test(origin))) {
        return callback(null, true);
      }
      return callback(httpError(403, "Origin not allowed.", "CORS_ORIGIN_REJECTED"));
    },
    credentials: true,
  })
);

// 5. Rate limiting, shared across serverless instances through MongoDB (see rate-limit-store.ts).
// - Global limiter fails OPEN if Mongo is unreachable: every API route needs Mongo anyway, so it
//   would fail on its own; blocking all traffic on a limiter error only adds an outage.
// - Strict limiter (login/signup/public guest writes) fails CLOSED with a 503: those are the
//   brute-force / spam targets, and they cannot succeed without Mongo either, so nothing is lost.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000, // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  store: new MemoryRateLimitStore("g:"),
  passOnStoreError: true,
  message: { success: false, error: { message: "Too many requests from this IP, please try again after 15 minutes", code: "RATE_LIMITED" } },
});
app.use(["/api", "/v1"], limiter);

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: new MongoRateLimitStore("s:"),
  passOnStoreError: false,
  message: { error: { message: "Too many attempts, please try again after 15 minutes", code: "RATE_LIMITED" } },
});
app.use(
  [
    "/v1/auth/login",
    "/v1/auth/signup",
    "/v1/auth/otp/send",
    "/v1/auth/otp/verify",
    "/api/v1/stayride/auth/login",
    "/api/v1/stayride/auth/signup",
    "/api/v1/stayride/auth/otp/send",
    "/api/v1/stayride/auth/otp/verify",
    "/api/v1/auth/login",
    "/api/v1/auth/otp/send",
    "/api/v1/auth/otp/verify",
  ],
  strictLimiter
);
app.post(["/v1/public/*path", "/api/v1/stayride/public/*path"], strictLimiter);
// Public booking creation is unauthenticated and writes records — keep it on the strict limiter.
app.post(["/api/v1/bookings", "/api/v1/reservations"], strictLimiter);
app.post(["/api/v1/drivers/bookings", "/api/v1/cabs/bookings"], strictLimiter);

// 6. Body Parsing (Clerk webhook needs the raw body for signature verification)
app.use(["/v1/auth/clerk-webhook", "/api/v1/stayride/auth/clerk-webhook"], express.raw({ type: "application/json" }));
app.use(["/v1/webhooks/razorpay", "/api/v1/stayride/webhooks/razorpay"], express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// Express 5 leaves req.body undefined when there is no body; handlers destructure it.
app.use((req, _res, next) => {
  req.body ??= {};
  next();
});
// 6b. NoSQL query and parameter sanitization (strips '$' and '.' operators)
app.use(mongoSanitize);

// 7. Health Check Endpoints
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "hospitality-transit-api",
    version: "1.0.0",
    docs: "/api/v1",
    health: "/health",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "hospitality-transit-api",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/v1/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "hospitality-transit-api",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// 8. Mount Main API Router & StayRide Mobile Adapter Router
app.use("/api/v1", apiRouter);
app.use("/v1/admin", adminRoutes);
app.use("/v1", stayrideV1Router);
app.use("/api/v1/stayride", stayrideV1Router);



// 9. Error and 404 Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
