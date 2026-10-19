import type { Request, Response } from "express";
import { GuestService } from "../services/guest.service.js";

export class GuestController {
  static async getGuests(req: Request, res: Response) {
    const user = (req as any).user;
    const filters = {
      status: req.query.status as string,
      query: (req.query.query || req.query.search) as string,
      room: req.query.room as string,
      ownerId: user?.role === "admin" && req.query.ownerId ? String(req.query.ownerId) : user?.id,
    };
    const guests = await GuestService.getGuests(filters);
    res.json({
      success: true,
      count: guests.length,
      data: guests,
    });
  }

  static async getGuest(req: Request, res: Response) {
    const user = (req as any).user;
    // Scope to the caller's own guests; admins may impersonate an owner via ?ownerId.
    const ownerId = user?.role === "admin" && req.query.ownerId ? String(req.query.ownerId) : user?.id;
    const guest = await GuestService.getGuestById(req.params.id as string, ownerId);
    if (!guest) {
      return res.status(404).json({ success: false, error: "Guest not found" });
    }
    res.json({ success: true, data: guest });
  }

  static async updateGuest(req: Request, res: Response) {
    const user = (req as any).user;
    const ownerId = user?.role === "admin" && req.query.ownerId ? String(req.query.ownerId) : user?.id;
    const updated = await GuestService.updateGuest(req.params.id as string, req.body, ownerId);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Guest not found" });
    }
    res.json({ success: true, data: updated });
  }

  static async getTimeline(req: Request, res: Response) {
    const user = (req as any).user;
    const startDate = req.query.startDate as string;
    const days = req.query.days ? Number(req.query.days) : 14;
    const ownerId = user?.role === "admin" && req.query.ownerId ? String(req.query.ownerId) : user?.id;
    const propertyId = user?.role === "owner" ? user?.propertyId : undefined;
    const timeline = await GuestService.getTimeline(startDate, days, ownerId, propertyId);
    res.json({ success: true, data: timeline });
  }
}
