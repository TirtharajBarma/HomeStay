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
    const resolvedOwnerId = user?.role === "admin" && req.query.ownerId ? String(req.query.ownerId) : user?.id;
    const filters = {
      roomCode: req.query.roomCode as string,
      channel: req.query.channel as string,
      status: req.query.status as string,
      search: req.query.search as string,
      ownerId: resolvedOwnerId,
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
    // This route is public (a guest looks up their own booking). The door PIN is a secret used to
    // authorise cancellation, so it is only returned to the property owner or an admin.
    const user = (req as any).user;
    const authorized = Boolean(user) && (user.role === "admin" || String(user.id) === String(booking.ownerId));
    const data: any = typeof (booking as any).toObject === "function" ? (booking as any).toObject() : { ...booking };
    if (!authorized) delete data.pin;
    res.json({ success: true, data });
  }

  static async cancelBooking(req: Request, res: Response) {
    const reference = (req.params.reference || req.params.id) as string;
    const user = (req as any).user;
    const booking = await BookingService.getBookingByReference(reference);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: `Booking '${reference}' not found`,
      });
    }

    const pin = req.body?.pin || req.headers["x-booking-pin"];
    const isAuthorized =
      (user && (user.role === "admin" || String(user.id) === String(booking.ownerId))) ||
      (pin && String(pin) === String(booking.pin));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: "Cancellation requires valid booking PIN or property owner credentials.",
      });
    }

    const cancelled = await BookingService.cancelBooking(reference);
    res.json({
      success: true,
      message: "Booking cancelled successfully",
      data: cancelled,
    });
  }
}
