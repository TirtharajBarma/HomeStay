import type { Request, Response } from "express";
import { GuestService } from "../services/guest.service.js";

export class GuestController {
  static async getGuests(req: Request, res: Response) {
    const user = (req as any).user;
    const filters = {
      status: req.query.status as string,
      query: (req.query.query || req.query.search) as string,
      room: req.query.room as string,
      ownerId: (req.query.ownerId as string) || (user?.role === "owner" ? user.id : undefined),
    };
    const guests = await GuestService.getGuests(filters);
    res.json({
      success: true,
      count: guests.length,
      data: guests,
    });
  }

  static async getGuest(req: Request, res: Response) {
    const guest = await GuestService.getGuestById(req.params.id as string);
    if (!guest) {
      return res.status(404).json({ success: false, error: "Guest not found" });
    }
    res.json({ success: true, data: guest });
  }

  static async updateGuest(req: Request, res: Response) {
    const updated = await GuestService.updateGuest(req.params.id as string, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Guest not found" });
    }
    res.json({ success: true, data: updated });
  }

  static async getTimeline(req: Request, res: Response) {
    const startDate = req.query.startDate as string;
    const days = req.query.days ? Number(req.query.days) : 14;
    const timeline = await GuestService.getTimeline(startDate, days);
    res.json({ success: true, data: timeline });
  }
}
