import { Router } from "express";
import { InfluencerController } from "../controllers/influencer.controller.js";

const router = Router();

// Public / Owner App Influencer Endpoints
router.get("/", InfluencerController.listPublic);
router.get("/:id", InfluencerController.getById);

export default router;
