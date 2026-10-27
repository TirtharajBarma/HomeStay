export interface StayRideRoom {
  id: number;
  number: string;
  type: string;
  floor: string;
  price: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
  note: string;
}

export interface StayRideGuest {
  id: number;
  name: string;
  phone: string;
  email: string;
  notes: string;
  visits: number;
  totalSpending: number;
  firstVisit: number;
  lastVisit: number;
  marketingConsent: boolean;
}

export interface StayRideBooking {
  id: number;
  guestId: number;
  guestName: string;
  phone: string;
  checkIn: number;
  checkOut: number;
  roomNumber: string;
  guests: number;
  status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  paid: boolean;
  amount: number;
  source: string;
  // Set by the server: when the guest actually left (early checkout frees the remaining nights)
  actualCheckOut?: number;
  // Set by the server: how much of this stay is in the guest's total spending (paid money, once checked out).
  // Older records hold `true` (the full amount was counted at checkout).
  spendCounted?: boolean | number;
  // Money received for this stay (advance, balance...). `paid` = received >= amount.
  payments?: BookingPayment[];
  // Imported from an OTA calendar (Airbnb, Booking.com...): no guest record, dates only
  external?: { source: string; uid: string; feedId: string; conflict?: boolean };
}

export interface BookingPayment {
  id: number;
  amount: number;
  method: 'CASH' | 'UPI' | 'CARD' | 'BANK' | 'OTA' | 'OTHER';
  note: string;
  at: number;
}

export const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'BANK', 'OTA', 'OTHER'] as const;

/** Money received for a stay. A booking marked paid before payments were itemised counts as fully paid. */
export function paidOf(b: StayRideBooking): number {
  if (b.payments?.length) return b.payments.reduce((sum, p) => sum + p.amount, 0);
  return b.paid ? b.amount : 0;
}
export const balanceOf = (b: StayRideBooking) => Math.max(0, b.amount - paidOf(b));

const DAY_MS_STORE = 86400000;
const IST_OFFSET = 330 * 60000;
/** Start of the IST calendar day containing `t` (booking dates are local-midnight timestamps). */
export const istDayStart = (t: number) => Math.floor((t + IST_OFFSET) / DAY_MS_STORE) * DAY_MS_STORE - IST_OFFSET;
const last10 = (p: unknown) => String(p ?? '').replace(/\D/g, '').slice(-10);

/**
 * Until when a booking holds its room. Checked out: until the day the guest actually left (so an
 * early checkout frees the remaining nights the same day). Checked in past the checkout date
 * (overstay): until now, the room is still taken. Otherwise its booked checkout.
 */
export function heldUntil(b: StayRideBooking, now = Date.now()): number {
  if (b.status === 'CHECKED_OUT') return Math.min(b.checkOut, istDayStart(b.actualCheckOut ?? b.checkOut));
  if (b.status === 'CHECKED_IN') return Math.max(b.checkOut, now);
  return b.checkOut;
}

/** The one overlap rule, for new bookings and room moves alike. */
export function bookingClash(bookings: StayRideBooking[], roomNumber: string, checkIn: number, checkOut: number, exceptId?: number, now = Date.now()) {
  return bookings.find(
    (b) => b.id !== exceptId && b.roomNumber === roomNumber && b.status !== 'CANCELLED' && checkIn < heldUntil(b, now) && checkOut > b.checkIn
  );
}

/**
 * Room status is derived, never stored: MAINTENANCE is the owner's only manual setting; otherwise a
 * checked-in guest makes it OCCUPIED, a confirmed stay that has started (arrival today or overdue)
 * makes it RESERVED, and anything else (including future bookings) leaves it AVAILABLE.
 */
export function roomStatusOf(room: StayRideRoom, bookings: StayRideBooking[], now = Date.now()): StayRideRoom['status'] {
  if (room.status === 'MAINTENANCE') return 'MAINTENANCE';
  const mine = bookings.filter((b) => b.roomNumber === room.number);
  if (mine.some((b) => b.status === 'CHECKED_IN')) return 'OCCUPIED';
  if (mine.some((b) => b.status === 'CONFIRMED' && b.checkIn <= now && now < b.checkOut)) return 'RESERVED';
  return 'AVAILABLE';
}

export interface StayRideDriver {
  id: number;
  name: string;
  phone: string;
  vehicle: string;
  vehicleType: 'SUV' | 'Sedan' | '7-seater' | '9-seater';
  seats: number;
  rating: number;
  area: string;
  trips: string[];
  available: boolean;
  active: boolean;
  ownerDriver: boolean;
}

export interface StayRideTrip {
  id: number;
  guestName: string;
  phone: string;
  pickup: string;
  pickupLat?: number; // map pin of the pickup, when the owner set one
  pickupLng?: number;
  destination: string;
  destinations?: Array<{ address: string; lat?: number; lng?: number; order: number }>;
  isRoundTrip?: boolean;
  returnDate?: number;
  returnTime?: string;
  date: number;
  time: string;
  passengers: number;
  vehicleType: 'SUV' | 'Sedan' | '7-seater' | '9-seater';
  estFare: number;
  status:
    | 'NEW_REQUEST'
    | 'FINDING_DRIVER'
    | 'QUOTE_RECEIVED'
    | 'AWAITING_ADVANCE'
    | 'DRIVER_ASSIGNED'
    | 'CONFIRMED'
    | 'TRIP_STARTED'
    | 'COMPLETED'
    | 'CANCELLED';
  driverId: number | null;
  driverName: string | null;
  ownerDriver: boolean;
  fare: number;
  commission: number;
  commissionPaid: boolean;
  platformFee?: number;
  advanceAmount?: number;
  advancePaid?: boolean;
  remainingCashAmount?: number;
  quotes?: Array<{
    driverId: number | string;
    driverName: string;
    quotedFare: number;
    status: string;
  }>;
  financialSnapshot?: any;
  source?: string;
  reference?: string; // CabRequest reference (admin queue mirror)
  guestId?: number;
  bookingId?: number;
  payoutId?: string; // set once the commission is settled through a platform payout
  dispatchMode?: 'PLATFORM' | 'OWN_DRIVER';
}

export interface StayRideCampaign {
  id: number;
  title: string;
  message: string;
  audience: string;
  status: 'CREATED' | 'SENDING' | 'COMPLETED';
  recipients: number;
  sent: number;
  failed: number;
  createdOn: number;
}

export interface StayRideHomestay {
  name: string;
  description: string;
  location: string;
  phone: string;
  email: string;
  ownerName: string;
  link: string;
  mapQuery: string;
  amenities: string[];
  photos: string[];
  // House times shown to owner and guest, e.g. "12:00 PM" / "11:00 AM"
  checkInTime?: string;
  checkOutTime?: string;
  // Map pin set by the owner (server-set via PUT /homestay/location); "nearby" drivers are measured from it
  latitude?: number;
  longitude?: number;
}

const DAY = 86400000;

// Client-writable fields per entity. Everything else (ids, money, status) is server-owned.
export const WRITABLE = {
  room: ['number', 'type', 'floor', 'price', 'status', 'note'],
  guest: ['name', 'phone', 'email', 'notes', 'marketingConsent'],
  booking: ['guestId', 'guestName', 'phone', 'checkIn', 'checkOut', 'roomNumber', 'guests', 'amount', 'source', 'paid'],
  driver: ['name', 'phone', 'vehicle', 'vehicleType', 'seats', 'rating', 'area', 'trips', 'available', 'active', 'plate'],
  trip: ['guestName', 'phone', 'pickup', 'pickupLat', 'pickupLng', 'destination', 'destinations', 'isRoundTrip', 'returnDate', 'returnTime', 'date', 'time', 'passengers', 'vehicleType', 'guestId', 'bookingId'],
  homestay: ['name', 'description', 'location', 'phone', 'email', 'ownerName', 'link', 'mapQuery', 'amenities', 'photos', 'checkInTime', 'checkOutTime'],
} as const;

export function pick(obj: any, keys: readonly string[]): any {
  const out: any = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  return out;
}
// ---------------------------------------------------------------------------
// Field validation (O4), shared by the owner API and admin tenant-data edits. Only listed fields are
// accepted; numbers must be finite and >= 0, strings are trimmed and capped, enums are checked.
// ---------------------------------------------------------------------------
type FieldRule =
  | { t: 'str'; max: number }
  | { t: 'num'; max?: number; int?: boolean; nullable?: boolean }
  | { t: 'bool' }
  | { t: 'enum'; values: readonly string[] }
  | { t: 'strs'; maxItems: number; max: number }
  | { t: 'photos' };

const S = (max: number): FieldRule => ({ t: 'str', max });
const N = (o: { max?: number; int?: boolean; nullable?: boolean } = {}): FieldRule => ({ t: 'num', ...o });
const B: FieldRule = { t: 'bool' };
const E = (values: readonly string[]): FieldRule => ({ t: 'enum', values });
const MONEY = N({ int: true, max: 10_000_000 });
const DATE = N({ max: 8_640_000_000_000 });
export const VEHICLE_TYPES = ['SUV', 'Sedan', '7-seater', '9-seater'] as const;
export const ROOM_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'] as const;

export const FIELDS: Record<string, Record<string, FieldRule>> = {
  room: { number: S(20), type: S(60), floor: S(30), price: MONEY, status: E(ROOM_STATUSES), note: S(300) },
  guest: { name: S(100), phone: S(20), email: S(120), notes: S(1000), marketingConsent: B },
  booking: {
    guestId: N({ int: true, nullable: true }), guestName: S(100), phone: S(20), checkIn: DATE, checkOut: DATE,
    roomNumber: S(20), guests: N({ int: true, max: 50 }), amount: MONEY, source: S(60), paid: B,
  },
  driver: {
    name: S(100), phone: S(20), vehicle: S(60), vehicleType: E(VEHICLE_TYPES), seats: N({ int: true, max: 60 }),
    rating: N({ max: 5 }), area: S(100), trips: { t: 'strs', maxItems: 20, max: 60 }, available: B, active: B, plate: S(20),
  },
  // Admin edits of OWN_DRIVER trips (owners create trips through tripInput in routes.ts).
  trip: {
    guestName: S(100), phone: S(20), pickup: S(200), pickupLat: N({ nullable: true, max: 180 }), pickupLng: N({ nullable: true, max: 180 }),
    destination: S(200), isRoundTrip: B, returnDate: N({ nullable: true }),
    returnTime: S(10), date: DATE, time: S(10), passengers: N({ int: true, max: 20 }), vehicleType: E(VEHICLE_TYPES),
    guestId: N({ int: true, nullable: true }), bookingId: N({ int: true, nullable: true }),
  },
  campaign: { title: S(120), message: S(1000), audience: S(50) },
  // `link` is server-generated (unique public URL) and not writable.
  homestay: {
    name: S(100), description: S(2000), location: S(200), phone: S(20), email: S(120), ownerName: S(100),
    mapQuery: S(300), amenities: { t: 'strs', maxItems: 30, max: 60 }, photos: { t: 'photos' },
    checkInTime: S(10), checkOutTime: S(10),
  },
};

export const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 400 * 1024;
const DATA_IMAGE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const bad = (message: string) => Object.assign(new Error(message), { status: 400, code: 'VALIDATION_ERROR' });

function checkPhoto(p: unknown): string {
  if (typeof p !== 'string') throw bad('Each photo must be an https URL or an image.');
  if (p.startsWith('https://')) {
    if (p.length > 1000) throw bad('Photo URL is too long (max 1000 characters).');
    // New photos must be images uploaded to our own Cloudinary account (not any outside link)
    if (!p.startsWith(CloudinaryService.deliveryPrefix())) throw bad('Photos must be uploaded through the app or dashboard.');
    return p;
  }
  const m = DATA_IMAGE.exec(p);
  if (!m) throw bad('Photos must be https URLs or JPEG/PNG/WebP images.');
  if (Math.floor((m[2].length * 3) / 4) > MAX_PHOTO_BYTES) throw bad('Each photo must be 400 KB or smaller.');
  return p;
}

/**
 * Validate + normalize the writable fields of `kind` present in `body`. Unknown keys are dropped.
 * `existingPhotos`: photos already stored are accepted as-is (older records may hold legacy values).
 */
export function clean(kind: keyof typeof FIELDS, body: any, existingPhotos: string[] = []): any {
  const rules = FIELDS[kind];
  const out: any = {};
  if (!body || typeof body !== 'object') return out;
  for (const [k, rule] of Object.entries(rules)) {
    if (!Object.prototype.hasOwnProperty.call(body, k) || body[k] === undefined) continue;
    const v = body[k];
    switch (rule.t) {
      case 'str':
        if (v === null) out[k] = '';
        else if (typeof v === 'string' || typeof v === 'number') out[k] = String(v).trim().slice(0, rule.max);
        else throw bad(`${k} must be text.`);
        break;
      case 'num': {
        if (v === null || v === '') {
          if (rule.nullable) { out[k] = null; break; }
          throw bad(`${k} must be a number.`);
        }
        const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
        if (!Number.isFinite(n) || n < 0) throw bad(`${k} must be a number of 0 or more.`);
        if (rule.max !== undefined && n > rule.max) throw bad(`${k} must be at most ${rule.max}.`);
        out[k] = rule.int ? Math.round(n) : n;
        break;
      }
      case 'bool':
        if (typeof v !== 'boolean') throw bad(`${k} must be true or false.`);
        out[k] = v;
        break;
      case 'enum':
        if (!rule.values.includes(v)) throw bad(`${k} must be one of: ${rule.values.join(', ')}.`);
        out[k] = v;
        break;
      case 'strs':
        if (!Array.isArray(v) || v.length > rule.maxItems || v.some((x) => typeof x !== 'string')) {
          throw bad(`${k} must be a list of at most ${rule.maxItems} texts.`);
        }
        out[k] = v.map((x: string) => x.trim().slice(0, rule.max)).filter(Boolean);
        break;
      case 'photos':
        if (!Array.isArray(v)) throw bad('photos must be a list.');
        if (v.length > MAX_PHOTOS) throw bad(`At most ${MAX_PHOTOS} photos are allowed.`);
        out[k] = v.map((p) => (typeof p === 'string' && existingPhotos.includes(p) ? p : checkPhoto(p)));
        break;
    }
  }
  return out;
}

/** Collections an admin may edit item-by-item, mapped to their field schema. */
export const TENANT_COLLECTIONS = { rooms: 'room', guests: 'guest', bookings: 'booking', drivers: 'driver', trips: 'trip', campaigns: 'campaign' } as const;
export type TenantCollection = keyof typeof TENANT_COLLECTIONS;
export const isPlatformTrip = (t: any) => Boolean(t?.reference) || t?.dispatchMode === 'PLATFORM';

const today = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export class StayRideMemoryStore {
  homestay: StayRideHomestay;
  rooms: StayRideRoom[] = [];
  guests: StayRideGuest[] = [];
  bookings: StayRideBooking[] = [];
  drivers: StayRideDriver[] = [];
  networkDrivers: StayRideDriver[] = [];
  trips: StayRideTrip[] = [];
  campaigns: StayRideCampaign[] = [];

  private nextRoomId = 100;
  private nextGuestId = 100;
  private nextBookingId = 100;
  private nextDriverId = 100;
  private nextTripId = 100;
  // Optimistic-concurrency bookkeeping, set by StayRideTenantManager.load(); never serialized.
  tenantKey = '';
  version = 0;
  private nextCampaignId = 100;

  constructor(isDemo: boolean = true, initialHomestay?: Partial<StayRideHomestay>) {
    if (isDemo) {
      this.homestay = {
        name: 'Mountain View Homestay',
        description: 'Charming mountain retreat nestled in the hills of Gangtok with valley views and organic local meals.',
        location: 'Upper Sichey, Gangtok, Sikkim 737101',
        phone: '+91 98001 23456',
        email: 'stay@mountainviewgangtok.com',
        ownerName: 'Tashi Bhutia',
        link: `${config.guestWebUrl}/h/mountain-view-gangtok`,
        mapQuery: 'Mountain View Homestay Gangtok Sikkim',
        amenities: [
          'Free Wi-Fi',
          '24x7 Hot Water',
          'Home Breakfast',
          'Mountain View',
          'In-house Cabs',
          'Private Parking',
        ],
        photos: [
          'Front elevation',
          'Deluxe room',
          'Valley view balcony',
          'Dining hall',
          'Rooftop garden',
        ],
      };
      this.seedNetworkDrivers();
      this.seed();
    } else {
      // New real homestays start blank; the owner fills in their own details. The unique public link
      // is generated by StayRideTenantManager.load() when the tenant is first created.
      this.homestay = {
        name: initialHomestay?.name || 'My Homestay',
        description: initialHomestay?.description || '',
        location: initialHomestay?.location || '',
        phone: initialHomestay?.phone || '',
        email: initialHomestay?.email || '',
        ownerName: initialHomestay?.ownerName || '',
        link: initialHomestay?.link || '',
        mapQuery: initialHomestay?.mapQuery ?? initialHomestay?.location ?? '',
        amenities: [],
        photos: [],
      };
      this.rooms = [];
      this.guests = [];
      this.bookings = [];
      this.drivers = [];
      this.trips = [];
      this.campaigns = [];
      this.networkDrivers = [];
    }
  }

  seedNetworkDrivers() {
    this.networkDrivers = [
      { id: 201, name: 'Norbu Sherpa', phone: '+91 98002 11001', vehicle: 'Innova Crysta', vehicleType: 'SUV', seats: 6, rating: 4.9, area: 'MG Marg Stand', trips: ['NJP', 'Bagdogra', 'Local'], available: true, active: true, ownerDriver: false },
      { id: 202, name: 'Bikash Rai', phone: '+91 98003 22002', vehicle: 'Maruti Ertiga', vehicleType: '7-seater', seats: 6, rating: 4.8, area: 'Deorali Stand', trips: ['NJP', 'Darjeeling'], available: true, active: true, ownerDriver: false },
      { id: 203, name: 'Sonam Wangchuk', phone: '+91 98004 33003', vehicle: 'Tata Nexon EV', vehicleType: 'SUV', seats: 4, rating: 4.9, area: 'Development Area', trips: ['Local', 'Sightseeing'], available: true, active: true, ownerDriver: false },
      { id: 204, name: 'Kishan Pradhan', phone: '+91 98005 44004', vehicle: 'Toyota Rumion', vehicleType: '7-seater', seats: 6, rating: 4.7, area: 'Burtuk', trips: ['Bagdogra', 'Pelling'], available: true, active: true, ownerDriver: false },
      { id: 205, name: 'Passang Dorjee', phone: '+91 98006 55005', vehicle: 'Force Cruiser', vehicleType: '9-seater', seats: 9, rating: 4.8, area: 'Sichey', trips: ['NJP', 'Bagdogra', 'Sightseeing'], available: true, active: true, ownerDriver: false },
    ];
  }

  seed() {
    const t = today();

    this.rooms = [
      { id: 1, number: '101', type: 'Deluxe Valley View', floor: '1st Floor', price: 2800, status: 'OCCUPIED', note: 'Balcony with Kanchenjunga view' },
      { id: 2, number: '102', type: 'Deluxe Valley View', floor: '1st Floor', price: 2800, status: 'AVAILABLE', note: 'King bed, wooden interiors' },
      { id: 3, number: '103', type: 'Standard Room', floor: '1st Floor', price: 1800, status: 'AVAILABLE', note: 'Cozy queen bed, attached bath' },
      { id: 4, number: '201', type: 'Family Suite', floor: '2nd Floor', price: 4200, status: 'OCCUPIED', note: '2 bedrooms + living area, ideal for 4' },
      { id: 5, number: '202', type: 'Family Suite', floor: '2nd Floor', price: 4200, status: 'AVAILABLE', note: 'Panoramic terrace view' },
      { id: 6, number: '203', type: 'Attic Cottage Room', floor: '3rd Floor', price: 2400, status: 'RESERVED', note: 'Slanted pine-wood roof, skylight' },
      { id: 7, number: '301', type: 'Budget Twin Room', floor: 'Ground Floor', price: 1400, status: 'AVAILABLE', note: 'Twin beds, garden facing' },
      { id: 8, number: '302', type: 'Budget Twin Room', floor: 'Ground Floor', price: 1400, status: 'MAINTENANCE', note: 'Painting and plumbing upgrade' },
    ];

    this.guests = [
      { id: 1, name: 'Ananya Roy', phone: '+91 98301 12345', email: 'ananya.roy@gmail.com', notes: 'Prefers non-spicy Sikkimese thali. Early riser.', visits: 3, totalSpending: 22400, firstVisit: t - 180 * DAY, lastVisit: t - 2 * DAY, marketingConsent: true },
      { id: 2, name: 'Vikram Mehta', phone: '+91 98200 45678', email: 'vikram.m@outlook.com', notes: 'Requested extra heater in room 201.', visits: 1, totalSpending: 8400, firstVisit: t - 1 * DAY, lastVisit: t - 1 * DAY, marketingConsent: true },
      { id: 3, name: 'Pooja Chawla', phone: '+91 97110 88990', email: 'pooja.chawla@techcorp.in', notes: 'Coming with family of 4. Needs airport cab.', visits: 2, totalSpending: 16800, firstVisit: t - 90 * DAY, lastVisit: t + 2 * DAY, marketingConsent: true },
      { id: 4, name: 'Siddharth Sen', phone: '+91 98314 33221', email: 'siddharth@senassociates.com', notes: 'Frequent weekend traveler from Kolkata.', visits: 4, totalSpending: 31200, firstVisit: t - 320 * DAY, lastVisit: t - 40 * DAY, marketingConsent: true },
      { id: 5, name: 'Meera Nambiar', phone: '+91 94471 99887', email: 'meera.nambiar@yahoo.com', notes: 'Vegetarian meals only. Requested quiet floor.', visits: 1, totalSpending: 5600, firstVisit: t - 10 * DAY, lastVisit: t - 8 * DAY, marketingConsent: false },
    ];

    this.bookings = [
      { id: 1, guestId: 1, guestName: 'Ananya Roy', phone: '+91 98301 12345', checkIn: t - 2 * DAY, checkOut: t + 1 * DAY, roomNumber: '101', guests: 2, status: 'CHECKED_IN', paid: true, amount: 8400, source: 'Direct link' },
      { id: 2, guestId: 2, guestName: 'Vikram Mehta', phone: '+91 98200 45678', checkIn: t - 1 * DAY, checkOut: t + 2 * DAY, roomNumber: '201', guests: 4, status: 'CHECKED_IN', paid: false, amount: 12600, source: 'Direct link' },
      { id: 3, guestId: 3, guestName: 'Pooja Chawla', phone: '+91 97110 88990', checkIn: t + 1 * DAY, checkOut: t + 4 * DAY, roomNumber: '203', guests: 2, status: 'CONFIRMED', paid: false, amount: 7200, source: 'WhatsApp' },
      { id: 4, guestId: 4, guestName: 'Siddharth Sen', phone: '+91 98314 33221', checkIn: t - 14 * DAY, checkOut: t - 11 * DAY, roomNumber: '102', guests: 1, status: 'CHECKED_OUT', paid: true, amount: 8400, source: 'Repeat booking' },
    ];

    this.drivers = [
      { id: 1, name: 'Pemba Lepcha', phone: '+91 98320 11223', vehicle: 'Innova Crysta', vehicleType: 'SUV', seats: 6, rating: 4.9, area: 'Gangtok - Deorali', trips: ['NJP', 'Bagdogra', 'Local', 'Sightseeing'], available: true, active: true, ownerDriver: true },
      { id: 2, name: 'Karma Bhutia', phone: '+91 97330 44556', vehicle: 'Mahindra Scorpio', vehicleType: 'SUV', seats: 6, rating: 4.8, area: 'Gangtok - Sichey', trips: ['NJP', 'Bagdogra', 'Sightseeing'], available: true, active: true, ownerDriver: true },
      { id: 3, name: 'Sunil Chettri', phone: '+91 94340 77889', vehicle: 'Swift Dzire', vehicleType: 'Sedan', seats: 4, rating: 4.7, area: 'Tadong', trips: ['Local', 'NJP'], available: false, active: true, ownerDriver: true },
      { id: 4, name: 'Dawa Tamang', phone: '+91 96470 22334', vehicle: 'Tata Winger', vehicleType: '9-seater', seats: 9, rating: 4.9, area: 'Vajra Stand', trips: ['NJP', 'Bagdogra', 'Sightseeing'], available: true, active: true, ownerDriver: true },
    ];

    this.networkDrivers = [
      { id: 201, name: 'Norbu Sherpa', phone: '+91 98002 11001', vehicle: 'Innova Crysta', vehicleType: 'SUV', seats: 6, rating: 4.9, area: 'MG Marg Stand', trips: ['NJP', 'Bagdogra', 'Local'], available: true, active: true, ownerDriver: false },
      { id: 202, name: 'Bikash Rai', phone: '+91 98003 22002', vehicle: 'Maruti Ertiga', vehicleType: '7-seater', seats: 6, rating: 4.8, area: 'Deorali Stand', trips: ['NJP', 'Darjeeling'], available: true, active: true, ownerDriver: false },
      { id: 203, name: 'Sonam Wangchuk', phone: '+91 98004 33003', vehicle: 'Tata Nexon EV', vehicleType: 'SUV', seats: 4, rating: 4.9, area: 'Development Area', trips: ['Local', 'Sightseeing'], available: true, active: true, ownerDriver: false },
      { id: 204, name: 'Kishan Pradhan', phone: '+91 98005 44004', vehicle: 'Toyota Rumion', vehicleType: '7-seater', seats: 6, rating: 4.7, area: 'Burtuk', trips: ['Bagdogra', 'Pelling'], available: true, active: true, ownerDriver: false },
      { id: 205, name: 'Passang Dorjee', phone: '+91 98006 55005', vehicle: 'Force Cruiser', vehicleType: '9-seater', seats: 9, rating: 4.8, area: 'Sichey', trips: ['NJP', 'Bagdogra', 'Sightseeing'], available: true, active: true, ownerDriver: false },
    ];

    this.trips = [
      { id: 1, guestName: 'Ananya Roy', phone: '+91 98301 12345', pickup: 'Bagdogra Airport', destination: 'Mountain View Homestay', date: t - 2 * DAY, time: '12:00 PM', passengers: 2, vehicleType: 'SUV', estFare: 3200, status: 'COMPLETED', driverId: 1, driverName: 'Pemba Lepcha', ownerDriver: true, fare: 3200, commission: 384, commissionPaid: true, advancePaid: true, advanceAmount: 480, remainingCashAmount: 2720 },
      { id: 2, guestName: 'Vikram Mehta', phone: '+91 98200 45678', pickup: 'NJP Station', destination: 'Mountain View Homestay', date: t - 1 * DAY, time: '09:00 AM', passengers: 4, vehicleType: 'SUV', estFare: 3000, status: 'COMPLETED', driverId: 2, driverName: 'Karma Bhutia', ownerDriver: true, fare: 3000, commission: 360, commissionPaid: false, advancePaid: true, advanceAmount: 450, remainingCashAmount: 2550 },
      { id: 3, guestName: 'Pooja Chawla', phone: '+91 97110 88990', pickup: 'Mountain View Homestay', destination: 'Bagdogra Airport', date: t + 4 * DAY, time: '08:00 AM', passengers: 2, vehicleType: 'SUV', estFare: 3200, status: 'DRIVER_ASSIGNED', driverId: 201, driverName: 'Norbu Sherpa', ownerDriver: false, fare: 0, commission: 384, commissionPaid: false, advancePaid: true, advanceAmount: 480, remainingCashAmount: 2720 },
      { id: 4, guestName: 'Rahul Verma', phone: '+91 98111 22334', pickup: 'Mountain View Homestay', destination: 'Tsomgo Lake & Baba Mandir', date: t + 1 * DAY, time: '07:30 AM', passengers: 4, vehicleType: 'SUV', estFare: 5500, status: 'NEW_REQUEST', driverId: null, driverName: null, ownerDriver: false, fare: 0, commission: 660, commissionPaid: false },
    ];

    this.campaigns = [
      { id: 1, title: 'Autumn Leaf Festival in Sikkim', message: 'Hi {name}! Autumn colors have arrived in Gangtok. Enjoy 15% off your weekend stay + complimentary airport pickup.', audience: 'All guests', status: 'COMPLETED', recipients: 14, sent: 14, failed: 0, createdOn: t - 15 * DAY },
      { id: 2, title: 'Kanchenjunga Winter Glow Discount', message: 'Dear {name}, clear blue skies and snow peaks await you at Mountain View Homestay. Book directly with us for best rates.', audience: 'Repeat guests', status: 'CREATED', recipients: 5, sent: 0, failed: 0, createdOn: t - 2 * DAY },
    ];
  }

  // Helpers
  room(id: number) { return this.rooms.find((r) => r.id === id); }
  guest(id: number) { return this.guests.find((g) => g.id === id); }
  booking(id: number) { return this.bookings.find((b) => b.id === id); }
  driver(id: number) { return this.drivers.find((d) => d.id === id); }
  trip(id: number) { return this.trips.find((t) => t.id === id); }
  campaign(id: number) { return this.campaigns.find((c) => c.id === id); }

  /** Id for a booking created outside createBooking (calendar imports). */
  nextBookingIdForImport() {
    return ++this.nextBookingId;
  }

  /** A room as clients see it: status derived from bookings, plus the next arrival. */
  roomView(r: StayRideRoom, now = Date.now()) {
    const next = this.bookings
      .filter((b) => b.roomNumber === r.number && b.status === 'CONFIRMED' && b.checkIn > now)
      .sort((a, b) => a.checkIn - b.checkIn)[0];
    return { ...r, status: roomStatusOf(r, this.bookings, now), nextArrival: next ? next.checkIn : null };
  }

  roomsView(now = Date.now()) {
    return this.rooms.map((r) => this.roomView(r, now));
  }

  /** The owner may only set or clear MAINTENANCE; occupied/reserved come from bookings. */
  private manualStatus(status: unknown, current: StayRideRoom['status']): StayRideRoom['status'] {
    if (status === 'MAINTENANCE') return 'MAINTENANCE';
    if (status === 'AVAILABLE') return 'AVAILABLE';
    return current === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE';
  }

  /** Bookings that still need this room (staying now, or arriving later). */
  private liveBookingsOf(roomNumber: string, now = Date.now()) {
    return this.bookings.filter((b) => b.roomNumber === roomNumber && (b.status === 'CHECKED_IN' || (b.status === 'CONFIRMED' && b.checkOut > now)));
  }

  // Mutations
  createRoom(data: Omit<StayRideRoom, 'id'>) {
    const fields = clean('room', data);
    if (!fields.number) throw bad('Room number is required.');
    if (this.rooms.some((r) => r.number === fields.number)) throw Object.assign(new Error(`Room ${fields.number} already exists.`), { status: 409 });
    const id = ++this.nextRoomId;
    const r: StayRideRoom = { ...fields, status: this.manualStatus(fields.status, 'AVAILABLE'), id };
    this.rooms.push(r);
    return this.roomView(r);
  }

  updateRoom(id: number, data: Partial<StayRideRoom>) {
    const r = this.room(id);
    if (!r) return null;
    const fields = clean('room', data);
    const oldNumber = r.number;
    if (fields.number && fields.number !== oldNumber) {
      if (this.rooms.some((o) => o.id !== id && o.number === fields.number)) {
        throw Object.assign(new Error(`Room ${fields.number} already exists.`), { status: 409 });
      }
    }
    if ('status' in fields) fields.status = this.manualStatus(fields.status, r.status);
    Object.assign(r, fields);
    // A renamed room keeps its bookings (they reference the room by number)
    if (r.number !== oldNumber) for (const b of this.bookings) if (b.roomNumber === oldNumber) b.roomNumber = r.number;
    return this.roomView(r);
  }

  deleteRoom(id: number) {
    const r = this.room(id);
    if (r && this.liveBookingsOf(r.number).length) {
      throw Object.assign(new Error(`Room ${r.number} has current or upcoming bookings. Move or cancel them first.`), { status: 409 });
    }
    this.rooms = this.rooms.filter((x) => x.id !== id);
  }

  /** Existing guest with this phone (last 10 digits), if any. */
  guestByPhone(phone: unknown) {
    const key = last10(phone);
    return key.length === 10 ? this.guests.find((g) => last10(g.phone) === key) : undefined;
  }

  createGuest(data: Omit<StayRideGuest, 'id' | 'visits' | 'totalSpending' | 'firstVisit' | 'lastVisit'>) {
    const fields = clean('guest', data);
    if (!fields.name) throw bad('Guest name is required.');
    const existing = this.guestByPhone(fields.phone);
    if (existing) {
      throw Object.assign(new Error(`${existing.name} already has this phone number in your guest list.`), { status: 409, code: 'DUPLICATE_GUEST' });
    }
    const id = ++this.nextGuestId;
    const g: StayRideGuest = {
      ...fields,
      id,
      visits: 0, // counted at checkout
      totalSpending: 0,
      firstVisit: Date.now(),
      lastVisit: Date.now(),
    };
    this.guests.unshift(g);
    return g;
  }

  updateGuest(id: number, data: Partial<StayRideGuest>) {
    const g = this.guest(id);
    if (!g) return null;
    const fields = clean('guest', data);
    const owner = 'phone' in fields ? this.guestByPhone(fields.phone) : undefined;
    if (owner && owner.id !== id) {
      throw Object.assign(new Error(`${owner.name} already has this phone number in your guest list.`), { status: 409, code: 'DUPLICATE_GUEST' });
    }
    Object.assign(g, fields);
    return g;
  }

  deleteGuest(id: number) {
    this.guests = this.guests.filter((g) => g.id !== id);
  }

  /**
   * Create a booking. The guest is the given guestId, else the existing guest with this phone, else a
   * new guest (created only once the booking is valid, so a refused booking leaves no orphan guest).
   */
  createBooking(input: Omit<StayRideBooking, 'id' | 'status'> & { paid?: boolean; advance?: unknown; advanceMethod?: unknown }) {
    const data = clean('booking', input);
    const advance = input.advance === undefined || input.advance === null || input.advance === '' ? 0 : Math.round(Number(input.advance));
    if (!Number.isFinite(advance) || advance < 0 || advance > Number(data.amount || 0)) throw bad('The amount received cannot be more than the booking total.');
    const requestedCheckIn = Number(data.checkIn);
    const requestedCheckOut = Number(data.checkOut);
    if (!Number.isFinite(requestedCheckIn) || !Number.isFinite(requestedCheckOut) || requestedCheckOut <= requestedCheckIn) {
      throw Object.assign(new Error('Valid check-in and check-out dates are required (check-out after check-in).'), { status: 400 });
    }
    const room = this.rooms.find((r) => r.number === data.roomNumber);
    if (!room) throw Object.assign(new Error('Unknown room.'), { status: 400 });
    if (room.status === 'MAINTENANCE') {
      throw Object.assign(new Error(`Room ${room.number} is under maintenance. Clear maintenance in Rooms first.`), { status: 409 });
    }
    const clash = bookingClash(this.bookings, data.roomNumber, requestedCheckIn, requestedCheckOut);
    if (clash) {
      throw Object.assign(
        new Error(`Room ${data.roomNumber} is already booked for these dates (${clash.guestName}). Please choose different dates or another room.`),
        { status: 409 }
      );
    }

    let guest = this.guest(Number(data.guestId)) || this.guestByPhone(data.phone);
    if (!guest) {
      if (!String(data.guestName || '').trim()) throw bad('Guest name is required.');
      if (last10(data.phone).length !== 10) throw bad('A 10-digit phone number is required for a new guest.');
      guest = this.createGuest({ name: data.guestName, phone: data.phone, email: '', notes: '', marketingConsent: false } as any);
    }

    const id = ++this.nextBookingId;
    const b: StayRideBooking = {
      ...data,
      guestId: guest.id,
      guestName: String(data.guestName || '').trim() || guest.name,
      phone: data.phone || guest.phone,
      id,
      status: 'CONFIRMED',
      paid: Boolean(data.paid),
    };
    this.bookings.unshift(b);
    // Money received when booking: the full amount ("paid") or an advance
    const received = data.paid ? b.amount : advance;
    if (received > 0) {
      b.paid = false;
      this.addPayment(b.id, { amount: received, method: input.advanceMethod, note: data.paid ? 'Paid at booking' : 'Advance at booking' });
    }
    return { ...b, guest };
  }

  checkInBooking(id: number) {
    const b = this.booking(id);
    if (!b) return null;
    if (b.status !== 'CONFIRMED') throw Object.assign(new Error(`Cannot check in a ${b.status} booking.`), { status: 409 });
    if (Date.now() < istDayStart(b.checkIn)) {
      const day = new Date(b.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
      throw Object.assign(new Error(`Check-in opens on ${day}. For an early arrival, cancel and book again from today.`), { status: 409, code: 'CHECK_IN_TOO_EARLY' });
    }
    const occupant = this.bookings.find((o) => o.id !== b.id && o.roomNumber === b.roomNumber && o.status === 'CHECKED_IN');
    if (occupant) throw Object.assign(new Error(`${occupant.guestName} is still checked in to room ${b.roomNumber}. Check them out first.`), { status: 409 });
    b.status = 'CHECKED_IN';
    return b;
  }

  /** A checked-out stay adds the money actually received to the guest's spending, kept in step afterwards. */
  private syncSpend(b: StayRideBooking) {
    const g = this.guest(b.guestId);
    const target = b.status === 'CHECKED_OUT' ? paidOf(b) : 0;
    // Older records: true / undefined-after-checkout meant "full amount counted at checkout"
    const counted =
      typeof b.spendCounted === 'number' ? b.spendCounted : (b.spendCounted ?? b.status === 'CHECKED_OUT') ? b.amount : 0;
    if (!g || target === counted) return;
    g.totalSpending = Math.max(0, g.totalSpending + target - counted);
    b.spendCounted = target;
  }

  private refreshPaid(b: StayRideBooking) {
    if (b.payments?.length) b.paid = b.amount > 0 && paidOf(b) >= b.amount;
  }

  /** Record money received (advance, part or balance). Never more than what is still due. */
  addPayment(id: number, input: { amount?: unknown; method?: unknown; note?: unknown }) {
    const b = this.booking(id);
    if (!b) return null;
    if (b.status === 'CANCELLED') throw Object.assign(new Error('A cancelled booking cannot take payments.'), { status: 409 });
    const amount = Math.round(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw bad('Enter the amount received.');
    const due = balanceOf(b);
    if (amount > due) throw bad(due > 0 ? `Only ₹${due.toLocaleString('en-IN')} is due on this booking.` : 'This booking is already fully paid.');
    const method = PAYMENT_METHODS.includes(input.method as any) ? (input.method as BookingPayment['method']) : 'CASH';
    if (!b.payments?.length && b.paid) b.payments = [{ id: 1, amount: b.amount, method: 'OTHER', note: 'Marked as paid', at: Date.now() }];
    const payments = b.payments || [];
    payments.push({ id: (payments.at(-1)?.id || 0) + 1, amount, method, note: String(input.note ?? '').trim().slice(0, 200), at: Date.now() });
    b.payments = payments;
    this.refreshPaid(b);
    this.syncSpend(b);
    return b;
  }

  /** Undo a payment recorded by mistake. */
  removePayment(id: number, paymentId: number) {
    const b = this.booking(id);
    if (!b) return null;
    if (!b.payments?.some((p) => p.id === paymentId)) throw Object.assign(new Error('Payment not found.'), { status: 404 });
    b.payments = b.payments.filter((p) => p.id !== paymentId);
    b.paid = b.payments.length ? b.amount > 0 && paidOf(b) >= b.amount : false;
    this.syncSpend(b);
    return b;
  }

  checkOutBooking(id: number) {
    const b = this.booking(id);
    if (!b) return null;
    // Guarded so a retried checkout can never count the visit twice
    if (b.status !== 'CHECKED_IN') throw Object.assign(new Error(`Cannot check out a ${b.status} booking.`), { status: 409 });
    b.spendCounted = false; // nothing counted yet for this stay
    b.status = 'CHECKED_OUT';
    b.actualCheckOut = Date.now();
    const g = this.guest(b.guestId);
    if (g) {
      g.visits += 1;
      g.lastVisit = Date.now();
    }
    this.syncSpend(b);
    return b;
  }

  cancelBooking(id: number) {
    const b = this.booking(id);
    if (!b) return null;
    if (b.status !== 'CONFIRMED') throw Object.assign(new Error(`Cannot cancel a ${b.status} booking.`), { status: 409 });
    b.status = 'CANCELLED';
    return b;
  }

  /** Older "paid" switch: on = the remaining balance was received; off = no money received. */
  setBookingPaid(id: number, paid: boolean) {
    const b = this.booking(id);
    if (!b) return null;
    if (paid) {
      const due = balanceOf(b);
      if (due > 0 && b.payments?.length) return this.addPayment(id, { amount: due, method: 'OTHER', note: 'Marked as paid' });
      if (!b.payments?.length) b.paid = true;
    } else {
      b.payments = [];
      b.paid = false;
    }
    this.syncSpend(b);
    return b;
  }

  /**
   * Edit a stay. Before arrival: dates, amount, party size (early arrival = move the check-in earlier).
   * While the guest is in: only the checkout (extend or leave earlier), amount and party size.
   * Same overlap rule as new bookings; check-ins never move into the past.
   */
  editBooking(id: number, changes: { checkIn?: unknown; checkOut?: unknown; amount?: unknown; guests?: unknown }) {
    const b = this.booking(id);
    if (!b) return null;
    if (b.status !== 'CONFIRMED' && b.status !== 'CHECKED_IN') {
      throw Object.assign(new Error(`A ${b.status.toLowerCase().replace('_', ' ')} booking cannot be edited.`), { status: 409 });
    }
    if (b.external && (changes.checkIn !== undefined || changes.checkOut !== undefined)) {
      throw Object.assign(new Error(`These dates come from ${b.external.source}. Change them there; the next sync updates them here.`), { status: 409 });
    }
    const num = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v));
    let checkIn = num(changes.checkIn) ?? b.checkIn;
    const checkOut = num(changes.checkOut) ?? b.checkOut;
    if (b.status === 'CHECKED_IN') checkIn = b.checkIn; // already arrived
    if (!Number.isFinite(checkIn) || !Number.isFinite(checkOut) || checkOut <= checkIn) {
      throw bad('Check-out must be after check-in.');
    }
    const today = istDayStart(Date.now());
    if (b.status === 'CONFIRMED' && checkIn !== b.checkIn && checkIn < today) throw bad('Check-in cannot be moved into the past.');
    if (b.status === 'CHECKED_IN' && checkOut < today) throw bad('Check-out cannot be before today.');
    const room = this.rooms.find((r) => r.number === b.roomNumber);
    if (room?.status === 'MAINTENANCE' && (checkIn < b.checkIn || checkOut > b.checkOut)) {
      throw Object.assign(new Error(`Room ${b.roomNumber} is under maintenance; it cannot be held longer.`), { status: 409 });
    }
    const clash = bookingClash(this.bookings, b.roomNumber, checkIn, checkOut, b.id);
    if (clash) {
      throw Object.assign(new Error(`Room ${b.roomNumber} is booked by ${clash.guestName} on some of these dates. Move this booking to another room first.`), { status: 409 });
    }
    const amount = num(changes.amount);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0 || amount > 10000000)) throw bad('Enter a valid amount.');
    const guests = num(changes.guests);
    if (guests !== undefined && (!Number.isInteger(guests) || guests < 1 || guests > 50)) throw bad('Enter a valid number of guests.');
    b.checkIn = checkIn;
    b.checkOut = checkOut;
    if (amount !== undefined && Math.round(amount) < paidOf(b) && b.payments?.length) {
      throw bad(`₹${paidOf(b).toLocaleString('en-IN')} is already received; the total cannot be lower. Remove a payment first.`);
    }
    if (amount !== undefined) b.amount = Math.round(amount);
    if (guests !== undefined) b.guests = guests;
    this.refreshPaid(b);
    return b;
  }

  changeBookingRoom(id: number, roomNumber: string) {
    const b = this.booking(id);
    if (!b) return null;
    if (b.status !== 'CONFIRMED') throw Object.assign(new Error(`Cannot move a ${b.status} booking.`), { status: 409 });
    if (b.external) throw Object.assign(new Error(`This booking is synced from ${b.external.source} for its room; it cannot be moved here.`), { status: 409 });
    const room = this.rooms.find((r) => r.number === roomNumber);
    if (!room) throw Object.assign(new Error('Unknown room.'), { status: 400 });
    if (room.status === 'MAINTENANCE') throw Object.assign(new Error(`Room ${roomNumber} is under maintenance.`), { status: 409 });
    if (bookingClash(this.bookings, roomNumber, b.checkIn, b.checkOut, b.id)) {
      throw Object.assign(new Error(`Room ${roomNumber} is already booked for these dates.`), { status: 409 });
    }
    b.roomNumber = roomNumber;
    return b;
  }

  deleteBooking(id: number) {
    const b = this.booking(id);
    if (b?.status === 'CHECKED_IN') throw Object.assign(new Error('Check the guest out before deleting this booking.'), { status: 409 });
    if (b) {
      b.paid = false;
      b.payments = [];
      this.syncSpend(b); // a deleted stay leaves the guest's spending
      const g = b.status === 'CHECKED_OUT' ? this.guest(b.guestId) : undefined;
      if (g) g.visits = Math.max(0, g.visits - 1); // ...and its visit
    }
    this.bookings = this.bookings.filter((x) => x.id !== id);
  }

  createDriver(data: Omit<StayRideDriver, 'id' | 'ownerDriver' | 'active'>) {
    const id = ++this.nextDriverId;
    const d: StayRideDriver = { ...clean('driver', data), id, ownerDriver: true, active: true };
    this.drivers.push(d);
    return d;
  }

  updateDriver(id: number, data: Partial<StayRideDriver>) {
    const d = this.driver(id);
    if (!d) return null;
    Object.assign(d, clean('driver', data));
    return d;
  }

  deleteDriver(id: number) {
    this.drivers = this.drivers.filter((d) => d.id !== id);
  }

  // `source` is set by the server (e.g. GUEST_WEB_LINK), never taken from the client body.
  createTrip(data: Partial<StayRideTrip>, source?: string) {
    const id = ++this.nextTripId;
    const estFare = data.vehicleType === 'SUV' ? 3000 : data.vehicleType === '7-seater' ? 3200 : data.vehicleType === '9-seater' ? 4200 : 2200;
    const t: StayRideTrip = {
      ...pick(data, WRITABLE.trip),
      ...(source ? { source } : {}),
      id,
      estFare,
      status: 'NEW_REQUEST',
      driverId: null,
      driverName: null,
      ownerDriver: false,
      fare: 0,
      commission: 0,
      commissionPaid: false,
    };
    this.trips.unshift(t);
    return t;
  }

  assignTrip(tripId: number, driverId: number) {
    const t = this.trip(tripId);
    if (!t) return null;
    const d = this.driver(driverId) || this.networkDrivers.find((nd) => nd.id === driverId);
    t.driverId = driverId;
    t.driverName = d ? d.name : 'Assigned Driver';
    t.ownerDriver = d ? d.ownerDriver : false;
    t.status = 'DRIVER_ASSIGNED';
    return t;
  }

  acceptTrip(tripId: number) {
    const t = this.trip(tripId);
    if (!t) return null;
    t.status = 'CONFIRMED';
    return t;
  }

  quoteTrip(tripId: number, driverId: number, quotedFare: number) {
    const t = this.trip(tripId);
    if (!t) return null;
    const d = this.driver(driverId) || this.networkDrivers.find((nd) => nd.id === driverId);
    t.quotes = t.quotes || [];
    t.quotes.push({
      driverId,
      driverName: d ? d.name : `Driver #${driverId}`,
      quotedFare,
      status: 'PENDING',
    });
    t.status = 'QUOTE_RECEIVED';
    return t;
  }

  confirmTripQuote(tripId: number, driverId: number, agreedFare: number, financialSnapshot?: any) {
    const t = this.trip(tripId);
    if (!t) return null;
    const d = this.driver(driverId) || this.networkDrivers.find((nd) => nd.id === driverId);
    t.driverId = driverId;
    t.driverName = d ? d.name : 'Assigned Driver';
    t.ownerDriver = d ? d.ownerDriver : false;
    t.fare = agreedFare;
    t.status = 'CONFIRMED';
    t.financialSnapshot = financialSnapshot;
    // Own-driver trips never carry platform money; platform trips live in CabRequest (see platform.ts).
    t.commission = 0;
    t.advanceAmount = 0;
    t.remainingCashAmount = agreedFare;
    return t;
  }

  reassignTrip(tripId: number) {
    const t = this.trip(tripId);
    if (!t) return null;
    t.driverId = null;
    t.driverName = null;
    t.status = 'FINDING_DRIVER';
    return t;
  }

  startTrip(tripId: number) {
    const t = this.trip(tripId);
    if (!t) return null;
    if (t.status !== 'CONFIRMED' && t.status !== 'DRIVER_ASSIGNED') {
      throw Object.assign(new Error(`Cannot start trip in status '${t.status}'. Only CONFIRMED or DRIVER_ASSIGNED trips can be started.`), { status: 409 });
    }
    t.status = 'TRIP_STARTED';
    return t;
  }

  completeTrip(tripId: number, finalFare?: number) {
    const t = this.trip(tripId);
    if (!t) return null;
    if (t.status !== 'TRIP_STARTED' && t.status !== 'CONFIRMED' && t.status !== 'DRIVER_ASSIGNED') {
      throw Object.assign(new Error(`Cannot complete trip in status '${t.status}'. Only active trips (TRIP_STARTED, CONFIRMED, or DRIVER_ASSIGNED) can be completed.`), { status: 409 });
    }
    t.status = 'COMPLETED';
    if (t.financialSnapshot) {
      // Platform-arranged trip: fare and commission are locked by the snapshot.
      t.fare = t.financialSnapshot.agreedFare;
      t.commission = t.financialSnapshot.homestayCommissionAmount;
    } else {
      // Own-driver trip: the fare is the owner's own record; no platform commission is ever earned.
      // Keep the agreed fare unless the owner records a different final fare
      const f = Number(finalFare);
      if (Number.isFinite(f) && f > 0) t.fare = Math.round(f);
      t.commission = 0;
    }
    return t;
  }

  cancelTrip(tripId: number) {
    const t = this.trip(tripId);
    if (!t) return null;
    if (t.status === 'COMPLETED') {
      throw Object.assign(new Error(`Cannot cancel a trip that is already COMPLETED.`), { status: 409 });
    }
    if (t.status === 'CANCELLED') {
      return t;
    }
    t.status = 'CANCELLED';
    return t;
  }

  payCommission(tripId: number, paid: boolean) {
    const t = this.trip(tripId);
    if (!t) return null;
    if (t.payoutId) return t; // settled by a platform payout; owner can't reopen it
    t.commissionPaid = paid;
    return t;
  }

  createCampaign(title: string, message: string, audience: string) {
    const id = ++this.nextCampaignId;
    const consenting = this.guests.filter((g) => g.marketingConsent);
    const recipients =
      audience === 'Repeat guests'
        ? consenting.filter((g) => g.visits > 1).length
        : audience === 'Recent guests'
        ? consenting.filter((g) => g.lastVisit >= Date.now() - 60 * DAY).length
        : audience === 'Inactive guests'
        ? consenting.filter((g) => g.lastVisit < Date.now() - 90 * DAY).length
        : consenting.length;
    const c: StayRideCampaign = {
      id,
      title,
      message,
      audience,
      status: 'CREATED',
      recipients,
      sent: 0,
      failed: 0,
      createdOn: Date.now(),
    };
    this.campaigns.unshift(c);
    return c;
  }

  sendCampaign(id: number) {
    const c = this.campaign(id);
    if (!c) return null;
    c.status = 'COMPLETED';
    c.sent = c.recipients;
    c.failed = 0;
    return c;
  }

  deleteCampaign(id: number) {
    this.campaigns = this.campaigns.filter((c) => c.id !== id);
  }

  /** Admin edit of one item. Platform trips are refused (they are managed through cab-request actions). */
  updateItem(collection: TenantCollection, id: number, body: any) {
    const item: any = (this[collection] as any[]).find((x) => x.id === id);
    if (!item) return null;
    if (collection === 'trips' && isPlatformTrip(item)) throw Object.assign(new Error('This trip is managed by the platform.'), { status: 409, code: 'PLATFORM_MANAGED' });
    const fields = clean(TENANT_COLLECTIONS[collection], body);
    const next = { ...item, ...fields };
    if (collection === 'bookings' && !(next.checkOut > next.checkIn)) throw bad('Check-out must be after check-in.');
    Object.assign(item, fields);
    return item;
  }

  deleteItem(collection: TenantCollection, id: number) {
    const list = this[collection] as any[];
    const item = list.find((x) => x.id === id);
    if (!item) return null;
    if (collection === 'trips' && isPlatformTrip(item)) throw Object.assign(new Error('This trip is managed by the platform.'), { status: 409, code: 'PLATFORM_MANAGED' });
    if (collection === 'guests' && this.bookings.some((b) => b.guestId === id && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN'))) {
      throw Object.assign(new Error('This guest has an active booking. Cancel or check out the booking first.'), { status: 409 });
    }
    (this as any)[collection] = list.filter((x) => x.id !== id);
    return item;
  }

  toJSON() {
    return {
      homestay: this.homestay,
      rooms: this.rooms,
      guests: this.guests,
      bookings: this.bookings,
      drivers: this.drivers,
      networkDrivers: this.networkDrivers,
      trips: this.trips,
      campaigns: this.campaigns,
      nextRoomId: this.nextRoomId,
      nextGuestId: this.nextGuestId,
      nextBookingId: this.nextBookingId,
      nextDriverId: this.nextDriverId,
      nextTripId: this.nextTripId,
      nextCampaignId: this.nextCampaignId,
    };
  }

  fromJSON(data: any) {
    if (!data) return;
    if (data.homestay) this.homestay = data.homestay;
    if (Array.isArray(data.rooms)) this.rooms = data.rooms;
    if (Array.isArray(data.guests)) this.guests = data.guests;
    if (Array.isArray(data.bookings)) this.bookings = data.bookings;
    if (Array.isArray(data.drivers)) this.drivers = data.drivers;
    if (Array.isArray(data.networkDrivers)) this.networkDrivers = data.networkDrivers;
    if (Array.isArray(data.trips)) this.trips = data.trips;
    if (Array.isArray(data.campaigns)) this.campaigns = data.campaigns;
    if (typeof data.nextRoomId === 'number') this.nextRoomId = data.nextRoomId;
    if (typeof data.nextGuestId === 'number') this.nextGuestId = data.nextGuestId;
    if (typeof data.nextBookingId === 'number') this.nextBookingId = data.nextBookingId;
    if (typeof data.nextDriverId === 'number') this.nextDriverId = data.nextDriverId;
    if (typeof data.nextTripId === 'number') this.nextTripId = data.nextTripId;
    if (typeof data.nextCampaignId === 'number') this.nextCampaignId = data.nextCampaignId;
  }
}

import mongoose, { Schema, model } from 'mongoose';
import crypto from 'node:crypto';
import { getISTTimestamp } from '../utils/date.js';
import { config, dbNameFor } from '../config/env.js';
import { CloudinaryService } from '../services/cloudinary.service.js';

export const StayRideTenantSchema = new Schema(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    version: { type: Number, default: 0 },
    accountType: {
      type: String,
      enum: ['DEMO', 'PRODUCTION'],
      default: 'PRODUCTION',
      index: true,
    },
    isDemo: { type: Boolean, default: false, index: true },
    ownerName: { type: String, default: '' },
    homestayName: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    location: { type: String, default: '' },
    data: { type: Schema.Types.Mixed, required: true },
    lastActiveAt: { type: Date, default: Date.now },
    lastActiveAtIST: { type: String, default: () => getISTTimestamp() },
    createdAtIST: { type: String, default: () => getISTTimestamp() },
    updatedAtIST: { type: String, default: () => getISTTimestamp() },
  },
  { timestamps: true }
);

StayRideTenantSchema.pre('save', function () {
  this.updatedAtIST = getISTTimestamp();
  this.lastActiveAtIST = getISTTimestamp();
  if (!this.createdAtIST) {
    this.createdAtIST = getISTTimestamp();
  }
});

export function getStayRideTenantModel(isDemo: boolean = false) {
  // Demo tenants live only in "test", everything else only in the live db. Never fall back to the
  // default connection: it points at the live db, so a not-ready connection would otherwise let a
  // demo read/write silently hit production.
  if (mongoose.connection.readyState !== 1) {
    throw Object.assign(
      new Error(isDemo ? 'Demo database (test) is unavailable.' : 'Database unavailable'),
      { status: 503, code: 'DB_UNAVAILABLE' }
    );
  }
  const db = mongoose.connection.useDb(dbNameFor(isDemo), { useCache: true });
  return (
    db.models.StayRideTenant ||
    db.model('StayRideTenant', StayRideTenantSchema)
  );
}

export const StayRideTenantModel =
  mongoose.models.StayRideTenant ||
  model('StayRideTenant', StayRideTenantSchema);

export const DEMO_TENANT = config.demoHostEmail || 'demo-tenant';
const DEMO_KEYS = new Set(
  [
    'demo',
    'demo-tenant',
    DEMO_TENANT,
    (config.demoHostEmail || '').toLowerCase().trim(),
    (config.demoDriverEmail || '').toLowerCase().trim(),
    'demo@stayride.in',
    'stay@mountainviewgangtok.com',
    'stay@mountainview.in',
  ].filter(Boolean)
);
export const isDemoKey = (key: string) => {
  const clean = (key || '').toLowerCase().trim();
  return DEMO_KEYS.has(clean) || clean.startsWith('demo@') || clean === 'demo';
};

export class ConflictError extends Error {
  status = 409;
  code = 'CONFLICT';
  constructor() {
    super('This record was changed at the same time by another request. Please retry.');
  }
}

const MAX_TENANT_BYTES = 8 * 1024 * 1024;
export const normKey = (k: string) => (isDemoKey(k) ? DEMO_TENANT : (k || '').toLowerCase().trim());

/**
 * Stateless tenant persistence for serverless (Vercel): every request loads the tenant fresh from
 * MongoDB and saves with optimistic concurrency ({tenantId, version} + $inc). Nothing is cached
 * between requests, so concurrent instances can never overwrite each other's newer data.
 */
export class StayRideTenantManager {
  private requireDb() {
    if (mongoose.connection.readyState !== 1) throw Object.assign(new Error('Database unavailable'), { status: 503 });
  }

  /** Load the tenant, creating (demo: seeding) it if it does not exist yet. */
  async load(tenantId: string, homestayInfo?: Partial<StayRideHomestay>): Promise<StayRideMemoryStore> {
    this.requireDb();
    const key = normKey(tenantId);
    const isDemo = key === DEMO_TENANT;
    const Model = getStayRideTenantModel(isDemo);
    let doc: any = await Model.findOne({ tenantId: key }).lean();
    if (!doc) {
      const seed = new StayRideMemoryStore(isDemo, homestayInfo);
      if (!isDemo && !seed.homestay.link) seed.homestay.link = await this.uniqueLink(Model, seed.homestay.name);
      await Model.updateOne(
        { tenantId: key },
        {
          $setOnInsert: {
            tenantId: key,
            version: 0,
            accountType: isDemo ? 'DEMO' : 'PRODUCTION',
            isDemo,
            ...this.summary(key, seed),
            data: seed.toJSON(),
          },
        },
        { upsert: true }
      );
      doc = await Model.findOne({ tenantId: key }).lean();
    }
    const store = new StayRideMemoryStore(isDemo);
    store.fromJSON(doc.data);
    store.tenantKey = key;
    store.version = doc.version ?? 0;
    return store;
  }

  /** `${GUEST_WEB_URL}/h/<slug>-<6 random lowercase alnum>`, checked against existing tenants. */
  private async uniqueLink(Model: mongoose.Model<any>, name: string): Promise<string> {
    const slug = (name || 'homestay').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'homestay';
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (;;) {
      const suffix = Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
      const link = `${config.guestWebUrl}/h/${slug}-${suffix}`;
      // ponytail: unindexed lookup, runs only at signup; 36^6 suffixes make a retry practically never happen
      if (!(await Model.exists({ 'data.homestay.link': link }))) return link;
    }
  }

  /** Alias kept for existing callers. */
  getStoreAsync(tenantId: string) {
    return this.load(tenantId);
  }

  createTenantIfMissing(tenantId: string, homestayInfo?: Partial<StayRideHomestay>) {
    return this.load(tenantId, homestayInfo);
  }

  /** Compare-and-set save. Throws ConflictError if another request saved first; throws on any DB error. */
  async save(store: StayRideMemoryStore): Promise<void> {
    this.requireDb();
    if (!store.tenantKey) throw new Error('Store was not loaded through the tenant manager');
    const isDemo = store.tenantKey === DEMO_TENANT;
    const data = store.toJSON();
    if (Buffer.byteLength(JSON.stringify(data)) > MAX_TENANT_BYTES) {
      throw Object.assign(new Error('Homestay data is too large (8 MB limit). Remove some photos or old records.'), { status: 413, code: 'PAYLOAD_TOO_LARGE' });
    }
    const versionFilter = store.version === 0 ? { $in: [0, null] } : store.version;
    const result = await getStayRideTenantModel(isDemo).updateOne(
      { tenantId: store.tenantKey, version: versionFilter },
      {
        $set: { ...this.summary(store.tenantKey, store), data, lastActiveAt: new Date(), updatedAtIST: getISTTimestamp() },
        $inc: { version: 1 },
      }
    );
    if (result.matchedCount === 0) throw new ConflictError();
    store.version += 1;
  }

  /** Load → mutate → save, retrying on concurrent writes. `fn` must only change the store. */
  async mutate<T>(tenantId: string, fn: (store: StayRideMemoryStore) => T, attempts = 5): Promise<T> {
    for (let i = 0; ; i++) {
      const store = await this.load(tenantId);
      const result = fn(store);
      try {
        await this.save(store);
        return result;
      } catch (err) {
        if (!(err instanceof ConflictError) || i >= attempts - 1) throw err;
        await new Promise((r) => setTimeout(r, 20 + Math.random() * 60));
      }
    }
  }

  async resetDemoStore(): Promise<void> {
    this.requireDb();
    const fresh = new StayRideMemoryStore(true);
    await getStayRideTenantModel(true).updateOne(
      { tenantId: DEMO_TENANT },
      { $set: { ...this.summary(DEMO_TENANT, fresh), data: fresh.toJSON(), accountType: 'DEMO', isDemo: true }, $inc: { version: 1 } },
      { upsert: true }
    );
  }

  private summary(key: string, store: StayRideMemoryStore) {
    return {
      ownerName: store.homestay.ownerName || '',
      homestayName: store.homestay.name || '',
      email: store.homestay.email || (key.includes('@') ? key : ''),
      phone: store.homestay.phone || '',
      location: store.homestay.location || '',
    };
  }
}

export const tenantManager = new StayRideTenantManager();
