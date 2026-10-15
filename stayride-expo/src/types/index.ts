export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';

export interface Room {
  id: number;
  number: string;
  type: string; // Standard, Deluxe, Suite, Family, Dorm
  floor: string;
  price: number;
  status: RoomStatus;
  note: string;
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
  source: 'StayRide link' | 'Walk-in' | 'Phone' | 'WhatsApp' | 'Repeat booking' | string;
}

export type VehicleType = 'SUV' | 'Sedan' | '7-seater' | '9-seater';

export interface Driver {
  id: number;
  name: string;
  phone: string;
  vehicle: string;
  vehicleType: VehicleType;
  seats: number;
  rating: number;
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
  | 'CANCELLED';

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
  quotes?: Array<{
    driverId: number | string;
    driverName: string;
    quotedFare: number;
    status: string;
  }>;
  financialSnapshot?: any;
  source?: 'MANUAL_OWNER' | 'NEARBY_BROADCAST' | 'GUEST_WEB_LINK' | 'ADMIN_DISPATCH';
  assignedDriverId?: number | string;
  assignedDriverName?: string;
}

export interface CommissionRates {
  pfPercent: number;
  hcPercent: number;
  advancePercent: number;
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
}

export type UserRole = 'owner' | 'driver';

export interface DriverSessionProfile {
  id: number | string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  vehicleType: VehicleType;
  plate: string;
  rating?: number;
  area?: string;
  available?: boolean;
  active?: boolean;
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
