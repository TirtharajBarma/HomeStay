# Owner Application Documentation (Host PMS & Operations)

> **Hill Hospitality & Transit Network — Homestay Host Portal**  
> Runtime Port: `3001`  
> Local URL: `http://localhost:3001`  
> Architecture: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS

---

## 📑 Table of Contents
1. [Overview & Host Value Proposition](#-overview--host-value-proposition)
2. [Route & Page Inventory](#-route--page-inventory)
3. [Component Hierarchy & Architecture](#-component-hierarchy--architecture)
4. [Backend API Integration Touchpoints](#-backend-api-integration-touchpoints)
5. [Multi-Tenancy & Zero-State Isolation](#-multi-tenancy--zero-state-isolation)
6. [Environment Configuration & Running Locally](#-environment-configuration--running-locally)

---

## 🏔️ Overview & Host Value Proposition

The Owner Application provides hillside boutique homestay hosts with a **100% free Property Management System (PMS)**:
- **14-Day Visual Tape Chart**: Drag-free, high-density reservation timeline showing active stays, turnovers, and scheduled arrivals.
- **Two-Way OTA Calendar Sync**: Export and import RFC 5545 iCalendar feeds to keep Airbnb, MakeMyTrip, and Booking.com synchronized automatically.
- **Maintenance Holds**: Lock rooms for repairs, deep cleaning, or off-season upkeep with one click.
- **Guest CRM & VIP Tagging**: Track guest stay history, lifetime revenue, dietary preferences, and room requests.
- **Local Driver Fleet Dispatch**: Maintain a preferred roster of trusted 4WD mountain drivers for guest airport and station pick-ups.
- **Financial Analytics & CSV Ledger**: Monitor occupancy percentages, Average Daily Rate (ADR), RevPAR, and export ledgers for local tax filing.

---

## 🗺️ Route & Page Inventory

| Route | Page File | Purpose & Host Experience |
|:---|:---|:---|
| `/` & `/book` | `app/book/page.tsx` & `app/page.tsx` | **Tape Chart Calendar & Room Inventory**: Interactive 14-day tape chart visual calendar, occupancy grid, room list, maintenance holds modal, quick direct booking modal. |
| `/guests` | `app/guests/page.tsx` | **Guest CRM**: Searchable guest directory with lifetime spend, VIP tags, past room stays, and personal guest preferences. |
| `/drivers` | `app/drivers/page.tsx` | **Driver Fleet Roster**: Directory of mountain transit drivers, vehicle plate numbers, 4WD capabilities, active duty status, and one-click driver registration. |
| `/analytics` | `app/analytics/page.tsx` | **Revenue & Occupancy Metrics**: KPI cards for Occupancy %, ADR, RevPAR, gross booking revenue, 30-day timeline chart, and CSV export. |
| `/profile` | `app/profile/page.tsx` | **Property Settings**: Estate name, contact phone, physical coordinates, bank account, and UPI ID for cab commission settlements. |
| `/campaign` | `app/campaign/page.tsx` | **Guest Communications**: Seasonal dispatch letters and email announcements for returning travelers. |
| `/login` | `app/login/page.tsx` | **Host Authentication**: Email/password login, Google Sign-In, and SMS phone OTP verification. |
| `/register` | `app/register/page.tsx` | **Host Registration**: Self-serve onboarding for new homestays. Automatically seeds a clean, zero-state workspace with zero mock data. |

---

## 🧩 Component Hierarchy & Architecture

```
owner-side/
├── components/
│   ├── app-shell.tsx               # Master layout containing top-nav, side-nav, and content container
│   ├── top-nav.tsx                 # Header with estate name badge, currency selector, and profile menu
│   ├── side-nav.tsx                # Left sidebar navigation with active route highlights
│   ├── auth-context.tsx            # React Context managing host token, login, logout, and role check
│   ├── estate-provider.tsx         # Global property state orchestrating rooms, bookings, and sync
│   ├── currency-provider.tsx       # Multi-currency converter (INR, USD, EUR, GBP)
│   ├── notifications.tsx           # Toast notification system for calendar updates and actions
│   ├── book/
│   │   ├── availability-grid.tsx   # 14-day visual tape chart matrix rendering room rows and date columns
│   │   └── book-view.tsx           # Host booking view controller and quick reservation modal
│   ├── rooms/
│   │   └── room-form-dialog.tsx    # Modal form to add or edit room pricing, capacity, and amenities
│   ├── guests/
│   │   └── guests-view.tsx         # Guest CRM table, search bar, VIP tag filters, and detail drawer
│   ├── drivers/
│   │   ├── drivers-view.tsx        # Mountain cab driver roster with vehicle tags & status toggles
│   │   └── add-driver-dialog.tsx   # Dialog to register a new driver into the local property roster
│   ├── analytics/
│   │   ├── analytics-view.tsx      # Executive metric tiles (Occupancy, ADR, RevPAR, Commission)
│   │   └── revenue-timeline.tsx    # Responsive SVG revenue chart for room & cab income
│   └── profile/
│       ├── profile-view.tsx        # Host profile settings, banking details, and UPI receiver
│       └── location-picker.tsx     # Coordinate map selector for estate grounds
```

---

## 🔌 Backend API Integration Touchpoints

All host operations communicate with the central API via `lib/api-config.ts` with automatic Bearer token injection:

### 1. Authentication & Multi-Tenancy Scoping
- **Login**: `POST /api/v1/auth/login`
- **Register**: `POST /api/v1/auth/register`
- **Google Sign-In**: `POST /api/v1/auth/google`
- **Phone OTP**: `POST /api/v1/auth/otp/send` & `POST /api/v1/auth/otp/verify`
- **Host Profile**: `GET /api/v1/auth/me`

### 2. Tape Chart & Room Inventory
- **Room List**: `GET /api/v1/rooms`
  - Scoped to authenticated host.
- **Availability Grid**: `GET /api/v1/rooms/availability/grid?startDate={date}&days=14`
  - Returns date-by-date booking and hold matrix.
- **Create Room**: `POST /api/v1/rooms`
  - Payload: `{ code, name, nightly, capacity, amenities, ... }`
- **Update Room**: `PATCH /api/v1/rooms/:codeOrSlug`
- **Delete Room**: `DELETE /api/v1/rooms/:codeOrSlug`
- **Maintenance Holds**: `POST /api/v1/rooms/:codeOrSlug/holds` & `DELETE /api/v1/rooms/:codeOrSlug/holds`

### 3. Bookings & Reservations Management
- **List Bookings**: `GET /api/v1/bookings`
- **Create Direct Booking**: `POST /api/v1/bookings`
- **Cancel Booking**: `POST /api/v1/bookings/:reference/cancel`

### 4. Guests CRM
- **List Guests**: `GET /api/v1/guests?search={q}`
- **Guest Timeline**: `GET /api/v1/guests/timeline`
- **Update Guest Notes / VIP**: `PATCH /api/v1/guests/:id`

### 5. Local Driver Fleet
- **Driver List**: `GET /api/v1/drivers`
- **Register Driver**: `POST /api/v1/drivers`
- **Toggle Driver Status**: `PATCH /api/v1/drivers/:id/status`

### 6. Analytics & Financial Ledger
- **Metrics & Graphs**: `GET /api/v1/analytics?range=month`
- **Export CSV**: `GET /api/v1/analytics/export`

### 7. External Calendar Sync (iCal)
- **Export Feed**: `GET /api/v1/rooms/:codeOrSlug/calendar.ics`
- **Sync Inbound Feed**: `POST /api/v1/rooms/:codeOrSlug/sync-ical`

---

## 🔒 Multi-Tenancy & Zero-State Isolation

The PMS is engineered to strictly isolate host accounts:
1. **Existing Demo Host**: Displays verified estate data for `Singtom Tea Estate & Resort`.
2. **New Registered Host**: When a new host registers via `/register`, their account starts with a **clean zero state**:
   - Zero bookings
   - Zero demo guests
   - Zero mock revenue
   - Blank analytics ready for real room entry
3. All database queries automatically filter by `ownerId` when an authenticated token is present.

---

## ⚙️ Environment Configuration & Running Locally

### Setup & Launch
```bash
# In owner-side/ directory:
npm install
npm run dev
```
Visit: `http://localhost:3001`

### Environment Variables (`owner-side/.env.local`)
```ini
NEXT_PUBLIC_API_URL=http://localhost:5050/api/v1
```
