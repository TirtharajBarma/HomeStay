# Admin Application Documentation (Platform Control Tower)

> **Hill Hospitality & Transit Network — Super Admin Tower**  
> Runtime Port: `3003`  
> Local URL: `http://localhost:3003`  
> Architecture: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS

---

## 📑 Table of Contents
1. [Overview & Administrative Capabilities](#-overview--administrative-capabilities)
2. [Route & Screen Inventory](#-route--screen-inventory)
3. [Financial Reconciliations & Payout Settlement](#-financial-reconciliations--payout-settlement)
4. [Backend API Integration Touchpoints](#-backend-api-integration-touchpoints)
5. [Demo Credentials](#-demo-credentials)
6. [Environment Configuration & Running Locally](#-environment-configuration--running-locally)

---

## 👑 Overview & Administrative Capabilities

The Admin Application serves as the executive **Control Tower** for the network:
- **Macro Marketplace Visibility**: Real-time aggregation of total Gross Booking Volume (GBV) across room reservations and mountain cab transit fares.
- **Platform Commission Tally**: Real-time tracking of the network's 18% cut on transit dispatches.
- **Homestay Moderation Desk**: Review incoming property registrations, inspect room counts and owner profiles, and toggle approval statuses (`Approved`, `Pending`, `Suspended`).
- **Driver Settlement Desk**: Settle completed cab trip payouts to drivers via UPI and attach transaction reference numbers to ensure complete financial auditability.

---

## 🗺️ Route & Screen Inventory

| Route | File | Screen Functionality & Admin Experience |
|:---|:---|:---|
| `/login` | `app/login/page.tsx` | **Admin Secure Gate**: Role-enforced authentication screen. Validates credentials and verifies `admin` privileges before granting dashboard access. |
| `/` | `app/page.tsx` | **Platform Control Tower**: <br>• **Executive KPI Bar**: Gross Platform Volume (GBV), Net Platform Cut (18%), Active Drivers, and Pending Payouts.<br>• **Property Moderation Table**: Overview of all host estates, room inventories, and status toggle buttons.<br>• **Transit Dispatches Audit**: Complete feed of mountain cab trips, passenger details, gross fare, and net driver take-home.<br>• **UPI Settlement Modal**: Interactive modal to record UPI reference (`UPI/20261013/...`) and reconcile driver disbursements. |

---

## 💳 Financial Reconciliations & Payout Settlement

1. When a driver completes a mountain transit trip, the trip status moves to `completed` and the payout status is marked `pending`.
2. The Admin Control Tower displays the outstanding driver balance under **Pending Payouts**.
3. The Super Admin clicks **"Settle Payout"**, enters the banking or UPI transaction ID, and confirms the settlement.
4. The system flags the trip as `settled` and updates both the admin audit ledger and the driver's mobile terminal earnings ledger.

---

## 🔌 Backend API Integration Touchpoints

All administrative requests require a valid Bearer token with `role: "admin"`:

### 1. Authentication
- **Admin Login**: `POST /api/v1/auth/login`
  - *Request Body*:
    ```json
    {
      "email": "admin@platform.local",
      "password": "admin123456"
    }
    ```
  - *Response*: `{ "success": true, "data": { "user": { "role": "admin" }, "token": "..." } }`
- **Session Check**: `GET /api/v1/auth/me`

### 2. Consolidated Platform Overview
- **Get Overview**: `GET /api/v1/admin/overview`
  - *Headers*: `Authorization: Bearer <adminToken>`
  - *Response*:
    ```json
    {
      "success": true,
      "data": {
        "kpis": {
          "totalGrossRevenue": 745000,
          "totalPlatformCommission": 26800,
          "totalProperties": 1,
          "totalDrivers": 3,
          "pendingPayouts": 7872
        },
        "properties": [ ... ],
        "recentTrips": [ ... ]
      }
    }
    ```

### 3. Payout Settlement
- **Settle Driver Payout**: `PATCH /api/v1/admin/payouts/:id/settle`
  - *Headers*: `Authorization: Bearer <adminToken>`
  - *Request Body*:
    ```json
    {
      "settlementReference": "UPI/20261013/8821004"
    }
    ```
  - *Response*:
    ```json
    {
      "success": true,
      "message": "Payout marked as settled.",
      "data": { "id": "...", "payoutStatus": "settled", "settlementReference": "UPI/20261013/8821004" }
    }
    ```

### 4. Property Moderation
- **Update Property Status**: `PATCH /api/v1/admin/properties/:id/status`
  - *Headers*: `Authorization: Bearer <adminToken>`
  - *Request Body*: `{ "status": "approved" }`
  - *Response*: `{ "success": true, "message": "Property status updated." }`

---

## 🔑 Demo Credentials

To access the Control Tower:
- **Email**: `admin@platform.local`
- **Password**: `admin123456`
- **Role**: Super Admin

---

## ⚙️ Environment Configuration & Running Locally

### Setup & Launch
```bash
# In admin-side/ directory:
npm install
npm run dev
```
Visit: `http://localhost:3003`

### Environment Variables (`admin-side/.env.local`)
```ini
NEXT_PUBLIC_API_URL=http://localhost:5050/api/v1
```
