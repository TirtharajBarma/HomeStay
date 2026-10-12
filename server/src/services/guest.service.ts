import { Guest, type IGuest } from "../models/guest.model.js";
import { Room } from "../models/room.model.js";

export class GuestService {
  static async getGuests(filters: {
    status?: string;
    query?: string;
    room?: string;
    ownerId?: string;
    propertyId?: string;
  } = {}): Promise<IGuest[]> {
    const mongoQuery: any = {};

    if (filters.propertyId) {
      mongoQuery.propertyId = filters.propertyId;
    } else if (filters.ownerId) {
      mongoQuery.ownerId = filters.ownerId;
    }

    if (filters.status && filters.status !== "Everyone" && filters.status !== "all") {
      mongoQuery.status = filters.status;
    }
    if (filters.room && filters.room !== "All units") {
      mongoQuery.room = filters.room;
    }
    if (filters.query) {
      mongoQuery.$or = [
        { name: new RegExp(filters.query, "i") },
        { email: new RegExp(filters.query, "i") },
        { phone: new RegExp(filters.query, "i") },
        { tags: new RegExp(filters.query, "i") },
      ];
    }

    return await Guest.find(mongoQuery).sort({ checkIn: -1 });
  }

  static async getGuestById(id: string, ownerId?: string): Promise<IGuest | null> {
    const query: any = { _id: id };
    if (ownerId) query.ownerId = ownerId;
    return await Guest.findOne(query);
  }

  static async updateGuest(id: string, updates: Partial<IGuest>, ownerId?: string): Promise<IGuest | null> {
    const query: any = { _id: id };
    if (ownerId) query.ownerId = ownerId;
    return await Guest.findOneAndUpdate(query, updates, { returnDocument: "after" });
  }

  static async getTimeline(startDateStr?: string, days = 14, ownerId?: string, propertyId?: string) {
    const start = startDateStr ? new Date(startDateStr) : new Date();
    const timeline = [];

    const roomQuery: any = {};
    if (propertyId) roomQuery.propertyId = propertyId;
    else if (ownerId) roomQuery.ownerId = ownerId;
    const totalUnits = (await Room.countDocuments(roomQuery)) || 1;

    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);

      // Guests arriving on this day
      const dayStart = new Date(dateStr);
      const dayEnd = new Date(dateStr);
      dayEnd.setHours(23, 59, 59, 999);

      const baseFilter: any = {};
      if (propertyId) baseFilter.propertyId = propertyId;
      else if (ownerId) baseFilter.ownerId = ownerId;

      const arrivals = await Guest.countDocuments({
        ...baseFilter,
        checkIn: { $gte: dayStart, $lte: dayEnd },
      });

      const departures = await Guest.countDocuments({
        ...baseFilter,
        checkOut: { $gte: dayStart, $lte: dayEnd },
      });

      const inHouse = await Guest.countDocuments({
        ...baseFilter,
        checkIn: { $lte: dayEnd },
        checkOut: { $gt: dayStart },
      });

      timeline.push({
        date: dateStr,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        dow: d.toLocaleDateString("en-US", { weekday: "short" }),
        arrivals,
        departures,
        inHouse,
        occupancyRate: Math.min(100, Math.round((inHouse / totalUnits) * 100)),
      });
    }

    return timeline;
  }
}
