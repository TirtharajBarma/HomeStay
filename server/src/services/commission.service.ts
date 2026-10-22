import { getCommissionSettingsModel, ICommissionSettings } from "../models/commission-settings.model.js";
import { getTenantControlModel, FEATURE_KEYS, FeatureKey } from "../models/tenant-control.model.js";
import { resolvePlatformConfig, PlatformConfig } from "./platform-config.js";

export interface CommissionCalculationResult {
  agreedFare: number;
  platformFeeRate: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  homestayCommissionRate: number;
  homestayCommissionPercent: number;
  homestayCommissionAmount: number;
  driverPayoutRate: number;
  driverPayoutAmount: number;
  advanceRate: number;
  advanceAmount: number;
  remainingCashToDriver: number;
  driverShareOfAdvance: number; // part of the advance the platform owes the driver
}

// Defaults when admin hasn't configured a feature yet.
const FEATURE_DEFAULTS: Record<FeatureKey, { enabled: boolean; defaultOn: boolean }> = {
  campaigns: { enabled: true, defaultOn: false }, // gated: admin grants per homestay (or via appeal)
  guestCabLinks: { enabled: true, defaultOn: true },
  platformDispatch: { enabled: true, defaultOn: true },
  payouts: { enabled: true, defaultOn: true },
  driverQuotes: { enabled: true, defaultOn: true },
};

const pct = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

export function validateRates(pf: number, hc: number, adv: number) {
  if (![pf, hc, adv].every((n) => Number.isFinite(n))) throw new Error("Rates must be numbers.");
  if (pf < 0 || hc < 0 || pf > 100 || hc > 100) throw new Error("Percentages must be between 0 and 100.");
  if (pf + hc >= 100) throw new Error("Platform Fee % + Homestay Commission % must be less than 100%.");
  if (adv < 5 || adv > 100) throw new Error("Advance % must be between 5 and 100.");
}

export class CommissionService {
  static async getSettings(isDemo = false): Promise<ICommissionSettings> {
    const Model = getCommissionSettingsModel(isDemo);
    const existing = await Model.findOne().sort({ createdAt: -1 });
    if (existing) return existing;
    // Upsert on a fixed key so concurrent cold starts can't create two settings docs.
    await Model.updateOne(
      { updatedBy: "system_init" },
      {
        $setOnInsert: {
          globalPlatformFeePercent: 5,
          globalHomestayCommissionPercent: 10,
          defaultAdvancePercent: 15,
          minAdvanceAmount: 300,
          // Demo showcases every feature; real homestays follow the admin defaults.
          features: isDemo
            ? Object.fromEntries(FEATURE_KEYS.map((k) => [k, { enabled: true, defaultOn: true }]))
            : FEATURE_DEFAULTS,
          propertyOverrides: [],
          changeReason: "Initial system default rates",
        },
      },
      { upsert: true }
    );
    return (await Model.findOne().sort({ createdAt: -1 }))!;
  }

  static async updateSettings(params: {
    globalPlatformFeePercent?: unknown;
    globalHomestayCommissionPercent?: unknown;
    defaultAdvancePercent?: unknown;
    minAdvanceAmount?: unknown;
    features?: Record<string, { enabled?: unknown; defaultOn?: unknown }>;
    platform?: Record<string, any>;
    updatedBy: string;
    changeReason?: string;
    isDemo?: boolean;
  }): Promise<{ before: any; after: ICommissionSettings }> {
    const settings = await this.getSettings(Boolean(params.isDemo));
    const before = settings.toObject();
    // Omitted values keep what is saved, so saving one settings form never reverts another's changes
    const pf = params.globalPlatformFeePercent === undefined ? settings.globalPlatformFeePercent : pct(params.globalPlatformFeePercent);
    const hc = params.globalHomestayCommissionPercent === undefined ? settings.globalHomestayCommissionPercent : pct(params.globalHomestayCommissionPercent);
    const adv = params.defaultAdvancePercent === undefined ? settings.defaultAdvancePercent : pct(params.defaultAdvancePercent);
    validateRates(pf, hc, adv);
    settings.globalPlatformFeePercent = pf;
    settings.globalHomestayCommissionPercent = hc;
    settings.defaultAdvancePercent = adv;
    if (params.minAdvanceAmount !== undefined) {
      const min = pct(params.minAdvanceAmount);
      if (!Number.isFinite(min) || min < 0) throw new Error("Minimum advance must be 0 or more.");
      settings.minAdvanceAmount = min;
    }
    if (params.features) {
      const next: any = { ...this.globalFeatures(settings) };
      for (const key of FEATURE_KEYS) {
        const f = params.features[key];
        if (!f) continue;
        next[key] = {
          enabled: f.enabled === undefined ? next[key].enabled : f.enabled === true,
          defaultOn: f.defaultOn === undefined ? next[key].defaultOn : f.defaultOn === true,
        };
      }
      settings.features = next;
      settings.markModified("features");
    }
    if (params.platform && typeof params.platform === "object") {
      // Partial edits merge onto what is saved; the result is validated/clamped before it is stored.
      const current = this.platformConfig(settings);
      settings.platform = resolvePlatformConfig({
        ...current,
        ...params.platform,
        vehicles: { ...current.vehicles, ...(params.platform.vehicles || {}) },
      }) as any;
      settings.markModified("platform");
    }
    settings.updatedBy = params.updatedBy;
    settings.changeReason = params.changeReason || "Admin updated platform settings";
    settings.effectiveFrom = new Date();
    await settings.save();
    this.configCache.delete(Boolean(params.isDemo));
    return { before, after: settings };
  }

  /** The admin's operational settings, complete and valid (defaults fill anything unsaved). */
  static platformConfig(settings: ICommissionSettings): PlatformConfig {
    return resolvePlatformConfig((settings as any).platform);
  }

  // Read on hot paths (every list, every message), so cached briefly; a save clears it at once on this
  // instance. ponytail: per-instance cache, other serverless instances see a change within 30s.
  private static configCache = new Map<boolean, { at: number; cfg: PlatformConfig }>();

  static async getPlatformConfig(isDemo = false): Promise<PlatformConfig> {
    const hit = this.configCache.get(isDemo);
    if (hit && Date.now() - hit.at < 30000) return hit.cfg;
    const cfg = this.platformConfig(await this.getSettings(isDemo));
    this.configCache.set(isDemo, { at: Date.now(), cfg });
    return cfg;
  }

  static globalFeatures(settings: ICommissionSettings): Record<FeatureKey, { enabled: boolean; defaultOn: boolean }> {
    const out: any = {};
    for (const key of FEATURE_KEYS) out[key] = { ...FEATURE_DEFAULTS[key], ...((settings.features || {}) as any)[key] };
    return out;
  }

  static async getControl(tenantKey: string, isDemo = false) {
    return getTenantControlModel(isDemo).findOne({ tenantKey }).lean() as Promise<any>;
  }

  /** Effective account state for a homestay: blocked flag + features (global disable always wins). */
  static async getAccountState(tenantKey: string, isDemo = false) {
    const [settings, control] = await Promise.all([this.getSettings(isDemo), this.getControl(tenantKey, isDemo)]);
    return this.accountStateFrom(settings, control);
  }

  /** Pure version of getAccountState for batch use (admin tenant list): no DB calls. */
  static accountStateFrom(settings: ICommissionSettings, control: any) {
    const global = this.globalFeatures(settings);
    const features = {} as Record<FeatureKey, boolean>;
    for (const key of FEATURE_KEYS) {
      const override = control?.features?.[key];
      features[key] = global[key].enabled && (typeof override === "boolean" ? override : global[key].defaultOn);
    }
    return { blocked: Boolean(control?.blocked), blockReason: control?.blockReason || "", features, settings, control };
  }

  static async getEffectiveRates(tenantKey?: string, isDemo = false) {
    const settings = await this.getSettings(isDemo);
    const control = tenantKey ? await this.getControl(tenantKey, isDemo) : null;
    const o = control?.commissionOverride;
    return {
      pfPercent: o?.pfPercent ?? settings.globalPlatformFeePercent,
      hcPercent: o?.hcPercent ?? settings.globalHomestayCommissionPercent,
      advancePercent: o?.advancePercent ?? settings.defaultAdvancePercent ?? 15,
      minAdvanceAmount: settings.minAdvanceAmount ?? 300,
      isOverride: Boolean(o),
    };
  }

  /** Exact split for an agreed fare. Integer rupees; PF + HC + driver always equals the fare. */
  static async calculateSplit(fare: number, tenantKey?: string, isDemo = false): Promise<CommissionCalculationResult> {
    const { pfPercent, hcPercent, advancePercent, minAdvanceAmount } = await this.getEffectiveRates(tenantKey, isDemo);
    return this.split(fare, pfPercent, hcPercent, advancePercent, minAdvanceAmount);
  }

  static split(fare: number, pfPercent: number, hcPercent: number, advancePercent: number, minAdvanceAmount: number): CommissionCalculationResult {
    if (!Number.isFinite(fare) || fare <= 0) throw new Error("Fare must be a positive number.");
    const agreedFare = Math.round(fare);
    const platformFeeAmount = Math.round((agreedFare * pfPercent) / 100);
    const homestayCommissionAmount = Math.round((agreedFare * hcPercent) / 100);
    const totalCommission = platformFeeAmount + homestayCommissionAmount;

    // Advance collected online from guest is strictly for StayRide platform fee + homestay commission.
    // It respects the minimum advance floor (minAdvanceAmount) and never exceeds the total agreed fare.
    const advanceAmount = Math.min(
      agreedFare,
      Math.max(minAdvanceAmount, totalCommission, Math.round((agreedFare * advancePercent) / 100))
    );

    const driverShareOfAdvance = Math.max(0, advanceAmount - totalCommission);
    const remainingCashToDriver = Math.max(0, agreedFare - advanceAmount);
    const driverPayoutAmount = remainingCashToDriver + driverShareOfAdvance;

    return {
      agreedFare,
      platformFeeRate: pfPercent / 100,
      platformFeePercent: pfPercent,
      platformFeeAmount,
      homestayCommissionRate: hcPercent / 100,
      homestayCommissionPercent: hcPercent,
      homestayCommissionAmount,
      driverPayoutRate: agreedFare > 0 ? driverPayoutAmount / agreedFare : 0,
      driverPayoutAmount,
      advanceRate: agreedFare > 0 ? advanceAmount / agreedFare : 0,
      advanceAmount,
      remainingCashToDriver,
      driverShareOfAdvance,
    };
  }

  /**
   * Given the net cash the driver wants in hand, calculate the total guest fare and breakdown
   * so the driver is guaranteed 100% of their net cash quote.
   */
  static fromDriverNetCash(
    driverCash: number,
    pfPercent: number,
    hcPercent: number,
    minAdvanceAmount: number
  ): CommissionCalculationResult {
    if (!Number.isFinite(driverCash) || driverCash <= 0) throw new Error("Driver cash fare must be a positive number.");
    const netCash = Math.round(driverCash);
    const combinedRate = (pfPercent + hcPercent) / 100;
    const naturalFee = combinedRate > 0 && combinedRate < 1 ? Math.round(netCash * (combinedRate / (1 - combinedRate))) : 0;
    const advanceAmount = Math.max(minAdvanceAmount, naturalFee);
    const agreedFare = netCash + advanceAmount;

    const totalPct = pfPercent + hcPercent;
    const platformFeeAmount = totalPct > 0 ? Math.round(advanceAmount * (pfPercent / totalPct)) : 0;
    const homestayCommissionAmount = advanceAmount - platformFeeAmount;
    const remainingCashToDriver = netCash;
    const driverPayoutAmount = netCash;

    return {
      agreedFare,
      platformFeeRate: pfPercent / 100,
      platformFeePercent: pfPercent,
      platformFeeAmount,
      homestayCommissionRate: hcPercent / 100,
      homestayCommissionPercent: hcPercent,
      homestayCommissionAmount,
      driverPayoutRate: agreedFare > 0 ? driverPayoutAmount / agreedFare : 0,
      driverPayoutAmount,
      advanceRate: agreedFare > 0 ? advanceAmount / agreedFare : 0,
      advanceAmount,
      remainingCashToDriver,
      driverShareOfAdvance: 0,
    };
  }

  static async calculateGrossFromDriverCash(driverCash: number, tenantKey?: string, isDemo = false): Promise<CommissionCalculationResult> {
    const { pfPercent, hcPercent, minAdvanceAmount } = await this.getEffectiveRates(tenantKey, isDemo);
    return this.fromDriverNetCash(driverCash, pfPercent, hcPercent, minAdvanceAmount);
  }
}
