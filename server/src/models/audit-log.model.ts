import mongoose, { Schema } from "mongoose";
import { dbNameFor } from "../config/env.js";

export interface AuditLogDocument {
  actor: string;
  actorRole?: string;
  actorName?: string;
  ip?: string;
  action: string;
  targetType: string;
  targetId: string;
  tenantId?: string;
  driverId?: string;
  details: Record<string, any>;
  createdAt: Date;
}

export interface AuditContext {
  tenantId?: string;
  driverId?: string;
  actorRole?: "ADMIN" | "OWNER" | "DRIVER" | "CUSTOMER" | "SYSTEM" | string;
  actorName?: string;
  ip?: string;
}

// Append-only record of every admin, owner, driver, and money action.
const AuditLogSchema = new Schema(
  {
    actor: { type: String, required: true, index: true },
    actorRole: { type: String, default: "", index: true },
    actorName: { type: String, default: "" },
    ip: { type: String, default: "" },
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: "" },
    targetId: { type: String, default: "", index: true },
    tenantId: { type: String, default: "", index: true }, // Isolates individual homestay owner's logs
    driverId: { type: String, default: "", index: true }, // Isolates individual cab driver's logs
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// No TTL: this holds payment, refund, payout and settlement history and must not expire.
// Filtering indexes for the admin / owner audit views:
AuditLogSchema.index({ tenantId: 1, createdAt: -1 });
AuditLogSchema.index({ driverId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ actorRole: 1, createdAt: -1 });

export function getAuditLogModel(isDemo = false): mongoose.Model<any> {
  const conn = mongoose.connection.useDb(dbNameFor(isDemo), { useCache: true });
  return (conn.models.AuditLog || conn.model("AuditLog", AuditLogSchema)) as mongoose.Model<any>;
}

/** Sanitize audit payload so huge binary/base64 strings and credentials are never stored. */
function cleanAuditDetails(obj: any, depth = 0): any {
  if (!obj || typeof obj !== "object" || depth > 4) return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map((x) => cleanAuditDetails(x, depth + 1));
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = k.toLowerCase();
    if (keyLower.includes("password") || keyLower.includes("secret") || keyLower.includes("token")) {
      clean[k] = "[REDACTED]";
      continue;
    }
    if (k === "photos" && Array.isArray(v)) {
      clean[k] = `${v.length} photo(s)`;
      continue;
    }
    if (typeof v === "string") {
      if (v.startsWith("data:image/") || v.length > 500) {
        clean[k] = v.startsWith("data:image/") ? "[IMAGE DATA]" : v.slice(0, 500) + "...";
      } else {
        clean[k] = v;
      }
    } else if (typeof v === "object" && v !== null) {
      clean[k] = cleanAuditDetails(v, depth + 1);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Record an audit log event.
 * Fully backward-compatible with legacy `(actor, action, targetType, targetId, details, isDemo)`
 * plus supports extra context (`context: AuditContext`) for tenant/driver isolation.
 * Non-blocking: Logging will NEVER fail or crash the active business transaction.
 */
export async function audit(
  actor: string,
  action: string,
  targetType: string,
  targetId: string,
  details: any = {},
  isDemo = false,
  context?: AuditContext
) {
  try {
    // Infer tenant/driver/role if not explicitly passed in context
    const tenantId = context?.tenantId || details?.tenantId || details?.tenantKey || "";
    const driverId = context?.driverId || details?.driverId || details?.driverUserId || "";
    // Actor formats: admin "Name (email)" or "admin:…", owner plain email or "owner:…", driver "driver:…",
    // automated "system" / "razorpay". details.role is the TARGET's role, never the actor's.
    const actorRole =
      context?.actorRole ||
      (actor.startsWith("admin:") || /\(\S+@\S+\)$/.test(actor)
        ? "ADMIN"
        : actor.startsWith("driver:")
        ? "DRIVER"
        : actor.startsWith("owner:") || /^\S+@\S+$/.test(actor)
        ? "OWNER"
        : actor === "system" || actor === "razorpay"
        ? "SYSTEM"
        : "");
    const ip = context?.ip || details?.ip || "";
    const actorName = context?.actorName || details?.actorName || "";

    const safeDetails = cleanAuditDetails(details);

    await getAuditLogModel(isDemo).create({
      actor,
      actorRole,
      actorName,
      ip,
      action,
      targetType,
      targetId: String(targetId || ""),
      tenantId: String(tenantId || ""),
      driverId: String(driverId || ""),
      details: safeDetails,
    });
  } catch (err) {
    // Non-blocking: log the error to console without breaking user response
    console.error("[AuditLog Error]", err);
  }
}
