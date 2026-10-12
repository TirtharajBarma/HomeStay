import { Room, type IRoom } from "../models/room.model.js";
import { Booking } from "../models/booking.model.js";

export interface RoomFilters {
  category?: string;
  kind?: string;
  petFriendly?: boolean;
  status?: string;
  guests?: number;
  checkIn?: string;
  checkOut?: string;
  ownerId?: string;
  propertyId?: string;
}

export interface QuoteCalculation {
  nightly: number;
  nights: number;
  roomTotal: number;
  cleaning: number;
  tax: number;
  total: number;
  deposit: number;
}

export class RoomService {
  static async getAllRooms(filters: RoomFilters = {}): Promise<IRoom[]> {
    const query: any = {};

    if (filters.propertyId) {
      query.propertyId = filters.propertyId;
    } else if (filters.ownerId) {
      query.ownerId = filters.ownerId;
    }

    if (filters.category && filters.category !== "all") {
      query.category = filters.category;
    }
    if (filters.kind && filters.kind !== "all") {
      query.kind = filters.kind;
    }
    if (typeof filters.petFriendly === "boolean") {
      query.petFriendly = filters.petFriendly;
    }
    if (filters.status && filters.status !== "all") {
      query.status = filters.status;
    }
    if (filters.guests) {
      query.maxGuests = { $gte: Number(filters.guests) };
    }

    return await Room.find(query).sort({ code: 1 });
  }

  static async getRoomByCodeOrSlug(codeOrSlug: string, propertyId?: string): Promise<IRoom | null> {
    const query: any = {
      $or: [{ code: codeOrSlug }, { slug: codeOrSlug }],
    };
    if (propertyId) {
      query.propertyId = propertyId;
    }
    return await Room.findOne(query);
  }

  static calculateQuote(
    nightlyRate: number,
    checkInStr: string,
    checkOutStr: string
  ): QuoteCalculation {
    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);

    let nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    if (isNaN(nights) || nights < 1) nights = 1;

    const roomTotal = nightlyRate * nights;
    const cleaning = 900; // Fixed estate turnover cleaning fee
    const tax = Math.round((roomTotal + cleaning) * 0.12); // 12% GST
    const total = roomTotal + cleaning + tax;
    const deposit = Math.round(total * 0.5); // 50% deposit option

    return {
      nightly: nightlyRate,
      nights,
      roomTotal,
      cleaning,
      tax,
      total,
      deposit,
    };
  }

  static async createRoom(data: Partial<IRoom>): Promise<IRoom> {
    return await Room.create(data);
  }

  static async updateRoom(
    codeOrSlug: string,
    updates: Partial<IRoom>,
    propertyId?: string,
    ownerId?: string
  ): Promise<IRoom | null> {
    const query: any = { $or: [{ code: codeOrSlug }, { slug: codeOrSlug }] };
    if (propertyId) query.propertyId = propertyId;
    else if (ownerId) query.ownerId = ownerId;

    return await Room.findOneAndUpdate(
      query,
      updates,
      { returnDocument: "after" }
    );
  }

  static async deleteRoom(codeOrSlug: string, propertyId?: string, ownerId?: string): Promise<boolean> {
    const query: any = { $or: [{ code: codeOrSlug }, { slug: codeOrSlug }] };
    if (propertyId) query.propertyId = propertyId;
    else if (ownerId) query.ownerId = ownerId;

    const res = await Room.deleteOne(query);
    return res.deletedCount > 0;
  }

  static async setMaintenanceHold(
    codeOrSlug: string,
    hold: { label: string; range: string; startDate?: string; endDate?: string } | undefined,
    propertyId?: string,
    ownerId?: string
  ): Promise<IRoom | null> {
    const query: any = { $or: [{ code: codeOrSlug }, { slug: codeOrSlug }] };
    if (propertyId) query.propertyId = propertyId;
    else if (ownerId) query.ownerId = ownerId;

    return await Room.findOneAndUpdate(
      query,
      { $set: { hold, status: hold ? "Maintenance" : "Active" } },
      { returnDocument: "after" }
    );
  }

  static async getAvailabilityGrid(startDateStr: string, days = 14, propertyId?: string, ownerId?: string) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);

    const roomQuery: any = {};
    if (propertyId) roomQuery.propertyId = propertyId;
    else if (ownerId) roomQuery.ownerId = ownerId;

    const rooms = await Room.find(roomQuery).sort({ code: 1 });
    const bookingQuery: any = {
      status: { $ne: "cancelled" },
      $or: [
        {
          checkIn: { $lte: endDate.toISOString().slice(0, 10) },
          checkOut: { $gte: startDate.toISOString().slice(0, 10) },
        },
      ],
    };
    if (propertyId) bookingQuery.propertyId = propertyId;
    else if (ownerId) bookingQuery.ownerId = ownerId;

    const bookings = await Booking.find(bookingQuery);

    return rooms.map((room) => {
      const roomBookings = bookings.filter((b) => b.roomCode === room.code);
      return {
        room: {
          code: room.code,
          slug: room.slug,
          name: room.name,
          category: room.category,
          nightly: room.nightly,
          status: room.status,
          hold: room.hold,
        },
        bookings: roomBookings.map((b) => ({
          reference: b.reference,
          guestName: b.guestName,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          channel: b.channel,
          status: b.status,
        })),
      };
    });
  }
}
