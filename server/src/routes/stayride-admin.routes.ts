// StayRide platform administration. Mounted under /api/v1/admin (and /v1/admin) behind
// verifyToken + requireRole("admin"). Every write is audited.
import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { CommissionService, validateRates } from "../services/commission.service.js";
import { getTenantControlModel, FEATURE_KEYS } from "../models/tenant-control.model.js";
import { getFeatureAppealModel } from "../models/feature-appeal.model.js";
import { getAuditLogModel, audit } from "../models/audit-log.model.js";
import { getStayRideTenantModel } from "../stayride/store.js";
import {
  OPEN_STATUSES, cabModel, payoutModel, userModel, parseFare, cancelRequest, startTrip, completeTrip,
  adminAssignDriver, adminRecordPayment, adminVoidPayment, adminMarkRefunded, adminSettleDriver,
  settlePayout, rejectPayout,
} from "../stayride/platform.js";
import { httpError } from "../middlewares/error-handler.js";

const router = Router();
const isDemo = (req: Request) => req.query.demo === "true" || req.body?.demo === true;
const actor = (req: Request) => (req as any).user?.email || String((req as any).user?.id || "admin");
const ok = (res: Response, data: any, message?: string) => res.json({ success: true, ...(message ? { message } : {}), data });
const page = (req: Request) => Math.max(0, Number(req.query.page) || 0);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------------------
// Platform settings: commission rates, minimum advance, global feature switches
// ---------------------------------------------------------------------------
router.get("/commission/settings", async (req, res) => {
  const settings = await CommissionService.getSettings(isDemo(req));
  ok(res, { ...settings.toObject(), features: CommissionService.globalFeatures(settings) });
});

router.put("/commission/settings", async (req, res) => {
  try {
    const { before, after } = await CommissionService.updateSettings({ ...req.body, updatedBy: actor(req) });
    await audit(actor(req), "settings.update", "PlatformSettings", String(after._id), {
      before: { pf: before.globalPlatformFeePercent, hc: before.globalHomestayCommissionPercent, adv: before.defaultAdvancePercent, min: before.minAdvanceAmount, features: before.features },
      after: { pf: after.globalPlatformFeePercent, hc: after.globalHomestayCommissionPercent, adv: after.defaultAdvancePercent, min: after.minAdvanceAmount, features: after.features },
      reason: req.body.changeReason || "",
    });
    ok(res, { ...after.toObject(), features: CommissionService.globalFeatures(after) }, "Platform settings updated.");
  } catch (err: any) {
    throw err?.status ? err : httpError(400, err?.message || "Invalid settings");
  }
});

router.post("/commission/preview", async (req, res) => {
  const fare = parseFare(req.body.fare);
  ok(res, await CommissionService.calculateSplit(fare, req.body.tenantKey || req.body.propertyId, isDemo(req)));
});

// ---------------------------------------------------------------------------
// Homestays (StayRide tenants): list, block/unblock, feature overrides, commission override
// ---------------------------------------------------------------------------
router.get("/stayride/tenants", async (req, res) => {
  const demo = isDemo(req);
  const q = String(req.query.search || "").trim();
  const filter = q ? { $or: [{ tenantId: new RegExp(escapeRegex(q), "i") }, { homestayName: new RegExp(escapeRegex(q), "i") }] } : {};
  const tenants = await getStayRideTenantModel(demo)
    .find(filter)
    .select("tenantId homestayName ownerName email phone location createdAt lastActiveAt")
    .sort({ createdAt: -1 })
    .skip(page(req) * 50)
    .limit(50)
    .lean();
  const keys = tenants.map((t: any) => t.tenantId);
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
  const data = await Promise.all(
    tenants.map(async (t: any) => {
      const state = await CommissionService.getAccountState(t.tenantId, demo);
      const c: any = controlBy.get(t.tenantId);
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
        stats: statsBy.get(t.tenantId) || { requests: 0, completed: 0, gmv: 0 },
      };
    })
  );
  ok(res, data);
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
  await audit(actor(req), "tenant.controls", "Tenant", tenantKey, { before, after: set }, demo);
  ok(res, { ...after, effective: await CommissionService.getAccountState(tenantKey, demo) }, "Homestay controls updated.");
});

// ---------------------------------------------------------------------------
// Platform users: list, role management (guest/owner/driver/admin), account status
// ---------------------------------------------------------------------------
router.get("/stayride/users", async (req, res) => {
  const demo = isDemo(req);
  const filter: any = {};
  if (req.query.role && ["guest", "owner", "driver", "admin"].includes(String(req.query.role))) {
    filter.role = req.query.role;
  }
  if (req.query.status && ["ACTIVE", "PENDING_APPROVAL", "BLOCKED"].includes(String(req.query.status))) {
    filter.accountStatus = req.query.status;
  }
  const q = String(req.query.search || "").trim();
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }
  const users = await userModel(demo)
    .find(filter)
    .select("name email phone role accountStatus statusReason vehicle propertyId createdAt updatedAt")
    .sort({ createdAt: -1 })
    .skip(page(req) * 100)
    .limit(100)
    .lean();
  const total = await userModel(demo).countDocuments(filter);
  ok(res, { total, count: users.length, users });
});

router.patch("/stayride/users/:id/role", async (req, res) => {
  const demo = isDemo(req);
  const targetRole = String(req.body.role);
  if (!["guest", "owner", "driver", "admin"].includes(targetRole)) {
    throw httpError(400, "Role must be guest, owner, driver, or admin.");
  }
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "User not found.");

  const targetUser = await userModel(demo).findById(String(req.params.id));
  if (!targetUser) throw httpError(404, "User not found.");

  const beforeRole = targetUser.role;
  targetUser.role = targetRole as any;
  if (req.body.accountStatus && ["ACTIVE", "PENDING_APPROVAL", "BLOCKED"].includes(req.body.accountStatus)) {
    targetUser.accountStatus = req.body.accountStatus;
  }
  await targetUser.save();

  await audit(actor(req), "user.role_change", "User", String(req.params.id), {
    before: { role: beforeRole },
    after: { role: targetRole, accountStatus: targetUser.accountStatus },
    reason: String(req.body.reason || "Role updated by Super Admin"),
  }, demo);

  ok(res, {
    _id: targetUser._id,
    name: targetUser.name,
    email: targetUser.email,
    role: targetUser.role,
    accountStatus: targetUser.accountStatus,
  }, `User role updated from ${beforeRole} to ${targetRole}.`);
});

router.patch("/stayride/users/:id/status", async (req, res) => {
  const demo = isDemo(req);
  const status = String(req.body.status);
  if (!["ACTIVE", "PENDING_APPROVAL", "BLOCKED"].includes(status)) {
    throw httpError(400, "Status must be ACTIVE, PENDING_APPROVAL or BLOCKED.");
  }
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "User not found.");

  const updated = await userModel(demo).findByIdAndUpdate(
    String(req.params.id),
    { $set: { accountStatus: status, statusReason: String(req.body.reason || "").slice(0, 300) } },
    { returnDocument: "after" }
  ).select("name email phone role accountStatus statusReason vehicle").lean();

  if (!updated) throw httpError(404, "User not found.");
  await audit(actor(req), "user.status", "User", String(req.params.id), { status, reason: req.body.reason || "" }, demo);
  ok(res, updated, `User account ${status === "ACTIVE" ? "activated" : status === "BLOCKED" ? "blocked" : "set to pending"}.`);
});

// ---------------------------------------------------------------------------
// Platform drivers: approve / block
// ---------------------------------------------------------------------------
router.get("/stayride/drivers", async (req, res) => {
  const filter: any = { role: "driver" };
  if (["ACTIVE", "PENDING_APPROVAL", "BLOCKED"].includes(String(req.query.status))) filter.accountStatus = req.query.status;
  const drivers = await userModel(isDemo(req))
    .find(filter)
    .select("name email phone accountStatus statusReason vehicle createdAt")
    .sort({ createdAt: -1 })
    .skip(page(req) * 100)
    .limit(100)
    .lean();
  ok(res, drivers);
});

router.patch("/stayride/drivers/:id/status", async (req, res) => {
  const status = String(req.body.status);
  if (!["ACTIVE", "PENDING_APPROVAL", "BLOCKED"].includes(status)) throw httpError(400, "Status must be ACTIVE, PENDING_APPROVAL or BLOCKED.");
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "Driver not found.");
  const updated = await userModel(isDemo(req)).findOneAndUpdate(
    { _id: String(req.params.id), role: "driver" },
    { $set: { accountStatus: status, statusReason: String(req.body.reason || "").slice(0, 300) } },
    { returnDocument: "after" }
  ).select("name email phone accountStatus statusReason vehicle").lean();
  if (!updated) throw httpError(404, "Driver not found.");
  await audit(actor(req), "driver.status", "User", String(req.params.id), { status, reason: req.body.reason || "" }, isDemo(req));
  ok(res, updated, `Driver ${status === "ACTIVE" ? "approved" : status === "BLOCKED" ? "blocked" : "set to pending"}.`);
});

// ---------------------------------------------------------------------------
// Cab requests (Workflow B queue + full history)
// ---------------------------------------------------------------------------
router.get("/cab-requests/pending", async (req, res) => {
  const data = await cabModel(isDemo(req))
    .find({ status: { $in: [...OPEN_STATUSES, "AWAITING_ADVANCE_PAYMENT"] } })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ success: true, count: data.length, data });
});

router.get("/cab-requests", async (req, res) => {
  const filter: any = {};
  if (req.query.status) filter.status = String(req.query.status);
  if (req.query.tenantKey) filter.propertyId = String(req.query.tenantKey);
  if (req.query.refundStatus) filter.refundStatus = String(req.query.refundStatus);
  if (req.query.driverSettlementStatus) filter.driverSettlementStatus = String(req.query.driverSettlementStatus);
  const data = await cabModel(isDemo(req)).find(filter).sort({ createdAt: -1 }).skip(page(req) * 100).limit(100).lean();
  res.json({ success: true, count: data.length, data });
});

const cabAction = (fn: (demo: boolean, id: string, req: Request) => Promise<any>, message: string) => async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "Cab request not found.");
  ok(res, await fn(isDemo(req), String(req.params.id), req), message);
};

router.post("/cab-requests/:id/assign-driver", cabAction((d, id, req) => adminAssignDriver(d, id, req.body, actor(req)), "Driver assigned and fare locked."));
router.post("/cab-requests/:id/record-payment", cabAction((d, id, req) => adminRecordPayment(d, id, req.body, actor(req)), "Advance payment recorded."));
router.post("/cab-requests/:id/void-payment", cabAction((d, id, req) => adminVoidPayment(d, id, req.body.reason, actor(req)), "Payment voided."));
router.post("/cab-requests/:id/cancel", cabAction((d, id, req) => cancelRequest({ _id: id }, d, actor(req), String(req.body.reason || "Cancelled by StayRide admin")), "Request cancelled."));
router.post("/cab-requests/:id/refund", cabAction((d, id, req) => adminMarkRefunded(d, id, req.body.reference, actor(req)), "Refund recorded."));
router.post("/cab-requests/:id/start", cabAction((d, id, req) => startTrip(d, { _id: id }, actor(req)), "Trip started."));
router.post("/cab-requests/:id/complete", cabAction((d, id, req) => completeTrip(d, { _id: id }, actor(req)), "Trip completed."));
router.post("/cab-requests/:id/driver-settled", cabAction((d, id, req) => adminSettleDriver(d, id, req.body.reference, actor(req)), "Driver settlement recorded."));

// ---------------------------------------------------------------------------
// Homestay commission payouts
// ---------------------------------------------------------------------------
router.get("/host-payouts", async (req, res) => {
  const filter: any = {};
  if (["PENDING", "SETTLED", "REJECTED"].includes(String(req.query.status))) filter.status = req.query.status;
  res.json(await payoutModel(isDemo(req)).find(filter).sort({ requestedAt: -1 }).skip(page(req) * 100).limit(100).lean());
});

router.post("/host-payouts/:id/settle", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "Payout not found.");
  const payout: any = await settlePayout(isDemo(req), String(req.params.id), req.body.utrNumber, req.body.notes, actor(req));
  res.json({ success: true, message: `Payout of ₹${payout.amount} settled with UTR ${payout.utrNumber}.`, payout });
});

router.post("/host-payouts/:id/reject", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) throw httpError(404, "Payout not found.");
  const payout = await rejectPayout(isDemo(req), String(req.params.id), req.body.reason, actor(req));
  res.json({ success: true, message: "Payout rejected; its trips can be requested again.", payout });
});

// ---------------------------------------------------------------------------
// Feature appeals → grant per-homestay feature
// ---------------------------------------------------------------------------
router.get("/appeals", async (req, res) => {
  const data = await getFeatureAppealModel(isDemo(req)).find().sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, count: data.length, data });
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
  res.json({ success: true, message: `Appeal ${status.toLowerCase()}.`, data: appeal });
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
        advanceCollected: { $sum: { $cond: ["$advancePaid", "$advanceAmount", 0] } },
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
  ok(res, { cab: cab || {}, payouts });
});

router.get("/audit-log", async (req, res) => {
  const filter: any = {};
  if (req.query.action) filter.action = String(req.query.action);
  if (req.query.targetId) filter.targetId = String(req.query.targetId);
  const data = await getAuditLogModel(isDemo(req)).find(filter).sort({ createdAt: -1 }).skip(page(req) * 100).limit(100).lean();
  ok(res, data);
});

export default router;
