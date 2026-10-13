# Central API Server Documentation

> **Hill Hospitality & Transit Network — Central REST API**  
> Runtime Port: `5050`  
> Base URL: `http://localhost:5050/api/v1`  
> Architecture: Node.js / Express 5 with TypeScript & MongoDB Mongoose Multi-Tenant Engine

---

## 📑 Table of Contents
1. [Overview & Architecture](#-overview--architecture)
2. [Authentication & Authorization Model](#-authentication--authorization-model)
3. [Error Handling & Standard Envelope](#-error-handling--standard-envelope)
4. [Endpoint Reference](#-endpoint-reference)
   - [0. Health & Root](#0-health--root)
   - [1. Authentication (`/auth`)](#1-authentication-auth)
   - [2. Properties & Estates (`/properties`)](#2-properties--estates-properties)
   - [3. Rooms & Stays Inventory (`/rooms` & `/stays`)](#3-rooms--stays-inventory-rooms--stays)
   - [4. Bookings & Reservations (`/bookings` & `/reservations`)](#4-bookings--reservations-bookings--reservations)
   - [5. Guests CRM (`/guests`)](#5-guests-crm-guests)
   - [6. Mountain Cabs & Drivers Fleet (`/drivers` & `/cabs`)](#6-mountain-cabs--drivers-fleet-drivers--cabs)
   - [7. Analytics & Financial Ledger (`/analytics`)](#7-analytics--financial-ledger-analytics)
   - [8. Super Admin Control Tower (`/admin`)](#8-super-admin-control-tower-admin)
   - [9. Calendar Synchronization (RFC 5545 iCal)](#9-calendar-synchronization-rfc-5545-ical)
   - [10. Seasonal Newsletter (`/newsletter`)](#10-seasonal-newsletter-newsletter)
5. [Local Development & Environment](#-local-development--environment)

---

## 🏛️ Overview & Architecture

The Central API Server serves as the single source of truth for the 4 frontend portals:
- **Client OTA (`:3000`)**: Public catalog, guest reservations, mountain cab transfers.
- **Owner PMS (`:3001`)**: Multi-tenant property management, 14-day tape chart, room pricing, guest CRM.
- **Driver Terminal (`:3002`)**: Mobile PWA dispatches, trip statuses, 82% take-home ledger.
- **Admin Tower (`:3003`)**: Network GBV, 18% cut, property moderation, UPI payouts settlement.

---

## 🔐 Authentication & Authorization Model

The API employs stateless **JSON Web Tokens (JWT)** with a 15-minute expiration window:
- **Bearer Token**: Provided in standard HTTP header: `Authorization: Bearer <token>`
- **User Roles**: `admin`, `owner`, `driver`, `guest`
- **Multi-Tenancy Scoping**: Owner endpoints automatically scope room, booking, and guest queries to the authenticated owner's `propertyId` or `ownerId`. When unauthenticated (development/testing), default or query-specified tenancy parameters apply.

---

## 📦 Error Handling & Standard Envelope

All JSON responses follow a consistent structural envelope:

### Success Response
```json
{
  "success": true,
  "message": "Optional descriptive status message",
  "data": { ... }
}
```

### Paginated / List Response
```json
{
  "success": true,
  "count": 12,
  "data": [ ... ]
}
```

### Error Response
```json
{
  "success": false,
  "error": "Descriptive error message",
  "errors": [ ... ] // Optional validation details
}
```

---

## 📡 Endpoint Reference

### 0. Health & Root

#### `GET /api/v1/`
Service descriptor and API version.
- **Request Headers**: None
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Hill Hospitality & Transit Network API v1",
  "version": "1.0.0",
  "docs": "/api/v1"
}
```

#### `GET /health`
Kubernetes/Docker liveness probe.
- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "uptime": 1420.5
}
```

---

### 1. Authentication (`/auth`)

#### `POST /api/v1/auth/register`
Create a new host or guest account.
- **Request Body**:
```json
{
  "name": "Ananya Sharma",
  "email": "ananya@example.com",
  "password": "Password123!",
  "role": "owner",
  "phone": "+91 98300 11223"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "User registered successfully.",
  "data": {
    "user": {
      "id": "6708a3f124...",
      "name": "Ananya Sharma",
      "email": "ananya@example.com",
      "role": "owner",
      "phone": "+91 98300 11223"
    },
    "token": "eyJhbGciOi...",
    "expiresIn": "15m",
    "expiresInSeconds": 900
  }
}
```

#### `POST /api/v1/auth/login`
Authenticate with email and password to receive a JWT session token.
- **Request Body**:
```json
{
  "email": "ananya@example.com",
  "password": "Password123!"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": "6708a3f124...",
      "name": "Ananya Sharma",
      "email": "ananya@example.com",
      "role": "owner"
    },
    "token": "eyJhbGciOi...",
    "expiresIn": "15m",
    "expiresInSeconds": 900
  }
}
```

#### `POST /api/v1/auth/google`
Authenticate or create a user via Google Sign-In.
- **Request Body**:
```json
{
  "idToken": "google-oauth-token-string",
  "email": "traveler@gmail.com",
  "name": "Traveler Name",
  "role": "guest"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Google authentication successful.",
  "data": {
    "user": {
      "id": "6708a3...",
      "name": "Traveler Name",
      "email": "traveler@gmail.com",
      "role": "guest"
    },
    "token": "eyJhbGciOi...",
    "expiresIn": "15m",
    "expiresInSeconds": 900
  }
}
```

#### `POST /api/v1/auth/otp/send`
Dispatch a 6-digit phone verification OTP (simulated `123456` in development).
- **Request Body**:
```json
{
  "phone": "+91 98300 41042"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "OTP sent successfully.",
  "data": {
    "phone": "+91 98300 41042",
    "mode": "development"
  }
}
```

#### `POST /api/v1/auth/otp/verify`
Verify phone OTP and obtain authenticated session.
- **Request Body**:
```json
{
  "phone": "+91 98300 41042",
  "otp": "123456",
  "role": "driver",
  "name": "Dipu Tamang"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "OTP verification successful.",
  "data": {
    "user": { "id": "...", "name": "Dipu Tamang", "phone": "+91 98300 41042", "role": "driver" },
    "token": "eyJhbGciOi...",
    "expiresIn": "15m",
    "expiresInSeconds": 900
  }
}
```

#### `POST /api/v1/auth/driver/login`
Quick PIN-based driver authentication for mobile terminals.
- **Request Body**:
```json
{
  "phone": "+91 98300 41042",
  "pin": "1234"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Driver login successful.",
  "data": {
    "driver": {
      "id": "drv-01",
      "name": "Dipu Tamang",
      "phone": "+91 98300 41042",
      "vehicle": "Mahindra Bolero 4WD",
      "plate": "WB 74 AJ 1042",
      "status": "available",
      "rating": 4.9
    },
    "token": "eyJhbGciOi...",
    "expiresIn": "15m",
    "expiresInSeconds": 900
  }
}
```

#### `GET /api/v1/auth/me`
Inspect current user profile from Bearer token.
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "6708a3...",
    "name": "Ananya Sharma",
    "email": "ananya@example.com",
    "role": "owner",
    "phone": "+91 98300 11223"
  }
}
```

---

### 2. Properties & Estates (`/properties`)

#### `GET /api/v1/properties`
Retrieve all registered homestay properties.
- **Headers**: `Authorization: Bearer <token>` (Optional)
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "6708a1...",
      "name": "Singtom Tea Estate & Resort",
      "slug": "singtom-tea-estate",
      "town": "Darjeeling",
      "address": "Singtom Division, P.O. North Point, Darjeeling 734104",
      "phone": "+91 98320 12345",
      "email": "host@singtom.com",
      "commissionRate": 0.18,
      "status": "approved",
      "locations": [
        { "id": "loc-1", "name": "Main Bungalow", "lat": 27.0512, "lng": 88.2618 }
      ]
    }
  ]
}
```

#### `GET /api/v1/properties/profile`
Retrieve active host property profile.
- **Headers**: `Authorization: Bearer <token>` (Optional)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "name": "Singtom Tea Estate & Resort",
    "phone": "+91 98320 12345",
    "address": "Darjeeling, West Bengal",
    "bankAccount": "HDFC0001234 - 50100234567890",
    "upiId": "singtom@okaxis",
    "locations": [ ... ]
  }
}
```

#### `PATCH /api/v1/properties/profile`
Update estate name, bank account, UPI ID, or contact number.
- **Request Body**:
```json
{
  "phone": "+91 98320 99999",
  "upiId": "estate.host@upi"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": { ... }
}
```

#### `GET /api/v1/properties/:slug`
Public stay property profile by URL slug.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "name": "Singtom Tea Estate & Resort",
    "slug": "singtom-tea-estate",
    "town": "Darjeeling",
    "address": "Singtom Division..."
  }
}
```

---

### 3. Rooms & Stays Inventory (`/rooms` & `/stays`)

> **Note**: `/api/v1/stays` is an exact alias for `/api/v1/rooms`.

#### `GET /api/v1/rooms`
List room inventory with optional filtering.
- **Query Parameters**:
  - `category` (e.g., `tea-gardens`, `heritage`, `cloud-lofts`)
  - `petFriendly` (`true` or `false`)
  - `status` (`available`, `maintenance`, `all`)
  - `guests` (integer)
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "code": "R101",
      "slug": "kanchan-view-suite",
      "name": "Kanchenjunga Suite",
      "kind": "Heritage Suite",
      "category": "tea-gardens",
      "nightly": 6500,
      "currency": "INR",
      "capacity": 3,
      "sqft": 450,
      "images": [ "/stays/stay-1.jpg" ],
      "amenities": [ "Mountain View", "Fireplace", "High-speed Wi-Fi", "Breakfast Included" ],
      "petFriendly": true,
      "status": "available"
    }
  ]
}
```

#### `GET /api/v1/rooms/availability/grid`
Fetch 14-day tape chart calendar availability grid across all units.
- **Query Parameters**:
  - `startDate`: ISO date string (default: today)
  - `days`: integer (default: 14)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "dates": [ "2026-10-13", "2026-10-14", "2026-10-15", "..." ],
    "rooms": [
      {
        "code": "R101",
        "name": "Kanchenjunga Suite",
        "dates": {
          "2026-10-13": { "status": "available", "price": 6500 },
          "2026-10-14": { "status": "booked", "bookingRef": "BK-88421" }
        }
      }
    ]
  }
}
```

#### `GET /api/v1/rooms/:codeOrSlug`
Retrieve individual room specifications and photo gallery.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "code": "R101",
    "name": "Kanchenjunga Suite",
    "nightly": 6500,
    "capacity": 3,
    "amenities": [ ... ]
  }
}
```

#### `POST /api/v1/rooms/:codeOrSlug/quote`
Calculate multi-night pricing quote including GST and optional add-ons.
- **Request Body**:
```json
{
  "checkIn": "2026-10-16",
  "checkOut": "2026-10-19",
  "guests": 2
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "roomCode": "R101",
    "nights": 3,
    "baseNightly": 6500,
    "roomTotal": 19500,
    "cleaningFee": 500,
    "taxPercent": 0.12,
    "taxAmount": 2400,
    "grandTotal": 22400,
    "currency": "INR"
  }
}
```

#### `POST /api/v1/rooms`
Create a new room in the host's inventory.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "code": "R105",
  "name": "Orchard Garden Studio",
  "kind": "Studio",
  "category": "garden-retreats",
  "nightly": 4200,
  "capacity": 2,
  "sqft": 320,
  "amenities": ["Balcony", "Tea Maker", "Geyser"],
  "petFriendly": false
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "code": "R105",
    "slug": "orchard-garden-studio",
    "nightly": 4200,
    "status": "available"
  }
}
```

#### `PATCH /api/v1/rooms/:codeOrSlug`
Update unit price, amenities, or capacity.
- **Request Body**:
```json
{
  "nightly": 4500,
  "status": "available"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": { "code": "R105", "nightly": 4500 }
}
```

#### `DELETE /api/v1/rooms/:codeOrSlug`
Remove a unit from inventory.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Room deleted successfully"
}
```

#### `POST /api/v1/rooms/:codeOrSlug/holds`
Block off dates for property maintenance, renovations, or private host use.
- **Request Body**:
```json
{
  "startDate": "2026-10-25",
  "endDate": "2026-10-28",
  "reason": "Fireplace chimney inspection & repainting"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": { "code": "R101", "status": "maintenance" }
}
```

#### `DELETE /api/v1/rooms/:codeOrSlug/holds`
Release maintenance block and return room to available tape chart status.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Maintenance hold released"
}
```

---

### 4. Bookings & Reservations (`/bookings` & `/reservations`)

> **Note**: `/api/v1/reservations` is an exact alias for `/api/v1/bookings`.

#### `GET /api/v1/bookings`
List bookings with optional filtering.
- **Query Parameters**:
  - `roomCode` (e.g. `R101`)
  - `channel` (`direct`, `ota`, `phone`)
  - `status` (`confirmed`, `checked_in`, `checked_out`, `cancelled`)
  - `search` (Guest name, reference, or phone query)
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "reference": "BK-88421",
      "roomCode": "R101",
      "roomName": "Kanchenjunga Suite",
      "guestName": "Rahul Mukherjee",
      "guestPhone": "+91 98301 23456",
      "guestEmail": "rahul.m@example.com",
      "checkIn": "2026-10-14",
      "checkOut": "2026-10-17",
      "nights": 3,
      "guests": 2,
      "totalAmount": 21840,
      "currency": "INR",
      "status": "confirmed",
      "doorPin": "4821",
      "channel": "direct"
    }
  ]
}
```

#### `GET /api/v1/bookings/:reference`
Retrieve a single reservation voucher.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "reference": "BK-88421",
    "guestName": "Rahul Mukherjee",
    "doorPin": "4821",
    "status": "confirmed"
  }
}
```

#### `POST /api/v1/bookings`
Reserve a room and generate immediate booking confirmation voucher with digital door PIN.
- **Request Body**:
```json
{
  "roomCode": "R101",
  "guestName": "Rahul Mukherjee",
  "guestEmail": "rahul.m@example.com",
  "guestPhone": "+91 98301 23456",
  "checkIn": "2026-10-18",
  "checkOut": "2026-10-21",
  "guests": 2,
  "paymentMethod": "card_simulated"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "reference": "BK-90412",
    "roomCode": "R101",
    "guestName": "Rahul Mukherjee",
    "checkIn": "2026-10-18",
    "checkOut": "2026-10-21",
    "nights": 3,
    "totalAmount": 21840,
    "status": "confirmed",
    "doorPin": "7291"
  }
}
```

#### `POST /api/v1/bookings/:reference/cancel`
Cancel an active booking and release calendar slots.
- **Request Body** (Optional):
```json
{
  "reason": "Guest travel itinerary change"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "reference": "BK-90412",
    "status": "cancelled"
  }
}
```

---

### 5. Guests CRM (`/guests`)

#### `GET /api/v1/guests`
Retrieve CRM guest directory with history, VIP tags, and stay records.
- **Query Parameters**:
  - `search` (Search by guest name or email)
  - `tag` (e.g. `VIP`, `Tea Connoisseur`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "gst-101",
      "name": "Rahul Mukherjee",
      "email": "rahul.m@example.com",
      "phone": "+91 98301 23456",
      "totalStays": 3,
      "lifetimeSpend": 64500,
      "vip": true,
      "tags": ["VIP", "Photographer"],
      "notes": "Prefers second-floor room facing east for sunrise photography.",
      "lastStay": "2026-10-14"
    }
  ]
}
```

#### `GET /api/v1/guests/timeline`
Retrieve chronological activity timeline across check-ins, check-outs, and cab transfers.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "tl-1",
      "time": "14:00",
      "date": "2026-10-14",
      "type": "check_in",
      "guest": "Rahul Mukherjee",
      "room": "R101",
      "details": "Arriving via Bagdogra transfer (Driver: Dipu Tamang)"
    }
  ]
}
```

#### `GET /api/v1/guests/:id`
Retrieve detailed profile for a specific guest.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": { "id": "gst-101", "name": "Rahul Mukherjee", "totalStays": 3 }
}
```

#### `PATCH /api/v1/guests/:id`
Update guest notes or VIP status.
- **Request Body**:
```json
{
  "vip": true,
  "notes": "Requested extra mountain honey at breakfast.",
  "tags": ["VIP", "Botanist"]
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Guest updated successfully",
  "data": { ... }
}
```

---

### 6. Mountain Cabs & Drivers Fleet (`/drivers` & `/cabs`)

> **Note**: `/api/v1/cabs` is an alias for `/api/v1/drivers`.

#### `GET /api/v1/drivers`
List mountain cab drivers and vehicles.
- **Query Parameters**:
  - `seats`: integer (`4`, `6`, `7`)
  - `status`: (`available`, `busy`, `offline`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "drv-01",
      "name": "Dipu Tamang",
      "phone": "+91 98300 41042",
      "vehicle": "Mahindra Bolero 4WD",
      "plate": "WB 74 AJ 1042",
      "seats": 6,
      "status": "available",
      "rating": 4.9,
      "tripsCompleted": 184
    }
  ]
}
```

#### `GET /api/v1/drivers/places`
Retrieve curated transit hubs, airports, and sightseeing destinations with coordinates.
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 6,
  "data": [
    { "name": "Bagdogra Airport (IXB)", "lat": 26.6812, "lng": 88.3286, "hub": true },
    { "name": "NJP Railway Station", "lat": 26.6916, "lng": 88.4419, "hub": true },
    { "name": "Darjeeling Mall / Chowrasta", "lat": 27.0425, "lng": 88.2662, "hub": false },
    { "name": "Tiger Hill Sunrise Point", "lat": 26.9944, "lng": 88.2861, "hub": false },
    { "name": "Singtom Tea Estate", "lat": 27.0512, "lng": 88.2618, "hub": false }
  ]
}
```

#### `POST /api/v1/drivers/quote` (or `POST /api/v1/cabs/quote`)
Compute upfront transit fare and calculate financial distribution:
- **82% Driver Net Take-Home**
- **18% Platform Commission Cut**
- **Request Body**:
```json
{
  "fromLat": 27.0512,
  "fromLng": 88.2618,
  "toLat": 26.6916,
  "toLng": 88.4419,
  "seats": 4
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "distanceKm": 72.4,
  "durationMin": 185,
  "grossFare": 3200,
  "platformCut": 576,
  "driverPayout": 2624,
  "driverTakeHomePercent": 82,
  "platformTakePercent": 18,
  "currency": "INR"
}
```

#### `POST /api/v1/drivers/bookings` (or `POST /api/v1/cabs/bookings`)
Book a mountain transit dispatch.
- **Request Body**:
```json
{
  "driverId": "drv-01",
  "guestName": "Rahul Mukherjee",
  "guestPhone": "+91 98301 23456",
  "pickupName": "Singtom Tea Estate",
  "pickupLat": 27.0512,
  "pickupLng": 88.2618,
  "dropoffName": "NJP Railway Station",
  "dropoffLat": 26.6916,
  "dropoffLng": 88.4419,
  "pickupDate": "2026-10-17",
  "pickupTime": "09:30",
  "fareAmount": 3200
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "reference": "CAB-44021",
    "driverId": "drv-01",
    "driverName": "Dipu Tamang",
    "fareAmount": 3200,
    "driverPayout": 2624,
    "estateCommission": 576,
    "status": "assigned",
    "payoutStatus": "pending"
  }
}
```

#### `GET /api/v1/drivers/:id/trips`
Retrieve trip history and pending dispatches for a specific driver.
- **Response `200 OK`**:
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

#### `PATCH /api/v1/drivers/trips/:id/status`
Advance trip lifecycle status from Driver Terminal.
- **Request Body**:
```json
{
  "status": "en_route"
}
```
*(Accepts: `"assigned"`, `"en_route"`, `"completed"`, `"cancelled"`)*
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "reference": "CAB-44021",
    "status": "en_route"
  }
}
```

#### `PATCH /api/v1/drivers/:id/status`
Toggle driver availability on duty.
- **Request Body**:
```json
{
  "status": "available"
}
```
*(Accepts: `"available"`, `"busy"`, `"offline"`)*
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": { "id": "drv-01", "status": "available" }
}
```

#### `POST /api/v1/drivers`
Register a new local mountain driver into the fleet roster.
- **Request Body**:
```json
{
  "name": "Bikash Gurung",
  "phone": "+91 98322 55441",
  "pin": "1234",
  "vehicle": "Toyota Innova Crysta",
  "plate": "WB 74 B 8891",
  "seats": 7
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": { "id": "drv-04", "name": "Bikash Gurung", "status": "available" }
}
```

---

### 7. Analytics & Financial Ledger (`/analytics`)

#### `GET /api/v1/analytics`
Retrieve host PMS occupancy rate, Average Daily Rate (ADR), RevPAR, and revenue graph.
- **Headers**: `Authorization: Bearer <token>` (Optional)
- **Query Parameters**:
  - `range`: `"month"` | `"quarter"` | `"year"`
  - `offset`: integer (default: `0`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "occupancy": 76.4,
    "adr": 5850,
    "revpar": 4469,
    "totalRevenue": 482000,
    "cabCommission": 24800,
    "timeline": [
      { "date": "2026-10-01", "roomRevenue": 14500, "cabCommission": 1200 },
      { "date": "2026-10-02", "roomRevenue": 19500, "cabCommission": 1750 }
    ]
  }
}
```

#### `GET /api/v1/analytics/export`
Stream monthly financial and booking ledger in CSV format for accounting.
- **Response `200 OK`**:
- **Headers**: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="estate-ledger-2026-10.csv"`
```csv
Date,Reference,Type,Guest,Amount,Commission,Net
2026-10-14,BK-88421,Room,Rahul Mukherjee,21840,0,21840
2026-10-14,CAB-44021,Cab,Rahul Mukherjee,3200,576,576
```

---

### 8. Super Admin Control Tower (`/admin`)

> **Protection**: All endpoints require `Authorization: Bearer <adminToken>` with role `"admin"`.

#### `GET /api/v1/admin/overview`
Platform-wide executive metrics, network GBV, 18% cut, homestays roster, and driver payouts desk.
- **Headers**: `Authorization: Bearer <adminToken>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "kpis": {
      "totalProperties": 1,
      "totalDrivers": 3,
      "totalTrips": 28,
      "totalGrossRevenue": 745000,
      "totalPlatformCommission": 26800,
      "pendingPayouts": 7872
    },
    "properties": [
      {
        "id": "6708a1...",
        "name": "Singtom Tea Estate & Resort",
        "ownerName": "Homestay Host",
        "town": "Darjeeling",
        "status": "approved",
        "roomsCount": 4
      }
    ],
    "recentTrips": [
      {
        "id": "6708c...",
        "reference": "CAB-44021",
        "driverName": "Dipu Tamang",
        "passengerName": "Rahul Mukherjee",
        "fare": 3200,
        "commission": 576,
        "payout": 2624,
        "payoutStatus": "pending"
      }
    ]
  }
}
```

#### `PATCH /api/v1/admin/payouts/:id/settle` (and `POST /api/v1/admin/payouts/settle`)
Mark a driver cab trip payout as settled with UPI transaction reference.
- **Request Body**:
```json
{
  "settlementReference": "UPI/20261013/8821004"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Payout marked as settled.",
  "data": {
    "id": "6708c...",
    "payoutStatus": "settled",
    "settlementReference": "UPI/20261013/8821004"
  }
}
```

#### `PATCH /api/v1/admin/properties/:id/status`
Update homestay property moderation status (`approved`, `pending`, `suspended`).
- **Request Body**:
```json
{
  "status": "approved"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Property status updated.",
  "data": {
    "id": "6708a1...",
    "status": "approved"
  }
}
```

---

### 9. Calendar Synchronization (RFC 5545 iCal)

#### `GET /api/v1/ical/export/:codeOrSlug` (or `GET /api/v1/rooms/:codeOrSlug/calendar.ics`)
Public RFC 5545 `.ics` feed for Airbnb, MakeMyTrip, and Google Calendar two-way synchronization.
- **Response `200 OK`**:
- **Headers**: `Content-Type: text/calendar; charset=utf-8`
```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Hill Hospitality & Transit Network//iCal Engine//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:BK-88421@platform
DTSTAMP:20261013T060000Z
DTSTART;VALUE=DATE:20261014
DTEND;VALUE=DATE:20261017
SUMMARY:Reserved - BK-88421
DESCRIPTION:Confirmed guest reservation on Hill Hospitality & Transit Network
END:VEVENT
END:VCALENDAR
```

#### `POST /api/v1/ical/sync/:codeOrSlug` (or `POST /api/v1/rooms/:codeOrSlug/sync-ical`)
Inbound iCal parser to ingest external Airbnb / Booking.com calendar URLs and block tape chart slots.
- **Request Body**:
```json
{
  "icalUrl": "https://www.airbnb.com/calendar/ical/1234567.ics?s=abcdef"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Calendar synced successfully",
  "importedEvents": 2
}
```

---

### 10. Seasonal Newsletter (`/newsletter`)

#### `POST /api/v1/newsletter/subscribe`
Subscribe visitor email address to seasonal Himalayan dispatch newsletter.
- **Request Body**:
```json
{
  "email": "traveler@outlook.com"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Subscribed to seasonal estate letters successfully"
}
```

---

## 💻 Local Development & Environment

```bash
# In server/ directory:
npm install
npm run dev      # Starts tsx watch on port 5050
npm run build    # Compiles TypeScript into dist/
npm run start    # Executes production dist/index.js
```

### Environment Variables (`server/.env`):
```ini
PORT=5050
NODE_ENV=development
MONGODB_URI=mongodb+srv://...mongodb.net/homestay
JWT_SECRET=super-secret-jwt-key-for-hill-network
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003
```
