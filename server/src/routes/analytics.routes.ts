import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller.js";
import { optionalAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/", optionalAuth, AnalyticsController.getAnalytics);
router.get("/export", optionalAuth, AnalyticsController.exportCsv);

export default router;
