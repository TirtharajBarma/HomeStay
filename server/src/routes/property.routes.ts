import { Router } from "express";
import { PropertyController } from "../controllers/property.controller.js";
import { optionalAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/", optionalAuth, PropertyController.getAllProperties);
router.get("/profile", optionalAuth, PropertyController.getProfile);
router.patch("/profile", optionalAuth, PropertyController.updateProfile);
router.get("/:slug", PropertyController.getPropertyBySlug);
router.post("/locations", optionalAuth, PropertyController.addLocation);
router.patch("/locations/:id", optionalAuth, PropertyController.updateLocation);
router.delete("/locations/:id", optionalAuth, PropertyController.deleteLocation);

export default router;
