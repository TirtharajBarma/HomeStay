# 02 - Canonical Data Schema & Entities

This document defines the unified canonical data schemas in the backend, harmonizing the entities across `client-side` and `owner-side`.

---

## 1. Property & Location Schema

```typescript
export interface PropertyProfile {
  id: string;              // "prop_gumtree_valley"
  name: string;            // "Gumtree Valley & Meadowfall Estate"
  hosts: string;           // "Ananya & Arjun Rai / Anuradha & Tenzin Dorjee"
  role: string;            // "Estate Owners & Hosts"
  email: string;           // "hosts@gumtreevalley.in"
  phone: string;           // "+91 98300 41000"
  address: string;         // "12 Ging Tea Estate Road"
  town: string;            // "Darjeeling"
  region: string;          // "West Bengal"
  postal: string;          // "734101"
  bio: string;             // Host story and description
  checkInTime: string;     // "3:00 PM"
  checkOutTime: string;    // "11:00 AM"
  responseTime: string;    // "Usually within 20 minutes"
  currency: string;        // "INR"
  createdAt: string;
  updatedAt: string;
}

export interface EstateLocation {
  id: string;              // "LOC-1"
  propertyId: string;
  name: string;            // "Ging Lodge", "Chiyabari Lofts", "Garden Cottages"
  address: string;
  kind: "Main lodge" | "Loft block" | "Cottages" | "Barn" | "Off-site";
  units: number;
  note: string;
  lat: number | null;      // 27.03677
  lng: number | null;      // 88.26302
}
```

---

## 2. Room & Accommodation Unified Schema

The room entity merges the client-side `Stay` (slug, editorial content, gallery, facts) and the owner-side `RoomUnit` (code, location, status, hold window):

```typescript
export interface Room {
  id: string;              // "rm_101"
  code: string;            // "101", "102", "201", "202", "301", "302"
  slug: string;            // "ging-tea-cottage", "chowrasta-studio", etc.
  name: string;            // "Ging Tea Cottage / Tiger Hill View Suite"
  location: string;        // "Ground Floor • Ging Lodge"
  category: "Ging Lodge" | "Chiyabari Lofts" | "Garden Cottages";
  kind: "cottage" | "loft" | "cabin";
  status: "Active" | "Maintenance";
  petFriendly: boolean;
  maxGuests: number;
  nightly: number;         // Base nightly rate in INR
  weekend?: number;        // Optional weekend rate
  bedLabel: string;        // "King Bed • Kanchenjunga View"
  bedIcon: string;         // "king_bed"
  occupancyLabel: string;  // "1 Queen Bed • 2 Guests"
  blurb: string;           // Short summary
  amenities: string[];     // ["Bukhari Stove", "Copper Bathtub", "Tea Garden View"]
  highlight: {
    icon: string;          // "coffee"
    label: string;         // "Breakfast included"
  };
  rating: number;          // 4.94
  reviewCount: number;     // 63
  eyebrow: string;         // "Lower Garden Cottage"
  intro: string;           // Descriptive intro
  image: string;           // Primary photo URL
  imageAlt: string;
  gallery: Array<{
    src: string;
    alt: string;
    caption: string;
  }>;
  facts: Array<{
    icon: string;
    label: string;
    value: string;
  }>;
  story: string[];         // Narrative paragraphs
  hold?: {                 // Maintenance blackout window
    label: string;
    range: string;
    startDate?: string;
    endDate?: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Booking & Reservation Schema

```typescript
export type BookingChannel = "direct" | "airbnb" | "ota" | "walk-in" | "phone" | "whatsapp";
export type BookingStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled";
export type PaymentPlan = "card_full" | "deposit";

export interface Booking {
  id: string;              // UUID
  reference: string;       // "MF-829103" or "GV-10294"
  pin: string;             // "4921" (Keyless door PIN)
  roomId: string;          // "rm_101"
  roomCode: string;        // "101"
  roomName: string;        // "Ging Tea Cottage"
  staySlug: string;        // "ging-tea-cottage"
  guestId: string;         // "gst_..."
  guestName: string;       // "John Doe"
  email: string;
  phone: string;
  checkIn: string;         // "YYYY-MM-DD"
  checkOut: string;        // "YYYY-MM-DD"
  nights: number;
  party: number;           // Guest count
  arrivalWindow: string;   // "2:00 PM – 4:00 PM"
  breakfasts: string[];    // ["Full Hill Breakfast"]
  channel: BookingChannel;
  status: BookingStatus;
  plan: PaymentPlan;
  settled: boolean;
  nightlyRate: number;
  roomTotal: number;
  cleaningFee: number;     // ₹900
  taxAmount: number;       // 12% GST
  totalAmount: number;     // roomTotal + cleaningFee + taxAmount
  dueToday: number;
  balanceDue: number;
  cancellationBy: string;  // 7 days prior ISO string
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. Guest CRM Schema

```typescript
export type GuestStatus =
  | "Arriving today"
  | "In house"
  | "Departing today"
  | "Upcoming"
  | "Past stay";

export interface Guest {
  id: string;              // "gst_..."
  name: string;
  email: string;
  phone: string;
  origin: string;          // "Boston, US" / "Kolkata, IN"
  roomCode: string;
  roomName: string;
  location: string;
  category: "Ging Lodge" | "Chiyabari Lofts" | "Garden Cottages";
  checkIn: string;
  checkOut: string;
  nights: number;
  party: number;
  channel: string;
  channelTone: string;
  spend: number;           // Current stay spend
  status: GuestStatus;
  tags: string[];          // ["Anniversary", "Vegan", "Repeat stay"]
  note?: string;
  vip: boolean;
  stays: number;           // Lifetime stay count
  lifetime: number;        // Lifetime total spend
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. Cab Fleet, Drivers & Transfers Schema

```typescript
export type DriverStatus = "Active" | "On a trip" | "Invited" | "Paused";

export interface Driver {
  id: string;              // "DRV-101"
  name: string;
  phone: string;
  email: string;
  vehicle: string;         // "Toyota Innova Crysta"
  plate: string;           // "WB 06 AB 4432"
  colour?: string;         // "Pearl White"
  seats: number;           // 4 | 6 | 8
  luggage: number;         // 3 | 4 | 6 bags
  rating: number;          // 4.9
  trips: number;           // Completed trip count
  commission: number;      // Paid-out driver earnings (INR)
  perKm: number;           // Base rate / km (₹48 - ₹80)
  minimum: number;         // Minimum fare (₹180 - ₹600)
  etaPad: number;          // Buffer minutes (10 - 25)
  status: DriverStatus;
  coverage: string;        // "Baggage • Family • Outstation"
  note: string;
  languages: string;
  joined: string;
  createdAt: string;
  updatedAt: string;
}

export interface CabTransferBooking {
  id: string;              // "cab_..."
  reference: string;       // "CAB-8241"
  driverId: string;
  driverName: string;
  vehicle: string;
  plate: string;
  guestName: string;
  email: string;
  phone: string;
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  dropoffName: string;
  dropoffLat: number;
  dropoffLng: number;
  pickupDate: string;      // "YYYY-MM-DD"
  pickupTime: string;      // "HH:mm"
  seats: number;
  distanceKm: number;
  fareAmount: number;      // Total fare (e.g. ₹2,500)
  estateCommission: number;// 18% estate share (₹450, or per diagram notes)
  driverPayout: number;    // fareAmount - estateCommission (₹2,050)
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
}
```

---

## 6. Financial & Operations Analytics Schema

```typescript
export interface AnalyticsKPIs {
  range: "today" | "week" | "fortnight" | "month" | "quarter" | "year";
  totals: {
    revenue: number;           // Gross revenue (Rooms + Cabs)
    roomRevenue: number;
    cabRevenue: number;
    cabCommission: number;     // 18% estate revenue
    driverPayout: number;      // 82% paid to drivers
    guests: number;
    roomNights: number;
    occupancy: number;         // 0 - 100%
    adr: number;               // Average daily rate
    cabTrips: number;
    avgStay: number;
    revenuePerGuest: number;
  };
  previousDelta: {
    revenuePct: number;
    occupancyPct: number;
    guestsPct: number;
  };
  timeline: Array<{
    date: string;
    label: string;
    dow: string;
    roomsSold: number;
    occupancy: number;
    guests: number;
    roomRevenue: number;
    cabTrips: number;
    cabRevenue: number;
    cabCommission: number;
    driverPayout: number;
    weekend: boolean;
    today: boolean;
  }>;
  serviceBreakdown: Array<{
    service: string;
    grossRevenue: number;
    directCost: number;
    netMargin: number;
    marginPct: number;
    sharePct: number;
  }>;
  roomPerformance: Array<{
    code: string;
    name: string;
    category: string;
    nightsSold: number;
    occupancy: number;
    guests: number;
    revenue: number;
  }>;
}
```
