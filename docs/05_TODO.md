# 05 - Master Implementation Plan & Granular TODO List

This document is the live operational checklist tracking progress across each phase. Every task has strict criteria to ensure the backend is robust, clean, and never goes off track.

---

## Phase 1: Environment & Server Scaffold (`/server`)
- [x] **1.1 Package Dependencies Configuration**
  - [x] Add `express`, `cors`, `zod`, `dotenv`, `mongoose`, `helmet`, `compression`, `express-rate-limit`, `morgan` to `dependencies`.
  - [x] Add `typescript`, `tsx`, `@types/node`, `@types/express`, `@types/cors`, `@types/compression`, `@types/morgan`, `mongodb-memory-server` to `devDependencies`.
  - [x] Configure `package.json` scripts: `"dev": "tsx watch src/server.ts"`, `"seed": "tsx src/data/seeds/seed.ts"`, `"build": "tsc"`, `"start": "node dist/server.js"`.
  - [x] Run `npm install` and verify zero errors.
- [x] **1.2 TypeScript Configuration (`tsconfig.json`)**
  - [x] Target `ES2022`, module `NodeNext`, moduleResolution `NodeNext`.
  - [x] Strict mode enabled, rootDir `src`, outDir `dist`.
- [x] **1.3 Environment & Server Core**
  - [x] Setup `src/config/env.ts` with PORT (5050 to avoid macOS AirPlay conflict on 5000) and allowed CORS origins (`http://localhost:3000`, `http://localhost:3001`).
  - [x] Setup `src/middlewares/error-handler.ts`, `src/middlewares/not-found.ts`, and `src/middlewares/validate.ts`.
  - [x] Setup `src/app.ts` (Express instance with Helmet, Morgan, Compression, Rate-limiting, CORS, Health endpoints).
  - [x] Setup `src/server.ts` listening on `PORT` with graceful shutdown.
  - [x] Test health endpoint: verified boot and listen on port 5050 with `tsx`.

---

## Phase 2: Domain Models & MongoDB Atlas Persistent Storage
- [x] **2.1 Mongoose Domain Schemas & Models (`src/models/`)**
  - [x] `property.model.ts`: Property profile and sub-locations.
  - [x] `room.model.ts`: Unified room unit and stay catalog model (code, slug, pricing, hold).
  - [x] `booking.model.ts`: Reservation, quote calculation, and payment plan types.
  - [x] `guest.model.ts`: Guest CRM and history models.
  - [x] `driver.model.ts`: Fleet drivers, status, ratings, trips, and commission.
  - [x] `cab-trip.model.ts`: Cab trips, distance, fares, 18% estate commission, and payouts.
  - [x] `newsletter.model.ts`: Email subscribers.
- [x] **2.2 MongoDB Connection Manager (`src/config/db.ts`)**
  - [x] Direct connection to MongoDB Atlas when `MONGODB_URI` is provided in `.env`.
  - [x] Automatic local in-memory MongoDB fallback during local development/testing if no URI is supplied.
  - [x] Graceful shutdown disconnect handlers.
- [x] **2.3 Seed Data Hydration (`src/data/seeds/`)**
  - [x] `rooms.seed.ts`: Hydrated 6 estate units (Tiger Hill / Ging Tea Cottage, Gumtree Suite, Chiyabari Loft, Second Flush Studio, Silver Oak Cottage, Cardamom Hills Hideaway).
  - [x] `drivers.seed.ts`: Hydrated 5 drivers (Dipu Tamang, Saraswati Rai, Bikash Gurung, Sunita Pradhan, Tobias Lund).
  - [x] `profile.seed.ts`: Hydrated Gumtree Valley & Meadowfall Estate profile & 3 locations.
  - [x] `bookings.seed.ts`: Hydrated initial calendar schedule and direct bookings.
  - [x] `guests.seed.ts`: Hydrated guest CRM records with tags and history.
  - [x] `seed.ts`: Master seed script tested and verified (`npm run seed`).

---

## Phase 3: Services & Business Logic Layer (`src/services/`)
- [x] **3.1 Room & Accommodation Service (`room.service.ts`)**
  - [x] `getAllRooms(filters)`: Support filtering by category, kind, petFriendly, status.
  - [x] `getRoomByCodeOrSlug(codeOrSlug)`: Dual lookup by ID, code, or URL slug.
  - [x] `calculateQuote(nightly, checkIn, checkOut)`: Formula: `nights * rate + 900 (cleaning) + 12% GST`.
  - [x] `createRoom(data)`, `updateRoom(code, data)`, `deleteRoom(code)`.
  - [x] `setMaintenanceHold(code, hold)`: Blackout window booking prevention.
  - [x] `getAvailabilityGrid(startDate, days)`: Matrix of occupied slots and open dates.
- [x] **3.2 Booking Service (`booking.service.ts`)**
  - [x] Conflict detection: Prevent overlapping reservations on the same room.
  - [x] Generate canonical reference code (`MF-XXXXXX`) and 4-digit PIN (`XXXX`).
  - [x] Automatic CRM linkage: create or update Guest record in MongoDB upon booking.
  - [x] Recalculate financial balances for `card_full` vs `deposit`.
- [x] **3.3 Guest CRM Service (`guest.service.ts`)**
  - [x] `getGuests(statusFilter, searchQuery, roomFilter)`.
  - [x] `getTimeline(startDate, days)`: Calculate arrivals, departures, in-house counts.
  - [x] `updateGuest(id, updates)`: Update VIP flag, tags, and notes.
- [x] **3.4 Fleet & Driver Service (`driver.service.ts`)**
  - [x] `getDrivers(seats, status)`.
  - [x] `calculateQuote(fromCoords, toCoords, seats)`: Calculate distance, hill rate, surge, and driver list.
  - [x] `createCabBooking(data)`: Reserve cab, update driver status to "On a trip", increment trips, compute 18% commission.
  - [x] `addDriver(data)`, `updateDriverStatus(id, status)`.
  - [x] `getPayoutsLedger()`: Total fares, commission, driver payouts.
- [x] **3.5 Analytics Service (`analytics.service.ts`)**
  - [x] Aggregate live metrics: Gross Revenue, Room Revenue, Cab Revenue, 18% Estate Commission, Driver Payouts, Headcounts, ADR, Occupancy %.
  - [x] Time-series timeline: Today, 7 days, 14 days, Month, Quarter, Year.
  - [x] Service-wise margin analysis & room performance breakdown.
  - [x] CSV export generation.

---

## Phase 4: Controllers & REST API Routes (`src/routes/`)
- [x] **4.1 Validation Schemas (`src/schemas/`)**
  - [x] Zod schemas for room creation, quote requests, bookings, driver intake, cab bookings.
- [x] **4.2 Endpoints Implementation**
  - [x] `/api/v1/properties`: Profile & locations endpoints.
  - [x] `/api/v1/rooms` & `/api/v1/stays`: Catalog, detail, quotes, availability grid, holds.
  - [x] `/api/v1/bookings` & `/api/v1/reservations`: Booking creation & status lookup.
  - [x] `/api/v1/guests`: CRM directory & arrivals/departures timeline.
  - [x] `/api/v1/drivers` & `/api/v1/cabs`: Fleet roster, quotes, trip booking, payouts ledger.
  - [x] `/api/v1/analytics`: Dashboard KPIs & CSV export.
  - [x] `/api/v1/newsletter/subscribe`: Subscription persistence.

---

## Phase 5: Verification & Contract Testing
- [x] **5.1 Server Verification**
  - [x] Launched server with `npm run dev` running `tsx watch src/server.ts`.
  - [x] Verified curl tests on `/health`, `/api/v1/stays`, `/api/v1/stays/ging-tea-cottage`, `/api/v1/drivers`, `/api/v1/analytics`.
  - [x] Verified reservation creation via POST request and asserted booking persistence in MongoDB.
  - [x] Verified cab quote calculation and trip creation updating driver status to "On a trip" and analytics.
- [x] **5.2 Automated HTTP Regression Test Suite (`scripts/test-endpoints.ts`)**
  - [x] Added `npm run test:api` to `server/package.json`.
  - [x] Ran automated regression suite covering all 34 operations across 8 service domains: **34 PASSED, 0 FAILED**.

---

## Phase 6: Client & Owner Connection Bridges
- [x] **6.1 Client-Side Connection Modularization**
  - [x] Created `client-side/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:5050/api/v1`.
  - [x] Created centralized `client-side/lib/api-config.ts` exporting `API_BASE_URL` and `API_ENDPOINTS` object.
  - [x] Wired `app/checkout/actions.ts` to `API_ENDPOINTS.reservations.create()`.
  - [x] Wired `components/newsletter-form.tsx` to `API_ENDPOINTS.newsletter.subscribe()`.
  - [x] Verified Next.js Turbo build: 0 errors in 2.7s.
- [x] **6.2 Owner-Side Connection Modularization**
  - [x] Created `owner-side/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:5050/api/v1`.
  - [x] Created centralized `owner-side/lib/api-config.ts` exporting `API_BASE_URL` and `API_ENDPOINTS` object.
  - [x] Refactored `EstateProvider` in `owner-side/components/estate-provider.tsx` to route all sync, creates, updates, and deletes through `API_ENDPOINTS.*`.
  - [x] Verified Next.js Turbo build: 0 errors in 1.6s.
- [x] **6.3 Live End-to-End Test**
  - [x] Client/guest booking -> live MongoDB persistence -> instant sync into owner portal room schedule, CRM guest records, and financial analytics.
