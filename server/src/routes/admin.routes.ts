import { Router } from "express";
import { AdminController } from "../controllers/admin.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";
import { Property } from "../models/property.model.js";

const router = Router();

// Protect all admin endpoints with Token Verification and Admin Role requirement
router.use(verifyToken, requireRole("admin"));

router.get("/overview", AdminController.getOverview);
router.get("/properties", async (_req, res) => {
  const properties = await Property.find().sort({ createdAt: -1 });
  res.json({ success: true, count: properties.length, data: properties });
});
router.patch("/payouts/:id/settle", AdminController.settlePayout);
router.post("/payouts/settle", AdminController.settlePayout);
router.patch("/trips/:id/settle", AdminController.settlePayout);
router.post("/trips/:id/settle", AdminController.settlePayout);
router.get("/host-payouts", AdminController.getHostPayouts);
router.post("/host-payouts/:id/settle", AdminController.settleHostPayout);
router.patch("/properties/:id/status", AdminController.updatePropertyStatus);

// Commission Settings Desk (Section 2.3)
router.get("/commission/settings", AdminController.getCommissionSettings);
router.put("/commission/settings", AdminController.updateCommissionSettings);
router.post("/commission/preview", AdminController.previewCommission);

// Feature Access Appeals (Section 2.4 & Section 9)
router.get("/appeals", AdminController.getAppeals);
router.post("/appeals/:id/decide", AdminController.decideAppeal);

// Cab Booking Operations (Workflow B - Section 2.5 & Section 6)
router.get("/cab-requests/pending", AdminController.getPendingCabRequests);
router.post("/cab-requests/:id/assign-driver", AdminController.assignDriverToRequest);
router.post("/cab-requests/:id/record-payment", AdminController.recordCabRequestPayment);

export default router;

