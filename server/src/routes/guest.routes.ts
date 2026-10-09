import { Router } from "express";
import { GuestController } from "../controllers/guest.controller.js";

const router = Router();

router.get("/", GuestController.getGuests);
router.get("/timeline", GuestController.getTimeline);
router.get("/:id", GuestController.getGuest);
router.patch("/:id", GuestController.updateGuest);

export default router;
