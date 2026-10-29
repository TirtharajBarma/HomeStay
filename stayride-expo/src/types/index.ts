export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';

export interface Room {
  id: number;
  number: string;
  type: string; // Standard, Deluxe, Suite, Family, Dorm
  floor: string;
  price: number;
  status: RoomStatus; // derived from bookings (MAINTENANCE is the only manual value)
  note: string;
  nextArrival?: number | null; // server: check-in of the next upcoming booking
}

export interface Guest {
  id: number;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  visits: number;
  totalSpending: number;
  firstVisit: number; // epoch ms
  lastVisit: number; // epoch ms
  marketingConsent: boolean;
  bookingIds?: number[];
}

export type BookingStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';

export interface Booking {
  id: number;
  guestId: number;
  guestName: string;
  phone: string;
  checkIn: number; // epoch ms
  checkOut: number; // epoch ms
  roomNumber: string;
  guests: number;
  status: BookingStatus;
  paid: boolean;
  amount: number;
  source: 'Direct link' | 'Walk-in' | 'Phone' | 'WhatsApp' | 'Repeat booking' | string;
  actualCheckOut?: number; // server: when the guest actually left
  payments?: BookingPayment[]; // money received (advance, balance…); paid = received >= amount
  external?: { source: string; uid: string; feedId: string; conflict?: boolean }; // imported from an OTA calendar
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'BANK' | 'OTA' | 'OTHER';

export interface BookingPayment {
  id: number;
  amount: number;
  method: PaymentMethod;
  note: string;
  at: number;
}

/** Calendar sync settings of one room (server: /rooms/:id/ical) */
export interface RoomCalendar {
  exportUrl: string;
  imports: { id: string; url: string; source: string; lastSyncAt: string | null; lastError: string; eventCount: number }[];
  results?: { source: string; ok: boolean; added?: number; updated?: number; cancelled?: number; conflicts?: number; error?: string }[];
}

export type VehicleType = 'SUV' | 'Sedan' | '7-seater' | '9-seater';

export interface Driver {
  id: number;
  name: string;
  phone: string;
  vehicle: string;
  vehicleType: VehicleType;
  seats: number;
  rating?: number;
  area: string;
  trips: string[]; // e.g. ["NJP", "Bagdogra", "Local", "Sightseeing"]
  available: boolean;
  active: boolean;
  ownerDriver: boolean;
  plate?: string;
}

export type CabTripStatus =
  | 'NEW_REQUEST'
  | 'FINDING_DRIVER'
  | 'QUOTE_RECEIVED'
  | 'AWAITING_ADVANCE'
  | 'DRIVER_ASSIGNED'
  | 'CONFIRMED'
  | 'TRIP_STARTED'
  | 'COMPLETED'
  | 'CANCELLED'
  // Server marks open requests whose pickup is >6h in the past
  | 'EXPIRED';

export interface CabTrip {
  id: number;
  guestName: string;
  phone: string;
  pickup: string;
  destination: string;
  destinations?: Array<{ address: string; lat?: number; lng?: number; order: number }>;
  isRoundTrip?: boolean;
  returnDate?: number;
  returnTime?: string;
  date: number; // epoch ms
  time: string; // "10:30 AM"
  passengers: number;
  vehicleType: VehicleType;
  estFare: number;
  status: CabTripStatus;
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
  reference?: string;
  payoutId?: string;
  // true = StayRide platform trip (money and progress handled by StayRide)
  platform?: boolean;
  // false = guest inquiry held for the owner: not yet sent to drivers
  dispatched?: boolean;
  // epoch ms: the guest must pay the advance by then or the driver is released
  advanceDueAt?: number;
  refundStatus?: 'NONE' | 'PENDING' | 'REFUNDED';
  quotes?: Array<{
    driverId: number | string;
    driverName: string;
    driverVehicle?: string;
    quotedFare: number;
    counterFare?: number | null; // the owner's counter-offer, waiting for the driver
    // Server estimates if this quote is accepted: the owner's commission and the guest's advance
    homestayCommission?: number;
    advanceAmount?: number;
    notes?: string;
    status: string;
    // Average stars (1 decimal); null when the driver has no ratings yet
    driverRating?: number | null;
    driverRatingCount?: number;
  }>;
  financialSnapshot?: any;
  source?: 'MANUAL_OWNER' | 'NEARBY_BROADCAST' | 'GUEST_WEB_LINK' | 'ADMIN_DISPATCH';
  assignedDriverId?: number | string;
  assignedDriverName?: string;
  assignedDriverCategory?: 'INDIVIDUAL' | 'UNION';
  assignedDriverUnionName?: string;
  // Owner already rated the driver of this completed platform trip
  driverRated?: boolean;
  // Assigned driver was removed after the advance was paid; StayRide is finding a new one
  needsReassignment?: boolean;
  cancellationReason?: string | null;
}

export interface CommissionRates {
  pfPercent: number;
  hcPercent: number;
  advancePercent: number;
  minAdvanceAmount?: number;
}

export type FeatureKey = 'campaigns' | 'guestCabLinks' | 'platformDispatch' | 'payouts' | 'driverQuotes';
export type AccountFeatures = Record<FeatureKey, boolean>;

// Trip as the server shows it to a platform driver (GET /snapshot for role 'driver').
// Guest and money fields are present only when assignedToMe.
export interface DriverTrip {
  reference: string;
  homestayName?: string;
  pickup: string;
  pickupLat?: number | null; // map pin of the pickup (homestay or owner-set point)
  pickupLng?: number | null;
  destinations?: Array<{ address: string; order: number }>;
  destination: string;
  isRoundTrip?: boolean;
  returnDate?: number;
  returnTime?: string;
  date: number;
  time: string;
  passengers: number;
  vehicleType: string;
  status: CabTripStatus;
  // counterFare: the homestay's counter-offer on my quote, waiting for me to accept
  myQuote: { quotedFare: number; status: string; notes?: string; counterFare?: number | null } | null;
  assignedToMe: boolean;
  pickupOtp?: string | null;
  pickupOtpRequired?: boolean;
  _pendingStartOtp?: string;
  _pendingComplete?: boolean;
  // Server's view of this trip for me; lost trips stay listed for 7 days as CANCELLED/REASSIGNED
  driverView?: 'OPEN' | 'QUOTED' | 'ASSIGNED' | 'CANCELLED' | 'REASSIGNED' | 'EXPIRED';
  cancellationReason?: string | null;
  // Money split, all null until a fare is agreed
  platformFeeAmount?: number | null;
  homestayCommissionAmount?: number | null;
  driverNetPayout?: number | null;
  driverSettlementStatus?: 'NONE' | 'PENDING' | 'SETTLED';
  driverSettlementReference?: string | null;
  driverSettledAt?: string | null;
  guestName?: string;
  phone?: string;
  fare?: number;
  advanceAmount?: number;
  advancePaid?: boolean;
  remainingCashAmount?: number;
}

export type CampaignAudience = 'All guests' | 'Repeat guests' | 'Recent guests' | 'Inactive guests';
export type CampaignStatus = 'CREATED' | 'SENDING' | 'COMPLETED';

export interface Campaign {
  id: number;
  title: string;
  message: string;
  audience: CampaignAudience;
  status: CampaignStatus;
  recipients: number;
  sent: number;
  failed: number;
  createdOn: number;
}

export interface Homestay {
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
  checkInTime?: string; // e.g. "12:00 PM"
  checkOutTime?: string; // e.g. "11:00 AM"
  latitude?: number; // map pin (server-set via setHomestayLocation)
  longitude?: number;
}

export type UserRole = 'owner' | 'driver' | 'admin';

export interface DriverSessionProfile {
  id: number | string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  vehicleType: VehicleType;
  plate: string;
  area?: string;
  seats?: number;
  available?: boolean;
  active?: boolean;
  whatsappAlerts?: boolean;
  status?: 'ACTIVE' | 'PENDING_APPROVAL' | 'BLOCKED';
  statusReason?: string;
}

export interface UserSession {
  accessToken: string;
  refreshToken: string;
  role?: UserRole;
  owner?: {
    id: number;
    name: string;
    phone: string;
    email: string;
    avatar?: string;
  };
  driver?: DriverSessionProfile;
  homestay?: {
    id: number;
    name: string;
    link: string;
  };
}
