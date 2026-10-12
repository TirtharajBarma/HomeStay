import { Booking } from "../models/booking.model.js";
import { Room } from "../models/room.model.js";

export class IcalService {
  /**
   * Generates an outbound iCal (.ics) string for a room so external OTAs
   * (Airbnb, Booking.com, VRBO) can import and block our dates.
   */
  static async generateIcal(roomCodeOrSlug: string, ownerId?: string): Promise<string> {
    const roomQuery: any = {
      $or: [{ code: roomCodeOrSlug }, { slug: roomCodeOrSlug.toLowerCase() }],
    };
    if (ownerId) roomQuery.ownerId = ownerId;

    const room = await Room.findOne(roomQuery);
    const roomCode = room ? room.code : roomCodeOrSlug;

    const bookingQuery: any = {
      roomCode,
      status: { $in: ["confirmed", "checked_in"] },
    };
    if (ownerId) bookingQuery.ownerId = ownerId;

    const bookings = await Booking.find(bookingQuery);

    const now = new Date();
    const stamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    let ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Hill Hospitality Platform//Room Calendar 1.0//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:Room ${roomCode} Calendar`,
    ];

    for (const b of bookings) {
      const dtStart = b.checkIn.replace(/-/g, "");
      const dtEnd = b.checkOut.replace(/-/g, "");
      const uid = `${b.reference || b._id}@platform.com`;

      ics.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:Reserved (${b.channel || "Platform"})`,
        `DESCRIPTION:Reservation Reference: ${b.reference}`,
        "STATUS:CONFIRMED",
        "END:VEVENT"
      );
    }

    ics.push("END:VCALENDAR");
    return ics.join("\r\n");
  }

  /**
   * Fetches an external OTA iCal feed (e.g. Airbnb .ics URL) and synchronizes
   * blocked booking dates into MongoDB to prevent double bookings.
   */
  static async syncInboundIcal(
    roomCodeOrSlug: string,
    icalUrl: string,
    ownerId?: string,
    propertyId?: string
  ): Promise<{ syncedCount: number; events: any[] }> {
    const room = await Room.findOne({
      $or: [{ code: roomCodeOrSlug }, { slug: roomCodeOrSlug.toLowerCase() }],
    });
    if (!room) {
      throw new Error(`Room '${roomCodeOrSlug}' not found.`);
    }

    // 1. Fetch raw .ics feed
    const res = await fetch(icalUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch iCal feed from ${icalUrl} (Status ${res.status})`);
    }

    const icsText = await res.text();
    const events = this.parseIcsText(icsText);

    let syncedCount = 0;
    for (const ev of events) {
      if (!ev.dtStart || !ev.dtEnd) continue;

      const bookingRef = `BK-OTA-${ev.uid.slice(0, 8).toUpperCase()}`;

      // Upsert into Booking collection
      await Booking.findOneAndUpdate(
        { reference: bookingRef },
        {
          reference: bookingRef,
          pin: "0000",
          roomCode: room.code,
          roomName: room.name,
          checkIn: ev.dtStart,
          checkOut: ev.dtEnd,
          party: 2,
          guestName: "Airbnb / OTA Guest",
          email: "ota-guest@platform.com",
          phone: "+91 98300 00000",
          channel: "airbnb",
          status: "confirmed",
          plan: "card_full",
          settled: true,
          dueToday: 0,
          balanceDue: 0,
          roomTotal: 0,
          cleaningFee: 0,
          serviceFee: 0,
          totalAmount: 0,
          notes: `Synchronized from external iCal: ${ev.summary || "Reserved"}`,
          ownerId: ownerId || room.ownerId,
          propertyId: propertyId || room.propertyId,
        },
        { upsert: true, returnDocument: "after" }
      );
      syncedCount++;
    }

    return { syncedCount, events };
  }

  /**
   * Simple standard parser for VEVENT blocks in raw iCal text.
   */
  private static parseIcsText(text: string): Array<{ uid: string; dtStart: string; dtEnd: string; summary: string }> {
    const lines = text.split(/\r\n|\n|\r/);
    const events: any[] = [];
    let inEvent = false;
    let current: any = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "BEGIN:VEVENT") {
        inEvent = true;
        current = { uid: "", dtStart: "", dtEnd: "", summary: "" };
      } else if (trimmed === "END:VEVENT") {
        if (inEvent && current.uid && current.dtStart) {
          events.push(current);
        }
        inEvent = false;
      } else if (inEvent) {
        if (trimmed.startsWith("UID:")) {
          current.uid = trimmed.slice(4).replace(/[^a-zA-Z0-9-]/g, "");
        } else if (trimmed.startsWith("SUMMARY:")) {
          current.summary = trimmed.slice(8);
        } else if (trimmed.includes("DTSTART")) {
          const val = trimmed.split(":")[1];
          if (val && val.length >= 8) {
            current.dtStart = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
          }
        } else if (trimmed.includes("DTEND")) {
          const val = trimmed.split(":")[1];
          if (val && val.length >= 8) {
            current.dtEnd = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
          }
        }
      }
    }

    return events;
  }
}
