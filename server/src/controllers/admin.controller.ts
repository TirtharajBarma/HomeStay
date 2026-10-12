import type { Request, Response } from "express";
import { Property } from "../models/property.model.js";
import { Room } from "../models/room.model.js";
import { Driver } from "../models/driver.model.js";
import { Booking } from "../models/booking.model.js";
import { CabTrip } from "../models/cab-trip.model.js";
import { User } from "../models/user.model.js";
import { AnalyticsService } from "../services/analytics.service.js";

export class AdminController {
  /**
   * Super-Admin aggregated platform overview matching architectural branch 4:
   * 1. see all homestays data
   * 2. see all driver data
   * 3. see revenue analytics
   */
  static async getOverview(_req: Request, res: Response) {
    try {
      const [
        homestays,
        rooms,
        drivers,
        bookings,
        cabTrips,
        users,
        analytics,
      ] = await Promise.all([
        Property.find().sort({ createdAt: -1 }),
        Room.find().sort({ code: 1 }),
        Driver.find().sort({ rating: -1 }),
        Booking.find({ status: { $ne: "cancelled" } }).sort({ createdAt: -1 }),
        CabTrip.find().sort({ createdAt: -1 }),
        User.find().select("-password").sort({ createdAt: -1 }),
        AnalyticsService.getAnalytics("month", 0),
      ]);

      const totalRoomRevenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
      const totalCabRevenue = cabTrips.reduce((sum, t) => sum + t.fareAmount, 0);
      const platformCommission = cabTrips.reduce((sum, t) => sum + t.estateCommission, 0);
      const totalDriverPayouts = cabTrips.reduce((sum, t) => sum + t.driverPayout, 0);
      const pendingPayouts = cabTrips
        .filter((t) => t.payoutStatus !== "settled")
        .reduce((sum, t) => sum + t.driverPayout, 0);

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
        commissionRate: h.commissionRate || 0.18,
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
        totalProperties: homestays.length,
        totalDrivers: drivers.length,
        totalTrips: cabTrips.length,
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
            totalHomestays: homestays.length,
            totalRooms: rooms.length,
            totalDrivers: drivers.length,
            totalRegisteredUsers: users.length,
            totalBookings: bookings.length,
            totalCabTrips: cabTrips.length,
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
      res.status(500).json({ success: false, error: err.message || "Failed to load admin overview" });
    }
  }

  static async settlePayout(req: Request, res: Response) {
    try {
      const id = req.params.id || req.body.tripId;
      const { settlementReference } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, error: "Missing tripId or payout id parameter" });
      }
      const trip = await CabTrip.findByIdAndUpdate(
        id,
        { payoutStatus: "settled", settlementReference: settlementReference || `UPI-${Date.now()}` },
        { returnDocument: "after" }
      );
      if (!trip) return res.status(404).json({ success: false, error: "Trip not found." });
      res.json({ success: true, message: "Payout marked as settled.", data: trip });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async updatePropertyStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const prop = await Property.findByIdAndUpdate(id, { status }, { returnDocument: "after" });
      if (!prop) return res.status(404).json({ success: false, error: "Property not found." });
      res.json({ success: true, message: "Property status updated.", data: prop });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
