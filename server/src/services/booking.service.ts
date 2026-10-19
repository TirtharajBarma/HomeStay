import crypto from "crypto";
import { Booking, type IBooking } from "../models/booking.model.js";
import { Room } from "../models/room.model.js";
import { Guest } from "../models/guest.model.js";
import { RoomService } from "./room.service.js";
import { NotificationService } from "./notification.service.js";

export interface CreateBookingDTO {
  stay?: string; // slug or roomCode
  roomCode?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  arrivalWindow?: string;
  breakfasts?: string[];
  paymentPlan?: "card_full" | "deposit";
  channel?: string;
  notes?: string;
}

export class BookingService {
  private static generateReference(): { reference: string; pin: string } {
    // Reference and PIN are derived from independent CSPRNG draws. Deriving both from the same
    // bytes (the old behaviour) let anyone who saw a reference narrow the PIN space.
    const refNum = crypto.randomInt(100000, 1000000);
    const pinNum = crypto.randomInt(1000, 10000);
    return {
      reference: `BK-${refNum}`,
      pin: String(pinNum),
    };
  }

  static async createBooking(data: CreateBookingDTO): Promise<IBooking> {
    const identifier = data.stay || data.roomCode;
    if (!identifier) {
      throw new Error("Room identifier (stay slug or roomCode) is required");
    }

    const room = await RoomService.getRoomByCodeOrSlug(identifier);
    if (!room) {
      throw new Error(`Room '${identifier}' not found`);
    }

    if (room.status === "Maintenance") {
      if (room.hold?.startDate && room.hold?.endDate) {
        if (data.checkIn < room.hold.endDate && data.checkOut > room.hold.startDate) {
          throw new Error(`Room '${room.name}' is currently closed for maintenance between ${room.hold.startDate} and ${room.hold.endDate}.`);
        }
      } else {
        throw new Error(`Room '${room.name}' is currently closed for maintenance.`);
      }
    }

    // Check for overlapping bookings on this specific room
    const overlap = await Booking.findOne({
      roomId: room._id,
      status: { $in: ["confirmed", "checked_in"] },
      $or: [
        {
          checkIn: { $lt: data.checkOut },
          checkOut: { $gt: data.checkIn },
        },
      ],
    });

    if (overlap) {
      throw new Error(
        `Room '${room.name}' is already reserved for the selected dates (${data.checkIn} to ${data.checkOut}).`
      );
    }

    // Compute Quote
    const quote = RoomService.calculateQuote(room.nightly, data.checkIn, data.checkOut);
    const plan = data.paymentPlan === "deposit" ? "deposit" : "card_full";
    const dueToday = plan === "deposit" ? quote.deposit : quote.total;
    const balanceDue = quote.total - dueToday;
    const settled = balanceDue <= 0;

    const { reference, pin } = this.generateReference();
    const guestFullName = `${data.firstName} ${data.lastName}`.trim();

    // Calculate cancellation deadline (7 days prior)
    const checkInDate = new Date(data.checkIn);
    const cancelDate = new Date(checkInDate);
    cancelDate.setDate(cancelDate.getDate() - 7);
    const cancellationBy = cancelDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const booking = new Booking({
      reference,
      pin,
      roomId: room._id,
      roomCode: room.code,
      roomName: room.name,
      staySlug: room.slug,
      ownerId: room.ownerId,
      propertyId: room.propertyId,
      homestayName: room.homestayName || "Boutique Homestay Estate",
      guestName: guestFullName,
      email: data.email.toLowerCase().trim(),
      phone: data.phone.trim(),
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      nights: quote.nights,
      party: Number(data.guests) || 1,
      arrivalWindow: data.arrivalWindow || "2:00 PM – 4:00 PM",
      breakfasts: data.breakfasts || [],
      channel: data.channel || "direct",
      status: "confirmed",
      plan,
      settled,
      nightlyRate: quote.nightly,
      roomTotal: quote.roomTotal,
      cleaningFee: quote.cleaning,
      taxAmount: quote.tax,
      totalAmount: quote.total,
      dueToday,
      balanceDue,
      cancellationBy,
      notes: data.notes || "",
    });
    await booking.save();

    // Automatically upsert or update the Guest record in the CRM
    try {
      const guestQuery: any = { email: booking.email };
      if (room.propertyId) guestQuery.propertyId = room.propertyId;

      let guest = await Guest.findOne(guestQuery);
      if (guest) {
        guest.stays += 1;
        guest.lifetime += booking.totalAmount;
        guest.spend = booking.totalAmount;
        guest.code = room.code;
        guest.room = room.name;
        guest.checkIn = new Date(booking.checkIn);
        guest.checkOut = new Date(booking.checkOut);
        guest.status = "Upcoming";
        await guest.save();
      } else {
        await Guest.create({
          ownerId: room.ownerId,
          propertyId: room.propertyId,
          name: guestFullName,
          code: room.code,
          room: room.name,
          location: room.location,
          category: room.category,
          checkIn: new Date(booking.checkIn),
          checkOut: new Date(booking.checkOut),
          nights: booking.nights,
          party: booking.party,
          channel: booking.channel === "direct" ? "Direct" : booking.channel,
          channelTone: "bg-primary-tint text-on-primary-container",
          email: booking.email,
          phone: booking.phone,
          origin: "Online Guest",
          spend: booking.totalAmount,
          status: "Upcoming",
          tags: ["Direct Booking"],
          note: booking.notes,
          vip: false,
          stays: 1,
          lifetime: booking.totalAmount,
        });
      }
    } catch (crmErr) {
      console.warn("CRM auto-sync non-critical error:", crmErr);
    }

    // Dispatch Notifications asynchronously (guest confirmation + owner alert)
    try {
      await NotificationService.sendBookingNotifications({
        reference: booking.reference,
        pin: booking.pin,
        roomName: booking.roomName,
        homestayName: booking.homestayName || room.homestayName || "Boutique Homestay Estate",
        guestName: booking.guestName,
        guestEmail: booking.email,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        totalAmount: booking.totalAmount,
      });
    } catch (notifErr) {
      console.warn("Booking notification dispatch notice:", notifErr);
    }

    return booking;
  }

  static async getBookings(filters: {
    roomCode?: string;
    channel?: string;
    status?: string;
    search?: string;
    ownerId?: string;
  } = {}): Promise<IBooking[]> {
    const query: any = {};
    if (filters.ownerId) query.ownerId = filters.ownerId;
    if (filters.roomCode) query.roomCode = filters.roomCode;
    if (filters.channel && filters.channel !== "all") query.channel = filters.channel;
    if (filters.status && filters.status !== "all") query.status = filters.status;
    if (filters.search) {
      query.$or = [
        { reference: new RegExp(filters.search, "i") },
        { guestName: new RegExp(filters.search, "i") },
        { email: new RegExp(filters.search, "i") },
      ];
    }
    return await Booking.find(query).sort({ createdAt: -1 });
  }

  static async getBookingByReference(reference: string): Promise<IBooking | null> {
    return await Booking.findOne({ reference });
  }

  static async cancelBooking(reference: string): Promise<IBooking | null> {
    const booking = await Booking.findOneAndUpdate(
      { reference },
      { status: "cancelled" },
      { returnDocument: "after" }
    );
    return booking;
  }
}
