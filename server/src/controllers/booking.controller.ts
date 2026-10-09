import type { Request, Response } from "express";
import { BookingService } from "../services/booking.service.js";

export class BookingController {
  static async createBooking(req: Request, res: Response) {
    try {
      const booking = await BookingService.createBooking(req.body);
      res.status(201).json({
        success: true,
        data: booking,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || "Failed to create booking",
      });
    }
  }

  static async getBookings(req: Request, res: Response) {
    const user = (req as any).user;
    const filters = {
      roomCode: req.query.roomCode as string,
      channel: req.query.channel as string,
      status: req.query.status as string,
      search: req.query.search as string,
      ownerId: (req.query.ownerId as string) || (user?.role === "owner" ? user.id : undefined),
    };
    const bookings = await BookingService.getBookings(filters);
    res.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  }

  static async getBookingByReference(req: Request, res: Response) {
    const reference = (req.params.reference || req.params.id) as string;
    const booking = await BookingService.getBookingByReference(reference);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: `Booking '${reference}' not found`,
      });
    }
    res.json({ success: true, data: booking });
  }

  static async cancelBooking(req: Request, res: Response) {
    const reference = (req.params.reference || req.params.id) as string;
    const booking = await BookingService.cancelBooking(reference);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: `Booking '${reference}' not found`,
      });
    }
    res.json({
      success: true,
      message: "Booking cancelled successfully",
      data: booking,
    });
  }
}
