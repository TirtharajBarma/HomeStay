import { Router } from "express";
import { DriverController } from "../controllers/driver.controller.js";
import { validate } from "../middlewares/validate.js";
import {
  CreateDriverSchema,
  DriverStatusSchema,
  CabQuoteSchema,
  CreateCabBookingSchema,
} from "../schemas/driver.schema.js";

const router = Router();

router.get("/", DriverController.getDrivers);
router.get("/places", DriverController.getPlaces);
router.post("/quote", validate(CabQuoteSchema, "body"), DriverController.calculateQuote);
router.post("/bookings", validate(CreateCabBookingSchema, "body"), DriverController.createCabBooking);
router.get("/payouts", DriverController.getPayouts);
router.get("/:id/trips", DriverController.getDriverTrips);
router.patch("/trips/:id/status", DriverController.updateTripStatus);
router.post("/", validate(CreateDriverSchema, "body"), DriverController.addDriver);
router.patch("/:id/status", validate(DriverStatusSchema, "body"), DriverController.updateStatus);

export default router;
