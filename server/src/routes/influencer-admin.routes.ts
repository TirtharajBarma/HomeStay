import { Router } from "express";
import { InfluencerAdminController } from "../controllers/influencer-admin.controller.js";

const router = Router();

// Influencer CRUD
router.get("/influencers", InfluencerAdminController.list);
router.post("/influencers", InfluencerAdminController.create);
router.get("/influencers/:id", InfluencerAdminController.getById);
router.put("/influencers/:id", InfluencerAdminController.update);
router.delete("/influencers/:id", InfluencerAdminController.delete);
router.patch("/influencers/:id/toggle-status", InfluencerAdminController.toggleStatus);

// Collaboration Requests Management
router.get("/collaboration-requests", InfluencerAdminController.listCollaborationRequests);
router.get("/collaboration-requests/stats", InfluencerAdminController.getCollaborationStats);
router.get("/collaboration-requests/:id", InfluencerAdminController.getCollaborationRequestById);
router.patch("/collaboration-requests/:id/status", InfluencerAdminController.updateCollaborationStatus);

export default router;
