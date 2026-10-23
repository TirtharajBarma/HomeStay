import dotenv from "dotenv";

dotenv.config();

// The old in-code fallback was public, so a missing or default secret is fatal.
const KNOWN_LEAKED_SECRET = "estate-transit-production-jwt-secret-key-2026";
const jwtSecret = process.env.JWT_SECRET || "";
if (!jwtSecret || jwtSecret === KNOWN_LEAKED_SECRET) {
  throw new Error("JWT_SECRET must be set to a private random value (the old default is public).");
}

// Deployed = running on Vercel. Everything that must fail closed keys off this.
const onVercel = Boolean(process.env.VERCEL);
const isPreview = onVercel && process.env.VERCEL_ENV === "preview";
const guestWebUrl = (process.env.GUEST_WEB_URL || "https://stayride.in").replace(/\/+$/, "");
const originOf = (u: string) => {
  try {
    return new URL(u).origin;
  } catch {
    return "";
  }
};

export const config = {
  port: parseInt(process.env.PORT || "5050", 10),
  mongoUri: process.env.MONGODB_URI || "",
  // Browser origins allowed by CORS (plus localhost when not deployed). The guest web page is always allowed.
  corsOrigins: [...(process.env.CORS_ORIGIN || "").split(","), originOf(guestWebUrl)].map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean),
  nodeEnv: process.env.NODE_ENV || "development",
  isDeployed: onVercel,
  isPreview,
  // Shared demo account (demo@stayride.in). Off on Vercel unless DEMO_ENABLED=true.
  demoEnabled: process.env.DEMO_ENABLED !== undefined ? process.env.DEMO_ENABLED === "true" : !onVercel,
  // Guest website API (stays catalog, properties, reservations). Enabled by default unless explicitly disabled.
  legacyApiEnabled: process.env.LEGACY_API_ENABLED !== "false",
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "",
  clerkSecretKey: process.env.CLERK_SECRET_KEY || "",
  clerkWebhookSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET || "",
  // Public site that hosts the guest cab-request page (client-side app)
  guestWebUrl,
};

// ---------------------------------------------------------------------------
// Database names. Demo data always lives in "test"; everything else in the live database, resolved
// ONLY here. Preview deployments never default to "production"; local runs refuse "production"
// unless ALLOW_LOCAL_PRODUCTION_DB=true (an in-memory dev server is exempt: it holds no real data).
// ---------------------------------------------------------------------------
const LIVE_DB = isPreview ? process.env.MONGODB_DATABASE_PREVIEW || "preview" : process.env.MONGODB_DATABASE || "production";
let inMemoryDb = false;
export const markInMemoryDb = () => {
  inMemoryDb = true;
};

export function liveDbName(): string {
  const fail = (message: string) => {
    throw Object.assign(new Error(message), { status: 503, code: "DB_MISCONFIGURED" });
  };
  if (LIVE_DB === "test") fail('The live database cannot be "test" (reserved for demo data).');
  if (isPreview && LIVE_DB === "production") fail("Preview deployments must not use the production database (set MONGODB_DATABASE_PREVIEW).");
  if (!onVercel && LIVE_DB === "production" && !inMemoryDb && process.env.ALLOW_LOCAL_PRODUCTION_DB !== "true") {
    fail('Refusing to use the "production" database outside Vercel. Set MONGODB_DATABASE to a dev database, or ALLOW_LOCAL_PRODUCTION_DB=true if you really mean it.');
  }
  return LIVE_DB;
}

export const dbNameFor = (isDemo: boolean) => (isDemo ? "test" : liveDbName());
