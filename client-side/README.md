# Client Application Documentation (Guest OTA & Mountain Cabs)

> **Hill Hospitality & Transit Network — Guest Portal**  
> Runtime Port: `3000`  
> Local URL: `http://localhost:3000`  
> Architecture: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS

---

## 📑 Table of Contents
1. [Overview & User Journey](#-overview--user-journey)
2. [Route & Page Inventory](#-route--page-inventory)
3. [Component Hierarchy](#-component-hierarchy)
4. [Backend API Integration Touchpoints](#-backend-api-integration-touchpoints)
5. [Client State & Data Flow](#-client-state--data-flow)
6. [Environment Configuration & Running Locally](#-environment-configuration--running-locally)

---

## 🌟 Overview & User Journey

The Client Application is the public-facing guest portal for the platform. It provides travelers visiting Darjeeling and the Eastern Himalayas with an end-to-end booking experience:
1. **Discover Authentic Homestays**: Browse boutique estates, tea garden cottages, and cloud lofts with transparent pricing and real photos.
2. **Instant Room Reservation**: Quote rates in real-time, select check-in/check-out dates, apply add-ons, and confirm reservations with instant digital door PIN generation.
3. **Mountain Cab Transit Transfers**: Calculate fixed upfront fares between remote hill properties and transit hubs (Bagdogra Airport, NJP Railway Station, Tiger Hill) and select verified 4WD hill drivers.
4. **Seasonal Estate Dispatch**: Subscribe to seasonal harvest and festival newsletters.

---

## 🗺️ Route & Page Inventory

| Route | Page File | Purpose & User Experience |
|:---|:---|:---|
| `/` | `app/(site)/page.tsx` | **Main OTA Catalog**: Editorial hero banner, filter tags (*All, Cottages, Tea Terraces, Lofts*), live search bar, interactive stay card grid with pricing and amenities, and newsletter subscription footer. |
| `/stays/[slug]` | `app/(site)/stays/[slug]/page.tsx` | **Stay Deep Dive**: Full stay gallery, unit dimensions, view details, verified guest reviews, pet policy, and interactive booking card with dynamic night/tax calculation. |
| `/h/[slug]` | `app/(site)/h/[slug]/page.tsx` | **Direct Estate Vanity URL**: White-labeled direct link for homestay hosts to share with direct guests. Mirrors the stay page. |
| `/checkout` | `app/checkout/page.tsx` | **Reservation Checkout**: Review reservation dates, guest name, email, and phone number. Features payment simulator with test card button (`4242 4242 4242 4242`) and generates immediate confirmation voucher. |
| `/cab` | `app/cab/page.tsx` | **Mountain Cab Transit Portal**: Point-to-point transit fare calculator. Select pickup and dropoff destinations (airports, stations, estates), calculate upfront rupee fares, choose vehicle class (Bolero 4WD, Innova), and dispatch driver. |
| `/cab/drivers` | `app/cab/drivers/page.tsx` | **Fleet Roster**: Browse mountain drivers, vehicle models, star ratings, and passenger capacity. |
| `/cab/confirmed` | `app/cab/confirmed/page.tsx` | **Transit Confirmation Voucher**: Displays booked pickup time, driver contact, vehicle registration plate, and fixed rupee fare. |

---

## 🧩 Component Hierarchy

```
client-side/
├── components/
│   ├── site-header.tsx             # Global navigation bar with branding & quick cab transfer link
│   ├── site-footer.tsx             # Editorial footer with destination links & trust badges
│   ├── mobile-nav.tsx              # Bottom sheet navigation for mobile viewports
│   ├── stay-card.tsx               # Accommodation card with photo thumbnail, price, and badges
│   ├── stay-filters.tsx            # Category filter pills (Tea Gardens, Heritage, Lofts)
│   ├── stay-search.tsx             # Real-time search input filtering properties by name & location
│   ├── stay-gallery.tsx            # Multi-image photo grid with lightbox view
│   ├── booking-card.tsx            # Sticky desktop reservation box with date picker & price tally
│   ├── booking-controls.tsx        # Guest count selector and date inputs
│   ├── checkout-form.tsx           # Payment form with test card simulator & validation
│   ├── checkout-dates.tsx          # Summary card of selected check-in/out dates
│   ├── mobile-reserve-bar.tsx      # Sticky mobile bottom bar with reserve trigger button
│   ├── newsletter-form.tsx         # Async email input subscribing to estate letters
│   └── cab/
│       ├── cab-header.tsx          # Mountain cab brand header & route breadcrumbs
│       ├── cab-form.tsx            # Pickup/dropoff dropdowns & vehicle class selector
│       ├── location-picker.tsx     # Geographic transit hub dropdown (Bagdogra, NJP, Darjeeling)
│       ├── trip-summary.tsx        # Upfront fare summary, distance in km, and duration
│       ├── driver-card.tsx         # Driver identity card with vehicle plate & phone
│       ├── driver-search.tsx       # Live driver fleet browser
│       └── stay-transfer-section.tsx # Embedded transfer callout shown on stay pages
```

---

## 🔌 Backend API Integration Touchpoints

All client requests communicate with the central API server configured in `lib/api-config.ts`.

### 1. Catalog & Stay Details
- **Fetch Stays**: `GET /api/v1/stays?category={category}&petFriendly={bool}`
  - *Response*: `{ success: true, count: number, data: Room[] }`
- **Stay Detail**: `GET /api/v1/stays/:slug`
  - *Response*: `{ success: true, data: Room }`
- **Dynamic Pricing Quote**: `POST /api/v1/stays/:slug/quote`
  - *Request Body*:
    ```json
    { "checkIn": "2026-10-18", "checkOut": "2026-10-21", "guests": 2 }
    ```
  - *Response*:
    ```json
    { "success": true, "data": { "nights": 3, "roomTotal": 19500, "taxAmount": 2400, "grandTotal": 22400 } }
    ```

### 2. Guest Reservation & Checkout
- **Create Booking**: `POST /api/v1/reservations`
  - *Request Body*:
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
  - *Response*:
    ```json
    { "success": true, "data": { "reference": "BK-90412", "doorPin": "7291", "status": "confirmed" } }
    ```

### 3. Mountain Cab Transfers
- **Transit Hubs & Places**: `GET /api/v1/cabs/places`
  - *Response*: List of airports, rail stations, and estates with coordinates.
- **Upfront Fare Calculation**: `POST /api/v1/cabs/quote`
  - *Request Body*:
    ```json
    { "fromLat": 27.0512, "fromLng": 88.2618, "toLat": 26.6916, "toLng": 88.4419, "seats": 4 }
    ```
  - *Response*:
    ```json
    { "success": true, "distanceKm": 72.4, "durationMin": 185, "grossFare": 3200 }
    ```
- **Book Cab Dispatch**: `POST /api/v1/cabs/bookings`
  - *Request Body*:
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
  - *Response*: `{ success: true, data: CabTrip }`

### 4. Newsletter
- **Subscribe**: `POST /api/v1/newsletter/subscribe`
  - *Request Body*: `{ "email": "traveler@outlook.com" }`
  - *Response*: `{ "success": true, "message": "Subscribed to seasonal estate letters successfully" }`

---

## 💾 Client State & Data Flow

1. **URL-Driven Filters**: Filters and active stay queries update standard URL parameters (`?category=tea-gardens`), making links bookmarkable and shareable.
2. **Local Session Persistence**: In-flight booking data (selected dates, room code, guest preferences) is temporarily kept in browser storage during the checkout funnel to handle page refreshes seamlessly.
3. **Optimistic Updates**: Form submissions update local state instantly with interactive loading spinners and clear field validation feedback.

---

## ⚙️ Environment Configuration & Running Locally

### Setup & Launch
```bash
# In client-side/ directory:
npm install
npm run dev
```
Visit: `http://localhost:3000`

### Environment Variables (`client-side/.env.local`)
```ini
NEXT_PUBLIC_API_URL=http://localhost:5050/api/v1
```
