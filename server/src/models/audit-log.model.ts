import mongoose, { Schema } from "mongoose";

// Append-only record of every admin / money action.
const AuditLogSchema = new Schema(
  {
    actor: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: "" },
    targetId: { type: String, default: "", index: true },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export function getAuditLogModel(isDemo = false): mongoose.Model<any> {
  const conn = mongoose.connection.useDb(isDemo ? "test" : "production", { useCache: true });
  return (conn.models.AuditLog || conn.model("AuditLog", AuditLogSchema)) as mongoose.Model<any>;
}

export async function audit(actor: string, action: string, targetType: string, targetId: string, details: any = {}, isDemo = false) {
  await getAuditLogModel(isDemo).create({ actor, action, targetType, targetId, details });
}
