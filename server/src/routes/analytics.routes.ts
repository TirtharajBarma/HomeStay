import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = Router();

router.use(verifyToken, requireRole("owner", "admin"));

router.get("/", AnalyticsController.getAnalytics);
router.get("/export", AnalyticsController.exportCsv);

export default router;
