# 00 - Business Requirements & System Scope

## 1. System Overview & Vision

Based on the architectural diagram (`image/image copy.png`) and the existing codebase, **Tirtha** is a dual-sided boutique estate hospitality and local transfer platform centered around tea estates in Darjeeling.

The system connects:
1. **Guests (Client-Side)**: Discover homestays, browse rooms/cottages, book stays with instant confirmation, and reserve point-to-point hill cab transfers without needing mandatory account login.
2. **Homestay Owners (Owner-Side)**: Manage estate rooms/units, view live availability calendars, create direct/walk-in/OTA bookings, manage guest CRM & history, manage dedicated cab driver rosters, track service revenues and financial analytics, and manage host profiles.
3. **Cab Drivers** *(Future Phase)*: Driver portal for profiles, rates, notifications, past trips, and calendar bookings.
4. **Admin** *(Future Phase)*: Global super-admin overview of all estates, drivers, and platform commission.

---

## 2. Immediate Scope (Phase 1 Target)

As explicitly requested:
> **"currently only do for owner side and client side connect"**
> - `/client-side`
> - `/owner-side`
> - `/server` (Node.js + TypeScript with `tsx`)

The backend will serve as the single source of truth connecting:
- What the **Guest books** on the `client-side` directly appears on the **Owner-side** calendar, guest directory, and analytics.
- What the **Owner updates** (rates, room details, availability, maintenance holds, driver rosters) is instantly reflected on the `client-side`.

---

## 3. Core Functional Requirements

### A. Estate & Room Management
- **Owner**:
  - View, create, update, and manage room units (`code`, `name`, `category`, `nightly`, `weekend`, `maxGuests`, `bedLabel`, `features`, `image`, `status`).
  - Set maintenance holds (`hold: { label, range }`) blocking room availability.
  - Update estate profile (host details, check-in/out hours, response times, location coordinates).
- **Guest / Client**:
  - Browse stays with filters (`all`, `cottage`, `loft`, `cabin`, `petFriendly`).
  - View individual stay detail, photos, facts, slow-living story, and amenities.
  - Calculate real-time price quotes (nights × rate + ₹900 cleaning fee + 12% GST).

### B. Room Reservation & Booking Synchronization
- **Guest / Client**:
  - Check room availability for specified check-in and check-out dates.
  - Reserve room with guest contact details (first name, last name, email, phone, arrival window, breakfast preferences, payment plan: 100% full card vs. 50% deposit).
  - Receive instant reservation confirmation with reference code (`MF-XXXXXX`) and 4-digit keyless door PIN.
- **Owner-Side**:
  - Bookings made by guests immediately sync to the owner's booking desk and interactive calendar.
  - Owner can also create direct walk-in / phone / OTA reservations on behalf of guests (`channel`: direct, Airbnb, Booking.com, walk-in).
  - Check calendar occupancy across 7-day, 14-day, and 28-day windows.

### C. Guest Directory & CRM
- **Owner-Side**:
  - Comprehensive guest directory (`id`, `name`, `code`, `room`, `checkIn`, `checkOut`, `nights`, `party`, `channel`, `email`, `phone`, `origin`, `spend`, `status`, `tags`, `note`, `vip`).
  - Status tracking: `Arriving today`, `In house`, `Departing today`, `Upcoming`, `Past stay`.
  - Ability to add guest tags, notes, and VIP statuses.
  - Timeline arrivals/departures summary by date.

### D. Cab Driver Fleet & Transfer Bookings
- **Owner-Side**:
  - Manage driver roster (`DRV-XXX`, `name`, `phone`, `email`, `vehicle`, `plate`, `rating`, `trips`, `commission`, `status`, `coverage`).
  - Register new drivers, change status (`Active`, `On a trip`, `Invited`, `Paused`), track completed trips and paid commission.
- **Guest / Client**:
  - Interactive map route selection (pickup, dropoff, date, time, passenger seats).
  - Match available active drivers based on vehicle seating capacity (4, 6, 8 seats).
  - Calculate hill road distance and fare (base ₹/km + hill surcharge + min fare).
  - Book cab transfer with instant booking voucher (`CAB-XXXX`) and email notification trigger.
  - When a guest books a driver, the driver's status can update and trip logs reflect in owner metrics.

### E. Financial Analytics & Reporting
- **Owner-Side**:
  - Real-time KPIs: Gross revenue, total guest head count, room revenue, cab revenue, estate cab commission (18%), driver payouts, occupancy rate, Average Daily Rate (ADR), revenue per guest.
  - Timeline filter: Today, 7 days, 14 days, this month, 90 days, year-to-date.
  - Breakdown by service (Rooms vs. Cabs vs. Breakfast/Add-ons) and performance per room unit.
  - Data export in CSV format.

---

## 4. Non-Functional Requirements
1. **Runtime & Execution**: Node.js 22+ with `tsx` (`npx tsx watch src/server.ts`). Zero compile wait time during development.
2. **Type Safety**: End-to-end TypeScript interfaces matching both client and owner expectations.
3. **Data Integrity & Seeding**:
   - Out-of-the-box seeded dataset reflecting Gumtree Valley / Meadowfall Estate so both frontends work out-of-the-box immediately upon boot.
   - Persistent disk-backed storage so new bookings and changes survive server restarts.
4. **CORS & Network**:
   - Proper CORS configured for `http://localhost:3000` (client-side) and `http://localhost:3001` (owner-side).
   - Standard JSON request and response payloads with informative HTTP status codes and error bodies.
