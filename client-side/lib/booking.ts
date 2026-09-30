const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** The estate showcase window: three autumn nights starting on the next 25th of October. */
function defaultWindow() {
  const now = new Date().getTime();
  const thisYear = new Date().getUTCFullYear();
  const october = Date.UTC(thisYear, 9, 25);

  return {
    checkIn: new Date(october > now ? october : Date.UTC(thisYear + 1, 9, 25))
      .toISOString()
      .slice(0, 10),
    checkOut: new Date((october > now ? october : Date.UTC(thisYear + 1, 9, 25)) + 3 * DAY_MS)
      .toISOString()
      .slice(0, 10),
  };
}

export const DEFAULT_CHECK_IN = defaultWindow().checkIn;
export const DEFAULT_CHECK_OUT = defaultWindow().checkOut;
export const DEFAULT_GUESTS = 2;

export const CLEANING_FEE = 900;
export const LODGING_TAX_RATE = 0.12;
export const TAX_LABEL = "GST (12%)";
export const MAX_NIGHTS = 30;
export const FREE_CANCELLATION_DAYS = 7;

export type RawParams = Record<string, string | string[] | undefined>;

export type BookingQuery = {
  checkIn: string;
  checkOut: string;
  guests: number;
};

export type Booking = BookingQuery & {
  nights: number;
};

export type StayKind = "cottage" | "loft" | "cabin";

export type Filters = {
  kind: StayKind | "all";
  petFriendly: boolean;
};

export type Quote = {
  nightly: number;
  nights: number;
  roomTotal: number;
  cleaning: number;
  tax: number;
  total: number;
  deposit: number;
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const longDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toDate(iso: string): Date | null {
  if (!ISO_DATE.test(iso)) return null;
  const time = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(time) ? null : new Date(time);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const start = toDate(checkIn);
  const end = toDate(checkOut);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

function addDays(iso: string, days: number): string {
  const date = toDate(iso);
  if (!date) return iso;
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function pickDate(value: string | string[] | undefined, fallback: string): string {
  const raw = first(value);
  return raw !== undefined && toDate(raw) !== null ? raw : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Reads booking state out of the query string so a stay selected on the home
 * page survives every hop through the detail and checkout routes. Check-in is
 * pulled forward to today and check-out is always forced to follow it, so no
 * page can render an unbookable window.
 */
export function resolveBooking(
  params: RawParams,
  maxGuests: number,
): Booking {
  const requestedCheckIn = pickDate(params.checkIn, DEFAULT_CHECK_IN);
  const checkIn = isPast(requestedCheckIn) ? today() : requestedCheckIn;
  const requested = nightsBetween(checkIn, pickDate(params.checkOut, DEFAULT_CHECK_OUT));
  const fallback = nightsBetween(DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT);
  const nights = requested > 0 ? Math.min(requested, MAX_NIGHTS) : fallback;
  const requestedGuests = Number.parseInt(first(params.guests) ?? "", 10);

  return {
    checkIn,
    checkOut: addDays(checkIn, nights),
    nights,
    guests: clamp(
      Number.isFinite(requestedGuests) ? requestedGuests : DEFAULT_GUESTS,
      1,
      maxGuests,
    ),
  };
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isValidDate(value: string): boolean {
  return toDate(value) !== null;
}

export function isPast(value: string): boolean {
  const date = toDate(value);
  return date !== null && date.getTime() < toDate(today())!.getTime();
}

/**
 * Repairs a half-typed date pair so the client and `resolveBooking` agree: an
 * unparseable check-in falls back, a check-out that is missing or not after
 * check-in becomes a one-night stay, and long stays are capped at MAX_NIGHTS.
 */
export function normalizeRange(
  checkIn: string,
  checkOut: string,
): { checkIn: string; checkOut: string; nights: number } {
  const requested = isValidDate(checkIn) ? checkIn : DEFAULT_CHECK_IN;
  const from = isPast(requested) ? today() : requested;
  const nights = Math.min(Math.max(countNights(from, checkOut), 1), MAX_NIGHTS);

  return { checkIn: from, checkOut: addDays(from, nights), nights };
}

export function countNights(checkIn: string, checkOut: string): number {
  const nights = nightsBetween(checkIn, checkOut);
  return nights > 0 ? Math.min(nights, MAX_NIGHTS) : 0;
}

export function readFilters(params: RawParams): Filters {
  const kind = first(params.kind);
  return {
    kind: kind === "cottage" || kind === "loft" || kind === "cabin" ? kind : "all",
    petFriendly: first(params.pets) === "1",
  };
}

export function quoteFor(nightly: number, booking: Booking): Quote {
  const roomTotal = nightly * booking.nights;
  const tax = Math.round((roomTotal + CLEANING_FEE) * LODGING_TAX_RATE);
  const total = roomTotal + CLEANING_FEE + tax;

  return {
    nightly,
    nights: booking.nights,
    roomTotal,
    cleaning: CLEANING_FEE,
    tax,
    total,
    deposit: Math.round(total / 2),
  };
}

function bookingQuery(booking: BookingQuery, filters?: Filters): string {
  const params = new URLSearchParams({
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    guests: String(booking.guests),
  });

  if (filters) {
    if (filters.kind !== "all") params.set("kind", filters.kind);
    if (filters.petFriendly) params.set("pets", "1");
  }

  return params.toString();
}

export function homeHref(
  booking: BookingQuery,
  filters: Filters = { kind: "all", petFriendly: false },
): string {
  const query = bookingQuery(booking, filters);
  return query ? `/?${query}` : "/";
}

export function stayHref(slug: string, booking: BookingQuery): string {
  return `/stays/${slug}?${bookingQuery(booking)}`;
}

export function checkoutHref(slug: string, booking: BookingQuery): string {
  return `/checkout?stay=${slug}&${bookingQuery(booking)}`;
}

export function formatDate(iso: string): string {
  const date = toDate(iso);
  return date ? longDateFormat.format(date) : iso;
}

export function formatDateRange(booking: Booking): string {
  const from = toDate(booking.checkIn);
  const to = toDate(booking.checkOut);
  if (!from || !to) return "";
  return `${dateFormat.format(from)} – ${longDateFormat.format(to)}`;
}

export function formatNights(nights: number): string {
  return `${nights} ${nights === 1 ? "Night" : "Nights"}`;
}

export function formatGuests(guests: number): string {
  return `${guests} Adult${guests === 1 ? "" : "s"}`;
}

const rupeeFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Whole rupees with Indian digit grouping (₹2,42,000). No paise — nobody quotes them. */
export function formatMoney(amount: number): string {
  return rupeeFormat.format(Math.round(amount)).replace(/\u00a0/g, "");
}


export function cancellationDeadline(checkIn: string): string {
  return formatDate(addDays(checkIn, -FREE_CANCELLATION_DAYS));
}
