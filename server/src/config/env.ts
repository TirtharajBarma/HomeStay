import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5050", 10),
  mongoUri: process.env.MONGODB_URI || "",
  corsOrigins: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        "http://localhost:5500",
        "http://localhost:5501",
      ],
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "estate-transit-production-jwt-secret-key-2026",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
};
