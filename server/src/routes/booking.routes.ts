import { Router } from "express";
import { BookingController } from "../controllers/booking.controller.js";
import { validate } from "../middlewares/validate.js";
import { CreateBookingSchema } from "../schemas/booking.schema.js";

const router = Router();

router.get("/", BookingController.getBookings);
router.get("/:reference", BookingController.getBookingByReference);
router.post("/", validate(CreateBookingSchema, "body"), BookingController.createBooking);
router.post("/:reference/cancel", BookingController.cancelBooking);
router.patch("/:reference/cancel", BookingController.cancelBooking);

export default router;
