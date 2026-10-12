import { Router } from "express";
import { AdminController } from "../controllers/admin.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = Router();

// Protect all admin endpoints with Token Verification and Admin Role requirement
router.use(verifyToken, requireRole("admin"));

router.get("/overview", AdminController.getOverview);
router.patch("/payouts/:id/settle", AdminController.settlePayout);
router.post("/payouts/settle", AdminController.settlePayout);
router.patch("/properties/:id/status", AdminController.updatePropertyStatus);

export default router;
