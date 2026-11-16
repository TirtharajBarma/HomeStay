import { Router } from "express";
import { InfluencerController } from "../controllers/influencer.controller.js";

const router = Router();

// Owner collaboration requests
router.post("/", InfluencerController.submitCollaborationRequest);
router.get("/my", InfluencerController.getMyCollaborationRequests);
router.get("/:id", InfluencerController.getCollaborationRequestById);

export default router;
