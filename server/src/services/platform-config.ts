// Operational settings the admin controls (stored on the platform settings document as `platform`).
// Everything the apps used to hard-code lives here; the apps read it from the server
// (owner snapshot, driver snapshot and the public guest link) instead of shipping their own copy.
// Defaults apply until the admin saves a value; every saved value is validated and clamped here.
import { parseTime12 } from '../stayride/time.js';

export const VEHICLE_KEYS = ['Sedan', 'SUV', '7-seater', '9-seater'] as const;
export type VehicleKey = (typeof VEHICLE_KEYS)[number];

export interface VehicleConfig {
  label: string;
  seats: number;
  estFare: number;
  enabled: boolean;
}

export interface RoutePreset {
  id: string;
  name: string;
  category: 'AIRPORT_STATION' | 'SIGHTSEEING' | 'DAY_EXCURSION' | 'LOCAL_DROP';
  duration?: string;
  description?: string;
  fares: Partial<Record<VehicleKey, number>>;
}

export interface PlatformConfig {
  /** Minutes the guest has to pay the advance; 0 = no deadline (keep 0 while payments are recorded by hand) */
  advanceWindowMin: number;
  /** StayRide fee on trips done by the owner's own drivers: percent of the fare, never below the minimum */
  ownFleetFeePercent: number;
  ownFleetMinFee: number;
  /** Max drivers messaged on WhatsApp per request (push goes to every matching driver) */
  driverBroadcastMax: number;
  /** Only drivers within this distance of the homestay hear about a request; 0 = no distance filter */
  nearbyRadiusKm: number;
  /** Meta template language code; templates must be approved in this language */
  whatsappLanguage: string;
  /** Minimum hours between two Ask-for-Cab messages to the same guest */
  askCabCooldownHours: number;
  pickupStart: string; // "hh:mm AM"
  pickupEnd: string;
  pickupStepMin: number;
  bookingHorizonDays: number;
  sightseeingPresets: string[];
  routePresets: RoutePreset[];
  vehicles: Record<VehicleKey, VehicleConfig>;
  requestExpiryHours: number;
  guestLinkDays: number;
  maxOpenRequestsPerPhone: number;
  maxFare: number;
  /** Calendar (iCal) links are only fetched from these sites (and their subdomains) */
  icalAllowedHosts: string[];
  /** A driver's quote stops counting after this many hours (he can quote again); 0 = never */
  quoteValidityHours: number;
  /** Minutes to wait for driver bids before auto-accepting lowest price quote; 0 = instant on first quote */
  quoteBiddingWindowMin: number;
  /** Meta-approved WhatsApp template name per message event (empty = plain text, test number only) */
  whatsappTemplates: Record<string, string>;
  /** Who runs StayRide, shown in the legal pages and the app (required business / grievance details) */
  business: BusinessDetails;
}

export interface BusinessDetails {
  name: string; // brand, e.g. StayRide
  legalName: string; // registered company / proprietor name
  address: string;
  email: string;
  phone: string;
  upiId?: string; // VPA for advance payments (e.g. stayride@upi)
  grievanceOfficer: string; // India IT Rules / DPDP Act: named contact for complaints
  grievanceEmail: string;
  website: string;
}

const BUSINESS_KEYS = ['name', 'legalName', 'address', 'email', 'phone', 'upiId', 'grievanceOfficer', 'grievanceEmail', 'website'] as const;

export const WHATSAPP_EVENTS = [
  'ASK_CAB',
  'NEW_REQUEST',
  'QUOTE_COUNTER',
  'QUOTE_ACCEPTED_DRIVER',
  'QUOTE_ACCEPTED_GUEST',
  'ADVANCE_PAID_GUEST',
  'ADVANCE_PAID_DRIVER',
  'ADVANCE_EXPIRED_GUEST',
  'TRIP_ASSIGNED_DRIVER',
  'TRIP_CANCELLED_GUEST',
  'REFUND_GUEST',
  'COMPLETION_REMINDER_DRIVER',
  'BIDDING_TIMEOUT_OWNER',
] as const;

export const DEFAULT_ROUTE_PRESETS: RoutePreset[] = [
  {
    id: 'bagdogra-airport',
    name: 'Bagdogra Airport (IXB) Transfer',
    category: 'AIRPORT_STATION',
    duration: 'approx 3 hrs (70 km)',
    description: 'One-way hill descent / climb transfer via Rohini route',
    fares: { Sedan: 2800, SUV: 3600, '7-seater': 3900, '9-seater': 5200 },
  },
  {
    id: 'njp-railway',
    name: 'NJP Railway Station Drop / Pickup',
    category: 'AIRPORT_STATION',
    duration: 'approx 3.5 hrs (75 km)',
    description: 'Major railway junction connecting North Bengal and Northeast',
    fares: { Sedan: 2700, SUV: 3500, '7-seater': 3800, '9-seater': 5000 },
  },
  {
    id: 'tiger-hill-sunrise',
    name: 'Tiger Hill Sunrise & Ghoom Tour',
    category: 'SIGHTSEEING',
    duration: '3:30 AM departure (3 hrs)',
    description: 'Early morning Kanchenjunga sunrise viewpoint + Ghoom Monastery & Batasia Loop',
    fares: { Sedan: 1800, SUV: 2400, '7-seater': 2600, '9-seater': 3500 },
  },
  {
    id: 'darjeeling-7-point',
    name: 'Darjeeling 7-Point Sightseeing',
    category: 'SIGHTSEEING',
    duration: 'Half day (4-5 hrs)',
    description: 'HMI, Padmaja Naidu Zoo, Ropeway, Tea Estate, Japanese Temple, Peace Pagoda & Tenzing Rock',
    fares: { Sedan: 2200, SUV: 2800, '7-seater': 3100, '9-seater': 4200 },
  },
  {
    id: 'mirik-lake',
    name: 'Mirik Lake & Pashupati Nepal Border Excursion',
    category: 'DAY_EXCURSION',
    duration: 'Full day (6-7 hrs)',
    description: 'Sumendu Lake boating, pine forests, orange orchards & border market shopping',
    fares: { Sedan: 3200, SUV: 4000, '7-seater': 4400, '9-seater': 5800 },
  },
  {
    id: 'lamahatta-ecopark',
    name: 'Lamahatta Eco Park & Lovers Meet Point',
    category: 'DAY_EXCURSION',
    duration: 'Half / full day (5 hrs)',
    description: 'Pine forest trail, prayer flags garden & Teesta-Rangeet river confluence view',
    fares: { Sedan: 2400, SUV: 3200, '7-seater': 3500, '9-seater': 4600 },
  },
];

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  advanceWindowMin: 0,
  ownFleetFeePercent: 5,
  ownFleetMinFee: 100,
  driverBroadcastMax: 25,
  nearbyRadiusKm: 40,
  whatsappLanguage: 'en',
  askCabCooldownHours: 12,
  pickupStart: '03:30 AM', // Tiger Hill sunrise trips leave before 4
  pickupEnd: '10:00 PM',
  pickupStepMin: 30,
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
  routePresets: DEFAULT_ROUTE_PRESETS,
  vehicles: {
    Sedan: { label: '4 Seater (Sedan)', seats: 4, estFare: 2200, enabled: true },
    SUV: { label: '6-7 Seater (Bolero / Innova)', seats: 7, estFare: 3000, enabled: true },
    '7-seater': { label: '7 Seater (Ertiga / Maxi)', seats: 7, estFare: 3200, enabled: true },
    '9-seater': { label: '9+ Seater (Traveller)', seats: 9, estFare: 4200, enabled: true },
  },
  requestExpiryHours: 6,
  guestLinkDays: 7,
  maxOpenRequestsPerPhone: 5,
  maxFare: 200000,
  quoteValidityHours: 24,
  quoteBiddingWindowMin: 5,
  whatsappTemplates: {},
  // Fill these in Operations settings before publishing the app: they appear in the legal pages
  business: { name: 'StayRide', legalName: '', address: '', email: '', phone: '', upiId: '', grievanceOfficer: '', grievanceEmail: '', website: '' },
  icalAllowedHosts: ['airbnb.com', 'airbnb.co.in', 'booking.com', 'vrbo.com', 'expedia.com', 'agoda.com', 'makemytrip.com', 'goibibo.com', 'calendar.google.com', 'tripadvisor.com'],
};

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : fallback;
};
const text = (v: unknown, fallback: string, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback);
const time = (v: unknown, fallback: string) => (typeof v === 'string' && parseTime12(v) !== null ? v.trim().toUpperCase().padStart(8, '0') : fallback);

/** Saved (possibly partial or stale) settings → a complete, valid config. Never throws. */
export function resolvePlatformConfig(saved: any): PlatformConfig {
  const s = saved && typeof saved === 'object' ? saved : {};
  const d = DEFAULT_PLATFORM_CONFIG;
  const vehicles = {} as Record<VehicleKey, VehicleConfig>;
  for (const key of VEHICLE_KEYS) {
    const v = s.vehicles?.[key] || {};
    const dv = d.vehicles[key];
    vehicles[key] = {
      label: text(v.label, dv.label, 60),
      seats: num(v.seats, dv.seats, 1, 30),
      estFare: num(v.estFare, dv.estFare, 0, 200000),
      enabled: typeof v.enabled === 'boolean' ? v.enabled : dv.enabled,
    };
  }
  // At least one vehicle class must stay bookable.
  if (!VEHICLE_KEYS.some((k) => vehicles[k].enabled)) vehicles.SUV.enabled = true;
  const presets = Array.isArray(s.sightseeingPresets)
    ? s.sightseeingPresets.map((p: unknown) => text(p, '', 80)).filter(Boolean).slice(0, 40)
    : d.sightseeingPresets;
  const routePresets: RoutePreset[] = Array.isArray(s.routePresets) && s.routePresets.length > 0
    ? s.routePresets.map((r: any) => ({
        id: text(r.id, 'route', 50),
        name: text(r.name, 'Mountain Route', 100),
        category: (['AIRPORT_STATION', 'SIGHTSEEING', 'DAY_EXCURSION', 'LOCAL_DROP'].includes(r.category) ? r.category : 'SIGHTSEEING') as any,
        duration: text(r.duration, '', 60),
        description: text(r.description, '', 200),
        fares: {
          Sedan: num(r.fares?.Sedan, 0, 0, 100000),
          SUV: num(r.fares?.SUV, 0, 0, 100000),
          '7-seater': num(r.fares?.['7-seater'], 0, 0, 100000),
          '9-seater': num(r.fares?.['9-seater'], 0, 0, 100000),
        },
      })).slice(0, 30)
    : d.routePresets;
  const lang = typeof s.whatsappLanguage === 'string' && /^[a-z]{2}(_[A-Z]{2})?$/.test(s.whatsappLanguage) ? s.whatsappLanguage : d.whatsappLanguage;
  const cfg: PlatformConfig = {
    advanceWindowMin: num(s.advanceWindowMin, d.advanceWindowMin, 0, 24 * 60),
    ownFleetFeePercent: num(s.ownFleetFeePercent, d.ownFleetFeePercent, 0, 50),
    ownFleetMinFee: num(s.ownFleetMinFee, d.ownFleetMinFee, 0, 5000),
    driverBroadcastMax: num(s.driverBroadcastMax, d.driverBroadcastMax, 0, 200),
    nearbyRadiusKm: num(s.nearbyRadiusKm, d.nearbyRadiusKm, 0, 500),
    whatsappLanguage: lang,
    askCabCooldownHours: num(s.askCabCooldownHours, d.askCabCooldownHours, 0, 24 * 7),
    pickupStart: time(s.pickupStart, d.pickupStart),
    pickupEnd: time(s.pickupEnd, d.pickupEnd),
    pickupStepMin: num(s.pickupStepMin, d.pickupStepMin, 5, 120),
    bookingHorizonDays: num(s.bookingHorizonDays, d.bookingHorizonDays, 1, 365),
    sightseeingPresets: presets,
    routePresets,
    vehicles,
    requestExpiryHours: num(s.requestExpiryHours, d.requestExpiryHours, 1, 72),
    guestLinkDays: num(s.guestLinkDays, d.guestLinkDays, 1, 60),
    maxOpenRequestsPerPhone: num(s.maxOpenRequestsPerPhone, d.maxOpenRequestsPerPhone, 1, 50),
    maxFare: num(s.maxFare, d.maxFare, 1000, 1000000),
    quoteValidityHours: num(s.quoteValidityHours, d.quoteValidityHours, 0, 24 * 14),
    quoteBiddingWindowMin: num(s.quoteBiddingWindowMin, d.quoteBiddingWindowMin, 0, 120),
    business: Object.fromEntries(BUSINESS_KEYS.map((k) => [k, text(s.business?.[k], d.business[k] || '', 300)])) as unknown as BusinessDetails,
    whatsappTemplates: Object.fromEntries(
      WHATSAPP_EVENTS.map((e) => [e, typeof s.whatsappTemplates?.[e] === 'string' ? s.whatsappTemplates[e].trim() : ''])
        .filter(([, v]) => /^[a-z0-9_]{1,200}$/.test(v as string))
    ) as Record<string, string>,
    icalAllowedHosts: Array.isArray(s.icalAllowedHosts)
      ? [...new Set(s.icalAllowedHosts.map((h: unknown) => String(h ?? '').trim().toLowerCase()).filter((h: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)))].slice(0, 40) as string[]
      : d.icalAllowedHosts,
  };
  // An advance window shorter than 5 minutes is unusable; 0 still means "off".
  if (cfg.advanceWindowMin > 0 && cfg.advanceWindowMin < 5) cfg.advanceWindowMin = 5;
  if ((parseTime12(cfg.pickupEnd) ?? 0) <= (parseTime12(cfg.pickupStart) ?? 0)) {
    cfg.pickupStart = d.pickupStart;
    cfg.pickupEnd = d.pickupEnd;
  }
  return cfg;
}

const fmt12 = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Selectable pickup times, e.g. ["03:30 AM", "04:00 AM", ...]. */
export function pickupTimes(cfg: PlatformConfig): string[] {
  const start = parseTime12(cfg.pickupStart) ?? 0;
  const end = parseTime12(cfg.pickupEnd) ?? 0;
  const out: string[] = [];
  for (let t = start; t <= end && out.length < 200; t += cfg.pickupStepMin) out.push(fmt12(t));
  return out;
}

/** The part of the config that apps and the guest page need (no internal limits). */
export function publicConfig(cfg: PlatformConfig) {
  return {
    pickupTimes: pickupTimes(cfg),
    bookingHorizonDays: cfg.bookingHorizonDays,
    sightseeingPresets: cfg.sightseeingPresets,
    routePresets: cfg.routePresets || DEFAULT_ROUTE_PRESETS,
    vehicles: VEHICLE_KEYS.filter((k) => cfg.vehicles[k].enabled).map((k) => ({ value: k, ...cfg.vehicles[k] })),
    advanceWindowMin: cfg.advanceWindowMin,
    ownFleetFeePercent: cfg.ownFleetFeePercent,
    ownFleetMinFee: cfg.ownFleetMinFee,
    upiId: cfg.business?.upiId || '',
    supportPhone: cfg.business?.phone || '',
  };
}

/** StayRide's fee on an own-fleet trip: percent of the fare, at least the minimum, never above the fare. */
export function ownFleetFee(cfg: PlatformConfig, fare: number): number {
  return Math.min(fare, Math.max(cfg.ownFleetMinFee, Math.round((fare * cfg.ownFleetFeePercent) / 100)));
}
