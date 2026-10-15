import type { Request, Response } from "express";
import { Property } from "../models/property.model.js";
import { Room } from "../models/room.model.js";
import { Driver } from "../models/driver.model.js";
import { Booking } from "../models/booking.model.js";
import { CabTrip } from "../models/cab-trip.model.js";
import { User } from "../models/user.model.js";
import { AnalyticsService } from "../services/analytics.service.js";
import { getCabRequestModel } from "../models/cab-request.model.js";
import { getPayoutRequestModel } from "../models/payout-request.model.js";
import { tenantManager } from "../stayride/store.js";
import { isPayoutEligible } from "../stayride/routes.js";
import { CommissionService } from "../services/commission.service.js";

// StayRide data lives in the "production" db ("test" for the demo tenant), not the default connection.
const isDemoReq = (req: Request) => req.query.demo === "true" || req.body?.demo === true;
const cabModel = (req: Request) => getCabRequestModel(isDemoReq(req)) as any;

// Apply admin-side changes to the owner's trip so the app shows the same state.
async function updateTenantTrip(doc: any, apply: (trip: any) => void) {
  if (!doc.tripId) return;
  const tenantKey = String(doc.propertyId);
  const store = await tenantManager.getStoreAsync(tenantKey);
  const trip = store.trips.find((t) => t.id === doc.tripId && t.reference === doc.reference);
  if (!trip) return;
  apply(trip);
  await tenantManager.persistTenant(tenantKey);
}

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

  // ----------------------------------------------------
  // Dynamic Commission Management (Section 2.3)
  // ----------------------------------------------------

  static async getCommissionSettings(_req: Request, res: Response) {
    try {
      const { CommissionService } = await import("../services/commission.service.js");
      const settings = await CommissionService.getSettings();
      res.json({ success: true, data: settings });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async updateCommissionSettings(req: Request, res: Response) {
    try {
      const { CommissionService } = await import("../services/commission.service.js");
      const { globalPlatformFeePercent, globalHomestayCommissionPercent, defaultAdvancePercent, changeReason } = req.body;
      const updatedBy = (req as any).user?.email || "admin";

      const settings = await CommissionService.updateSettings({
        globalPlatformFeePercent: Number(globalPlatformFeePercent),
        globalHomestayCommissionPercent: Number(globalHomestayCommissionPercent),
        defaultAdvancePercent: defaultAdvancePercent !== undefined ? Number(defaultAdvancePercent) : undefined,
        updatedBy,
        changeReason,
      });

      res.json({ success: true, message: "Commission settings updated successfully.", data: settings });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async previewCommission(req: Request, res: Response) {
    try {
      const { CommissionService } = await import("../services/commission.service.js");
      const { fare, propertyId } = req.body;
      if (!fare || isNaN(Number(fare))) {
        return res.status(400).json({ success: false, error: "Valid numeric fare is required." });
      }

      const split = await CommissionService.calculateSplit(Number(fare), propertyId);
      res.json({ success: true, data: split });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // ----------------------------------------------------
  // Feature Access Appeals (Section 2.4 & Section 9)
  // ----------------------------------------------------

  static async getAppeals(_req: Request, res: Response) {
    try {
      const { FeatureAppeal } = await import("../models/feature-appeal.model.js");
      const appeals = await FeatureAppeal.find().sort({ createdAt: -1 });
      res.json({ success: true, count: appeals.length, data: appeals });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async decideAppeal(req: Request, res: Response) {
    try {
      const { FeatureAppeal } = await import("../models/feature-appeal.model.js");
      const { id } = req.params;
      const { status, decisionNote } = req.body;

      if (!["APPROVED", "REJECTED"].includes(status)) {
        return res.status(400).json({ success: false, error: "Status must be APPROVED or REJECTED." });
      }

      const appeal = await FeatureAppeal.findById(id);
      if (!appeal) {
        return res.status(404).json({ success: false, error: "Appeal not found." });
      }
      if (appeal.status !== "PENDING") {
        return res.status(409).json({ success: false, error: `Appeal was already ${appeal.status.toLowerCase()}.` });
      }

      appeal.status = status;
      appeal.decisionNote = decisionNote || "";
      appeal.decidedBy = (req as any).user?.email || "admin";
      appeal.decidedAt = new Date();
      await appeal.save();

      // If approved, update property's featureAccess flag
      if (status === "APPROVED") {
        const prop = await Property.findById(appeal.propertyId);
        if (prop) {
          prop.featureAccess = prop.featureAccess || {
            campaigns: true,
            networkDispatch: true,
            guestCabLinks: true,
          };
          if (appeal.featureKey === "campaigns") prop.featureAccess.campaigns = true;
          if (appeal.featureKey === "networkDispatch") prop.featureAccess.networkDispatch = true;
          if (appeal.featureKey === "guestCabRequests") prop.featureAccess.guestCabLinks = true;
          await prop.save();
        }
      }

      res.json({ success: true, message: `Appeal marked as ${status}.`, data: appeal });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ----------------------------------------------------
  // Pending Cab Requests (Workflow B - Section 2.5 & 6)
  // ----------------------------------------------------

  static async getPendingCabRequests(req: Request, res: Response) {
    try {
      const requests = await cabModel(req)
        .find({ status: { $in: ["PENDING_REVIEW", "FINDING_DRIVER", "QUOTE_RECEIVED", "AWAITING_ADVANCE_PAYMENT"] } })
        .sort({ createdAt: -1 })
        .limit(200);
      res.json({ success: true, count: requests.length, data: requests });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async assignDriverToRequest(req: Request, res: Response) {
    try {
      const { assignedDriverName, assignedDriverPhone, vehicleModel, vehiclePlate, agreedFare } = req.body;
      const fare = Number(agreedFare);
      if (!Number.isFinite(fare) || fare <= 0) {
        return res.status(400).json({ success: false, error: "Agreed fare must be greater than zero." });
      }
      if (!assignedDriverName || !assignedDriverPhone) {
        return res.status(400).json({ success: false, error: "Driver name and phone are required." });
      }

      const Model = cabModel(req);
      const request = await Model.findById(req.params.id);
      if (!request) return res.status(404).json({ success: false, error: "Cab request not found." });

      const split = await CommissionService.calculateSplit(fare, String(request.propertyId));
      const financialSnapshot = {
        agreedFare: split.agreedFare,
        advanceAmount: split.advanceAmount,
        advancePaid: false,
        platformFeeRate: split.platformFeeRate,
        platformFeeAmount: split.platformFeeAmount,
        homestayCommissionRate: split.homestayCommissionRate,
        homestayCommissionAmount: split.homestayCommissionAmount,
        driverPayoutAmount: split.driverPayoutAmount,
        remainingCashToDriver: split.remainingCashToDriver,
        calculatedAt: new Date(),
      };

      // Only open requests can be (re)assigned; the status filter makes this atomic.
      const updated = await Model.findOneAndUpdate(
        { _id: request._id, status: { $in: ["PENDING_REVIEW", "FINDING_DRIVER", "QUOTE_RECEIVED", "AWAITING_ADVANCE_PAYMENT"] }, advancePaid: { $ne: true } },
        {
          assignedDriverName: String(assignedDriverName).slice(0, 100),
          assignedDriverPhone: String(assignedDriverPhone).slice(0, 20),
          vehicleDetails: { model: String(vehicleModel || request.vehicleType || ""), plate: String(vehiclePlate || "") },
          agreedFare: split.agreedFare,
          advanceAmount: split.advanceAmount,
          remainingCashAmount: split.remainingCashToDriver,
          status: "AWAITING_ADVANCE_PAYMENT",
          financialSnapshot,
          adminNotes: `Assigned by ${(req as any).user?.email || "admin"}`,
        },
        { returnDocument: "after" }
      );
      if (!updated) return res.status(409).json({ success: false, error: "Request is no longer open for assignment." });

      await updateTenantTrip(updated, (trip) => {
        trip.driverId = null;
        trip.driverName = updated.assignedDriverName;
        trip.fare = split.agreedFare;
        trip.status = "AWAITING_ADVANCE";
        trip.financialSnapshot = financialSnapshot;
        trip.commission = split.homestayCommissionAmount;
        trip.advanceAmount = split.advanceAmount;
        trip.advancePaid = false;
        trip.remainingCashAmount = split.remainingCashToDriver;
      });

      res.json({ success: true, message: "Driver assigned and financial snapshot generated.", data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Audited manual reconciliation of the guest advance (until a gateway webhook exists).
  static async recordCabRequestPayment(req: Request, res: Response) {
    try {
      const { transactionId, amount, method, note } = req.body;
      const methods = ["UPI", "BANK_TRANSFER", "CASH", "GATEWAY"];
      if (!transactionId || typeof transactionId !== "string") {
        return res.status(400).json({ success: false, error: "Transaction ID is required." });
      }
      if (!methods.includes(method)) {
        return res.status(400).json({ success: false, error: `Method must be one of ${methods.join(", ")}.` });
      }
      const Model = cabModel(req);
      const request = await Model.findById(req.params.id);
      if (!request) return res.status(404).json({ success: false, error: "Cab request not found." });
      const paid = Number(amount);
      if (!Number.isFinite(paid) || paid < request.advanceAmount) {
        return res.status(400).json({ success: false, error: `Amount must be at least the advance of ₹${request.advanceAmount}.` });
      }

      const updated = await Model.findOneAndUpdate(
        { _id: request._id, status: "AWAITING_ADVANCE_PAYMENT", advancePaid: { $ne: true } },
        {
          advancePaid: true,
          "financialSnapshot.advancePaid": true,
          advancePaymentId: transactionId.trim().slice(0, 100),
          advancePaymentMethod: method,
          paymentRecordedBy: (req as any).user?.email || String((req as any).user?.id || "admin"),
          paymentRecordedAt: new Date(),
          paymentNote: String(note || "").slice(0, 500),
          status: "CONFIRMED",
        },
        { returnDocument: "after" }
      );
      if (!updated) return res.status(409).json({ success: false, error: "Request is not awaiting an advance payment." });

      await updateTenantTrip(updated, (trip) => {
        trip.advancePaid = true;
        trip.status = "CONFIRMED";
        if (trip.financialSnapshot) trip.financialSnapshot.advancePaid = true;
      });

      res.json({ success: true, message: "Advance payment recorded.", data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getHostPayouts(req: Request, res: Response) {
    try {
      const requests = await (getPayoutRequestModel(isDemoReq(req)) as any).find().sort({ requestedAt: -1 }).limit(100);
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch host payouts" });
    }
  }

  static async settleHostPayout(req: Request, res: Response) {
    try {
      const { utrNumber, notes } = req.body;
      if (!utrNumber || typeof utrNumber !== "string") {
        return res.status(400).json({ error: "UTR / reference number is required." });
      }
      // Atomic PENDING -> SETTLED: a second click (or a parallel request) gets 409.
      const payout = await (getPayoutRequestModel(isDemoReq(req)) as any).findOneAndUpdate(
        { _id: req.params.id, status: "PENDING" },
        { status: "SETTLED", utrNumber: utrNumber.trim(), notes: String(notes || ""), settledAt: new Date() },
        { returnDocument: "after" }
      );
      if (!payout) return res.status(409).json({ error: "Payout not found or already settled." });

      // Mark eligible trips (oldest first) as paid by this payout, never more than its amount.
      const store = await tenantManager.getStoreAsync(payout.tenantId);
      let remaining = payout.amount;
      for (const trip of [...store.trips].reverse()) {
        if (isPayoutEligible(trip) && trip.commission <= remaining) {
          trip.commissionPaid = true;
          trip.payoutId = String(payout._id);
          remaining -= trip.commission;
        }
      }
      await tenantManager.persistTenant(payout.tenantId);

      res.json({
        success: true,
        message: `Homestay commission of ₹${payout.amount} settled successfully with UTR ${payout.utrNumber}`,
        payout,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to settle host payout" });
    }
  }
}


