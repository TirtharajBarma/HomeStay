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
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";

const app = express();

// 1. Security Headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// 2. HTTP Request Logging via Morgan
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));

// 3. HTTP Compression
app.use(compression());

// 4. Rate Limiting for Public APIs
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests from this IP, please try again after 15 minutes",
  },
});
app.use(["/api", "/v1"], limiter);

// Stricter limit for login/signup and the public guest endpoints (brute force / spam).
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many attempts, please try again after 15 minutes" } },
});
app.use(
  ["/v1/auth/login", "/v1/auth/signup", "/api/v1/stayride/auth/login", "/api/v1/stayride/auth/signup"],
  strictLimiter
);
app.post(["/v1/public/*path", "/api/v1/stayride/public/*path"], strictLimiter);

// 5. CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile apps, SSR server-to-server)
      if (!origin) return callback(null, true);
      if (
        config.corsOrigins.includes(origin) ||
        config.corsOrigins.includes("*") ||
        config.nodeEnv === "development" ||
        origin.endsWith(".vercel.app") ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin '${origin}' not allowed`));
    },
    credentials: true,
  })
);

// 6. Body Parsing (Clerk webhook needs the raw body for signature verification)
app.use(["/v1/auth/clerk-webhook", "/api/v1/stayride/auth/clerk-webhook"], express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// Express 5 leaves req.body undefined when there is no body; handlers destructure it.
app.use((req, _res, next) => {
  req.body ??= {};
  next();
});

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
