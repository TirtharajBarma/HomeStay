import { Router } from "express";
import { GuestController } from "../controllers/guest.controller.js";
import { optionalAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/", optionalAuth, GuestController.getGuests);
router.get("/timeline", optionalAuth, GuestController.getTimeline);
router.get("/:id", GuestController.getGuest);
router.patch("/:id", GuestController.updateGuest);

export default router;
