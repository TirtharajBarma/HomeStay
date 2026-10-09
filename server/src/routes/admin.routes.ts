import { Router } from "express";
import { AdminController } from "../controllers/admin.controller.js";

const router = Router();

router.get("/overview", AdminController.getOverview);

export default router;
