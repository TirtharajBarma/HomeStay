# Hill Hospitality & Transit Network

> A production-grade, 4-sided marketplace connecting **Travelers (Guests)**, **Boutique Homestay Hosts (Owners)**, **Mountain Cab Drivers**, and the **Super Admin Platform Tower** across Darjeeling and the Eastern Himalayas.

---

## 📑 Table of Contents
1. [Platform Overview & Architecture](#-platform-overview--architecture)
2. [Applications & Port Mapping](#-applications--port-mapping)
3. [Technology Stack](#-technology-stack)
4. [Prerequisites & Environment Setup](#-prerequisites--environment-setup)
5. [Quick Start (Run Locally)](#-quick-start-run-locally)
6. [Demo Accounts & Credentials Matrix](#-demo-accounts--credentials-matrix)
7. [Manual Verification Walkthrough](#-manual-verification-walkthrough)
8. [Automated Verification Suites](#-automated-verification-suites)
9. [Project Directory Structure](#-project-directory-structure)

---

## 🏛️ Platform Overview & Architecture

The platform solves the two primary problems of hill tourism:
1. **Boutique Homestay Management (PMS)**: A 100% free property management system for hill hosts (14-day visual tape chart, room inventory, direct bookings, RFC 5545 iCal two-way sync with Airbnb/MakeMyTrip, and guest CRM).
2. **Hill Cab Transit Dispatch**: Reliable mountain transit between remote estates and hill hubs (NJP Railway Station, Bagdogra Airport, Tiger Hill, Chowrasta, Batasia Loop) with upfront rupee pricing, driver dispatching, and automated 82% driver take-home vs. 18% platform commission reconciliation.

```
                     ┌─────────────────────────────────────────┐
                     │      MongoDB Atlas Central Database     │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │       Central API Server (Port 5050)    │
                     │       Node.js + Express + TypeScript    │
                     └─┬──────────────┬──────────────┬─────────┘
                       │              │              │
        ┌──────────────┴───┐    ┌─────┴────────┐   ┌─┴────────────────┐
        ▼                  ▼    ▼              ▼   ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│  Client OTA  │ │  Owner PMS   │ │  Driver PWA  │ │ Super Admin Tower│
│  (Port 3000) │ │  (Port 3001) │ │  (Port 3002) │ │  (Port 3003)     │
│ Guest Booking│ │ Host Ops CRM │ │ Live Dispatch│ │ UPI Settlements  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘
```

---

## 🔌 Applications & Port Mapping

| Application | Directory | Default Port | Role & Primary Flows |
|:---|:---|:---:|:---|
| **API Server** | `/server` | **`5050`** | Central Node/Express REST API, Atlas MongoDB, JWT auth, iCal sync engine, UPI settlements |
| **Client Side** | `/client-side` | **`3000`** | Public catalog, stay editorial, dynamic quote calculation, room checkout, point-to-point cab booking |
| **Owner Side** | `/owner-side` | **`3001`** | Host PMS, 14-day tape chart, room inventory, guest CRM directory, fleet drivers roster, analytics |
| **Driver Side** | `/driver-side` | **`3002`** | Mobile driver terminal PWA, duty toggle (Available/On a trip/Offline), assigned hill trips, status progression |
| **Admin Side** | `/admin-side` | **`3003`** | Super Admin control tower, global platform KPIs, property listing moderation, driver UPI payout ledger |

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express, TypeScript, Mongoose (MongoDB Atlas), JSON Web Tokens (JWT), Zod validation, Helmet security, RFC 5545 iCal generator/parser.
- **Frontend Portals**: Next.js 16 (App Router + Turbopack), React 19, TypeScript, Tailwind CSS v4 with PostCSS.
- **Mapping & Distance**: Leaflet, OpenStreetMap, Mountain Winding Distance Algorithms.
- **Testing & Verification**: Playwright (Headless Chromium E2E), cURL regression test suites.

---

## ⚙️ Prerequisites & Environment Setup

- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x` or higher
- **MongoDB**: MongoDB Atlas URI or local MongoDB instance

### 1. Backend Server Setup
Navigate to `/server` and ensure `.env` contains:
```env
PORT=5050
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/homestay?retryWrites=true&w=majority
JWT_SECRET=meadowfall_super_secret_jwt_key_2026_estate_platform
CLIENT_URL=http://localhost:3000
OWNER_URL=http://localhost:3001
DRIVER_URL=http://localhost:3002
ADMIN_URL=http://localhost:3003
```

### 2. Frontend Portals Setup
In `client-side`, `owner-side`, `driver-side`, and `admin-side`, `.env.local` is preconfigured to point to `http://localhost:5050/api/v1`.

---

## 🚀 Quick Start (Run Locally)

### Install Dependencies Across All Applications
```bash
# Server
cd server && npm install && cd ..

# Client Side (Guest OTA)
cd client-side && npm install && cd ..

# Owner Side (Host PMS)
cd owner-side && npm install && cd ..

# Driver Side (Terminal PWA)
cd driver-side && npm install && cd ..

# Admin Side (Super Admin)
cd admin-side && npm install && cd ..
```

### Seed MongoDB Database (Optional / Fresh Start)
```bash
cd server
npm run seed
cd ..
```

### Start All 5 Applications Simultaneously

Open 5 separate terminal tabs (or run with `nohup` / `pm2`):

```bash
# Terminal 1: Backend Server (Port 5050)
cd server && npm run dev

# Terminal 2: Client Side (Port 3000)
cd client-side && npm run dev

# Terminal 3: Owner Side (Port 3001)
cd owner-side && npm run dev

# Terminal 4: Driver Side (Port 3002)
cd driver-side && npm run dev

# Terminal 5: Admin Side (Port 3003)
cd admin-side && npm run dev
```

---

## 🔑 Demo Accounts & Credentials Matrix

| Persona | Portal URL | Username / Identifier | Password / PIN | Access Level |
|:---|:---|:---|:---|:---|
| **Super Admin** | `http://localhost:3003/login` | `admin@platform.com` | `adminMasterPassword2026!` | Super Admin Control Tower |
| **Showcase Host** | `http://localhost:3001/login` | `owner@estate.com` | `estatePassword123!` | Host PMS with Gumtree Valley demo data |
| **New Real Host** | `http://localhost:3001/register` | *(Register any email)* | *(Any 8+ char password)* | True Zero-State PMS (0 rooms, 0 guests, ₹0 revenue) |
| **Fleet Driver** | `http://localhost:3002/login` | `+91 98300 41042` | `1234` | Driver Terminal (Dipu Tamang) |
| **Traveler / Guest**| `http://localhost:3000` | *Direct Public Access* | *N/A (Card simulation)* | Public booking & transfers |

> **OTP Note**: Any SMS phone OTP verification flow accepts `123456` in development/demo mode.  
> **Test Card**: The checkout payment simulation uses test card `4242 4242 4242 4242`, expiry `10 / 2028`, CVC `123` (or click **"Fill test card"** on the checkout page).

---

## 🧭 Manual Verification Walkthrough

A complete step-by-step testing guide for QA engineers and developers is documented in:  
👉 **[`WALKTHROUGH.md`](./WALKTHROUGH.md)**

### Quick Walkthrough Checklist:
1. **Guest Flow (`:3000`)**: Browse catalog ➔ Open stay ➔ Complete checkout with test card ➔ Receive confirmation voucher & digital door PIN ➔ Search cab (Ging Tea Estate ➔ Darjeeling Station) ➔ Select driver ➔ View cab voucher.
2. **Host Flow (`:3001`)**: Log in ➔ View analytics tiles ➔ Walk 14-day tape chart ➔ Open Room modal ➔ Filter guests in CRM table ➔ Check driver roster ➔ Register new host to verify true zero state.
3. **Driver Flow (`:3002`)**: Log in with phone & PIN ➔ Toggle duty status (Available / On a trip) ➔ Review gross earnings & 82% net payout ➔ Advance trip status (Assigned ➔ En Route ➔ Completed).
4. **Admin Flow (`:3003`)**: Log in with admin credentials ➔ Inspect network Gross Volume & 18% cut ➔ Moderate properties ➔ Reconcile driver payout with UPI reference.

---

## 🧪 Automated Verification Suites

### 1. 60-Point Automated cURL Audit
Runs a complete regression suite against all REST endpoints, multi-tenancy rules, and state progressions:
```bash
bash scripts/run_audit_curl_tests.sh
```
*Current Result*: **60 / 60 Passed (100% Green)**

### 2. End-to-End Playwright Browser Walkthrough
Runs an automated Chromium browser across all 4 frontend portals, asserting clean visual layouts, true input placeholders, interactive modals, and zero console errors:
```bash
python3 scripts/test_ui_walkthrough.py
```
*Current Result*: **0 Console Errors, 0 Network Failures, 21 Screenshots Verified**

---

## 📁 Project Directory Structure

```
.
├── admin-side/                 # Super Admin Control Tower (Port 3003)
│   ├── app/                    # Next.js App Router (Dashboard & Login)
│   ├── components/             # Admin auth context, tables & payout modal
│   └── postcss.config.mjs      # Tailwind CSS v4 compiler config
├── client-side/                # Guest OTA & Transfers (Port 3000)
│   ├── app/                    # Next.js App Router (Stays, Checkout, Cab booking)
│   ├── components/             # Interactive search, checkout form, map picker
│   └── lib/                    # Booking quotes, cabs, and live stay helpers
├── driver-side/                # Driver Dispatch Terminal PWA (Port 3002)
│   ├── app/                    # Next.js App Router (Terminal Dashboard & Login)
│   ├── components/             # Driver auth context, trip cards, duty toggles
│   └── postcss.config.mjs      # Tailwind CSS v4 compiler config
├── owner-side/                 # Host Property Management System (Port 3001)
│   ├── app/                    # Next.js App Router (Analytics, Calendar, CRM, Roster)
│   ├── components/             # 14-day tape chart, estate provider, modals
│   └── lib/                    # Timeline calculations, analytics data models
├── server/                     # Central API Server (Port 5050)
│   ├── src/
│   │   ├── controllers/        # Auth, rooms, bookings, drivers, admin, cabs
│   │   ├── models/             # Mongoose schemas (Property, Room, Booking, Driver)
│   │   ├── routes/             # REST route declarations under /api/v1
│   │   ├── services/           # Analytics, iCal sync, pricing, transit algorithms
│   │   └── server.ts           # Express entry point, Atlas bootstrap & indexing
│   └── package.json
├── docs/                       # Architecture, requirements & API contracts
├── README.md                   # Platform documentation & master guide
└── WALKTHROUGH.md              # Step-by-step developer manual testing guide
```

---

## 📄 License
Private & Proprietary. All rights reserved.
