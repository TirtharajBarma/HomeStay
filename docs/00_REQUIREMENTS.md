# 00 - Business Requirements & System Scope
**Platform:** Hill Hospitality & Transit Network  
**Target Region:** North Bengal & Sikkim (Darjeeling, Kalimpong, Kurseong, Mirik, Siliguri, NJP, Bagdogra)  
**Status:** Updated Master Specification  

---

## 1. System Vision & Business Model

The platform is a 4-sided boutique hospitality and hill transit network connecting:
1. **Guests (Travelers)**: Discover homestays directly OR land on a dedicated single-homestay page (`/h/:slug`) after an OTA reservation (Airbnb, MakeMyTrip, Goibibo) to access stay guides and reserve point-to-point hill transfers (e.g., NJP / Bagdogra ↔ Darjeeling, local sightseeing).
2. **Homestay Owners**: Receive a **100% free, lightweight Property Management System (PMS)** to manage rooms, live calendar, direct walk-in bookings, OTA reservations, and their trusted local driver rosters.
3. **Cab Drivers**: Local verified drivers with hill vehicles (Innova, Sumo, Bolero, Dzire) operating with pre-agreed fares, automated WhatsApp dispatch, and transparent payouts.
4. **Super Admin (Platform Operator)**: Central operations dashboard to view all homestays, rooms, drivers, trip volumes, platform commissions (18–20% on cabs), and driver payout settlements.

### The Business Strategy:
- **Free PMS as the Acquisition Hook**: Small hill homestay owners do not pay monthly SaaS fees for complex systems. A free, clean mobile tool drives initial adoption.
- **Cab Transfers as the Primary Monetization Engine**: 
  - Room commissions on small homestays are modest and face direct competition from major OTAs.
  - In contrast, exclusive hill cab transfers (₹3,500 to ₹5,000 per trip) yield **₹630 to ₹900 net profit per booking** at an 18% commission rate.
  - Particular focus is placed on the **outbound return trip (Darjeeling → NJP/Bagdogra)**, where travelers prioritize reliable, pre-arranged transport to avoid missing scheduled flights and trains.

---

## 2. Core Functional Requirements Across the 4 Sides

### A. Homestay Owner Portal (`/owner-side`)
- **Authentication**:
  - Multi-tenant host registration and login via Email + Password, Google OAuth, and OTP verification.
  - Strict tenant isolation: Owners can access only their own homestay profile, rooms, calendar, and drivers.
- **Room & Rate Management**:
  - Manage room inventory with scoped room codes (e.g. "Room 101" unique per property).
  - Configure nightly pricing, weekend adjustments, and maintenance blackout holds.
- **Live Booking Desk & Calendar**:
  - Interactive multi-day availability grid (7, 14, 28 days) supporting real-time reservation creation.
  - Categorized booking channels: Direct, Phone, Walk-in, Airbnb, MakeMyTrip, Goibibo.
- **Driver Fleet & Roster**:
  - Onboard and manage trusted local drivers (name, phone, vehicle class, license plate, coverage area).
  - Track assigned trips, driver status ("Active", "On a trip", "Paused"), and earnings.
- **Guest CRM & Stays Directory**:
  - Directory of past and incoming guests with status indicators ("Arriving today", "In house", "Departing today").
  - Tags (VIP, dietary preferences, family) and stay notes.

### B. Client / Guest Application (`/client-side`)
- **Direct Catalog & Search**:
  - Browse available homestays and filter by region, category, and amenities.
- **Dedicated Homestay Landing Pages (`/h/:slug`)**:
  - Clean, dedicated presentation of a single homestay's details, photos, house rules, and room options.
  - Deep-link target for OTA-referred guests to view their reservation and access add-on services.
- **Hill Cab Booking**:
  - Route selection across key regional transit points (NJP, Bagdogra Airport, Darjeeling, Kalimpong, Mirik, Tiger Hill).
  - Transparent fare calculation based on distance, hill road factor, and vehicle seating capacity (4, 6, 8 seats).
  - Instant trip voucher generation with driver assignment and pickup instructions.

### C. Cab Driver Interface & Dispatch
- **Driver Profile & Vehicle Specs**:
  - Vehicle classification (4-seater sedan, 6-seater SUV, 8-seater van), registration plate, and verification details.
- **Dispatch Flow**:
  - Asynchronous dispatch alerts delivered via automated WhatsApp Cloud API / SMS containing passenger name, contact number, pickup location, and scheduled time.
  - PWA / Mobile web view allowing drivers to view upcoming trips and log trip completions.

### D. Super Admin Control Tower
- **Platform Analytics**:
  - Aggregated view of Gross Booking Value (GBV), platform commission totals, and active properties.
- **Driver Payout Settlement Desk**:
  - Ledger tracking gross fares, platform commission cuts (18%), and outstanding driver payouts (82%).
  - Interface to mark payouts as settled following UPI or direct bank transfers.
- **Onboarding & Verification**:
  - Verification workflow to approve new homestay listings and review driver credentials.

---

## 3. Third-Party OTA Synchronization Requirements

### 1. Two-Way iCal (.ics) Calendar Sync (Airbnb & Booking.com)
- **Export**: Provide a persistent `.ics` calendar URL per room (`GET /api/v1/properties/:id/rooms/:code/calendar.ics`) for hosts to paste into their Airbnb availability settings.
- **Import**: Background worker to fetch external Airbnb iCal URLs every 15 minutes, automatically blocking corresponding calendar dates.

### 2. MakeMyTrip & Goibibo Integration
- **Direct Integration Partner**: Connect via certified channel manager APIs (e.g. Channex.io) for automated two-way inventory and booking synchronization with IngoMMT.
- **Dashboard Quick-Entry**: Provide an expedited manual entry dialog on the host dashboard to record MMT/Goibibo bookings in under 15 seconds.

### 3. Automated Guest Onboarding Sequence
- Ingested or logged reservations trigger an automated WhatsApp confirmation message welcoming the guest and providing a direct link to their dedicated homestay guide and cab booking page.

---

## 4. Technical Stack & Architecture

- **Backend (`/server`)**: Node.js 22+, TypeScript, Express, MongoDB (Mongoose), JWT, Zod validation, Nodemailer.
- **Owner Frontend (`/owner-side`)**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide/Material Symbols, Leaflet / OpenStreetMap.
- **Client Frontend (`/client-side`)**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Leaflet / OpenStreetMap, dynamic routing.
- **Integrations**: Razorpay (Payments), WhatsApp Cloud API / Twilio (Messaging), iCal / `node-ical` (Calendar sync).
