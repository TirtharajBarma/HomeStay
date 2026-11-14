import type { Request, Response } from "express";
import { BookingService } from "../services/booking.service.js";

export class BookingController {
  static async createBooking(req: Request, res: Response) {
    try {
      // The legacy room checkout only validates card details in the client and
      // has no server-side payment authorization or capture. Never confirm a
      // paid booking from that flow in production.
      if (process.env.NODE_ENV === "production") {
        return res.status(503).json({
          success: false,
          error: "Room bookings are temporarily unavailable while payments are configured.",
        });
      }
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
    // Admins without ownerId in query can view all bookings; homestay owners are scoped to their own id
    const resolvedOwnerId = user?.role === "admin" ? (req.query.ownerId ? String(req.query.ownerId) : undefined) : user?.id;
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

    const user = (req as any).user;
    const isStaff = Boolean(user) && (user.role === "admin" || String(user.id) === String(booking.ownerId));

    // Zero-Trust verification: prevent unauthenticated IDOR enumeration of guest PII.
    // Guests must provide matching phone (last 10 digits), matching email, or secret booking PIN.
    const last10 = (p: unknown) => String(p || "").replace(/\D/g, "").slice(-10);
    const queryPhone = last10(req.query.phone);
    const queryEmail = String(req.query.email || "").trim().toLowerCase();
    const queryPin = String(req.query.pin || req.headers["x-booking-pin"] || "").trim();

    const pinMatches = Boolean(queryPin) && queryPin === String(booking.pin).trim();
    const phoneMatches = queryPhone.length === 10 && queryPhone === last10(booking.phone);
    const emailMatches = Boolean(queryEmail) && queryEmail === String(booking.email || "").trim().toLowerCase();

    const isVerifiedGuest = pinMatches || phoneMatches || emailMatches;

    if (!isStaff && !isVerifiedGuest) {
      return res.status(401).json({
        success: false,
        error: "Verification required: please provide matching phone number, email, or PIN to view this booking.",
      });
    }

    const data: any = typeof (booking as any).toObject === "function" ? (booking as any).toObject() : { ...booking };
    // Only staff or a guest who explicitly supplied the matching PIN can see the PIN
    if (!isStaff && !pinMatches) delete data.pin;
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
