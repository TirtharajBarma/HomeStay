import crypto from "crypto";
import mongoose from "mongoose";
import { Driver, type IDriver } from "../models/driver.model.js";
import { CabTrip, type ICabTrip } from "../models/cab-trip.model.js";
import { CommissionService } from "./commission.service.js";
import { NotificationService } from "./notification.service.js";

export const CURATED_CAB_PLACES = [
  {
    id: "meadowfall-estate",
    name: "Meadowfall Estate Gate",
    area: "Ging Tea Estate Road",
    lat: 27.0178,
    lng: 88.2351,
    note: "Ging Tea Estate Road · the house gate",
  },
  {
    id: "bagdogra-airport",
    name: "Bagdogra Airport",
    area: "Siliguri",
    lat: 26.6811,
    lng: 88.3392,
    note: "IXA · the nearest airport, 90 min down the hill",
  },
  {
    id: "new-jalpaiguri",
    name: "New Jalpaiguri Junction",
    area: "Jalpaiguri Road",
    lat: 26.6892,
    lng: 88.4242,
    note: "NJP · the main rail gateway",
  },
  {
    id: "darjeeling-station",
    name: "Darjeeling Railway Station",
    area: "Chowrasta",
    lat: 27.0393,
    lng: 88.2598,
    note: "DJR · UNESCO toy train terminus",
  },
  {
    id: "chowrasta",
    name: "Chowrasta",
    area: "Darjeeling town",
    lat: 27.0372,
    lng: 88.2689,
    note: "The Mall junction, heart of the town",
  },
  {
    id: "batasia",
    name: "Batasia Loop & Gorkha War Memorial",
    area: "Ging River Road",
    lat: 27.0224,
    lng: 88.2469,
    note: "The horseshoe loop, 20 minutes away",
  },
  {
    id: "tiger-hill",
    name: "Tiger Hill",
    area: "Ging Tea Estate",
    lat: 27.0113,
    lng: 88.2924,
    note: "Sunrise point for Singalila and Everest",
  },
  {
    id: "ghoom",
    name: "Ghoom Station",
    area: "Old Darjeeling road",
    lat: 27.0551,
    lng: 88.1993,
    note: "Highest rail station in India",
  },
  {
    id: "new-market",
    name: "New Market",
    area: "Darjeeling town",
    lat: 27.0413,
    lng: 88.2641,
    note: "Shops, bakeries and the morning market",
  },
  {
    id: "phalut",
    name: "Phalut Viewpoint",
    area: "Singalila National Park",
    lat: 27.1322,
    lng: 88.2318,
    note: "Snow line, 3,480 m",
  },
  {
    id: "kurseong",
    name: "Kurseong",
    area: "Kurseong Road",
    lat: 27.0552,
    lng: 88.4434,
    note: "Tea museum and the Eagle Craig viewpoint",
  },
  {
    id: "kalimpong",
    name: "Kalimpong",
    area: "Kalimpong Road",
    lat: 27.0663,
    lng: 88.5648,
    note: "Cardamom and cheese country",
  },
  {
    id: "mirik",
    name: "Mirik",
    area: "Rangbuli Road",
    lat: 27.0451,
    lng: 88.1403,
    note: "Orchards and the quietest lake in the hills",
  },
  {
    id: "namchi",
    name: "Namchi",
    area: "NH 27",
    lat: 27.1667,
    lng: 87.7333,
    note: "Road trip country, 2 hrs across the ridge",
  },
  {
    id: "siliguri",
    name: "Siliguri Junction",
    area: "Siliguri",
    lat: 26.4336,
    lng: 88.4097,
    note: "SGUJ · flats, rail and the airport road",
  },
];

export class DriverService {
  static getPlaces() {
    return CURATED_CAB_PLACES;
  }

  static async getDrivers(filters: { seats?: number; status?: string } = {}): Promise<IDriver[]> {
    const query: any = {};
    if (filters.seats) {
      query.seats = { $gte: Number(filters.seats) };
    }
    if (filters.status && filters.status !== "all") {
      query.status = filters.status;
    }
    return await Driver.find(query).sort({ rating: -1, trips: -1 });
  }

  static calculateDistanceKm(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): number {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(toLat - fromLat);
    const dLon = toRad(toLng - fromLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightKm = R * c;
    // Mountain hill road winding factor
    const windingKm = straightKm * 1.38;
    return Math.max(3, Math.round(windingKm * 10) / 10);
  }

  static async calculateQuote(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    seatsRequired = 4
  ) {
    const distanceKm = this.calculateDistanceKm(fromLat, fromLng, toLat, toLng);
    const drivers = await Driver.find({
      seats: { $gte: seatsRequired },
      status: { $in: ["Active", "On a trip"] },
    });

    // Commission comes from the single source of truth (admin-configured platform settings),
    // never from a hard-coded rate. PF + HC is the estate's cut; the remainder is the payout.
    const { pfPercent, hcPercent, advancePercent, minAdvanceAmount } = await CommissionService.getEffectiveRates();

    const quotes = drivers.map((driver) => {
      // Long distance hill surcharge (>40 km, e.g. down to Siliguri/Bagdogra)
      const surgeMultiplier = distanceKm > 40 ? 1.15 : 1.0;
      const rawFare = distanceKm * driver.perKm * surgeMultiplier;
      const fare = Math.round(Math.max(driver.minimum, rawFare) / 10) * 10;
      const split = CommissionService.split(fare, pfPercent, hcPercent, advancePercent, minAdvanceAmount);
      const commission = split.platformFeeAmount + split.homestayCommissionAmount;
      const payout = split.driverPayoutAmount;
      const etaMinutes = Math.round(15 + distanceKm * 2.2 + driver.etaPad);

      return {
        driverId: driver.id,
        name: driver.name,
        phone: driver.phone,
        vehicle: driver.vehicle,
        plate: driver.plate,
        colour: driver.colour,
        rating: driver.rating,
        seats: driver.seats,
        luggage: driver.luggage,
        coverage: driver.coverage,
        status: driver.status,
        distanceKm,
        etaMinutes,
        fare,
        commission,
        payout,
      };
    });

    return {
      distanceKm,
      quotes: quotes.sort((a, b) => a.fare - b.fare),
    };
  }

  static async createCabBooking(data: {
    driverId: string;
    guestName: string;
    email: string;
    phone: string;
    pickupName: string;
    pickupLat: number;
    pickupLng: number;
    dropoffName: string;
    dropoffLat: number;
    dropoffLng: number;
    pickupDate: string;
    pickupTime: string;
    seats: number;
  }): Promise<ICabTrip> {
    const driver = await Driver.findOne({ id: data.driverId });
    if (!driver) {
      throw new Error(`Driver with ID '${data.driverId}' not found`);
    }

    // Validate & snap coordinates against curated landmarks if available
    let pickupLat = data.pickupLat;
    let pickupLng = data.pickupLng;
    let dropoffLat = data.dropoffLat;
    let dropoffLng = data.dropoffLng;

    const matchedPickup = CURATED_CAB_PLACES.find(
      (p) =>
        p.id.toLowerCase() === data.pickupName?.toLowerCase() ||
        p.name.toLowerCase() === data.pickupName?.toLowerCase()
    );
    if (matchedPickup) {
      pickupLat = matchedPickup.lat;
      pickupLng = matchedPickup.lng;
    }

    const matchedDropoff = CURATED_CAB_PLACES.find(
      (p) =>
        p.id.toLowerCase() === data.dropoffName?.toLowerCase() ||
        p.name.toLowerCase() === data.dropoffName?.toLowerCase()
    );
    if (matchedDropoff) {
      dropoffLat = matchedDropoff.lat;
      dropoffLng = matchedDropoff.lng;
    }

    let distanceKm = this.calculateDistanceKm(
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng
    );

    // If locations have distinct names, enforce minimum route distance of 3km
    if (
      data.pickupName?.trim().toLowerCase() !== data.dropoffName?.trim().toLowerCase() &&
      distanceKm < 3
    ) {
      distanceKm = 3;
    }

    const surgeMultiplier = distanceKm > 40 ? 1.15 : 1.0;
    const rawFare = distanceKm * driver.perKm * surgeMultiplier;
    const fareAmount = Math.round(Math.max(driver.minimum, rawFare) / 10) * 10;
    // Single source of truth for the split (no hard-coded rate).
    const { pfPercent, hcPercent, advancePercent, minAdvanceAmount } = await CommissionService.getEffectiveRates();
    const split = CommissionService.split(fareAmount, pfPercent, hcPercent, advancePercent, minAdvanceAmount);
    const estateCommission = split.platformFeeAmount + split.homestayCommissionAmount;
    const driverPayout = split.driverPayoutAmount;

    const randomBytes = crypto.randomBytes(2);
    const refNum = (randomBytes.readUInt16BE(0) % 9000) + 1000;
    const reference = `CAB-${refNum}`;

    const trip = await CabTrip.create({
      reference,
      driverId: driver.id,
      driverName: driver.name,
      vehicle: driver.vehicle,
      plate: driver.plate,
      guestName: data.guestName,
      email: data.email,
      phone: data.phone,
      pickupName: data.pickupName,
      pickupLat,
      pickupLng,
      dropoffName: data.dropoffName,
      dropoffLat,
      dropoffLng,
      pickupDate: data.pickupDate,
      pickupTime: data.pickupTime,
      seats: data.seats,
      distanceKm,
      fareAmount,
      commissionRate: (pfPercent + hcPercent) / 100,
      estateCommission,
      driverPayout,
      status: "scheduled",
    });

    // Update driver state
    driver.status = "On a trip";
    driver.trips += 1;
    // `commission` is the estate's cut earned from this driver; only the commission is credited here,
    // never the driver's payout.
    driver.commission += estateCommission;
    await driver.save();

    // Dispatch Notifications asynchronously (guest confirmation + driver alert)
    try {
      await NotificationService.sendCabNotifications({
        reference: trip.reference,
        driverName: trip.driverName,
        driverPhone: driver.phone,
        guestName: trip.guestName,
        guestPhone: trip.phone,
        guestEmail: trip.email,
        pickup: trip.pickupName,
        dropoff: trip.dropoffName,
        date: trip.pickupDate,
        time: trip.pickupTime,
        fareAmount: trip.fareAmount,
      });
    } catch (notifErr) {
      console.warn("Cab trip notification dispatch notice:", notifErr);
    }

    return trip;
  }

  static async addDriver(data: Partial<IDriver>): Promise<IDriver> {
    if (!data.id) {
      const count = await Driver.countDocuments();
      data.id = `DRV-${101 + count}`;
    }
    if (!data.pin) {
      // Unique per driver; the old shared default of "1234" let any driver log in as any other.
      data.pin = String(crypto.randomInt(1000, 10000));
    }
    const driver = await Driver.create(data);
    if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
      console.log(`🧑✈️ [DRIVER PIN] ${driver.id} (${driver.phone}) -> ${driver.pin}`);
    }
    return driver;
  }

  static async updateDriverStatus(
    id: string,
    status: string
  ): Promise<IDriver | null> {
    const filter = mongoose.isValidObjectId(id) ? { $or: [{ id }, { _id: id }] } : { id };
    return await Driver.findOneAndUpdate(filter, { status }, { returnDocument: "after" });
  }

  static async getPayoutsLedger() {
    const trips = await CabTrip.find().sort({ createdAt: -1 });
    const totalFare = trips.reduce((acc, t) => acc + t.fareAmount, 0);
    const totalCommission = trips.reduce((acc, t) => acc + t.estateCommission, 0);
    const totalPayouts = trips.reduce((acc, t) => acc + t.driverPayout, 0);

    return {
      totalTrips: trips.length,
      totalFare,
      totalCommission,
      totalPayouts,
      trips,
    };
  }

  static async getDriverTrips(driverId: string) {
    return await CabTrip.find({
      $or: [{ driverId }, { driverName: new RegExp(driverId, "i") }],
    }).sort({ createdAt: -1 });
  }

  static async getDriverById(id: string) {
    const filter = mongoose.isValidObjectId(id) ? { $or: [{ id }, { _id: id }] } : { id };
    return await Driver.findOne(filter);
  }

  static async getTripById(id: string) {
    const filter = mongoose.isValidObjectId(id)
      ? { $or: [{ _id: id }, { reference: id }] }
      : { $or: [{ reference: id }, { id }] };
    return await CabTrip.findOne(filter);
  }

  /**
   * Authorization for a driver-scoped resource. A driver may only act on themselves; an owner
   * may only act on drivers they own (Driver.ownerId); admins may act on anyone. A plain role
   * check is not enough — without the ownership check any owner could read/modify any driver.
   */
  static async canAccessDriver(driverId: string, user: any): Promise<boolean> {
    if (!user) return false;
    if (user.role === "admin") return true;
    const driver = await this.getDriverById(driverId);
    if (!driver) return false;
    if (user.role === "driver") {
      return String(driver.id) === String(user.id) || String(driver._id) === String(user.id);
    }
    if (user.role === "owner") {
      return Boolean(driver.ownerId) && String(driver.ownerId) === String(user.id);
    }
    return false;
  }

  /** Same rule as canAccessDriver but resolved through the trip's driver. */
  static async canAccessTrip(tripId: string, user: any): Promise<boolean> {
    if (!user) return false;
    if (user.role === "admin") return true;
    const trip = await this.getTripById(tripId);
    if (!trip) return false;
    return this.canAccessDriver(trip.driverId, user);
  }

  static async updateTripStatus(tripId: string, status: string) {
    const filter = mongoose.isValidObjectId(tripId)
      ? { _id: tripId }
      : { $or: [{ reference: tripId }, { id: tripId }] };
    return await CabTrip.findOneAndUpdate(filter, { status }, { returnDocument: "after" });
  }
}
