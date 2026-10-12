import { Router } from "express";
import { RoomController } from "../controllers/room.controller.js";
import { IcalController } from "../controllers/ical.controller.js";
import { validate } from "../middlewares/validate.js";
import { CreateRoomSchema, MaintenanceHoldSchema } from "../schemas/room.schema.js";
import { QuoteQuerySchema } from "../schemas/booking.schema.js";
import { optionalAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/", optionalAuth, RoomController.getAllRooms);
router.get("/availability/grid", RoomController.getAvailabilityGrid);
router.get("/:codeOrSlug/calendar.ics", IcalController.exportIcal);
router.get("/:codeOrSlug/ical", IcalController.exportIcal);
router.post("/:codeOrSlug/sync-ical", optionalAuth, IcalController.syncInboundIcal);
router.get("/:codeOrSlug", RoomController.getRoom);
router.post("/:codeOrSlug/quote", validate(QuoteQuerySchema, "body"), RoomController.getQuote);
router.post("/", optionalAuth, validate(CreateRoomSchema, "body"), RoomController.createRoom);
router.patch("/:codeOrSlug", optionalAuth, RoomController.updateRoom);
router.delete("/:codeOrSlug", optionalAuth, RoomController.deleteRoom);
router.post("/:codeOrSlug/holds", optionalAuth, validate(MaintenanceHoldSchema, "body"), RoomController.setMaintenanceHold);
router.delete("/:codeOrSlug/holds", optionalAuth, RoomController.clearMaintenanceHold);

export default router;
