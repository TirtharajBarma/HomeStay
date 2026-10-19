import { VehicleType } from '../types';

// Admin-controlled settings sent by the server (owner/driver snapshot). The defaults below only cover
// the first launch before any sync; they mirror the server defaults (server/src/services/platform-config.ts).
export interface VehicleOption {
  value: VehicleType;
  label: string;
  seats: number;
  estFare: number;
}

export interface PlatformPublicConfig {
  pickupTimes: string[];
  bookingHorizonDays: number;
  sightseeingPresets: string[];
  vehicles: VehicleOption[];
  advanceWindowMin: number;
  ownFleetFeePercent: number;
  ownFleetMinFee: number;
}

const halfHours = (from: number, to: number) =>
  Array.from({ length: (to - from) / 30 + 1 }, (_, i) => {
    const m = from + i * 30;
    const h = Math.floor(m / 60);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  });

export const DEFAULT_PLATFORM_CONFIG: PlatformPublicConfig = {
  pickupTimes: halfHours(3 * 60 + 30, 22 * 60),
  bookingHorizonDays: 60,
  sightseeingPresets: [
    'Batasia Loop & War Memorial',
    'Tiger Hill Sunrise',
    'Lamahatta Eco Park',
    'Peace Pagoda',
    'Rock Garden & Ganga Maya Park',
    'Happy Valley Tea Estate',
    'Padmaja Naidu Zoo & HMI',
    'Ghoom Monastery',
    'Mirik Lake',
    'Bagdogra Airport (IXB)',
    'NJP Railway Station',
  ],
  vehicles: [
    { value: 'Sedan', label: '4 Seater (Sedan)', seats: 4, estFare: 2200 },
    { value: 'SUV', label: '6-7 Seater (Bolero / Innova)', seats: 7, estFare: 3000 },
    { value: '7-seater', label: '7 Seater (Ertiga / Maxi)', seats: 7, estFare: 3200 },
    { value: '9-seater', label: '9+ Seater (Traveller)', seats: 9, estFare: 4200 },
  ],
  advanceWindowMin: 0,
  ownFleetFeePercent: 5,
  ownFleetMinFee: 100,
};

// The store sets this after every sync so plain helpers (vehicle labels) see the admin's values too.
let current: PlatformPublicConfig = DEFAULT_PLATFORM_CONFIG;

export const getPlatformConfig = () => current;

/** Accepts the server's object; anything missing or malformed keeps the default. */
export function setPlatformConfig(next: Partial<PlatformPublicConfig> | null | undefined): PlatformPublicConfig {
  const d = DEFAULT_PLATFORM_CONFIG;
  const n = next || {};
  current = {
    pickupTimes: Array.isArray(n.pickupTimes) && n.pickupTimes.length ? n.pickupTimes : d.pickupTimes,
    bookingHorizonDays: Number(n.bookingHorizonDays) > 0 ? Number(n.bookingHorizonDays) : d.bookingHorizonDays,
    sightseeingPresets: Array.isArray(n.sightseeingPresets) ? n.sightseeingPresets : d.sightseeingPresets,
    vehicles: Array.isArray(n.vehicles) && n.vehicles.length ? n.vehicles : d.vehicles,
    advanceWindowMin: Number.isFinite(Number(n.advanceWindowMin)) ? Number(n.advanceWindowMin) : d.advanceWindowMin,
    ownFleetFeePercent: Number.isFinite(Number(n.ownFleetFeePercent)) ? Number(n.ownFleetFeePercent) : d.ownFleetFeePercent,
    ownFleetMinFee: Number.isFinite(Number(n.ownFleetMinFee)) ? Number(n.ownFleetMinFee) : d.ownFleetMinFee,
  };
  return current;
}

/** Same rule as the server: percent of the fare, at least the minimum, never above the fare. Display only. */
export const ownFleetFeeFor = (cfg: PlatformPublicConfig, fare: number) =>
  Math.min(fare, Math.max(cfg.ownFleetMinFee, Math.round((fare * cfg.ownFleetFeePercent) / 100)));
