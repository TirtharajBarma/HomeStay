import { Router } from "express";
import { PropertyController } from "../controllers/property.controller.js";

const router = Router();

router.get("/", PropertyController.getAllProperties);
router.get("/profile", PropertyController.getProfile);
router.patch("/profile", PropertyController.updateProfile);
router.get("/:slug", PropertyController.getPropertyBySlug);
router.post("/locations", PropertyController.addLocation);
router.patch("/locations/:id", PropertyController.updateLocation);
router.delete("/locations/:id", PropertyController.deleteLocation);

export default router;
