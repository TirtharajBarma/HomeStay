# 01 - System Architecture & Security Design
**Platform:** Hill Hospitality & Transit Network  
**Deployment Architecture:** Single Domain with 4 Isolated Subdomain Portals  
**Status:** Master System Architecture  

---

## 1. Domain & Subdomain Topology (Single Domain Strategy)

To achieve maximum security, clean UI isolation, and zero extra domain costs, the entire platform runs under **1 single purchased domain** (e.g. `yourdomain.com`) with 4 isolated subdomains:

```
                                      ┌──────────────────────────────────────────────┐
                                      │          SINGLE PURCHASED DOMAIN             │
                                      │            (e.g., yourdomain.com)            │
                                      └──────────────────────┬───────────────────────┘
                                                             │
         ┌───────────────────────────┬───────────────────────┴───────────────────────┬───────────────────────────┐
         ▼                           ▼                                               ▼                           ▼
┌──────────────────┐       ┌──────────────────┐                            ┌──────────────────┐       ┌──────────────────┐
│   CLIENT PORTAL  │       │  OWNER DASHBOARD │                            │  DRIVER PORTAL   │       │   SUPER ADMIN    │
│  (Travelers/OTA) │       │ (Homestay Hosts) │                            │ (Fleet Drivers)  │       │ (Control Tower)  │
│  yourdomain.com  │       │owner.yourdomain.c│                            │driver.yourdomain.│       │admin.yourdomain.c│
│   (Port 3000)    │       │   (Port 3001)    │                            │   (Port 3002)    │       │   (Port 3003)    │
└────────┬─────────┘       └──────────────────┘                            └──────────────────┘       └──────────────────┘
         │                                                           ▲
         ▼                                                           │
 ┌───────────────────────────────┐                                   │
 │ Dynamic Single-Stay Page      │                                   │
 │ yourdomain.com/h/:slug        │                                   │
 └───────────────────────────────┘                                   │
         │                                                           │
         └───────────────────────────┬───────────────────────────────┘
                                     ▼
                     ┌───────────────────────────────┐
                     │     CENTRAL BACKEND API       │
                     │       api.yourdomain.com      │
                     │         (Port 5050)           │
                     │  - Role-Based JWT Auth        │
                     │  - Multi-Tenant DB Scoping    │
                     │  - iCal & Dispatch Workers    │
                     └───────────────┬───────────────┘
                                     ▼
                     ┌───────────────────────────────┐
                     │   MongoDB Atlas (M0 Cluster)  │
                     └───────────────────────────────┘
```

---

## 2. Security Boundaries: Zero Code-Leak Guarantee

### The Threat
In many single-app setups, developer teams place Admin and Driver routes inside the same client codebase under `/admin` or `/driver`. Even if hidden behind conditional redirects, **Next.js bundles and ships compiled JavaScript chunks (`_next/static/chunks`) to the user's browser**. Anyone opening browser DevTools can inspect internal API paths, data schemas, and administrative endpoints.

### The Solution: Complete Build & Subdomain Separation
1. **Independent Client Bundles**:
   - `client-side` (`yourdomain.com`): Ships **only** traveler-facing code and `/h/:slug` stay pages. Contains zero admin or driver JavaScript.
   - `owner-side` (`owner.yourdomain.com`): Ships the host Property Management System (PMS).
   - `driver-side` (`driver.yourdomain.com`): Ships a lightweight, high-contrast mobile PWA for drivers.
   - `admin-side` (`admin.yourdomain.com`): Ships private management dashboards, protected with whitelist credentials.
2. **Cryptographic Role-Based Access Control (RBAC)**:
   - Backend JWT tokens carry cryptographically signed roles: `{ id, email, role: "guest" | "owner" | "driver" | "admin" }`.
   - Any attempt to access `/api/v1/admin/*` by non-admin tokens is rejected with an immediate `403 Forbidden`.
3. **Database Tenant Isolation**:
   - Every database query for homestays, rooms, calendar dates, and guest records is strictly scoped by `ownerId` or `propertyId`. Cross-tenant data leakage is structurally impossible.

---

## 3. Technology Stack: Free-First Production Plan

Since the platform is in its startup launch phase, all infrastructure utilizes production-ready free tiers with zero ongoing software costs:

| Layer | Technology | Cost | Function & Architecture |
| :--- | :--- | :--- | :--- |
| **Domain** | 1 Standard Domain (`.in` / `.com`) | ~₹800 / year | Single apex domain with infinite free subdomains via DNS. |
| **Frontend Hosting** | Vercel (Hobby Tier) | **₹0 Free** | Hosts all 4 Next.js frontend applications with automated global edge caching and free SSL certificates. |
| **Backend API** | Node.js 22 + Express + TypeScript (`tsx`) | **₹0 Free** | Hosted on Render / Railway / self-hosted VPS (`api.yourdomain.com`). |
| **Database** | MongoDB Atlas (M0 Free Cluster) | **₹0 Free** | 512 MB storage (stores ~200,000 bookings and hundreds of homestays before scaling). |
| **Authentication** | Google OAuth 2.0 + Bcrypt/JWT | **₹0 Free** | Google Cloud Console provides unlimited free Google Sign-In. Email/password is self-hosted with bcrypt. |
| **Mapping & Routing** | OpenStreetMap + Leaflet | **₹0 Free** | Replaces Google Maps API ($5–$7/1k hits). Mountain winding factor (1.38x) is calculated natively via Haversine. |
| **Payments** | Direct UPI QR / Pay on Arrival | **₹0 Free** | 70% of North Bengal bookings use UPI QR. Optional Razorpay gateway costs 0 upfront (2% per transaction). |
| **Messaging & Dispatch** | WhatsApp Deep-Links (`wa.me`) + Nodemailer | **₹0 Free** | Generates pre-filled WhatsApp alert links and SMTP emails without paying monthly WhatsApp API charges. |
| **OTA Synchronization** | Custom iCal Engine (`node-ical`) | **₹0 Free** | Self-hosted two-way RFC 5545 `.ics` feed parser for Airbnb and Booking.com. |

---

## 4. Frontend Topology & Responsibilities

### 1. Client Application (`yourdomain.com`)
- **Directory**: `/client-side`
- **Key Routes**:
  - `/`: Public landing page, search bar, and curated homestays directory.
  - `/h/[slug]`: **Dedicated single-homestay landing page** (e.g. `/h/darjeeling-heritage-cottage`). Displays only this property's story, photos, amenities, room availability, and cab transfer booking.
  - `/cab`: Dedicated hill transfer booking flow (NJP, Bagdogra ↔ Darjeeling, Kalimpong, Mirik).
  - `/checkout`: Room reservation checkout with live server sync.

### 2. Owner Portal (`owner.yourdomain.com`)
- **Directory**: `/owner-side`
- **Key Routes**:
  - `/login` & `/register`: Multi-tenant host onboarding with Google Sign-In and Email/Password.
  - `/book`: Live calendar availability grid (7, 14, 28 days) and reservation wizard.
  - `/drivers`: Local driver roster management, status updates ("Active", "On a trip", "Paused").
  - `/guests`: Guest CRM directory and arrival/departure timeline.
  - `/profile`: Property details, room inventory CRUD, and Leaflet location coordinates picker.
  - `/analytics`: Real-time financial reports (Room vs. Cab revenue, ADR, Occupancy %).

### 3. Driver Portal (`driver.yourdomain.com`)
- **Directory**: `/driver-side` (Lightweight Mobile PWA)
- **Key Features**:
  - Mobile-first interface with large touch targets for Android phones.
  - Phone Number + 4-digit PIN authentication.
  - View assigned trips today with passenger phone and one-tap call button.
  - Status toggle buttons: **[En Route]**, **[Arrived]**, **[Trip Completed]**.
  - Personal earnings ledger showing gross fare, 18% commission deduction, and net payout status.

### 4. Super Admin Control Tower (`admin.yourdomain.com`)
- **Directory**: `/admin-side` (Internal Operations Portal)
- **Key Features**:
  - Accessible only to verified platform administrator credentials.
  - Platform-wide KPIs: Gross Booking Value (GBV), total platform commissions, active properties.
  - Driver Settlement Ledger: Review completed rides, view net driver payouts (82%), and mark as settled.
  - Property Verification Queue: Review and approve new homestay registrations.
