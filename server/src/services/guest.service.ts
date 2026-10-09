import { Guest, type IGuest } from "../models/guest.model.js";

export class GuestService {
  static async getGuests(filters: {
    status?: string;
    query?: string;
    room?: string;
  } = {}): Promise<IGuest[]> {
    const mongoQuery: any = {};

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

  static async getGuestById(id: string): Promise<IGuest | null> {
    return await Guest.findById(id);
  }

  static async updateGuest(id: string, updates: Partial<IGuest>): Promise<IGuest | null> {
    return await Guest.findByIdAndUpdate(id, updates, { returnDocument: "after" });
  }

  static async getTimeline(startDateStr?: string, days = 14) {
    const start = startDateStr ? new Date(startDateStr) : new Date();
    const timeline = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);

      // Guests arriving on this day
      const dayStart = new Date(dateStr);
      const dayEnd = new Date(dateStr);
      dayEnd.setHours(23, 59, 59, 999);

      const arrivals = await Guest.countDocuments({
        checkIn: { $gte: dayStart, $lte: dayEnd },
      });

      const departures = await Guest.countDocuments({
        checkOut: { $gte: dayStart, $lte: dayEnd },
      });

      const inHouse = await Guest.countDocuments({
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
        occupancyRate: Math.min(100, Math.round((inHouse / 6) * 100)),
      });
    }

    return timeline;
  }
}
