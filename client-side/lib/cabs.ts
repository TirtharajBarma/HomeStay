import { formatDate, isValidDate, today, type RawParams } from "@/lib/booking";

/* ------------------------------------------------------------------ *
 * Places
 *
 * Real coordinates around Darjeeling so the map pin, the distance and
 * the fare all agree with each other. The estate is our own gate.
 * ------------------------------------------------------------------ */

export type CabPlace = {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  /** Short hint shown under the suggestion. */
  note: string;
};

export const ESTATE: CabPlace = {
  id: "meadowfall-estate",
  name: "Meadowfall Estate Gate",
  area: "Ging Tea Estate Road",
  lat: 27.0178,
  lng: 88.2351,
  note: "Ging Tea Estate Road · the house gate",
};

/** Ordered so the common arrival points sit at the top of the list. */
export const CAB_PLACES: CabPlace[] = [
  ESTATE,
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
    id: "new-market",
    name: "New Market",
    area: "Darjeeling town",
    lat: 27.0413,
    lng: 88.2641,
    note: "Shops, bakeries and the morning market",
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

export function placeById(id: string): CabPlace | undefined {
  return CAB_PLACES.find((place) => place.id === id);
}

const EARTH_RADIUS_KM = 6371;

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;

  return `${Math.round(km)} km`;
}

/** Loose, forgiving match: "tiger" finds Tiger Hill, "bag" finds Bagdogra. */
export function searchPlaces(query: string, limit = 6): CabPlace[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return CAB_PLACES.slice(0, limit);

  const scored: { place: CabPlace; score: number }[] = [];
  for (const place of CAB_PLACES) {
    const haystack = `${place.name} ${place.area} ${place.note}`.toLowerCase();
    const index = haystack.indexOf(q);
    if (index === -1) continue;
    scored.push({ place, score: (index === 0 ? 0 : 1) * 100 + place.name.length });
  }

  scored.sort((a, b) => a.score - b.score);

  return scored.slice(0, limit).map((entry) => entry.place);
}

/* ------------------------------------------------------------------ *
 * Vehicles
 * ------------------------------------------------------------------ */

export const CAB_SEAT_TYPES = [
  {
    id: "4",
    label: "4 Seater",
    detail: "Sedan · 3 guests + 2 cases",
    seats: 4,
  },
  {
    id: "6",
    label: "6 Seater",
    detail: "SUV · 5 guests + 4 cases",
    seats: 6,
  },
  {
    id: "8",
    label: "8 Seater",
    detail: "Estate van · 7 guests + 6 cases",
    seats: 8,
  },
] as const;

export type SeatTypeId = (typeof CAB_SEAT_TYPES)[number]["id"];

export type Driver = {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  vehicle: string;
  colour: string;
  plate: string;
  seats: number;
  luggage: number;
  /** Rupees per km on hill roads. */
  perKm: number;
  /** Rupees the driver will not go below. */
  minimum: number;
  /** Minutes on top of the drive estimate. */
  etaPad: number;
  note: string;
  languages: string;
};

export type CabDriver = Driver & {
  etaMinutes: number;
  fare: number;
  distanceKm: number;
};

export const drivers: Driver[] = [
  {
    id: "sonam-lama",
    name: "Sonam Lama",
    rating: 4.9,
    reviews: 412,
    vehicle: "Toyota Innova Crysta",
    colour: "Royal silver",
    plate: "WB 06 A 4417",
    seats: 8,
    luggage: 6,
    perKm: 78,
    minimum: 550,
    etaPad: 4,
    note: "Estate regular — knows the Namchi road the shortcut way.",
    languages: "Nepali, Hindi, English",
  },
  {
    id: "pintu-rai",
    name: "Pintu Rai",
    rating: 4.9,
    reviews: 368,
    vehicle: "Maruti Suzuki Dzire",
    colour: "Pearl white",
    plate: "WB 06 B 2093",
    seats: 4,
    luggage: 2,
    perKm: 48,
    minimum: 180,
    etaPad: 2,
    note: "Town and station runs. Always punctual for the toy train.",
    languages: "Nepali, Bengali, Hindi",
  },
  {
    id: "tenzin-bhutia",
    name: "Tenzin Bhutia",
    rating: 4.8,
    reviews: 291,
    vehicle: "Toyota Innova",
    colour: "Metallic grey",
    plate: "WB 04 C 7734",
    seats: 6,
    luggage: 4,
    perKm: 64,
    minimum: 300,
    etaPad: 3,
    note: "Airport transfers, luggage-heavy and unfussy about timings.",
    languages: "Sikkimese, Nepali, Hindi, English",
  },
  {
    id: "sandeep-pradhan",
    name: "Sandeep Pradhan",
    rating: 4.8,
    reviews: 244,
    vehicle: "Mahindra XUV700",
    colour: "Deep navy",
    plate: "WB 06 D 1158",
    seats: 6,
    luggage: 5,
    perKm: 70,
    minimum: 340,
    etaPad: 3,
    note: "Tiger Hill sunrise driver, holds a 4 am pickup without complaint.",
    languages: "Nepali, Hindi, English",
  },
  {
    id: "rinchen-tamang",
    name: "Rinchen Tamang",
    rating: 4.7,
    reviews: 187,
    vehicle: "Mahindra Bolero Maxi Plus",
    colour: "Forest green",
    plate: "WB 04 E 5580",
    seats: 8,
    luggage: 6,
    perKm: 74,
    minimum: 500,
    etaPad: 5,
    note: "Big family luggage, Kalimpong and Kurseong runs.",
    languages: "Tamang, Nepali, Hindi",
  },
  {
    id: "amit-lama",
    name: "Amit Lama",
    rating: 4.6,
    reviews: 152,
    vehicle: "Maruti Suzuki Ertiga",
    colour: "Silky silver",
    plate: "WB 06 F 3306",
    seats: 6,
    luggage: 3,
    perKm: 60,
    minimum: 280,
    etaPad: 2,
    note: "Family favourite. Child seat available at no charge.",
    languages: "Nepali, Hindi, Bengali",
  },
  {
    id: "mohit-gurung",
    name: "Mohit Gurung",
    rating: 4.8,
    reviews: 205,
    vehicle: "Toyota Innova Crysta",
    colour: "Black",
    plate: "WB 04 G 4412",
    seats: 8,
    luggage: 6,
    perKm: 80,
    minimum: 600,
    etaPad: 6,
    note: "Long-haul driver for Namchi, Pelling and the airport road.",
    languages: "Nepali, Hindi, English, Bangla",
  },
];

export function seatCapacity(id: string): number {
  return CAB_SEAT_TYPES.find((seat) => seat.id === id)?.seats ?? 4;
}

export function seatLabel(id: string): string {
  return CAB_SEAT_TYPES.find((seat) => seat.id === id)?.label ?? "4 Seater";
}

/* ------------------------------------------------------------------ *
 * Requests
 * ------------------------------------------------------------------ */

export type CabPoint = {
  label: string;
  lat: number;
  lng: number;
};

export type CabRequest = {
  source: CabPoint;
  destination: CabPoint;
  date: string;
  time: string;
  seats: SeatTypeId;
};

/** Hill roads: a loaded car does roughly 25 km/h between towns. */
const KMH = 25;

export function tripDistance(request: CabRequest): number {
  return distanceKm(request.source, request.destination);
}

function tripMinutes(km: number, pad: number): number {
  return Math.max(4, Math.round((km / KMH) * 60) + pad);
}

function tripFare(km: number, driver: Driver): number {
  const raw = Math.max(driver.minimum, km * driver.perKm);

  // Hill surcharge on the long runs, rounded to the nearest ₹10.
  const surcharge = km > 40 ? 1.15 : 1;
  const total = raw * surcharge;

  return Math.round(total / 10) * 10;
}

/**
 * Matches drivers whose vehicle can carry the requested class, then prices and
 * times each match from the real distance between the two pins. Deterministic on
 * purpose: the same trip always returns the same list.
 */
export function findNearbyDrivers(request: CabRequest): CabDriver[] {
  const wanted = seatCapacity(request.seats);
  const km = tripDistance(request);

  return drivers
    .filter((driver) => driver.seats >= wanted)
    .map((driver) => ({
      ...driver,
      distanceKm: km,
      fare: tripFare(km, driver),
      etaMinutes: tripMinutes(km, driver.etaPad),
    }))
    .sort((a, b) => a.fare - b.fare || b.rating - a.rating);
}

export function getDriver(id: string): Driver | undefined {
  return drivers.find((driver) => driver.id === id);
}

export function validateCabRequest(request: CabRequest): Record<string, string> {
  const errors: Record<string, string> = {};

  if (request.source.label.trim().length < 2) {
    errors.source = "Tell us where we should collect you.";
  }
  if (request.destination.label.trim().length < 2) {
    errors.destination = "Where would you like to go?";
  }
  if (!isValidDate(request.date)) {
    errors.date = "Choose a pickup date.";
  } else if (request.date < today()) {
    errors.date = "Pickup cannot be in the past.";
  }
  if (!/^\d{2}:\d{2}$/.test(request.time)) {
    errors.time = "Choose a pickup time.";
  }
  if (!CAB_SEAT_TYPES.some((seat) => seat.id === request.seats)) {
    errors.seats = "Choose a seat class.";
  }

  return errors;
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function readCabRequest(params: RawParams): CabRequest | null {
  const source = typeof params.from === "string" ? params.from.trim() : "";
  const destination = typeof params.to === "string" ? params.to.trim() : "";
  const date = typeof params.date === "string" ? params.date : "";
  const time = typeof params.time === "string" ? params.time : "";
  const seats = typeof params.seats === "string" ? params.seats : "";
  const fromLat = num(params.fromLat);
  const fromLng = num(params.fromLng);
  const toLat = num(params.toLat);
  const toLng = num(params.toLng);

  if (!source || !destination || !date || !time) return null;
  if (!CAB_SEAT_TYPES.some((seat) => seat.id === seats)) return null;
  if (fromLat === null || fromLng === null || toLat === null || toLng === null) {
    return null;
  }

  return {
    source: { label: source, lat: fromLat, lng: fromLng },
    destination: { label: destination, lat: toLat, lng: toLng },
    date,
    time,
    seats: seats as SeatTypeId,
  };
}

export function cabParams(request: CabRequest): string {
  return new URLSearchParams({
    from: request.source.label,
    fromLat: request.source.lat.toFixed(5),
    fromLng: request.source.lng.toFixed(5),
    to: request.destination.label,
    toLat: request.destination.lat.toFixed(5),
    toLng: request.destination.lng.toFixed(5),
    date: request.date,
    time: request.time,
    seats: request.seats,
  }).toString();
}

export function driversHref(request: CabRequest): string {
  return `/cab/drivers?${cabParams(request)}`;
}

export function cabHref(request: CabRequest): string {
  return `/cab?${cabParams(request)}`;
}

export function confirmedHref(request: CabRequest, driverId: string): string {
  return `/cab/confirmed?${cabParams(request)}&driver=${driverId}`;
}

/** A request that only knows the labels, used to prefill the picker. */
export function requestFromLabels(
  source: string,
  destination: string,
  date: string,
  time: string,
  seats: string,
): CabRequest {
  const from = searchPlaces(source, 1)[0] ?? ESTATE;
  const to = searchPlaces(destination, 1)[0] ?? ESTATE;

  return {
    source: { label: source || ESTATE.name, lat: from.lat, lng: from.lng },
    destination: { label: destination, lat: to.lat, lng: to.lng },
    date,
    time,
    seats: (CAB_SEAT_TYPES.find((s) => s.id === seats)?.id ?? "4") as SeatTypeId,
  };
}

export function formatCabTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatEta(minutes: number): string {
  if (minutes < 60) return `${minutes} min away`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest ? `${hours} hr ${rest} min away` : `${hours} hr away`;
}

export function formatFare(fare: number): string {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(fare)}`;
}

/** Stable per trip + driver, so a refresh keeps the same reference. */
export function cabReference(request: CabRequest, driverId: string): string {
  const seed = `${request.source.label}${request.destination.label}${request.date}${driverId}`;
  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }

  return `CAB-${String(1000 + (hash % 8999))}`;
}

export function formatTripDate(date: string): string {
  return formatDate(date);
}
