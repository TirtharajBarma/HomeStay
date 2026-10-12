import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config } from "./config/env.js";
import apiRouter from "./routes/index.js";
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
app.use("/api", limiter);

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

// 6. Body Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 7. Health Check Endpoints
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

// 8. Mount Main API Router
app.use("/api/v1", apiRouter);

// 9. Error and 404 Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
