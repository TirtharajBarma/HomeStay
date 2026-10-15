import { Router } from "express";
import { DriverController } from "../controllers/driver.controller.js";
import { validate } from "../middlewares/validate.js";
import {
  CreateDriverSchema,
  DriverStatusSchema,
  CabQuoteSchema,
  CreateCabBookingSchema,
} from "../schemas/driver.schema.js";

import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = Router();

router.get("/", DriverController.getDrivers);
router.get("/places", DriverController.getPlaces);
router.post("/quote", validate(CabQuoteSchema, "body"), DriverController.calculateQuote);
router.post("/bookings", validate(CreateCabBookingSchema, "body"), DriverController.createCabBooking);
router.get("/payouts", verifyToken, requireRole("admin"), DriverController.getPayouts);
router.get("/:id/trips", verifyToken, requireRole("admin", "driver", "owner"), DriverController.getDriverTrips);
router.patch("/trips/:id/status", verifyToken, requireRole("admin", "driver", "owner"), DriverController.updateTripStatus);
router.post("/", verifyToken, requireRole("admin", "owner"), validate(CreateDriverSchema, "body"), DriverController.addDriver);
router.patch("/:id/status", verifyToken, requireRole("admin"), validate(DriverStatusSchema, "body"), DriverController.updateStatus);

export default router;
