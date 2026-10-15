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
}

const DAY = 86400000;

// Client-writable fields per entity. Everything else (ids, money, status) is server-owned.
export const WRITABLE = {
  room: ['number', 'type', 'floor', 'price', 'status', 'note'],
  guest: ['name', 'phone', 'email', 'notes', 'marketingConsent'],
  booking: ['guestId', 'guestName', 'phone', 'checkIn', 'checkOut', 'roomNumber', 'guests', 'amount', 'source', 'paid'],
  driver: ['name', 'phone', 'vehicle', 'vehicleType', 'seats', 'rating', 'area', 'trips', 'available', 'active', 'plate'],
  trip: ['guestName', 'phone', 'pickup', 'destination', 'destinations', 'isRoundTrip', 'returnDate', 'returnTime', 'date', 'time', 'passengers', 'vehicleType', 'guestId', 'bookingId'],
  homestay: ['name', 'description', 'location', 'phone', 'ownerName', 'mapQuery', 'amenities', 'photos'],
} as const;

export function pick(obj: any, keys: readonly string[]): any {
  const out: any = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  return out;
}
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
        link: 'https://stayride.in/h/mountain-view-gangtok',
        mapQuery: 'Mountain View Homestay Gangtok Sikkim',
        amenities: [
          'Free Wi-Fi',
          '24x7 Hot Water',
          'Home Breakfast',
          'Mountain View',
          'In-house Cabs (StayRide)',
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
      // PRODUCTION FRESH HOMESTAY FOR REAL USERS:
      // Real users start with 0 rooms, 0 guests, 0 bookings, 0 trips, 0 campaigns
      this.homestay = {
        name: initialHomestay?.name || 'My Homestay',
        description: initialHomestay?.description || 'Peaceful mountain retreat nestled in the hills.',
        location: initialHomestay?.location || 'Gangtok, Sikkim',
        phone: initialHomestay?.phone || '',
        email: initialHomestay?.email || '',
        ownerName: initialHomestay?.ownerName || 'Host',
        link: initialHomestay?.link || `https://stayride.in/h/${(initialHomestay?.name || 'homestay').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        mapQuery: initialHomestay?.location || '',
        amenities: ['Free Wi-Fi', 'Hot Water', 'Home Cooked Meals', 'Power Backup'],
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
      { id: 1, guestId: 1, guestName: 'Ananya Roy', phone: '+91 98301 12345', checkIn: t - 2 * DAY, checkOut: t + 1 * DAY, roomNumber: '101', guests: 2, status: 'CHECKED_IN', paid: true, amount: 8400, source: 'StayRide link' },
      { id: 2, guestId: 2, guestName: 'Vikram Mehta', phone: '+91 98200 45678', checkIn: t - 1 * DAY, checkOut: t + 2 * DAY, roomNumber: '201', guests: 4, status: 'CHECKED_IN', paid: false, amount: 12600, source: 'StayRide link' },
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
      { id: 1, guestName: 'Ananya Roy', phone: '+91 98301 12345', pickup: 'Bagdogra Airport', destination: 'Mountain View Homestay', date: t - 2 * DAY, time: '12:00 PM', passengers: 2, vehicleType: 'SUV', estFare: 3200, status: 'COMPLETED', driverId: 1, driverName: 'Pemba Lepcha', ownerDriver: true, fare: 3200, commission: 384, commissionPaid: true },
      { id: 2, guestName: 'Vikram Mehta', phone: '+91 98200 45678', pickup: 'NJP Station', destination: 'Mountain View Homestay', date: t - 1 * DAY, time: '09:00 AM', passengers: 4, vehicleType: 'SUV', estFare: 3000, status: 'COMPLETED', driverId: 2, driverName: 'Karma Bhutia', ownerDriver: true, fare: 3000, commission: 360, commissionPaid: false },
      { id: 3, guestName: 'Pooja Chawla', phone: '+91 97110 88990', pickup: 'Mountain View Homestay', destination: 'Bagdogra Airport', date: t + 4 * DAY, time: '08:00 AM', passengers: 2, vehicleType: 'SUV', estFare: 3200, status: 'DRIVER_ASSIGNED', driverId: 201, driverName: 'Norbu Sherpa', ownerDriver: false, fare: 0, commission: 384, commissionPaid: false },
      { id: 4, guestName: 'Rahul Verma', phone: '+91 98111 22334', pickup: 'Mountain View Homestay', destination: 'Tsomgo Lake & Baba Mandir', date: t + 1 * DAY, time: '07:30 AM', passengers: 4, vehicleType: 'SUV', estFare: 5500, status: 'NEW_REQUEST', driverId: null, driverName: null, ownerDriver: false, fare: 0, commission: 660, commissionPaid: false },
    ];

    this.campaigns = [
      { id: 1, title: 'Autumn Leaf Festival in Sikkim', message: 'Hi {name}! Autumn colors have arrived in Gangtok. Enjoy 15% off your weekend stay + complimentary airport pickup.', audience: 'All guests', status: 'COMPLETED', recipients: 14, sent: 14, failed: 0, createdOn: t - 15 * DAY },
      { id: 2, title: 'Kanchenjunga Winter Glow Discount', message: 'Dear {name}, clear blue skies and snow peaks await you at Mountain View Homestay. Book directly on StayRide for best rates.', audience: 'Repeat guests', status: 'CREATED', recipients: 5, sent: 0, failed: 0, createdOn: t - 2 * DAY },
    ];
  }

  // Helpers
  room(id: number) { return this.rooms.find((r) => r.id === id); }
  guest(id: number) { return this.guests.find((g) => g.id === id); }
  booking(id: number) { return this.bookings.find((b) => b.id === id); }
  driver(id: number) { return this.drivers.find((d) => d.id === id); }
  trip(id: number) { return this.trips.find((t) => t.id === id); }
  campaign(id: number) { return this.campaigns.find((c) => c.id === id); }

  // Mutations
  createRoom(data: Omit<StayRideRoom, 'id'>) {
    const id = ++this.nextRoomId;
    const r: StayRideRoom = { ...pick(data, WRITABLE.room), id };
    this.rooms.push(r);
    return r;
  }

  updateRoom(id: number, data: Partial<StayRideRoom>) {
    const r = this.room(id);
    if (!r) return null;
    Object.assign(r, pick(data, WRITABLE.room));
    return r;
  }

  deleteRoom(id: number) {
    this.rooms = this.rooms.filter((r) => r.id !== id);
  }

  createGuest(data: Omit<StayRideGuest, 'id' | 'visits' | 'totalSpending' | 'firstVisit' | 'lastVisit'>) {
    const id = ++this.nextGuestId;
    const g: StayRideGuest = {
      ...pick(data, WRITABLE.guest),
      id,
      visits: 1,
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
    Object.assign(g, pick(data, WRITABLE.guest));
    return g;
  }

  deleteGuest(id: number) {
    this.guests = this.guests.filter((g) => g.id !== id);
  }

  createBooking(data: Omit<StayRideBooking, 'id' | 'status'> & { paid?: boolean }) {
    // Prevent overlapping bookings on the same room
    const requestedCheckIn = Number(data.checkIn);
    const requestedCheckOut = Number(data.checkOut);
    const hasCollision = this.bookings.some((b) => {
      if (b.roomNumber !== data.roomNumber || b.status === 'CANCELLED') return false;
      return requestedCheckIn < b.checkOut && requestedCheckOut > b.checkIn;
    });

    if (hasCollision) {
      throw new Error(
        `Room ${data.roomNumber} is already booked for these dates (${new Date(requestedCheckIn).toLocaleDateString()} to ${new Date(requestedCheckOut).toLocaleDateString()}). Please select different dates or a different room.`
      );
    }

    const id = ++this.nextBookingId;
    const b: StayRideBooking = {
      ...pick(data, WRITABLE.booking),
      id,
      status: 'CONFIRMED',
      paid: Boolean(data.paid),
    };
    this.bookings.unshift(b);

    const rm = this.rooms.find((r) => r.number === data.roomNumber);
    if (rm && rm.status === 'AVAILABLE') {
      rm.status = 'RESERVED';
    }
    return b;
  }

  checkInBooking(id: number) {
    const b = this.booking(id);
    if (!b) return null;
    b.status = 'CHECKED_IN';
    const rm = this.rooms.find((r) => r.number === b.roomNumber);
    if (rm) rm.status = 'OCCUPIED';
    return b;
  }

  checkOutBooking(id: number) {
    const b = this.booking(id);
    if (!b) return null;
    b.status = 'CHECKED_OUT';
    const rm = this.rooms.find((r) => r.number === b.roomNumber);
    if (rm) rm.status = 'AVAILABLE';

    // Update guest statistics on checkout
    const g = this.guest(b.guestId);
    if (g) {
      g.visits += 1;
      g.totalSpending += b.amount;
      g.lastVisit = Date.now();
    }
    return b;
  }

  cancelBooking(id: number) {
    const b = this.booking(id);
    if (!b) return null;
    b.status = 'CANCELLED';
    const rm = this.rooms.find((r) => r.number === b.roomNumber);
    if (rm && rm.status !== 'OCCUPIED') rm.status = 'AVAILABLE';
    return b;
  }

  setBookingPaid(id: number, paid: boolean) {
    const b = this.booking(id);
    if (!b) return null;
    b.paid = paid;
    return b;
  }

  changeBookingRoom(id: number, roomNumber: string) {
    const b = this.booking(id);
    if (!b) return null;

    // Release old room if it was reserved
    const oldRm = this.rooms.find((r) => r.number === b.roomNumber);
    if (oldRm && oldRm.status === 'RESERVED') {
      oldRm.status = 'AVAILABLE';
    }

    // Reserve new room if available
    const newRm = this.rooms.find((r) => r.number === roomNumber);
    if (newRm && newRm.status === 'AVAILABLE') {
      newRm.status = 'RESERVED';
    }

    b.roomNumber = roomNumber;
    return b;
  }

  deleteBooking(id: number) {
    this.bookings = this.bookings.filter((b) => b.id !== id);
  }

  createDriver(data: Omit<StayRideDriver, 'id' | 'ownerDriver' | 'active'>) {
    const id = ++this.nextDriverId;
    const d: StayRideDriver = { ...pick(data, WRITABLE.driver), id, ownerDriver: true, active: true };
    this.drivers.push(d);
    return d;
  }

  updateDriver(id: number, data: Partial<StayRideDriver>) {
    const d = this.driver(id);
    if (!d) return null;
    Object.assign(d, pick(data, WRITABLE.driver));
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
    t.commission = financialSnapshot?.homestayCommissionAmount ?? Math.round(agreedFare * 0.10);
    t.advanceAmount = financialSnapshot?.advanceAmount ?? Math.round(agreedFare * 0.15);
    t.remainingCashAmount = financialSnapshot?.remainingCashToDriver ?? Math.max(0, agreedFare - (t.advanceAmount || 0));
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
      throw new Error(`Cannot start trip in status '${t.status}'. Only CONFIRMED or DRIVER_ASSIGNED trips can be started.`);
    }
    t.status = 'TRIP_STARTED';
    return t;
  }

  completeTrip(tripId: number, finalFare?: number, hcRate = 0.10) {
    const t = this.trip(tripId);
    if (!t) return null;
    if (t.status !== 'TRIP_STARTED' && t.status !== 'CONFIRMED' && t.status !== 'DRIVER_ASSIGNED') {
      throw new Error(`Cannot complete trip in status '${t.status}'. Only active trips (TRIP_STARTED, CONFIRMED, or DRIVER_ASSIGNED) can be completed.`);
    }
    t.status = 'COMPLETED';
    if (t.financialSnapshot) {
      // Platform-arranged trip: fare and commission are locked by the snapshot.
      t.fare = t.financialSnapshot.agreedFare;
      t.commission = t.financialSnapshot.homestayCommissionAmount;
    } else {
      const f = Number(finalFare);
      t.fare = Number.isFinite(f) && f > 0 ? Math.round(f) : t.estFare || 3000;
      t.commission = Math.round(t.fare * hcRate);
    }
    return t;
  }

  cancelTrip(tripId: number) {
    const t = this.trip(tripId);
    if (!t) return null;
    if (t.status === 'COMPLETED') {
      throw new Error(`Cannot cancel a trip that is already COMPLETED.`);
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
import { getISTTimestamp } from '../utils/date.js';

export const StayRideTenantSchema = new Schema(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
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
  const dbName = isDemo ? 'test' : 'production';
  if (mongoose.connection.readyState === 1) {
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    return (
      db.models.StayRideTenant ||
      db.model('StayRideTenant', StayRideTenantSchema)
    );
  }
  return (
    mongoose.models.StayRideTenant ||
    model('StayRideTenant', StayRideTenantSchema)
  );
}

export const StayRideTenantModel =
  mongoose.models.StayRideTenant ||
  model('StayRideTenant', StayRideTenantSchema);

const DEMO_KEYS = new Set(['demo', 'demo@stayride.in', 'stay@mountainviewgangtok.com', 'stay@mountainview.in']);
export const isDemoKey = (key: string) => DEMO_KEYS.has((key || '').toLowerCase().trim());

export class StayRideTenantManager {
  private stores = new Map<string, StayRideMemoryStore>();
  private loading = new Map<string, Promise<StayRideMemoryStore>>();

  constructor() {
    // Demo store is always initialized with Mountain View Homestay showcase data
    const demoStore = new StayRideMemoryStore(true);
    this.stores.set('demo', demoStore);
    this.stores.set('demo@stayride.in', demoStore);
    this.stores.set('stay@mountainviewgangtok.com', demoStore);
    this.stores.set('stay@mountainview.in', demoStore);
  }

  async initDemoTenant() {
    if (mongoose.connection.readyState !== 1) return;
    try {
      const demoStore = this.stores.get('demo') || new StayRideMemoryStore(true);
      const testModel = getStayRideTenantModel(true); // Saved to 'test' database in MongoDB Atlas
      await testModel.findOneAndUpdate(
        { tenantId: 'demo@stayride.in' },
        {
          tenantId: 'demo@stayride.in',
          accountType: 'DEMO',
          isDemo: true,
          ownerName: 'Tshering Bhutia (Demo Host)',
          homestayName: 'Mountain View Homestay',
          email: 'demo@stayride.in',
          phone: '+91 98001 23456',
          location: 'Upper Sichey, Gangtok, Sikkim 737101',
          data: demoStore.toJSON(),
          lastActiveAt: new Date(),
          lastActiveAtIST: getISTTimestamp(),
          updatedAtIST: getISTTimestamp(),
        },
        { upsert: true, new: true }
      );
      console.log("✅ Demo tenant initialized in MongoDB 'test' database (Cluster0 > test > stayridetenants)");
    } catch (err) {
      console.warn('[StayRide] Failed to seed demo tenant to MongoDB:', err);
    }
  }

  getStore(tenantId: string = 'demo'): StayRideMemoryStore {
    const key = (tenantId || 'demo').toLowerCase().trim();
    if (isDemoKey(key)) {
      return this.stores.get('demo')!;
    }
    if (!this.stores.has(key)) {
      // Create fresh isolated homestay workspace for real user!
      this.stores.set(key, new StayRideMemoryStore(false));
    }
    return this.stores.get(key)!;
  }

  async getStoreAsync(tenantId: string = 'demo'): Promise<StayRideMemoryStore> {
    const key = (tenantId || 'demo').toLowerCase().trim();
    if (isDemoKey(key)) {
      return this.stores.get('demo')!;
    }

    if (this.stores.has(key)) {
      return this.stores.get(key)!;
    }

    // Hydrate from MongoDB. On DB errors/disconnects we throw instead of caching an
    // empty store, otherwise the next persistTenant would overwrite the real data.
    if (mongoose.connection.readyState !== 1) throw new Error('Database unavailable');
    // Single-flight per tenant so concurrent first requests share one store instance.
    let pending = this.loading.get(key);
    if (!pending) {
      pending = this.loadPersisted(key)
        .then((persisted) => {
          if (persisted) return persisted;
          const fresh = new StayRideMemoryStore(false);
          this.stores.set(key, fresh);
          return fresh;
        })
        .finally(() => this.loading.delete(key));
      this.loading.set(key, pending);
    }
    return pending;
  }

  private async loadPersisted(key: string): Promise<StayRideMemoryStore | null> {
    if (mongoose.connection.readyState !== 1) return null;
    const existing = await getStayRideTenantModel(false).findOne({ tenantId: key }).lean();
    if (!existing || !(existing as any).data) return null;
    const store = new StayRideMemoryStore(false);
    store.fromJSON((existing as any).data);
    this.stores.set(key, store);
    return store;
  }

  // Never replaces existing tenant data; DB errors propagate instead of wiping.
  async createTenantIfMissing(tenantId: string, homestayInfo?: Partial<StayRideHomestay>): Promise<StayRideMemoryStore> {
    const key = tenantId.toLowerCase().trim();
    const existing = this.stores.get(key) || (await this.loadPersisted(key));
    return existing || this.createFreshTenant(key, homestayInfo);
  }

  createFreshTenant(tenantId: string, homestayInfo?: Partial<StayRideHomestay>): StayRideMemoryStore {
    const key = tenantId.toLowerCase().trim();
    const store = new StayRideMemoryStore(false, homestayInfo);
    this.stores.set(key, store);
    this.persistTenant(key).catch(() => {});
    return store;
  }

  async persistTenant(tenantId: string) {
    const key = (tenantId || 'demo').toLowerCase().trim();
    if (mongoose.connection.readyState !== 1) return;

    const isDemo = isDemoKey(key);
    const store = isDemo ? (this.stores.get('demo') || this.stores.get(key)) : this.stores.get(key);
    if (!store) return;

    const accountType = isDemo ? 'DEMO' : 'PRODUCTION';
    const effectiveTenantId = isDemo ? 'demo@stayride.in' : key;
    const model = getStayRideTenantModel(isDemo);

    try {
      await model.findOneAndUpdate(
        { tenantId: effectiveTenantId },
        {
          tenantId: effectiveTenantId,
          accountType,
          isDemo,
          ownerName: store.homestay.ownerName || (isDemo ? 'Tshering Bhutia (Demo Host)' : 'Host'),
          homestayName: store.homestay.name || (isDemo ? 'Mountain View Homestay' : 'My Homestay'),
          email: store.homestay.email || (effectiveTenantId.includes('@') ? effectiveTenantId : ''),
          phone: store.homestay.phone || '',
          location: store.homestay.location || '',
          data: store.toJSON(),
          lastActiveAt: new Date(),
          lastActiveAtIST: getISTTimestamp(),
          updatedAtIST: getISTTimestamp(),
        },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (err) {
      console.warn(`[StayRide] Error persisting tenant ${key} to MongoDB:`, err);
    }
  }

  resetDemoStore(): StayRideMemoryStore {
    const freshDemo = new StayRideMemoryStore(true);
    this.stores.set('demo', freshDemo);
    this.stores.set('demo@stayride.in', freshDemo);
    this.stores.set('stay@mountainviewgangtok.com', freshDemo);
    this.stores.set('stay@mountainview.in', freshDemo);
    this.persistTenant('demo@stayride.in').catch(() => {});
    return freshDemo;
  }
}

export const tenantManager = new StayRideTenantManager();
export const stayRideStore = tenantManager.getStore('demo');

