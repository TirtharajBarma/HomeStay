# Driver Application Documentation (Mobile Terminal PWA)

> **Hill Hospitality & Transit Network — Driver Terminal**  
> Runtime Port: `3002`  
> Local URL: `http://localhost:3002`  
> Architecture: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS (Mobile-Optimized PWA)

---

## 📑 Table of Contents
1. [Overview & Mobile Driver Experience](#-overview--mobile-driver-experience)
2. [Route & Screen Inventory](#-route--screen-inventory)
3. [Financial Commission Model (82% / 18%)](#-financial-commission-model-82--18)
4. [Backend API Integration Touchpoints](#-backend-api-integration-touchpoints)
5. [Demo Credentials](#-demo-credentials)
6. [Environment Configuration & Running Locally](#-environment-configuration--running-locally)

---

## 🚕 Overview & Mobile Driver Experience

The Driver Application is a lightweight, mobile-first Progressive Web App (PWA) designed for Himalayan mountain transit drivers operating 4WD vehicles (Mahindra Bolero, Scorpio, Innova):
- **High-Contrast, Touch-Optimized UI**: Large buttons and clear typography suitable for mobile devices in bright hill sunlight.
- **PIN-Based Quick Login**: Fast 4-digit PIN login without cumbersome passwords.
- **One-Tap Duty Toggle**: Instantly switch between `Available`, `On a Trip (Busy)`, and `Offline`.
- **Trip Lifecycle Stepper**: Step trips through their lifecycle (`Assigned` ➔ `En Route` ➔ `Completed`).
- **Transparent 82% Earnings Ledger**: Every trip explicitly breaks down the gross fare, the driver's guaranteed 82% take-home, and the 18% platform fee.

---

## 📱 Route & Screen Inventory

| Route | File | Screen Functionality & User Experience |
|:---|:---|:---|
| `/login` | `app/login/page.tsx` | **Driver Login Terminal**: Clean mobile phone number and 4-digit PIN input screen. Validates against the central driver fleet database and stores driver token in local storage. |
| `/` | `app/page.tsx` | **Driver Dashboard & Dispatches**: <br>• **Driver Identity Header**: Driver name, vehicle model (e.g. *Mahindra Bolero 4WD*), plate number, and rating.<br>• **Duty Status Switcher**: Toggle between *Available*, *Busy*, and *Offline*.<br>• **Active Dispatch Card**: Passenger name, pickup/dropoff location, phone dial button, and one-tap status stepper.<br>• **Earnings & Payout Ledger**: Summary cards showing total gross fares earned, 82% net take-home, and UPI settlement tracking. |

---

## 💰 Financial Commission Model (82% / 18%)

Every trip executed on the network follows a transparent hill transit economics model:
- **82% Driver Net Payout**: Kept by the mountain driver for fuel, mountain vehicle wear-and-tear, and labor.
- **18% Platform Commission**: Retained by the network for marketplace operations and passenger support.

### Example Trip Breakdown (Darjeeling ➔ NJP Station):
- **Gross Passenger Fare**: ₹3,200
- **Driver Net Take-Home (82%)**: ₹2,624
- **Platform Fee (18%)**: ₹576
- **Settlement**: Admin reconciles and transfers ₹2,624 to driver's registered UPI ID upon trip completion.

---

## 🔌 Backend API Integration Touchpoints

All actions interface with the Central API configured in `lib/api-config.ts`:

### 1. Driver Authentication
- **Driver Login**: `POST /api/v1/auth/driver/login`
  - *Request Body*:
    ```json
    {
      "phone": "+91 98300 41042",
      "pin": "1234"
    }
    ```
  - *Response*:
    ```json
    {
      "success": true,
      "message": "Driver login successful.",
      "data": {
        "driver": {
          "id": "drv-01",
          "name": "Dipu Tamang",
          "vehicle": "Mahindra Bolero 4WD",
          "plate": "WB 74 AJ 1042",
          "status": "available"
        },
        "token": "eyJhbGciOi..."
      }
    }
    ```

### 2. Duty Status
- **Toggle Status**: `PATCH /api/v1/drivers/:id/status`
  - *Request Body*: `{ "status": "available" }` (or `"busy"`, `"offline"`)
  - *Response*: `{ "success": true, "data": { "id": "drv-01", "status": "available" } }`

### 3. Trip Dispatches & Status Stepper
- **Fetch Assigned Trips**: `GET /api/v1/drivers/:id/trips`
  - *Response*:
    ```json
    {
      "success": true,
      "count": 1,
      "data": [
        {
          "id": "6708c...",
          "reference": "CAB-44021",
          "passengerName": "Rahul Mukherjee",
          "pickup": "Singtom Tea Estate",
          "dropoff": "NJP Railway Station",
          "fare": 3200,
          "payout": 2624,
          "status": "assigned",
          "payoutStatus": "pending"
        }
      ]
    }
    ```
- **Advance Trip Status**: `PATCH /api/v1/drivers/trips/:id/status`
  - *Request Body*: `{ "status": "en_route" }` (or `"completed"`)
  - *Response*: `{ "success": true, "data": { "status": "en_route" } }`

### 4. Payout Ledger
- **Payout Summary**: `GET /api/v1/cabs/payouts`
  - *Response*: Detailed ledger of settled and pending driver earnings.

---

## 🔑 Demo Credentials

To test the driver terminal immediately:
- **Phone Number**: `+91 98300 41042`
- **PIN**: `1234`
- **Identity**: Dipu Tamang (*Mahindra Bolero 4WD*)

---

## ⚙️ Environment Configuration & Running Locally

### Setup & Launch
```bash
# In driver-side/ directory:
npm install
npm run dev
```
Visit: `http://localhost:3002`

### Environment Variables (`driver-side/.env.local`)
```ini
NEXT_PUBLIC_API_URL=http://localhost:5050/api/v1
```
