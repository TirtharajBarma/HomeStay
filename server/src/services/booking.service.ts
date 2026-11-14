import crypto from "crypto";
import { Booking, type IBooking } from "../models/booking.model.js";
import { Room } from "../models/room.model.js";
import { Guest } from "../models/guest.model.js";
import { User } from "../models/user.model.js";
import { Property } from "../models/property.model.js";
import { RoomService } from "./room.service.js";
import { NotificationService } from "./notification.service.js";
import { tenantManager } from "../stayride/store.js";
import { logger } from "../utils/logger.js";

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

    // Resolve property tenantKey for iCal OTA synchronization
    let tenantKey: string | null = null;
    try {
      const owner = room.ownerId ? await User.findById(room.ownerId).select("email").lean() : null;
      tenantKey = owner?.email || (room.propertyId ? (await Property.findById(room.propertyId).select("email").lean())?.email : null) || null;
    } catch {}

    // 1. Check for OTA / iCal imported calendar reservations in tenantManager
    if (tenantKey) {
      try {
        const store = await tenantManager.load(tenantKey);
        const reqStart = new Date(data.checkIn).getTime();
        const reqEnd = new Date(data.checkOut).getTime();
        const otaOverlap = store.bookings.find((b) => {
          if (b.status !== "CONFIRMED" && b.status !== "CHECKED_IN") return false;
          const roomMatches =
            String(b.roomNumber) === String(room.code) ||
            String(b.roomNumber) === String(room.name) ||
            (b.roomNumber && String(room.code || "").includes(String(b.roomNumber)));
          if (!roomMatches) return false;
          return b.checkIn < reqEnd && b.checkOut > reqStart;
        });
        if (otaOverlap) {
          const source = (otaOverlap as any).external?.source || "calendar sync (Airbnb/Booking.com)";
          throw new Error(`Room '${room.name}' is already reserved via ${source} for the selected dates.`);
        }
      } catch (storeErr: any) {
        if (storeErr.message?.includes("already reserved")) throw storeErr;
      }
    }

    // 2. Check for overlapping bookings in canonical Booking collection
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

    // Atomic post-save concurrency check: Ensure no concurrent reservation committed for the same room & dates
    const concurrentOverlap = await Booking.findOne({
      _id: { $ne: booking._id },
      roomId: room._id,
      status: { $in: ["confirmed", "checked_in"] },
      checkIn: { $lt: data.checkOut },
      checkOut: { $gt: data.checkIn },
    });
    if (concurrentOverlap) {
      await Booking.deleteOne({ _id: booking._id });
      throw new Error(`Room '${room.name}' was just reserved by another guest for these dates. Please select other dates.`);
    }

    // Sync direct booking to tenant store so iCal exports (Airbnb, Vrbo, Booking.com) block out these dates
    if (tenantKey) {
      await tenantManager
        .mutate(tenantKey, (store) => {
          const exists = store.bookings.some((b) => b.reference === booking.reference);
          if (!exists) {
            const guest = store.guestByPhone(booking.phone) || store.createGuest({
              name: booking.guestName,
              phone: booking.phone,
              email: booking.email || "",
              notes: "Direct web booking",
              marketingConsent: false,
            } as any);

            store.bookings.unshift({
              id: store.nextBookingIdForImport(),
              guestId: guest.id,
              guestName: booking.guestName,
              phone: booking.phone,
              roomNumber: room.code || room.name,
              checkIn: new Date(booking.checkIn).getTime(),
              checkOut: new Date(booking.checkOut).getTime(),
              amount: booking.totalAmount,
              guests: booking.party || 1,
              status: "CONFIRMED",
              paid: Boolean(booking.settled || booking.balanceDue === 0),
              source: "Direct Web",
              reference: booking.reference,
              channel: "Direct Web",
            });
          }
        })
        .catch((err) => logger.warn(`[BookingService] Sync to tenant store notice: ${err?.message}`));
    }

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

    logger.info(
      `[BOOKING CREATED] Ref ${booking.reference} | Room: ${booking.roomName} (${booking.roomCode}) | Guest: ${booking.guestName} (${booking.email}) | Nights: ${booking.nights} | Total: ₹${booking.totalAmount} (Due today: ₹${booking.dueToday}, Bal: ₹${booking.balanceDue}) | Owner: ${booking.ownerId}`,
      {
        action: "booking_created",
        tenantId: String(booking.propertyId || booking.ownerId || ""),
        userId: booking.email,
        userRole: "GUEST",
        metadata: {
          reference: booking.reference,
          roomCode: booking.roomCode,
          roomName: booking.roomName,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          nights: booking.nights,
          party: booking.party,
          nightlyRate: booking.nightlyRate,
          roomTotal: booking.roomTotal,
          cleaningFee: booking.cleaningFee,
          taxAmount: booking.taxAmount,
          totalAmount: booking.totalAmount,
          dueToday: booking.dueToday,
          balanceDue: booking.balanceDue,
          plan: booking.plan,
        },
      }
    );

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
    if (booking) {
      // Free the dates in tenant store and iCal export feeds
      try {
        const owner = booking.ownerId ? await User.findById(booking.ownerId).select("email").lean() : null;
        const tenantKey = owner?.email || (booking.propertyId ? (await Property.findById(booking.propertyId).select("email").lean())?.email : null);
        if (tenantKey) {
          await tenantManager.mutate(tenantKey, (store) => {
            const b = store.bookings.find((item) => item.reference === reference);
            if (b) b.status = "CANCELLED";
          });
        }
      } catch (syncErr: any) {
        logger.warn(`[BOOKING CANCELLED] Tenant store sync notice: ${syncErr?.message}`);
      }

      logger.info(
        `[BOOKING CANCELLED] Ref ${booking.reference} | Room: ${booking.roomName} (${booking.roomCode}) | Guest: ${booking.guestName} (${booking.email})`,
        {
          action: "booking_cancelled",
          tenantId: String(booking.propertyId || booking.ownerId || ""),
          userId: booking.email,
          userRole: "GUEST",
          metadata: {
            reference: booking.reference,
            roomCode: booking.roomCode,
            guestName: booking.guestName,
            status: "cancelled",
          },
        }
      );
    }
    return booking;
  }
}
