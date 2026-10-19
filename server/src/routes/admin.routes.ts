import { Router } from "express";
import { AdminController } from "../controllers/admin.controller.js";
import { verifyToken, requireRole, requireLiveAdmin } from "../middlewares/auth.js";
import { Property } from "../models/property.model.js";
import stayrideAdmin from "./stayride-admin.routes.js";

const router = Router();

// Protect all admin endpoints with Token Verification and Admin Role requirement
router.use(verifyToken, requireRole("admin"), requireLiveAdmin);

// Legacy (/api/v1 Hill Hospitality) admin endpoints
router.get("/overview", AdminController.getOverview);
router.get("/properties", async (_req, res) => {
  const properties = await Property.find().sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, count: properties.length, data: properties });
});
router.patch("/payouts/:id/settle", AdminController.settlePayout);
router.post("/payouts/settle", AdminController.settlePayout);
router.patch("/trips/:id/settle", AdminController.settlePayout);
router.post("/trips/:id/settle", AdminController.settlePayout);
router.patch("/properties/:id/status", AdminController.updatePropertyStatus);

// StayRide platform administration (commission, features, blocking, cab queue, payments, payouts, audit)
router.use(stayrideAdmin);

export default router;
