# Live Vercel Production Audit & Verification Plan

> **Scope**: End-to-end verification of the deployed StayRide platform on Vercel (`https://home-stay-ten.vercel.app`), MongoDB Atlas multi-tenant persistence, Axiom telemetry, cron jobs, and complete role-based user workflows.

---

## 1. Objectives & Target Environments

* **Deployed Vercel Backend**: `https://home-stay-ten.vercel.app`
* **Deployed Admin Dashboard**: `https://home-stay-admin.vercel.app`
* **Deployed Client Portal**: `https://home-stay-p5rg.vercel.app`
* **Live Database Cluster**: MongoDB Atlas (`Cluster0`)
  * **Production Database**: `production`
  * **Demo Database**: `test`
* **Cloud Telemetry**: Axiom (`stayride-api`)

---

## 2. Step-by-Step Scenario Matrix

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Super Admin
    actor Host as Production Host
    actor Guest as Traveler Guest
    actor Driver as Driver Partner
    participant Vercel as Vercel API
    participant Mongo as MongoDB Atlas
    participant Axiom as Axiom Cloud

    Note over Admin,Axiom: Scenario 1: System Baseline & Cron Check
    Admin->>Vercel: GET /health
    Vercel-->>Admin: 200 OK (Uptime, timestamp)
    Admin->>Vercel: GET /v1/cron/ical-sync (Bearer CRON_SECRET)
    Vercel->>Mongo: Sync room calendar feeds
    Vercel-->>Admin: 200 OK ({ ok: true, rooms: N })
    Vercel-->>Axiom: Stream HTTP telemetry

    Note over Admin,Axiom: Scenario 2: Admin Control Tower Walkthrough
    Admin->>Vercel: POST /api/v1/auth/login (admin@platform.com)
    Vercel-->>Admin: 200 OK (JWT Session token)
    Admin->>Vercel: GET /api/v1/admin/overview
    Vercel->>Mongo: Read KPIs, properties, drivers
    Vercel-->>Admin: 200 OK (Financials, analytics, active estates)
    Admin->>Vercel: GET /api/v1/stayride/admin/settings
    Vercel-->>Admin: 200 OK (Commission % & Advance limits)

    Note over Host,Mongo: Scenario 3: Real Production Host Workflow
    Host->>Vercel: POST /v1/auth/signup (Real Host)
    Vercel->>Mongo: Create User & Property in 'production'
    Host->>Vercel: POST /v1/rooms (Create Deluxe Attic Room)
    Vercel->>Mongo: Insert Room in 'production'
    Mongo-->>Host: Persisted with unique room ID

    Note over Guest,Driver: Scenario 4 & 5: Guest Cab Booking & Driver Dispatch
    Guest->>Vercel: POST /stayride/public/cab-requests (Bagdogra to Darjeeling)
    Vercel->>Mongo: Save CabRequest in 'production'
    Admin->>Vercel: Assign Driver to CabRequest
    Admin->>Vercel: Record Advance (Simulation Mode)
    Vercel->>Mongo: Transition status to CONFIRMED

    Note over Admin,Mongo: Scenario 6: Strict Demo Isolation Verification
    Admin->>Vercel: POST /v1/auth/login (demo@stayride.in)
    Vercel->>Mongo: useDb('test') - strictly isolated
    Note right of Mongo: Assert ZERO demo records touch 'production' db
```

---

## 3. Detailed Test Steps & Assertions

### Scenario 1: System Baseline & Public Readiness
1. **Health Verification**: Send `GET /health` to live backend. Expect `200 OK` with JSON `{ status: "ok" }`.
2. **Platform Public Config**: Send `GET /api/v1/stayride/public/config`. Expect preset routes (Bagdogra, NJP, Tiger Hill), vehicle types, and pickup times.
3. **iCal Background Cron**:
   * Test without header: Expect `401 Unauthorized`.
   * Test with `Authorization: Bearer stayride_cron_secret_74b9a12c8e3f4d0a1b2c3d4e`: Expect `200 OK` with `{ ok: true }`.

### Scenario 2: Super Admin Tower Operations
1. **Admin Login**: `POST /api/v1/auth/login` with `admin@platform.com` and password `adminMasterPassword2026!`.
   * Assert response status is `200`.
   * Assert user role is `"admin"`.
   * Assert JWT token is issued.
2. **Overview Statistics**: `GET /api/v1/admin/overview` with Bearer token.
   * Assert KPI counts for properties, drivers, and bookings.
3. **Commission & Operations Settings**: `GET /api/v1/stayride/admin/settings`.
   * Assert platform fee, homestay commission, and default advance percentages are retrieved.
4. **Driver Fleet**: `GET /api/v1/admin/stayride/drivers`.
   * Assert active drivers list (e.g. Dipu Tamang, Saraswati Rai).

### Scenario 3: Real Production Host Lifecycle
1. **Host Signup / Auth**: Register a new production host (`prod.audit.host@stayride.in`).
2. **Room Management**:
   * Create room: `POST /v1/rooms` with title `"Pine View Alpine Suite"`, capacity, and base rate.
   * Query rooms: `GET /v1/rooms`.
3. **Database Validation**: Directly query MongoDB Atlas (`production` database) to confirm the new room document is physically persisted on disk.

### Scenario 4: Guest Cab Booking & Fare Calculation
1. **Public Request**: Create cab request via `POST /api/v1/stayride/public/cab-requests` from Bagdogra Airport to Darjeeling.
2. **Status Page**: Retrieve request by reference token; verify pricing calculation, advance amount, and remaining cash.

### Scenario 5: Driver Assignment & Simulation Payment
1. **Driver Assignment**: Admin assigns driver (`DRV-101`) to pending cab request.
2. **Advance Recording**: Admin records advance payment (`₹500`).
3. **Status Check**: Verify request status transitions from `AWAITING_ADVANCE_PAYMENT` to `CONFIRMED`.

### Scenario 6: Strict Demo vs. Production DB Isolation
1. **Demo Login**: Authenticate using `demo@stayride.in` / `demo123`.
2. **Demo Operations**: Fetch demo rooms and demo bookings.
3. **Database Validation**: Query MongoDB Atlas:
   * Verify all demo data was read/written to the `"test"` database.
   * Verify zero records from the demo tenant appear in the `"production"` database.

### Scenario 7: Telemetry & Log Ingestion (Axiom)
1. Trigger API requests on live Vercel.
2. Verify telemetry stream in Axiom dataset `stayride-api` receives the events with structured fields (`statusCode`, `userRole`, `durationMs`).

### Scenario 8: Expo Mobile App Code Audit
1. Audit mobile source code in `my-code/stayride-expo/`:
   * Authentication tokens & Clerk sync.
   * API base URL configuration.
   * Offline synchronization logic.
   * Push notification device token registration.
