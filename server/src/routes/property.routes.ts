import { Router } from "express";
import { PropertyController } from "../controllers/property.controller.js";
import { optionalAuth, verifyToken, requireRole } from "../middlewares/auth.js";

const router = Router();

router.get("/", optionalAuth, PropertyController.getAllProperties);
router.get("/profile", verifyToken, requireRole("owner", "admin"), PropertyController.getProfile);
router.patch("/profile", verifyToken, requireRole("owner", "admin"), PropertyController.updateProfile);
router.get("/:slug", PropertyController.getPropertyBySlug);
router.post("/locations", verifyToken, requireRole("owner", "admin"), PropertyController.addLocation);
router.patch("/locations/:id", verifyToken, requireRole("owner", "admin"), PropertyController.updateLocation);
router.delete("/locations/:id", verifyToken, requireRole("owner", "admin"), PropertyController.deleteLocation);

export default router;
