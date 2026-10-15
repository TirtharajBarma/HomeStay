import { Router } from "express";
import { BookingController } from "../controllers/booking.controller.js";
import { validate } from "../middlewares/validate.js";
import { CreateBookingSchema } from "../schemas/booking.schema.js";
import { optionalAuth, verifyToken, requireRole } from "../middlewares/auth.js";

const router = Router();

router.get("/", verifyToken, requireRole("owner", "admin"), BookingController.getBookings);
router.get("/:reference", BookingController.getBookingByReference);
router.post("/", validate(CreateBookingSchema, "body"), BookingController.createBooking);
router.post("/:reference/cancel", optionalAuth, BookingController.cancelBooking);
router.patch("/:reference/cancel", optionalAuth, BookingController.cancelBooking);

export default router;
