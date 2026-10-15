import { CommissionSettings, ICommissionSettings } from "../models/commission-settings.model.js";
import mongoose from "mongoose";
import { Property } from "../models/property.model.js";

export interface CommissionCalculationResult {
  agreedFare: number;
  platformFeeRate: number; // e.g. 0.05
  platformFeePercent: number; // e.g. 5.0
  platformFeeAmount: number;
  homestayCommissionRate: number; // e.g. 0.10
  homestayCommissionPercent: number; // e.g. 10.0
  homestayCommissionAmount: number;
  driverPayoutRate: number; // e.g. 0.85
  driverPayoutAmount: number;
  advanceRate: number; // e.g. 0.15
  advanceAmount: number;
  remainingCashToDriver: number;
}

export class CommissionService {
  /**
   * Retrieves the current CommissionSettings document, initializing with defaults if none exists.
   */
  static async getSettings(): Promise<ICommissionSettings> {
    let settings = await CommissionSettings.findOne().sort({ createdAt: -1 });
    if (!settings) {
      settings = await CommissionSettings.create({
        globalPlatformFeePercent: 5.0,
        globalHomestayCommissionPercent: 10.0,
        defaultAdvancePercent: 15.0,
        propertyOverrides: [],
        updatedBy: "system_init",
        changeReason: "Initial system default rates",
      });
    }
    return settings;
  }

  /**
   * Updates global commission rates and records audit details.
   */
  static async updateSettings(params: {
    globalPlatformFeePercent: number;
    globalHomestayCommissionPercent: number;
    defaultAdvancePercent?: number;
    updatedBy?: string;
    changeReason?: string;
  }): Promise<ICommissionSettings> {
    const { globalPlatformFeePercent, globalHomestayCommissionPercent, defaultAdvancePercent, updatedBy, changeReason } = params;

    if (globalPlatformFeePercent < 0 || globalHomestayCommissionPercent < 0) {
      throw new Error("Commission percentages cannot be negative.");
    }

    if (globalPlatformFeePercent + globalHomestayCommissionPercent >= 100) {
      throw new Error("Combined Platform Fee % and Homestay Commission % must be less than 100%.");
    }

    let settings = await CommissionSettings.findOne().sort({ createdAt: -1 });
    if (!settings) {
      settings = new CommissionSettings();
    }

    settings.globalPlatformFeePercent = globalPlatformFeePercent;
    settings.globalHomestayCommissionPercent = globalHomestayCommissionPercent;
    if (defaultAdvancePercent !== undefined) {
      settings.defaultAdvancePercent = defaultAdvancePercent;
    }
    settings.updatedBy = updatedBy || "admin";
    settings.changeReason = changeReason || "Admin updated commission rates";
    settings.effectiveFrom = new Date();

    await settings.save();
    return settings;
  }

  /**
   * Resolves the effective commission rates for a given property (override if set, otherwise global).
   */
  static async getEffectiveRates(propertyId?: string): Promise<{
    pfPercent: number;
    hcPercent: number;
    advancePercent: number;
    isOverride: boolean;
  }> {
    const settings = await this.getSettings();
    let pfPercent = settings.globalPlatformFeePercent;
    let hcPercent = settings.globalHomestayCommissionPercent;
    let isOverride = false;

    if (propertyId) {
      // 1. Check in CommissionSettings propertyOverrides array
      const override = settings.propertyOverrides.find(
        (o) => o.propertyId.toString() === propertyId.toString()
      );
      if (override) {
        pfPercent = override.platformFeePercent;
        hcPercent = override.homestayCommissionPercent;
        isOverride = true;
      } else if (mongoose.isValidObjectId(propertyId)) {
        // 2. Check on Property document itself (StayRide tenant keys are emails, not ObjectIds)
        const prop = await Property.findById(propertyId).select("platformFeePercent homestayCommissionPercent");
        if (prop?.platformFeePercent !== null && prop?.platformFeePercent !== undefined) {
          pfPercent = prop.platformFeePercent;
          isOverride = true;
        }
        if (prop?.homestayCommissionPercent !== null && prop?.homestayCommissionPercent !== undefined) {
          hcPercent = prop.homestayCommissionPercent;
          isOverride = true;
        }
      }
    }

    return {
      pfPercent,
      hcPercent,
      advancePercent: settings.defaultAdvancePercent ?? 15.0,
      isOverride,
    };
  }

  /**
   * Calculates the exact financial split for an agreed cab fare.
   */
  static async calculateSplit(fare: number, propertyId?: string): Promise<CommissionCalculationResult> {
    const { pfPercent, hcPercent, advancePercent } = await this.getEffectiveRates(propertyId);

    const agreedFare = Math.max(0, Math.round(fare));
    const pfRate = pfPercent / 100;
    const hcRate = hcPercent / 100;
    const advRate = advancePercent / 100;

    const platformFeeAmount = Math.round(agreedFare * pfRate);
    const homestayCommissionAmount = Math.round(agreedFare * hcRate);
    const driverPayoutAmount = Math.max(0, agreedFare - (platformFeeAmount + homestayCommissionAmount));
    const driverPayoutRate = Math.max(0, 1 - (pfRate + hcRate));

    // Advance from guest: advance% (min ₹300), always enough to cover PF + HC, never more than the fare.
    const advanceAmount = Math.min(
      agreedFare,
      Math.max(300, Math.round(agreedFare * advRate), platformFeeAmount + homestayCommissionAmount)
    );
    // Remaining cash guest pays directly to driver
    const remainingCashToDriver = Math.max(0, agreedFare - advanceAmount);

    return {
      agreedFare,
      platformFeeRate: pfRate,
      platformFeePercent: pfPercent,
      platformFeeAmount,
      homestayCommissionRate: hcRate,
      homestayCommissionPercent: hcPercent,
      homestayCommissionAmount,
      driverPayoutRate,
      driverPayoutAmount,
      advanceRate: advRate,
      advanceAmount,
      remainingCashToDriver,
    };
  }
}
