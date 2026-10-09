import { Router } from "express";
import { RoomController } from "../controllers/room.controller.js";
import { validate } from "../middlewares/validate.js";
import { CreateRoomSchema, MaintenanceHoldSchema } from "../schemas/room.schema.js";
import { QuoteQuerySchema } from "../schemas/booking.schema.js";
import { optionalAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/", optionalAuth, RoomController.getAllRooms);
router.get("/availability/grid", RoomController.getAvailabilityGrid);
router.get("/:codeOrSlug", RoomController.getRoom);
router.post("/:codeOrSlug/quote", validate(QuoteQuerySchema, "body"), RoomController.getQuote);
router.post("/", optionalAuth, validate(CreateRoomSchema, "body"), RoomController.createRoom);
router.patch("/:codeOrSlug", RoomController.updateRoom);
router.delete("/:codeOrSlug", RoomController.deleteRoom);
router.post("/:codeOrSlug/holds", validate(MaintenanceHoldSchema, "body"), RoomController.setMaintenanceHold);
router.delete("/:codeOrSlug/holds", RoomController.clearMaintenanceHold);

export default router;
