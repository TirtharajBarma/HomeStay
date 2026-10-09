# 03 - REST API Contract Specifications

Base URL: `http://localhost:5050/api/v1`

---

## 0. Authentication & JWT (15-Minute Session)

### `POST /auth/register`
Register a new guest or owner account.
- **Request Body**:
```json
{
  "name": "Aditi Sen",
  "email": "aditi.sen@example.com",
  "password": "securePassword123",
  "role": "owner",
  "phone": "+91 98300 12345"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "User registered successfully.",
  "data": {
    "user": { "id": "...", "name": "Aditi Sen", "email": "aditi.sen@example.com", "role": "owner" },
    "token": "eyJhbGciOi...",
    "expiresIn": "15m",
    "expiresInSeconds": 900
  }
}
```

### `POST /auth/login`
Authenticate with email and password to receive a 15-minute JWT Bearer token.
- **Request Body**:
```json
{
  "email": "aditi.sen@example.com",
  "password": "securePassword123"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": { "id": "...", "name": "Aditi Sen", "email": "aditi.sen@example.com", "role": "owner" },
    "token": "eyJhbGciOi...",
    "expiresIn": "15m",
    "expiresInSeconds": 900
  }
}
```

### `GET /auth/me`
Protected route returning the authenticated user profile.
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "Aditi Sen",
    "email": "aditi.sen@example.com",
    "role": "owner"
  }
}
```
- **Error `401 Unauthorized`** (expired after 15m or invalid):
```json
{
  "success": false,
  "error": "JWT token has expired (15m validity). Please log in again to renew your session.",
  "expired": true
}
```

---

## 1. Property & Locations

### `GET /properties/profile`
Returns current estate host profile, house rules, policies, and locations.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "prop_gumtree",
      "name": "Gumtree Valley & Meadowfall Estate",
      "role": "Estate Owner & Host",
      "email": "ananya@gumtreevalley.in",
      "phone": "+91 98300 41000",
      "address": "12 Ging Tea Estate Road",
      "town": "Darjeeling",
      "region": "West Bengal",
      "postal": "734101",
      "bio": "I run Gumtree Valley with my brother Arjun...",
      "checkInTime": "3:00 PM",
      "checkOutTime": "11:00 AM",
      "responseTime": "Usually within 20 minutes",
      "currency": "INR"
    },
    "locations": [
      {
        "id": "LOC-1",
        "name": "Ging Lodge",
        "address": "12 Ging Tea Estate Road, Darjeeling, West Bengal 734101",
        "kind": "Main lodge",
        "units": 2,
        "note": "Ground floor suites with direct terrace access...",
        "lat": 27.03677,
        "lng": 88.26302
      }
    ]
  }
}
```

### `PATCH /properties/profile`
Updates host profile.
- **Request Body**: Partial `PropertyProfile`.
- **Response `200 OK`**: `{ "success": true, "data": { ...updatedProfile } }`.

### `POST /properties/locations`
Add a new sub-building or location.
- **Request Body**: `{ name, address, kind, units, note, lat, lng }`.
- **Response `201 Created`**: `{ "success": true, "data": { ...newLocation } }`.

---

## 2. Accommodations & Stays (Rooms)

### `GET /rooms` (also accessible as `GET /stays`)
List all rooms / accommodations with optional filtering.
- **Query Params**:
  - `kind` (`cottage` | `loft` | `cabin` | `all`)
  - `petFriendly` (`true` | `false`)
  - `category` (`Ging Lodge` | `Chiyabari Lofts` | `Garden Cottages`)
  - `status` (`Active` | `Maintenance` | `all`)
  - `checkIn` (`YYYY-MM-DD`)
  - `checkOut` (`YYYY-MM-DD`)
  - `guests` (`number`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "id": "rm_101",
      "code": "101",
      "slug": "ging-tea-cottage",
      "name": "Ging Tea Cottage",
      "category": "Garden Cottages",
      "kind": "cottage",
      "status": "Active",
      "petFriendly": false,
      "maxGuests": 2,
      "nightly": 2400,
      "weekend": 2900,
      "amenities": ["Bukhari Stove", "Copper Bathtub", "Tea Garden View"],
      "image": "https://...",
      "available": true
    }
  ]
}
```

### `GET /rooms/:idOrSlug` (or `GET /stays/:slug`)
Returns complete detail of a specific stay.
- **Response `200 OK`**: `{ "success": true, "data": { ...roomDetail } }`.
- **Response `404 Not Found`**: `{ "success": false, "error": "Room not found" }`.

### `POST /rooms/:idOrSlug/quote`
Calculates dynamic quote for selected dates and guest count.
- **Request Body**:
```json
{
  "checkIn": "2026-10-25",
  "checkOut": "2026-10-28",
  "guests": 2
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "nightly": 2400,
    "nights": 3,
    "roomTotal": 7200,
    "cleaning": 900,
    "tax": 972,
    "total": 9072,
    "deposit": 4536
  }
}
```

### `POST /rooms`
Creates a new room unit (Owner-Side).
- **Request Body**: Room creation fields.
- **Response `201 Created`**: `{ "success": true, "data": { ...room } }`.

### `PATCH /rooms/:id`
Updates room rates, status, capacity, or details.
- **Response `200 OK`**: `{ "success": true, "data": { ...updatedRoom } }`.

### `POST /rooms/:id/holds`
Schedules a maintenance hold blackout window.
- **Request Body**: `{ "label": "Monsoon Proofing", "startDate": "2026-10-28", "endDate": "2026-10-30" }`.
- **Response `200 OK`**: `{ "success": true, "data": { ...roomWithHold } }`.

### `GET /rooms/availability/grid`
Returns interactive calendar matrix for specified window.
- **Query Params**: `startDate` (`YYYY-MM-DD`), `days` (`7` | `14` | `28`).
- **Response `200 OK`**: Array of rooms with occupied slots, maintenance holds, and open dates.

---

## 3. Bookings & Reservations

### `POST /reservations` (or `POST /bookings`)
Creates a new reservation from `client-side` checkout or `owner-side` booking desk.
- **Request Body**:
```json
{
  "stay": "ging-tea-cottage",
  "checkIn": "2026-10-25",
  "checkOut": "2026-10-28",
  "guests": 2,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+91 98765 43210",
  "arrivalWindow": "2:00 PM – 4:00 PM",
  "breakfasts": ["Full Hill Breakfast"],
  "paymentPlan": "card_full",
  "channel": "direct",
  "notes": "Prefers valley view room"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "reference": "MF-829103",
    "pin": "4921",
    "stayName": "Ging Tea Cottage",
    "staySlug": "ging-tea-cottage",
    "roomCode": "101",
    "guestName": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+91 98765 43210",
    "dates": "Oct 25 – Oct 28, 2026",
    "nights": 3,
    "guests": "2 Guests",
    "plan": "card_full",
    "settled": true,
    "dueToday": "₹9,072",
    "balance": "₹0",
    "total": "₹9,072",
    "cancellationBy": "October 18, 2026"
  }
}
```

### `GET /bookings`
Paginated bookings list for the owner.
- **Query Params**: `channel`, `status`, `startDate`, `endDate`, `search`.
- **Response `200 OK`**: Paginated array of bookings.

### `GET /bookings/:reference`
Get details of a specific reservation.

---

## 4. Guest Directory & CRM

### `GET /guests`
Fetches guest directory with filters.
- **Query Params**: `status` (`Everyone` | `In house` | `Arriving today` | `Departing today` | `Upcoming` | `Past stay`), `query`, `room`.
- **Response `200 OK`**: Array of `Guest` objects.

### `GET /guests/timeline`
Timeline arrivals, departures, and in-house counts by date.
- **Query Params**: `startDate`, `days`.
- **Response `200 OK`**: Daily breakdown.

### `PATCH /guests/:id`
Updates tags, VIP status, or notes for a guest.
- **Request Body**: `{ "tags": ["Anniversary", "Vegan"], "vip": true, "note": "..." }`.
- **Response `200 OK`**: `{ "success": true, "data": { ...guest } }`.

---

## 5. Cab Fleet, Drivers & Transfers

### `GET /cabs/places`
List 15 curated hill transfer pickup/drop locations with coordinates.
- **Response `200 OK`**: Array of `CabPlace`.

### `GET /drivers` (or `GET /cabs/drivers`)
List active roster of drivers with rating, vehicle, coverage, and seat capacity.
- **Query Params**: `seats` (`4` | `6` | `8`), `status` (`Active` | `On a trip` | `all`).
- **Response `200 OK`**: Array of `Driver`.

### `POST /cabs/quote`
Calculate distance, ETA, and fare per driver vehicle class between coordinates.
- **Request Body**:
```json
{
  "fromLat": 27.0178,
  "fromLng": 88.2351,
  "toLat": 26.6811,
  "toLng": 88.3392,
  "seats": "6"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "distanceKm": 48.2,
  "drivers": [
    {
      "id": "DRV-101",
      "name": "Dipu Tamang",
      "vehicle": "Toyota Innova Crysta",
      "plate": "WB 06 AB 4432",
      "rating": 4.9,
      "etaMinutes": 25,
      "fare": 3280,
      "commission": 590
    }
  ]
}
```

### `POST /cabs/bookings`
Book a cab transfer.
- **Request Body**: `{ driverId, pickup, dropoff, date, time, seats, guestName, email, phone }`.
- **Response `201 Created`**: Returns `{ reference: "CAB-...", voucher: { ... } }` and updates driver status.

### `POST /drivers`
Add a driver to the roster (Owner-Side).
- **Request Body**: `{ name, phone, email, vehicle, plate, coverage, status }`.
- **Response `201 Created`**: `{ "success": true, "data": { ...driver } }`.

### `PATCH /drivers/:id/status`
Updates driver status (`Active`, `On a trip`, `Invited`, `Paused`).
- **Response `200 OK`**: `{ "success": true, "data": { ...driver } }`.

---

## 6. Financial Analytics & Reporting

### `GET /analytics`
Computes all financial and operational metrics.
- **Query Params**: `range` (`today` | `week` | `fortnight` | `month` | `quarter` | `year`), `offset` (`number`).
- **Response `200 OK`**: Returns `AnalyticsKPIs` structure (KPI totals, comparative deltas, timeline charts, service breakdown, room performance).

### `GET /analytics/export`
Exports report as CSV attachment.
- **Response `200 OK`**: `Content-Type: text/csv`.

---

## 7. Auxiliary Endpoints

### `POST /newsletter/subscribe`
- **Request Body**: `{ "email": "traveller@example.com" }`.
- **Response `200 OK`**: `{ "success": true, "message": "Subscribed successfully" }`.

### `GET /health`
- **Response `200 OK`**: `{ "status": "ok", "uptime": 1234, "timestamp": "..." }`.
