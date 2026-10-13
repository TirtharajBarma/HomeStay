import type { Request, Response } from "express";
import { RoomService } from "../services/room.service.js";
import { Property } from "../models/property.model.js";

export class RoomController {
  static async getAllRooms(req: Request, res: Response) {
    const user = (req as any).user;
    const filters = {
      category: req.query.category as string,
      kind: req.query.kind as string,
      petFriendly: req.query.petFriendly ? req.query.petFriendly === "true" : undefined,
      status: req.query.status as string,
      guests: req.query.guests ? Number(req.query.guests) : undefined,
      ownerId: (req.query.ownerId as string) || (user?.role === "owner" ? user.id : undefined),
    };
    const rooms = await RoomService.getAllRooms(filters);
    res.json({ success: true, count: rooms.length, data: rooms });
  }

  static async getRoom(req: Request, res: Response) {
    const codeOrSlug = (req.params.codeOrSlug || req.params.slug || req.params.id) as string;
    const room = await RoomService.getRoomByCodeOrSlug(codeOrSlug);
    if (!room) {
      return res.status(404).json({ success: false, error: `Room '${codeOrSlug}' not found` });
    }
    res.json({ success: true, data: room });
  }

  static async getQuote(req: Request, res: Response) {
    const codeOrSlug = (req.params.codeOrSlug || req.params.slug || req.params.id) as string;
    const room = await RoomService.getRoomByCodeOrSlug(codeOrSlug);
    if (!room) {
      return res.status(404).json({ success: false, error: `Room '${codeOrSlug}' not found` });
    }
    const { checkIn, checkOut } = req.body;
    const quote = RoomService.calculateQuote(room.nightly, checkIn, checkOut);
    res.json({ success: true, data: quote });
  }

  static async createRoom(req: Request, res: Response) {
    const user = (req as any).user;
    const payload = { ...req.body };
    if (user?.role === "owner") {
      if (!payload.ownerId) payload.ownerId = user.id;
      if (!payload.propertyId) {
        if (user.propertyId) {
          payload.propertyId = user.propertyId;
        } else {
          const prop = await Property.findOne({ ownerId: user.id });
          if (prop) payload.propertyId = prop._id;
        }
      }
    }
    const room = await RoomService.createRoom(payload);
    res.status(201).json({ success: true, data: room });
  }

  static async updateRoom(req: Request, res: Response) {
    const codeOrSlug = (req.params.codeOrSlug || req.params.id) as string;
    const room = await RoomService.updateRoom(codeOrSlug, req.body);
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    res.json({ success: true, data: room });
  }

  static async deleteRoom(req: Request, res: Response) {
    const codeOrSlug = (req.params.codeOrSlug || req.params.id) as string;
    const deleted = await RoomService.deleteRoom(codeOrSlug);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    res.json({ success: true, message: "Room deleted successfully" });
  }

  static async setMaintenanceHold(req: Request, res: Response) {
    const codeOrSlug = (req.params.codeOrSlug || req.params.id) as string;
    const holdData = req.body?.clear ? undefined : req.body;
    const room = await RoomService.setMaintenanceHold(codeOrSlug, holdData);
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    res.json({ success: true, data: room });
  }

  static async clearMaintenanceHold(req: Request, res: Response) {
    const codeOrSlug = (req.params.codeOrSlug || req.params.id) as string;
    const room = await RoomService.setMaintenanceHold(codeOrSlug, undefined);
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    res.json({ success: true, data: room, message: "Maintenance hold released" });
  }

  static async getAvailabilityGrid(req: Request, res: Response) {
    const startDate = (req.query.startDate as string) || new Date().toISOString().slice(0, 10);
    const days = req.query.days ? Number(req.query.days) : 14;
    const grid = await RoomService.getAvailabilityGrid(startDate, days);
    res.json({ success: true, data: grid });
  }
}
