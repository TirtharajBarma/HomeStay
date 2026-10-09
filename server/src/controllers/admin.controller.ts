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

      res.json({
        success: true,
        data: {
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
          homestays: homestays.map((h) => ({
            id: h._id,
            slug: h.slug,
            name: h.name,
            ownerId: h.ownerId,
            email: h.email,
            phone: h.phone,
            town: h.town,
            roomCount: rooms.filter((r) => String(r.propertyId) === String(h._id) || String(r.ownerId) === String(h.ownerId)).length,
          })),
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
}
