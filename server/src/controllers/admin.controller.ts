import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Property } from "../models/property.model.js";
import { Room } from "../models/room.model.js";
import { Driver } from "../models/driver.model.js";
import { Booking } from "../models/booking.model.js";
import { CabTrip } from "../models/cab-trip.model.js";
import { User } from "../models/user.model.js";
import { AnalyticsService } from "../services/analytics.service.js";
import { CommissionService } from "../services/commission.service.js";
import { getTenantControlModel } from "../models/tenant-control.model.js";

const PROPERTY_STATUSES = ["active", "pending", "paused", "suspended"];

export class AdminController {
  /**
   * Super-Admin aggregated platform overview matching architectural branch 4:
   * 1. see all homestays data
   * 2. see all driver data
   * 3. see revenue analytics
   */
  static async getOverview(_req: Request, res: Response) {
    try {
      // Bounded: at most the 200 most recent documents per collection are loaded; totals come from
      // counts / aggregations so they stay correct without reading everything into memory.
      const LIMIT = 200;
      const [
        homestays,
        rooms,
        drivers,
        bookings,
        cabTrips,
        users,
        analytics,
        rates,
        counts,
        [bookingSums],
        [tripSums],
      ] = await Promise.all([
        Property.find().sort({ createdAt: -1 }).limit(LIMIT),
        Room.find().sort({ createdAt: -1 }).limit(LIMIT),
        Driver.find().sort({ createdAt: -1 }).limit(LIMIT),
        Booking.find({ status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).limit(LIMIT),
        CabTrip.find().sort({ createdAt: -1 }).limit(LIMIT),
        User.find().select("name").sort({ createdAt: -1 }).limit(LIMIT),
        AnalyticsService.getAnalytics("month", 0),
        CommissionService.getEffectiveRates(),
        Promise.all([
          Property.countDocuments(),
          Room.countDocuments(),
          Driver.countDocuments(),
          Booking.countDocuments({ status: { $ne: "cancelled" } }),
          CabTrip.countDocuments(),
          User.countDocuments(),
        ]),
        Booking.aggregate([{ $match: { status: { $ne: "cancelled" } } }, { $group: { _id: null, revenue: { $sum: "$totalAmount" } } }]),
        CabTrip.aggregate([
          {
            $group: {
              _id: null,
              revenue: { $sum: "$fareAmount" },
              commission: { $sum: "$estateCommission" },
              payouts: { $sum: "$driverPayout" },
              pending: { $sum: { $cond: [{ $ne: ["$payoutStatus", "settled"] }, "$driverPayout", 0] } },
            },
          },
        ]),
      ]);
      const [propertyCount, roomCount, driverCount, bookingCount, tripCount, userCount] = counts;

      // Platform-wide default commission, sourced from admin settings (no hard-coded rate).
      const { pfPercent, hcPercent } = rates;
      const defaultCommissionRate = (pfPercent + hcPercent) / 100;

      const totalRoomRevenue = bookingSums?.revenue || 0;
      const totalCabRevenue = tripSums?.revenue || 0;
      const platformCommission = tripSums?.commission || 0;
      const totalDriverPayouts = tripSums?.payouts || 0;
      const pendingPayouts = tripSums?.pending || 0;

      const userMap = new Map(users.map((u) => [String(u._id), u.name]));
      const driverMap = new Map(drivers.map((d) => [d.id, d.name]));

      const propertiesFormatted = homestays.map((h) => ({
        id: String(h._id),
        name: h.name,
        ownerName: userMap.get(String(h.ownerId)) || "Homestay Host",
        email: h.email || "",
        phone: h.phone || "",
        address: h.address || "",
        town: h.town || "Darjeeling",
        status: h.status || "active",
        commissionRate: h.commissionRate || defaultCommissionRate,
        roomsCount: rooms.filter((r) => String(r.propertyId) === String(h._id) || String(r.ownerId) === String(h.ownerId)).length,
      }));

      const recentTripsFormatted = cabTrips.slice(0, 50).map((t) => ({
        id: String(t._id),
        reference: t.reference,
        driverName: driverMap.get(t.driverId) || t.driverId,
        passengerName: t.guestName || "Guest Passenger",
        pickup: t.pickupName || "Darjeeling",
        dropoff: t.dropoffName || "NJP Railway Station",
        fare: t.fareAmount,
        commission: t.estateCommission,
        payout: t.driverPayout,
        payoutStatus: t.payoutStatus,
        settlementReference: t.settlementReference || "",
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
      }));

      const kpisFormatted = {
        totalProperties: propertyCount,
        totalDrivers: driverCount,
        totalTrips: tripCount,
        totalGrossRevenue: totalRoomRevenue + totalCabRevenue,
        totalPlatformCommission: platformCommission,
        pendingPayouts,
      };

      res.json({
        success: true,
        data: {
          kpis: kpisFormatted,
          properties: propertiesFormatted,
          recentTrips: recentTripsFormatted,
          metrics: {
            totalHomestays: propertyCount,
            totalRooms: roomCount,
            totalDrivers: driverCount,
            totalRegisteredUsers: userCount,
            totalBookings: bookingCount,
            totalCabTrips: tripCount,
            financials: {
              roomRevenue: totalRoomRevenue,
              cabRevenue: totalCabRevenue,
              platformCommission,
              driverPayouts: totalDriverPayouts,
              estateGross: totalRoomRevenue + platformCommission,
            },
          },
          homestays: propertiesFormatted,
          drivers: drivers.map((d) => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            vehicle: d.vehicle,
            plate: d.plate,
            rating: d.rating,
            trips: d.trips,
            status: d.status,
            commissionEarned: d.commission,
          })),
          analytics,
        },
      });
    } catch (err: any) {
      console.error("Admin overview failed:", err);
      res.status(500).json({ success: false, error: "Failed to load admin overview" });
    }
  }

  static async settlePayout(req: Request, res: Response) {
    try {
      const id = String(req.params.id || req.body.tripId || "");
      const settlementReference = typeof req.body.settlementReference === "string" ? req.body.settlementReference.trim().slice(0, 100) : "";
      if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, error: "Trip not found." });
      if (!settlementReference) {
        return res.status(400).json({ success: false, error: "settlementReference (UTR / transaction id) is required." });
      }
      // Settle once: a settled trip keeps its original reference.
      const trip = await CabTrip.findOneAndUpdate(
        { _id: id, payoutStatus: { $ne: "settled" } },
        { payoutStatus: "settled", settlementReference },
        { returnDocument: "after" }
      );
      if (!trip) {
        const exists = await CabTrip.exists({ _id: id });
        return res.status(exists ? 409 : 404).json({ success: false, error: exists ? "Payout is already settled." : "Trip not found." });
      }
      res.json({ success: true, message: "Payout marked as settled.", data: trip });
    } catch (err: any) {
      res.status(500).json({ success: false, error: "Failed to settle payout." });
    }
  }

  static async updatePropertyStatus(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { status } = req.body;
      if (!PROPERTY_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, error: `Status must be one of: ${PROPERTY_STATUSES.join(", ")}.` });
      }
      if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, error: "Property not found." });
      const prop = await Property.findByIdAndUpdate(id, { status }, { returnDocument: "after", runValidators: true });
      if (!prop) return res.status(404).json({ success: false, error: "Property not found." });

      // StayRide homestays are keyed by the owner's email.
      const tenantKey = String(prop.email || "").toLowerCase().trim();
      if (!tenantKey) {
        return res.json({ success: true, message: "Property status updated (no StayRide account linked).", data: prop });
      }
      if (status === "suspended") {
        await getTenantControlModel(false).updateOne(
          { tenantKey },
          { $set: { blocked: true, blockReason: "Property suspended by platform administrator." } },
          { upsert: true }
        );
      } else if (status === "active") {
        await getTenantControlModel(false).updateOne(
          { tenantKey },
          { $set: { blocked: false, blockReason: "" } },
          { upsert: true }
        );
      }

      res.json({ success: true, message: "Property status updated.", data: prop });
    } catch (err: any) {
      res.status(500).json({ success: false, error: "Failed to update property status." });
    }
  }
}
