# 05 - Master Operational Checklist & Implementation Plan

This checklist outlines the phased roadmap required to bring the 4-sided platform to full production readiness.

---

## Phase 1: Authentication & True Multi-Tenancy (Foundation)
- [x] **1.1 Server Multi-Tenancy & Schema Refactor**
  - [x] Remove global unique constraints on `code` and `slug` in `src/models/room.model.ts`; establish compound index on `{ propertyId: 1, code: 1 }`.
  - [x] Add `propertyId` and `ownerId` foreign keys to `Guest` and `CabTrip` models.
  - [x] Refactor `PropertyService`, `RoomService`, `GuestService`, and `AnalyticsService` to scope all queries by `ownerId` or `propertyId`.
- [x] **1.2 Server Authentication Hardening**
  - [x] Patch `RegisterSchema` in `src/schemas/auth.schema.ts` to prevent client self-assignment of `role: "admin"`.
  - [x] Implement JWT session verification (`/auth/me`).
  - [x] Add phone-based OTP verification service (`/auth/otp/send` and `/auth/otp/verify`).
  - [x] Protect mutation endpoints across rooms, bookings, properties, and drivers with `verifyToken` and `optionalAuth` middleware.
- [x] **1.3 Owner Dashboard Authentication UI**
  - [x] Create `/login` and `/register` views with clean forms for email, password, Google OAuth, and phone number.
  - [x] Build OTP verification dialog for mobile verification.
  - [x] Add `AuthContext` to persist JWT tokens and user session in the browser.
  - [x] Update `components/estate-provider.tsx` to include `Authorization: Bearer <token>` on all server requests.
  - [x] Implement route protection redirecting unauthenticated users to `/login`.

---

## Phase 2: Dedicated Homestay Routing & Client Cab Integration
- [x] **2.1 Client Dynamic Multi-Homestay Routing**
  - [x] Implement dynamic property route: `app/(site)/h/[slug]/page.tsx` displaying individual homestay details, rooms, facts, story, and local transfer booking.
  - [x] Support query parameter deep linking (`?ref=BK-XXXX&checkIn=...&guest=...`) to pre-fill guest details and dates.
- [x] **2.2 Live Cab Integration on Client**
  - [x] Wire pre-configured return cab transfers to NJP Railway Station and Bagdogra Airport.
  - [x] Wire the cab booking confirmation step in `client-side/app/cab/confirmed/page.tsx` to `POST /api/v1/cabs/bookings`.
  - [x] Verify cab bookings persist to MongoDB `CabTrip` collection with real passenger details.

---

## Phase 3: Payment Gateway & WhatsApp Automation
- [ ] **3.1 Razorpay Payment Processing** (Planned for Live Stage)
  - [ ] Integrate Razorpay Checkout SDK for processing cab bookings and room reservation deposits.
  - [ ] Implement backend webhook listener to verify payment signatures before confirming trips.
- [x] **3.2 WhatsApp Communication Engine**
  - [x] WhatsApp deep-link generation (`wa.me`) with pre-filled confirmation text and direct link to the guest's dedicated homestay guide.
  - [x] One-tap WhatsApp button for drivers to message passengers directly.
  - [ ] Future: Server-side WhatsApp Cloud API / Twilio service worker for background headless dispatches.

---

## Phase 4: Super Admin Operations Control Tower
- [x] **4.1 Admin Authentication & Route Protection**
  - [x] Add `requireRole("admin")` middleware guard to `/api/v1/admin/*` endpoints.
  - [x] Seed a default platform administrator account (`admin@platform.com`).
- [x] **4.2 Admin Management Dashboard**
  - [x] Build `/admin-side` portal showing platform KPIs: Gross Booking Revenue, total platform commissions (18%), active properties, and total trip volume.
  - [x] Driver Settlement Ledger: Interface displaying completed trips and pending driver payouts, with a UPI Reference modal for marking transfers settled.
  - [x] Property Moderation: View and approve registered homestays.

---

## Phase 5: Two-Way iCal Calendar Synchronization
- [x] **5.1 Outbound iCal Calendar Feeds**
  - [x] Implement `GET /api/v1/rooms/:codeOrSlug/calendar.ics` returning an RFC 5545 formatted `.ics` calendar feed of confirmed bookings and holds.
- [x] **5.2 Inbound iCal Calendar Poller**
  - [x] Add `icalFeeds` configuration fields to `property.model.ts`.
  - [x] Implement `POST /api/v1/rooms/:codeOrSlug/sync-ical` endpoint parsing external Airbnb feeds.
  - [x] Create recurring `CronService` background worker polling external Airbnb iCal feeds every 15 minutes.
- [x] **5.3 Quick OTA Entry & Share Modal**
  - [x] Build an expedited booking entry dialog in the owner dashboard (`/book`) for logging MakeMyTrip, Goibibo, and Airbnb reservations.
  - [x] Auto-generate the personalized homestay guest link with 1-click WhatsApp invite.

---

## Phase 6: Cab Driver Interface (PWA)
- [x] **6.1 Driver Mobile Web Application**
  - [x] Build a lightweight mobile web portal (`/driver-side` on port 3002) for onboarded drivers.
  - [x] Display daily assigned pickups, passenger contact numbers (`tel:` and `wa.me`), and pickup locations.
  - [x] Add one-tap status toggles ("En Route", "Arrived", "Completed") syncing with the backend.
  - [x] Provide a personal earnings ledger showing 82% take-home vs 18% platform commission.
