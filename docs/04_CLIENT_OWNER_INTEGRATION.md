# 04 - Client & Owner Integration Bridge

This guide details how `client-side` and `owner-side` transition from local/mock data to live communication with the backend server running at `http://localhost:5000/api/v1`.

---

## 1. Environment Configurations

### Client-Side (`/client-side/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

### Owner-Side (`/owner-side/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

---

## 2. Shared API Client Adapter Pattern

Both frontends can utilize a lightweight fetch helper that automatically targets `NEXT_PUBLIC_API_URL`:

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `API error ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data ?? result;
}
```

---

## 3. Client-Side Integration Points

### A. Accommodations Catalog (`client-side/lib/stays.ts`)
- Replace static `stays` array with `apiFetch<Stay[]>("/stays")`.
- `getStay(slug)` delegates to `apiFetch<Stay>(`/stays/${slug}`)`.

### B. Checkout Server Action (`client-side/app/checkout/actions.ts`)
- The `confirmReservation` server action submits the reservation directly to:
  ```typescript
  const response = await fetch(`${API_BASE}/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stay: text(formData, "stay"),
      checkIn: text(formData, "checkIn"),
      checkOut: text(formData, "checkOut"),
      guests: text(formData, "guests"),
      firstName,
      lastName,
      email,
      phone,
      arrivalWindow,
      breakfasts,
      paymentPlan,
    }),
  });
  ```
- Receives the canonical `reference` code, door `pin`, and total pricing directly from the server.
- **Immediate Outcome**: This booking is instantly created in the backend database and shows up on the Owner-Side!

### C. Cab Transfers (`client-side/lib/cabs.ts`)
- Places list fetched from `GET /cabs/places`.
- Driver lookup and fare calculation calls `POST /cabs/quote`.
- Driver reservation commits to `POST /cabs/bookings`.

---

## 4. Owner-Side Integration Points

### A. Estate Provider Store Bridge (`owner-side/components/estate-provider.tsx`)
Currently, `EstateProvider` initializes from `localStorage` using `createPersistedStore`.
We provide a seamless hybrid or direct async hook:
1. On initial mount, `EstateProvider` fetches live data from:
   - `GET /properties/profile` -> loads profile & locations
   - `GET /rooms` -> loads room inventory
   - `GET /drivers` -> loads cab drivers
   - `GET /bookings` -> loads bookings
2. Mutations call the backend API:
   - `addRoom()` -> `POST /rooms`
   - `updateRoom()` -> `PATCH /rooms/:id`
   - `addDriver()` -> `POST /drivers`
   - `updateDriverStatus()` -> `PATCH /drivers/:id/status`
   - `createBooking()` -> `POST /bookings`
3. Fallback: If the backend is temporarily unreachable, it can gracefully fall back to localStorage/seed data with an offline notification.

### B. Calendar Availability Grid (`owner-side/app/book`)
- Fetches `GET /rooms/availability/grid?startDate=...&days=14`.
- Any booking created on the client-side appears directly as an occupied cell in the calendar.

### C. Guest CRM (`owner-side/app/guests`)
- `GET /guests` supplies the full table.
- `PATCH /guests/:id` updates tags/VIP status directly to the backend.

### D. Operations Analytics (`owner-side/app/analytics`)
- `GET /analytics?range=...&offset=...` replaces PRNG client calculations with actual aggregated server numbers from real room and cab bookings!

---

## 5. End-to-End Live Sync Verification Walkthrough

1. Start backend server:
   ```bash
   cd server && npm run dev
   # Runs on http://localhost:5000
   ```
2. Start owner-side:
   ```bash
   cd owner-side && npm run dev -- -p 3001
   # Runs on http://localhost:3001
   ```
3. Start client-side:
   ```bash
   cd client-side && npm run dev -- -p 3000
   # Runs on http://localhost:3000
   ```
4. **Action**: Open `client-side` in browser and complete a booking for "Ging Tea Cottage".
5. **Observation**: Open `owner-side` at `http://localhost:3001`.
   - Go to `/book`: Ging Tea Cottage is marked booked on those dates.
   - Go to `/guests`: The guest appears in "Upcoming" / "Arriving" with contact info and room code.
   - Go to `/analytics`: Gross revenue and room nights increment immediately!
