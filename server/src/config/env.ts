import dotenv from "dotenv";

dotenv.config();

// The old in-code fallback was public, so a missing or default secret is fatal.
const KNOWN_LEAKED_SECRET = "estate-transit-production-jwt-secret-key-2026";
const jwtSecret = process.env.JWT_SECRET || "";
if (!jwtSecret || jwtSecret === KNOWN_LEAKED_SECRET) {
  throw new Error("JWT_SECRET must be set to a private random value (the old default is public).");
}

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
  // Deployed = running on Vercel or NODE_ENV=production. Used to fail closed.
  isDeployed: Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production",
  // Shared demo account (demo@stayride.in). Off in deployments unless DEMO_ENABLED=true.
  demoEnabled:
    process.env.DEMO_ENABLED !== undefined
      ? process.env.DEMO_ENABLED === "true"
      : !(Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production"),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "",
  clerkSecretKey: process.env.CLERK_SECRET_KEY || "",
  clerkWebhookSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET || "",
  // Public site that hosts the guest cab-request page (client-side app)
  guestWebUrl: (process.env.GUEST_WEB_URL || "https://stayride.in").replace(/\/+$/, ""),
};
