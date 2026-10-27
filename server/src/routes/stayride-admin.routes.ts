// StayRide platform administration. Mounted under /api/v1/admin (and /v1/admin) behind
// verifyToken + requireRole("admin"). Every write is audited.
import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { CommissionService, validateRates } from "../services/commission.service.js";
import { getTenantControlModel, FEATURE_KEYS } from "../models/tenant-control.model.js";
import { getFeatureAppealModel } from "../models/feature-appeal.model.js";
import { getAuditLogModel, audit } from "../models/audit-log.model.js";
import { getStayRideTenantModel, tenantManager, normKey, isDemoKey, clean, FIELDS, TENANT_COLLECTIONS, TenantCollection } from "../stayride/store.js";
import {
  OPEN_STATUSES, cabModel, payoutModel, userModel, parseFare, cancelRequest, startTrip, completeTrip,
  adminAssignDriver, adminRecordPayment, adminVoidPayment, adminMarkRefunded, adminSettleDriver,
  settlePayout, rejectPayout, expireStaleRequests, overlayTrips, onDriverStatusChange, releaseDriverTrips, adminRefundUnmatched,
} from "../stayride/platform.js";
import { httpError } from "../middlewares/error-handler.js";
import { config } from "../config/env.js";

const router = Router();

const isDemo = (req: Request) => req.query.demo === "true" || req.body?.demo === true;
const actor = (req: Request) => {
  const u = (req as any).user;
  if (!u) return "Admin";
  // Always "Name (email)": audit() recognises this shape as an admin actor
  if (u.email) return `${u.name || "Admin"} (${u.email})`;
  return `admin:${u.name || u.id || "unknown"}`;
};
const ok = (res: Response, data: any, message?: string) => res.json({ success: true, ...(message ? { message } : {}), data });
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const search = (req: Request) => String(req.query.q ?? req.query.search ?? "").trim().slice(0, 100);

// A1 pagination: ?page=1&limit=50 (limit max 100) -> { success, items, total, page, limit }.
function paging(req: Request) {
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit)) || 50));
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
  return { page, limit, skip: (page - 1) * limit };
}
async function sendPage(req: Request, res: Response, Model: mongoose.Model<any>, filter: any, sort: any, select?: string, map: (d: any) => any = (d) => d) {
  const { page, limit, skip } = paging(req);
  let query = Model.find(filter).sort(sort).skip(skip).limit(limit);
  if (select) query = query.select(select);
  const [docs, total] = await Promise.all([query.lean(), Model.countDocuments(filter)]);
  res.json({ success: true, items: docs.map(map), total, page, limit });
}

const ratingOf = (u: any) => (u.ratingCount ? Math.round((u.ratingSum / u.ratingCount) * 10) / 10 : null);
const USER_FIELDS = "name email phone role accountStatus statusReason vehicle driverCategory unionName createdAt deletedAt ratingSum ratingCount";
const userItem = (demo: boolean) => (u: any) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  phone: u.phone || "",
  role: u.role,
  accountStatus: u.accountStatus || (u.role === "driver" ? "PENDING_APPROVAL" : "ACTIVE"),
  statusReason: u.statusReason || "",
  tenantKey: u.email,
  isDemo: demo,
  createdAt: u.createdAt,
  deletedAt: u.deletedAt ?? null,
  ...(u.role === "driver"
    ? {
        rating: ratingOf(u),
        ratingCount: u.ratingCount || 0,
        vehicle: u.vehicle || null,
        driverCategory: u.driverCategory || "INDIVIDUAL",
        unionName: u.unionName || "",
      }
    : {}),
});


// ---------------------------------------------------------------------------
// Platform settings: commission rates, minimum advance, global feature switches
// ---------------------------------------------------------------------------
router.get("/commission/settings", async (req, res) => {
  const settings = await CommissionService.getSettings(isDemo(req));
  ok(res, { ...settings.toObject(), features: CommissionService.globalFeatures(settings), platform: CommissionService.platformConfig(settings), isDemo: isDemo(req) });
});

router.put("/commission/settings", async (req, res) => {
  try {
    const { before, after } = await CommissionService.updateSettings({ ...req.body, updatedBy: actor(req), isDemo: isDemo(req) });
    await audit(actor(req), "settings.update", "PlatformSettings", String(after._id), {
      before: { pf: before.globalPlatformFeePercent, hc: before.globalHomestayCommissionPercent, adv: before.defaultAdvancePercent, min: before.minAdvanceAmount, features: before.features, platform: before.platform },
      after: { pf: after.globalPlatformFeePercent, hc: after.globalHomestayCommissionPercent, adv: after.defaultAdvancePercent, min: after.minAdvanceAmount, features: after.features, platform: after.platform },
      reason: req.body.changeReason || "",
    }, isDemo(req));
    ok(res, { ...after.toObject(), features: CommissionService.globalFeatures(after), platform: CommissionService.platformConfig(after) }, "Platform settings updated.");
  } catch (err: any) {
    throw err?.status ? err : httpError(400, err?.message || "Invalid settings");
  }
});

router.post("/commission/preview", async (req, res) => {
  const cfg = await CommissionService.getPlatformConfig(isDemo(req));
  const fare = parseFare(req.body.fare, cfg.maxFare);
  ok(res, await CommissionService.calculateSplit(fare, req.body.tenantKey || req.body.propertyId, isDemo(req)));
});

// ---------------------------------------------------------------------------
// Homestays (StayRide tenants): list, block/unblock, feature overrides, commission override
// ---------------------------------------------------------------------------
router.get("/stayride/tenants", async (req, res) => {
  const demo = isDemo(req);
  const q = search(req);
  const filter = q ? { $or: [{ tenantId: new RegExp(escapeRegex(q), "i") }, { homestayName: new RegExp(escapeRegex(q), "i") }] } : {};
  const { page, limit, skip } = paging(req);
  const Tenant = getStayRideTenantModel(demo);
  const [tenants, total, settings] = await Promise.all([
    Tenant.find(filter).select("tenantId homestayName ownerName email phone location createdAt lastActiveAt").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Tenant.countDocuments(filter),
    CommissionService.getSettings(demo),
  ]);
  const keys = tenants.map((t: any) => t.tenantId);
  // Batched: one query for controls, one aggregation for stats, settings once (no per-row queries).
  const [controls, stats] = await Promise.all([
    getTenantControlModel(demo).find({ tenantKey: { $in: keys } }).lean(),
    cabModel(demo).aggregate([
      { $match: { propertyId: { $in: keys } } },
      {
        $group: {
          _id: "$propertyId",
          requests: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
          gmv: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$agreedFare", 0] } },
        },
      },
    ]),
  ]);
  const controlBy = new Map(controls.map((c: any) => [c.tenantKey, c]));
  const statsBy = new Map(stats.map((s: any) => [s._id, s]));
  const items = tenants.map((t: any) => {
    const c: any = controlBy.get(t.tenantId);
    const state = CommissionService.accountStateFrom(settings, c);
    const st: any = statsBy.get(t.tenantId);
    return {
      tenantKey: t.tenantId,
      homestayName: t.homestayName,
      ownerName: t.ownerName,
      email: t.email,
      phone: t.phone,
      location: t.location,
      createdAt: t.createdAt,
      lastActiveAt: t.lastActiveAt,
      blocked: state.blocked,
      blockReason: state.blockReason,
      effectiveFeatures: state.features,
      featureOverrides: c?.features || {},
      commissionOverride: c?.commissionOverride || null,
      stats: st ? { requests: st.requests, completed: st.completed, gmv: st.gmv } : { requests: 0, completed: 0, gmv: 0 },
    };
  });
  res.json({ success: true, items, total, page, limit });
});

router.put("/stayride/tenants/:tenantKey/controls", async (req, res) => {
  const demo = isDemo(req);
  const tenantKey = String(req.params.tenantKey).toLowerCase();
  if (!(await getStayRideTenantModel(demo).exists({ tenantId: tenantKey }))) throw httpError(404, "Homestay not found.");
  const set: any = { updatedBy: actor(req) };
  if (req.body.blocked !== undefined) {
    set.blocked = req.body.blocked === true;
    set.blockReason = set.blocked ? String(req.body.blockReason || "").slice(0, 300) : "";
  }
  if (req.body.features) {
    for (const key of FEATURE_KEYS) {
      const v = req.body.features[key];
      if (v === true || v === false || v === null) set[`features.${key}`] = v;
    }
  }
  if (req.body.commissionOverride !== undefined) {
    const o = req.body.commissionOverride;
    if (o === null) set.commissionOverride = null;
    else {
      const pf = Number(o.pfPercent), hc = Number(o.hcPercent), adv = Number(o.advancePercent);
      validateRates(pf, hc, adv);
      set.commissionOverride = { pfPercent: pf, hcPercent: hc, advancePercent: adv };
    }
  }
  const before = await getTenantControlModel(demo).findOne({ tenantKey }).lean();
  const after = await getTenantControlModel(demo).findOneAndUpdate({ tenantKey }, { $set: set }, { upsert: true, returnDocument: "after" }).lean();
  await audit(actor(req), "tenant.controls", "Tenant", tenantKey, { before, after: set }, demo, { tenantId: tenantKey });
  ok(res, { ...after, effective: await CommissionService.getAccountState(tenantKey, demo) }, "Homestay controls updated.");
});

// ---------------------------------------------------------------------------
// Platform users: list, role management (guest/owner/driver/admin), account status
// ---------------------------------------------------------------------------
router.get("/stayride/users", async (req, res) => {
  const demo = isDemo(req);
  const filter: any = {};
  if (["guest", "owner", "driver", "admin"].includes(String(req.query.role))) filter.role = req.query.role;
  if (["ACTIVE", "PENDING_APPROVAL", "BLOCKED"].includes(String(req.query.status))) filter.accountStatus = req.query.status;
  const q = search(req);
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }
  await sendPage(req, res, userModel(demo), filter, { createdAt: -1 }, USER_FIELDS, userItem(demo));
});

async function loadTargetUser(req: Request, demo: boolean) {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw httpError(404, "User not found.");
  const user: any = await userModel(demo).findById(id).select(USER_FIELDS).lean();
  if (!user) throw httpError(404, "User not found.");
  return user;
}

/** An admin can't lock itself out, and the last active admin can't be blocked, demoted or deleted. */
async function protectAdmins(req: Request, demo: boolean, target: any, what: string) {
  if (String(target._id) === String((req as any).user?.id)) throw httpError(409, `You cannot ${what} your own account.`, "SELF_ACTION");
  if (target.role === "admin" && target.accountStatus === "ACTIVE") {
    // ponytail: count-then-write; two admins removing each other at the same instant could both pass
    const others = await userModel(demo).countDocuments({ role: "admin", accountStatus: "ACTIVE", _id: { $ne: target._id } });
    if (others === 0) throw httpError(409, "At least one active admin must remain.", "LAST_ADMIN");
  }
}

router.patch("/stayride/users/:id/status", async (req, res) => {
  const demo = isDemo(req);
  const status = String(req.body.status);
  if (!["ACTIVE", "PENDING_APPROVAL", "BLOCKED"].includes(status)) {
    throw httpError(400, "Status must be ACTIVE, PENDING_APPROVAL or BLOCKED.");
  }
  const target = await loadTargetUser(req, demo);
  if (target.deletedAt && status !== "BLOCKED") throw httpError(409, "This account was deleted and cannot be re-activated.", "ACCOUNT_DELETED");
  if (status !== "ACTIVE") await protectAdmins(req, demo, target, "block");
  const reason = String(req.body.reason || "").slice(0, 300);
  const updated = await userModel(demo).findByIdAndUpdate(target._id, { $set: { accountStatus: status, statusReason: reason } }, { returnDocument: "after" })
    .select(USER_FIELDS).lean();
  if (!updated) throw httpError(404, "User not found.");
  await audit(actor(req), "user.status", "User", String(target._id), { targetName: target.name, targetEmail: target.email, role: target.role, before: target.accountStatus || "ACTIVE", status, reason }, demo);
  // D6: blocking releases the driver's not-yet-started trips; approve/block also notify the driver.
  if (target.role === "driver" && status !== target.accountStatus) await onDriverStatusChange(demo, String(target._id), status, actor(req));
  ok(res, userItem(demo)(updated), `User account ${status === "ACTIVE" ? "activated" : status === "BLOCKED" ? "blocked" : "set to pending"}.`);
});

router.patch("/stayride/users/:id/role", async (req, res) => {
  const demo = isDemo(req);
  const role = String(req.body.role);
  if (!["guest", "owner", "driver", "admin"].includes(role)) throw httpError(400, "Role must be guest, owner, driver, or admin.");
  const target = await loadTargetUser(req, demo);
  if (target.deletedAt) throw httpError(409, "This account was deleted; its role cannot be changed.", "ACCOUNT_DELETED");
  if (role !== "admin") await protectAdmins(req, demo, target, "demote");
  // Tokens carry the role, so a role change ends every existing session.
  // Becoming a driver needs admin approval (vehicle, documents) like a driver signup
  const set: any = { role };
  if (role === "driver" && target.role !== "driver") Object.assign(set, { accountStatus: "PENDING_APPROVAL", statusReason: "Role changed to driver; awaiting approval." });
  const updated = await userModel(demo).findByIdAndUpdate(target._id, { $set: set, $inc: { tokenVersion: 1 } }, { returnDocument: "after" })
    .select(USER_FIELDS).lean();
  if (!updated) throw httpError(404, "User not found.");
  await audit(actor(req), "user.role_change", "User", String(target._id), {
    targetName: target.name,
    targetEmail: target.email,
    before: target.role,
    after: role,
    role,
    reason: String(req.body.reason || "").slice(0, 300),
  }, demo, { actorRole: "ADMIN" });
  // No longer a driver: their not-started trips go back to StayRide (same as blocking)
  if (target.role === "driver" && role !== "driver") await releaseDriverTrips(demo, String(target._id), actor(req));
  ok(res, userItem(demo)(updated), `User role updated from ${target.role} to ${role}.`);
});

router.post("/stayride/users/:id/revoke-sessions", async (req, res) => {
  const demo = isDemo(req);
  const target = await loadTargetUser(req, demo);
  await userModel(demo).updateOne({ _id: target._id }, { $inc: { tokenVersion: 1 } });
  await audit(actor(req), "user.revoke_sessions", "User", String(target._id), { targetName: target.name, targetEmail: target.email, reason: String(req.body?.reason || "").slice(0, 300) }, demo, { actorRole: "ADMIN" });
  ok(res, userItem(demo)(target), "All sessions revoked.");
});

// Soft delete: the account is blocked and marked deleted; its money history stays.
router.delete("/stayride/users/:id", async (req, res) => {
  const demo = isDemo(req);
  const target = await loadTargetUser(req, demo);
  await protectAdmins(req, demo, target, "delete");
  const updated = await userModel(demo).findByIdAndUpdate(
    target._id,
    { $set: { accountStatus: "BLOCKED", statusReason: String(req.body?.reason || "Deleted by platform admin").slice(0, 300), deletedAt: target.deletedAt || new Date() }, $inc: { tokenVersion: 1 } },
    { returnDocument: "after" }
  ).select(USER_FIELDS).lean();
  if (!updated) throw httpError(404, "User not found.");
  await audit(actor(req), "user.delete", "User", String(target._id), { targetName: target.name, targetEmail: target.email, email: target.email, role: target.role, reason: String(req.body?.reason || "").slice(0, 300) }, demo, { actorRole: "ADMIN" });
  if (target.role === "driver" && target.accountStatus !== "BLOCKED") await onDriverStatusChange(demo, String(target._id), "BLOCKED", actor(req));
  ok(res, userItem(demo)(updated), "User deleted.");
});

// ---------------------------------------------------------------------------
// Platform drivers: approve / block
// ---------------------------------------------------------------------------
router.get("/stayride/drivers", async (req, res) => {
  const demo = isDemo(req);
  const filter: any = { role: "driver" };
  if (["ACTIVE", "PENDING_APPROVAL", "BLOCKED"].includes(String(req.query.status))) filter.accountStatus = req.query.status;
  const q = search(req);
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }, { "vehicle.plate": regex }];
  }
  await sendPage(req, res, userModel(demo), filter, { createdAt: -1 }, "name email phone accountStatus statusReason vehicle createdAt deletedAt ratingSum ratingCount isAvailable",
    ({ ratingSum, ...d }: any) => ({ ...d, id: String(d._id), rating: ratingOf({ ratingSum, ratingCount: d.ratingCount }), ratingCount: d.ratingCount || 0 }));
});

router.patch("/stayride/drivers/:id/status", async (req, res) => {
  const status = String(req.body.status);
  if (!["ACTIVE", "PENDING_APPROVAL", "BLOCKED"].includes(status)) throw httpError(400, "Status must be ACTIVE, PENDING_APPROVAL or BLOCKED.");
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "Driver not found.");
  // A deleted driver can only stay blocked (the filter refuses anything else)
  const prev = await userModel(isDemo(req)).findOneAndUpdate(
    { _id: String(req.params.id), role: "driver", ...(status === "BLOCKED" ? {} : { deletedAt: null }) },
    { $set: { accountStatus: status, statusReason: String(req.body.reason || "").slice(0, 300) } },
    { returnDocument: "before" }
  ).select("name email phone accountStatus statusReason vehicle").lean();
  if (!prev) throw httpError(404, "Driver not found, or the account was deleted and cannot be re-activated.");
  const auditReason = String(req.body.reason || "").trim() || (status === "ACTIVE" ? "Admin approved driver onboarding" : status === "BLOCKED" ? "Blocked by admin" : "Set to pending approval");
  await audit(actor(req), "driver.status", "User", String(req.params.id), {
    targetName: prev.name,
    targetEmail: prev.email,
    before: prev.accountStatus || "PENDING_APPROVAL",
    status,
    reason: auditReason,
  }, isDemo(req), { actorRole: "ADMIN", driverId: String(req.params.id) });
  // Release trips / push only on a real change, so re-saving the same status doesn't re-notify
  if (prev.accountStatus !== status) await onDriverStatusChange(isDemo(req), String(req.params.id), status, actor(req));
  const updated = { ...prev, accountStatus: status, statusReason: String(req.body.reason || "").slice(0, 300) };
  ok(res, { ...updated, id: String(updated._id) }, `Driver ${status === "ACTIVE" ? "approved" : status === "BLOCKED" ? "blocked" : "set to pending"}.`);
});

router.post("/stayride/drivers", async (req, res) => {
  const demo = isDemo(req);
  const name = String(req.body?.name || "").trim();
  const phone = String(req.body?.phone || "").trim();
  if (!name) throw httpError(400, "Driver name is required.");
  if (!phone || phone.replace(/[^0-9]/g, "").length < 10) throw httpError(400, "Valid 10-digit driver phone is required.");

  const cleanPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/[^0-9]/g, "").slice(-10)}`;
  const driverDomain = process.env.DRIVER_EMAIL_DOMAIN || `driver.${config.appDomain || 'local'}`;
  const cleanEmail = String(req.body?.email || "").trim().toLowerCase() || `driver.${cleanPhone.replace(/[^0-9]/g, "")}@${driverDomain}`;
  const vehicleType = String(req.body?.vehicleType || "SUV");
  const model = String(req.body?.model || "").trim();
  const plate = String(req.body?.plate || "").trim();
  const seats = Number(req.body?.seats) || 4;
  const area = String(req.body?.area || "").trim();

  const User = userModel(demo);
  let existing = await User.findOne({ $or: [{ phone: cleanPhone }, { email: cleanEmail }] });
  if (existing) {
    if (existing.role !== "driver") throw httpError(409, "A user with this phone or email already exists with another role.");
    existing.name = name;
    existing.accountStatus = "ACTIVE";
    existing.vehicle = { type: vehicleType, model, plate, seats, area };
    await existing.save();
    await audit(actor(req), "driver.update", "User", String(existing._id), { targetName: name, targetPhone: cleanPhone, vehicle: existing.vehicle }, demo, { actorRole: "ADMIN", driverId: String(existing._id) });
    return ok(res, { id: String(existing._id), name: existing.name, phone: existing.phone, vehicle: existing.vehicle, accountStatus: existing.accountStatus }, "Driver updated and active.");
  }

  const created = await User.create({
    name,
    email: cleanEmail,
    password: crypto.randomBytes(16).toString("hex"),
    phone: cleanPhone,
    role: "driver",
    accountStatus: "ACTIVE",
    isAvailable: true,
    whatsappAlerts: true,
    vehicle: { type: vehicleType, model, plate, seats, area },
  });

  await audit(actor(req), "driver.create", "User", String(created._id), { targetName: name, targetPhone: cleanPhone, vehicle: created.vehicle }, demo, { actorRole: "ADMIN", driverId: String(created._id) });
  return ok(res, { id: String(created._id), name: created.name, phone: created.phone, vehicle: created.vehicle, accountStatus: created.accountStatus }, "Driver registered and active.");
});

// ---------------------------------------------------------------------------
// Cab requests (Workflow B queue + full history)
// ---------------------------------------------------------------------------
router.get("/cab-requests/pending", async (req, res) => {
  const demo = isDemo(req);
  await expireStaleRequests(demo);
  // Needs admin action: open / awaiting payment, plus paid trips whose driver was removed (D6).
  const filter: any = { $or: [{ status: { $in: [...OPEN_STATUSES, "AWAITING_ADVANCE_PAYMENT"] } }, { status: "CONFIRMED", needsReassignment: true }] };
  if (req.query.tenantKey) filter.propertyId = String(req.query.tenantKey);
  if (req.query.needsReassignment === "true") filter.needsReassignment = true;
  const q = search(req);
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    filter.$and = [{ $or: [{ reference: regex }, { homestayName: regex }, { guestName: regex }] }];
  }
  await sendPage(req, res, cabModel(demo), filter, { createdAt: -1 });
});

router.get("/cab-requests", async (req, res) => {
  const demo = isDemo(req);
  await expireStaleRequests(demo);
  const filter: any = {};
  if (req.query.status) filter.status = String(req.query.status);
  if (req.query.tenantKey) filter.propertyId = String(req.query.tenantKey);
  if (req.query.refundStatus) filter.refundStatus = String(req.query.refundStatus);
  if (req.query.driverSettlementStatus) filter.driverSettlementStatus = String(req.query.driverSettlementStatus);
  if (req.query.needsReassignment === "true") filter.needsReassignment = true;
  if (req.query.unmatched === "true") filter.unmatchedPayments = { $elemMatch: { refundedAt: null } };
  const q = search(req);
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ reference: regex }, { homestayName: regex }, { guestName: regex }, { assignedDriverName: regex }];
  }
  await sendPage(req, res, cabModel(demo), filter, { createdAt: -1 });
});

const cabAction = (fn: (demo: boolean, id: string, req: Request) => Promise<any>, message: string) => async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "Cab request not found.");
  ok(res, await fn(isDemo(req), String(req.params.id), req), message);
};

router.post("/cab-requests/:id/assign-driver", cabAction((d, id, req) => adminAssignDriver(d, id, req.body, actor(req)), "Driver assigned and fare locked."));
router.post("/cab-requests/:id/record-payment", cabAction((d, id, req) => adminRecordPayment(d, id, req.body, actor(req)), "Advance payment recorded."));
router.post("/cab-requests/:id/void-payment", cabAction((d, id, req) => adminVoidPayment(d, id, req.body.reason, actor(req)), "Payment voided."));
router.post("/cab-requests/:id/cancel", cabAction((d, id, req) => cancelRequest({ _id: id }, d, actor(req), String(req.body.reason || "Cancelled by platform admin"), true), "Request cancelled."));
router.post("/cab-requests/:id/refund", cabAction((d, id, req) => adminMarkRefunded(d, id, req.body.reference, actor(req)), "Refund recorded."));
router.post("/cab-requests/:id/start", cabAction((d, id, req) => startTrip(d, { _id: id }, actor(req), undefined, false), "Trip started."));
router.post("/cab-requests/:id/complete", cabAction((d, id, req) => completeTrip(d, { _id: id }, actor(req)), "Trip completed."));
router.post("/cab-requests/:id/unmatched-refunded", cabAction((d, id, req) => adminRefundUnmatched(d, id, req.body.paymentId, req.body.reference, actor(req)), "Unmatched payment marked refunded."));
router.post("/cab-requests/:id/driver-settled", cabAction((d, id, req) => adminSettleDriver(d, id, req.body.reference, actor(req)), "Driver settlement recorded."));

// ---------------------------------------------------------------------------
// Homestay & Driver payouts
// ---------------------------------------------------------------------------
router.get("/host-payouts", async (req, res) => {
  const filter: any = { recipientType: { $ne: "DRIVER" } };
  if (["PENDING", "SETTLED", "REJECTED"].includes(String(req.query.status))) filter.status = req.query.status;
  if (req.query.tenantKey) filter.tenantId = String(req.query.tenantKey);
  await sendPage(req, res, payoutModel(isDemo(req)), filter, { requestedAt: -1 });
});

router.get("/driver-payouts", async (req, res) => {
  const filter: any = { recipientType: "DRIVER" };
  if (["PENDING", "SETTLED", "REJECTED"].includes(String(req.query.status))) filter.status = req.query.status;
  if (req.query.driverId) filter.driverId = String(req.query.driverId);
  await sendPage(req, res, payoutModel(isDemo(req)), filter, { requestedAt: -1 });
});

router.post("/host-payouts/:id/settle", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "Payout not found.");
  const payout: any = await settlePayout(isDemo(req), String(req.params.id), req.body.utrNumber, req.body.notes, actor(req));
  res.json({ success: true, message: `Payout of ₹${payout.amount} settled with UTR ${payout.utrNumber}.`, payout });
});

router.post("/driver-payouts/:id/settle", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "Payout not found.");
  const payout: any = await settlePayout(isDemo(req), String(req.params.id), req.body.utrNumber, req.body.notes, actor(req));
  res.json({ success: true, message: `Driver payout of ₹${payout.amount} settled with UTR ${payout.utrNumber}.`, payout });
});

router.post("/host-payouts/:id/reject", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "Payout not found.");
  const payout = await rejectPayout(isDemo(req), String(req.params.id), req.body.reason, actor(req));
  res.json({ success: true, message: "Payout rejected; its trips can be requested again.", payout });
});

router.post("/driver-payouts/:id/reject", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "Payout not found.");
  const payout = await rejectPayout(isDemo(req), String(req.params.id), req.body.reason, actor(req));
  res.json({ success: true, message: "Driver payout rejected; wallet balance restored.", payout });
});

// ---------------------------------------------------------------------------
// Feature appeals → grant per-homestay feature
// ---------------------------------------------------------------------------
router.get("/appeals", async (req, res) => {
  const filter: any = {};
  if (["PENDING", "APPROVED", "REJECTED"].includes(String(req.query.status))) filter.status = req.query.status;
  if (req.query.tenantKey) filter.propertyId = String(req.query.tenantKey);
  await sendPage(req, res, getFeatureAppealModel(isDemo(req)), filter, { createdAt: -1 });
});

router.post("/appeals/:id/decide", async (req, res) => {
  const demo = isDemo(req);
  const status = String(req.body.status);
  if (!["APPROVED", "REJECTED"].includes(status)) throw httpError(400, "Status must be APPROVED or REJECTED.");
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "Appeal not found.");
  const appeal: any = await getFeatureAppealModel(demo).findOneAndUpdate(
    { _id: String(req.params.id), status: "PENDING" },
    { $set: { status, decisionNote: String(req.body.decisionNote || "").slice(0, 500), decidedBy: actor(req), decidedAt: new Date() } },
    { returnDocument: "after" }
  ).lean();
  if (!appeal) throw httpError(409, "Appeal not found or already decided.");
  if (status === "APPROVED" && (FEATURE_KEYS as readonly string[]).includes(appeal.featureKey)) {
    await getTenantControlModel(demo).updateOne(
      { tenantKey: String(appeal.propertyId) },
      { $set: { [`features.${appeal.featureKey}`]: true, updatedBy: actor(req) } },
      { upsert: true }
    );
  }
  await audit(actor(req), "appeal.decide", "FeatureAppeal", String(req.params.id), { status, featureKey: appeal.featureKey, tenantKey: appeal.propertyId }, demo);
  // A per-homestay grant can't beat the global switch: say so instead of looking like it worked
  const globalOff = status === "APPROVED" && (FEATURE_KEYS as readonly string[]).includes(appeal.featureKey)
    && !(CommissionService.globalFeatures(await CommissionService.getSettings(demo)) as any)[appeal.featureKey]?.enabled;
  res.json({
    success: true,
    message: globalOff
      ? `Appeal approved, but ${appeal.featureKey} is switched OFF globally in Platform settings, so the homestay still can't use it until you enable it there.`
      : `Appeal ${status.toLowerCase()}.`,
    data: appeal,
  });
});

// ---------------------------------------------------------------------------
// Money summary + audit log
// ---------------------------------------------------------------------------
router.get("/stayride/summary", async (req, res) => {
  const demo = isDemo(req);
  const [cab] = await cabModel(demo).aggregate([
    {
      $group: {
        _id: null,
        open: { $sum: { $cond: [{ $in: ["$status", OPEN_STATUSES] }, 1, 0] } },
        awaitingPayment: { $sum: { $cond: [{ $eq: ["$status", "AWAITING_ADVANCE_PAYMENT"] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
        gmv: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$agreedFare", 0] } },
        // Cancelled paid advances are owed back (see refundsPending / refunded), not money kept
        advanceCollected: { $sum: { $cond: [{ $and: ["$advancePaid", { $ne: ["$status", "CANCELLED"] }] }, "$advanceAmount", 0] } },
        platformFee: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "COMPLETED"] }, "$advancePaid"] }, "$financialSnapshot.platformFeeAmount", 0] } },
        homestayCommission: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "COMPLETED"] }, "$advancePaid"] }, "$financialSnapshot.homestayCommissionAmount", 0] } },
        refundsPending: { $sum: { $cond: [{ $eq: ["$refundStatus", "PENDING"] }, "$advanceAmount", 0] } },
        driverDuesPending: {
          $sum: {
            $cond: [
              { $eq: ["$driverSettlementStatus", "PENDING"] },
              { $subtract: ["$financialSnapshot.advanceAmount", { $add: ["$financialSnapshot.platformFeeAmount", "$financialSnapshot.homestayCommissionAmount"] }] },
              0,
            ],
          },
        },
      },
    },
  ]);
  const payouts = await payoutModel(demo).aggregate([{ $group: { _id: "$status", amount: { $sum: "$amount" }, count: { $sum: 1 } } }]);
  // Gateway money that matched no request (old link, paid twice, after a cancel): must be refunded in Razorpay
  const [unmatched] = await cabModel(demo).aggregate([
    { $match: { "unmatchedPayments.0": { $exists: true } } },
    { $unwind: "$unmatchedPayments" },
    { $match: { "unmatchedPayments.refundedAt": null } },
    { $group: { _id: null, amount: { $sum: "$unmatchedPayments.amount" }, count: { $sum: 1 } } },
  ]);
  ok(res, { cab: { ...(cab || {}), unmatchedPending: unmatched?.amount ?? 0, unmatchedCount: unmatched?.count ?? 0 }, payouts });
});

router.get("/audit-log", async (req, res) => {
  const filter: any = {};
  if (req.query.action) filter.action = String(req.query.action);
  if (req.query.targetId) filter.targetId = String(req.query.targetId);
  if (req.query.tenantId) filter.tenantId = String(req.query.tenantId);
  if (req.query.driverId) filter.driverId = String(req.query.driverId);
  if (req.query.actorRole) filter.actorRole = String(req.query.actorRole).toUpperCase();
  if (req.query.actor) {
    const actorSafe = String(req.query.actor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.actor = new RegExp(actorSafe, "i");
  }
  if (req.query.startDate || req.query.endDate) {
    filter.createdAt = {};
    if (req.query.startDate) filter.createdAt.$gte = new Date(String(req.query.startDate));
    if (req.query.endDate) filter.createdAt.$lte = new Date(String(req.query.endDate));
  }

  const { page, limit, skip } = paging(req);
  const demo = isDemo(req);
  const Model = getAuditLogModel(demo);
  const [docs, total] = await Promise.all([
    Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Model.countDocuments(filter),
  ]);

  // Batch-resolve human names for Users, Homestays, and Cab Requests
  const userIds = new Set<string>();
  const tenantIds = new Set<string>();
  const cabIds = new Set<string>();

  for (const d of docs) {
    if (d.targetType === "User" && d.targetId && d.targetId.length === 24) {
      userIds.add(d.targetId);
    }
    if (d.targetType === "Tenant" && d.targetId) {
      tenantIds.add(d.targetId);
    }
    if (d.tenantId) {
      tenantIds.add(d.tenantId);
    }
    if (d.details?.tenantKey) {
      tenantIds.add(d.details.tenantKey);
    }
    if (d.targetType === "CabRequest" && d.targetId) {
      cabIds.add(d.targetId);
    }
    const actorRaw = String(d.actor || "").replace(/^user:/, "").replace(/^driver:/, "").replace(/^owner:/, "");
    if (actorRaw.length === 24) {
      userIds.add(actorRaw);
    }
  }

  const objectUserIds = Array.from(userIds)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const objectCabIds = Array.from(cabIds)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const [users, tenants, cabs] = await Promise.all([
    objectUserIds.length ? userModel(demo).find({ _id: { $in: objectUserIds } }, "name email phone role").lean() : [],
    tenantIds.size ? getStayRideTenantModel(demo).find({ tenantId: { $in: Array.from(tenantIds) } }, "tenantId homestayName data.homestay.name").lean() : [],
    objectCabIds.length ? cabModel(demo).find({ _id: { $in: objectCabIds } }, "reference guestName guestPhone").lean() : [],
  ]);

  const userMap = new Map<string, any>(users.map((u: any) => [String(u._id), u]));
  const tenantMap = new Map<string, string>(
    tenants.map((t: any) => [t.tenantId, t.homestayName || t.data?.homestay?.name || t.tenantId])
  );
  const cabMap = new Map<string, any>(cabs.map((c: any) => [String(c._id), c]));


  const items = docs.map((d: any) => {
    let targetName = d.details?.targetName || d.details?.name || "";
    let targetEmail = d.details?.targetEmail || d.details?.email || "";
    let targetLabel = "";

    // Resolve user target
    if (d.targetType === "User") {
      const u = userMap.get(String(d.targetId));
      if (u) {
        targetName = u.name || targetName;
        targetEmail = u.email || targetEmail;
        targetLabel = u.name ? `${u.name} (${u.email})` : u.email;
      }
    } else if (d.targetType === "Tenant") {
      const homestayName = tenantMap.get(d.targetId) || tenantMap.get(d.details?.tenantKey);
      if (homestayName) {
        targetName = homestayName;
        targetLabel = homestayName;
      }
    } else if (d.targetType === "CabRequest") {
      const c = cabMap.get(String(d.targetId));
      if (c) {
        targetLabel = `${c.reference || "Trip"} (${c.guestName || "Guest"})`;
      }
    }

    // Resolve actor display name
    let actorDisplayName = d.actorName || d.actor;
    const actorRaw = String(d.actor || "").replace(/^user:/, "").replace(/^driver:/, "").replace(/^owner:/, "");
    if (userMap.has(actorRaw)) {
      const au = userMap.get(actorRaw);
      if (au.name && au.email) actorDisplayName = `${au.name} (${au.email})`;
      else if (au.email) actorDisplayName = au.email;
    }

    // Resolve scope homestay name
    const scopeTenantKey = d.tenantId || d.details?.tenantKey;
    const scopeTenantName = scopeTenantKey ? tenantMap.get(scopeTenantKey) : "";

    return {
      ...d,
      actorDisplayName,
      targetName,
      targetEmail,
      targetLabel: targetLabel || targetName || (d.targetId ? `#...${String(d.targetId).slice(-6)}` : ""),
      scopeTenantName: scopeTenantName || "",
    };
  });

  res.json({ success: true, items, total, page, limit });
});



// ---------------------------------------------------------------------------
// Tenant data (A3): view and correct a homestay's records. Same validation as the owner API;
// platform trips are refused (use the cab-request actions). Every write is audited.
// ---------------------------------------------------------------------------
async function existingTenant(req: Request) {
  const key = normKey(String(req.params.tenantKey));
  const demo = isDemoKey(key);
  if (!(await getStayRideTenantModel(demo).exists({ tenantId: key }))) throw httpError(404, "Homestay not found.");
  return { key, demo };
}
const collectionOf = (req: Request): TenantCollection => {
  const c = String(req.params.collection);
  if (!Object.prototype.hasOwnProperty.call(TENANT_COLLECTIONS, c)) throw httpError(404, "Unknown collection.");
  return c as TenantCollection;
};
// Audit entries keep field values but not photo data.
const auditable = (o: any) => (o && o.photos ? { ...o, photos: `${o.photos.length} photo(s)` } : o);

router.get("/stayride/tenants/:tenantKey/data", async (req, res) => {
  const { key, demo } = await existingTenant(req);
  const store = await tenantManager.load(key);
  res.json({
    success: true,
    homestay: store.homestay,
    rooms: store.rooms,
    guests: store.guests,
    bookings: store.bookings,
    drivers: store.drivers,
    trips: await overlayTrips(key, demo, store.trips),
    campaigns: store.campaigns,
    version: store.version,
  });
});

router.patch("/stayride/tenants/:tenantKey/homestay", async (req, res) => {
  const { key, demo } = await existingTenant(req);
  let before: any = null;
  let changes: any = null;
  const homestay = await tenantManager.mutate(key, (s) => {
    changes = clean("homestay", req.body, s.homestay.photos);
    before = Object.fromEntries(Object.keys(changes).map((k) => [k, (s.homestay as any)[k]]));
    return Object.assign(s.homestay, changes);
  });
  await audit(actor(req), "tenant.homestay.update", "Tenant", key, { before: auditable(before), after: auditable(changes) }, demo, { tenantId: key });
  ok(res, homestay, "Homestay updated.");
});

router.patch("/stayride/tenants/:tenantKey/:collection/:id", async (req, res) => {
  const { key, demo } = await existingTenant(req);
  const collection = collectionOf(req);
  const id = Number(req.params.id);
  // Say so instead of silently dropping fields the server never lets anyone edit
  const editable = new Set([...Object.keys(FIELDS[TENANT_COLLECTIONS[collection]]), "id", "_id", "createdAt", "updatedAt"]);
  const rejected = Object.keys(req.body || {}).filter((k) => !editable.has(k));
  if (rejected.length) throw httpError(400, `These fields can't be edited: ${rejected.join(", ")}.`);
  let before: any = null;
  const item = await tenantManager.mutate(key, (s) => {
    before = { ...((s[collection] as any[]).find((x) => x.id === id) || {}) };
    return s.updateItem(collection, id, req.body);
  });
  if (!item) throw httpError(404, "Record not found.");
  await audit(actor(req), "tenant.data.update", "Tenant", key, { collection, id, before, after: item }, demo, { tenantId: key });
  ok(res, item, "Record updated.");
});

router.delete("/stayride/tenants/:tenantKey/:collection/:id", async (req, res) => {
  const { key, demo } = await existingTenant(req);
  const collection = collectionOf(req);
  const id = Number(req.params.id);
  const removed = await tenantManager.mutate(key, (s) => s.deleteItem(collection, id));
  if (!removed) throw httpError(404, "Record not found.");
  await audit(actor(req), "tenant.data.delete", "Tenant", key, { collection, id, removed }, demo, { tenantId: key });
  ok(res, removed, "Record deleted.");
});

export default router;
