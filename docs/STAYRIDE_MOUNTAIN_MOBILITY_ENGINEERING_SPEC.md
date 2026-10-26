# StayRide Mountain Mobility & Cab Architecture: Engineering Specification
**Target Audience:** Backend, Frontend, and Mobile Development Teams  
**Domain Focus:** Mountain Transport (Darjeeling, Kalimpong, Kurseong, Mirik, Sikkim) & Homestay Hospitality  
**Document Version:** 2.0 (Production Blueprint)

---

## 1. Executive Summary & Core Mountain Principles

Mountain mobility operates under physical, geographic, and economic realities that break standard city rideshare models (Uber/Ola):
1. **Mountain Geography:** Driving down 75 km from Darjeeling (2,050m) to Bagdogra Airport (120m) takes 3.5 hours. Driving back uphill empty (*khali gaddi*) burns ₹1,400 in fuel. Hill drivers refuse downhill trips unless guaranteed a return passenger or paid round-trip rates.
2. **Zero-App Driver Reality:** Local mountain drivers frequently resist downloading heavy mobile apps onto budget Android devices. The system must operate seamlessly via **WhatsApp + lightweight Chrome Web portals** without requiring app installation, while offering free push notifications to drivers who do install the app.
3. **Zero-Trust Telemetry (No Background GPS):** Mountain drivers on WhatsApp do not broadcast continuous background GPS. Telemetry must be event-driven (Base Taxi Stand anchors + 1-time milestone browser GPS taps).
4. **Guest Privacy First (No Flight Numbers Required):** To protect guest privacy and avoid third-party flight API tracking dependencies, the system relies strictly on **Scheduled Arrival Date, Estimated Touchdown/Arrival Time (e.g. 12:45 PM), and Terminal Gate / Landmark Selection**, with a generous 60-minute baggage grace buffer.
5. **Economic Feasibility:** Meta WhatsApp Cloud API costs must be aggressively capped below **₹1.00 per completed booking** via 3-step waterfall batching, Push-first routing, and Utility template classification.

---

## 2. Driver Location & Telemetry Engine (Zero App, Zero Background GPS)

When a driver operates exclusively through WhatsApp and mobile web, background GPS tracking is impossible. The system resolves driver location through a **4-Tier Hybrid Telemetry Engine**:

```
[ Tier 1: Registered Base Stand ] ──► Permanent anchor on driver profile (Home Stand)
[ Tier 2: Milestone Web Ping    ] ──► Browser captures 1-time HTML5 GPS when driver taps buttons
[ Tier 3: Trajectory of Last Trip] ──► System knows driver's drop-off point from their previous trip
[ Tier 4: WhatsApp Pin Drop     ] ──► Driver sends native WhatsApp location pin to bot
```

### A. Tier 1: Registered Base Taxi Stand (Static Geographic Anchor)
- During driver verification/signup (`IUser` in `user.model.ts`), each driver is assigned a `homeStandLocation` with verified coordinates:
  - *Examples:* Darjeeling Club Stand (`27.0436, 88.2652`), Ghum Station Stand (`27.0112, 88.2570`), Kurseong Motor Stand (`26.8816, 88.2789`), Siliguri Junction (`26.7271, 88.4239`), Bagdogra Airport Taxi Hub (`26.6811, 88.3392`).
- If a driver's `location.updatedAt` is older than 60 minutes or null, `matchingDrivers()` calculates distance from their **Base Stand**, ensuring Siliguri drivers are not messaged for Darjeeling town trips.

### B. Tier 2: Milestone Browser Geolocation (HTML5 Web Tap-In)
- When a driver opens `driver-quote/page.tsx` from WhatsApp and interacts:
  - On tapping **"Submit Quote"**, **"En Route"**, or **"Arrived"**, the browser executes `navigator.geolocation.getCurrentPosition()`.
  - The latitude, longitude, and accuracy are sent in the API payload, updating `User.location` in MongoDB.
  - Zero background battery drain; works on intermittent 3G/4G mountain networks.

### C. Tier 3: Trajectory from Last Completed Drop
- When a driver completes an airport drop at Bagdogra, the server automatically updates their location to the destination coordinates (`lat: 26.6811, lng: 88.3392`), enabling immediate eligibility for uphill return matching.

### D. Tier 4: Native WhatsApp Location Sharing
- Drivers can tap 📎 $\rightarrow$ **Location** $\rightarrow$ **"Send Current Location"** on WhatsApp. The Meta Cloud API webhook delivers coordinates to `POST /webhooks/whatsapp`, updating the driver's position in real time.

---

## 3. Guest Location Resolution

1. **Guest at the Homestay (Sightseeing / Departure Drops):**
   - Automatically anchored to the homestay’s verified GPS coordinates stored in `tenantManager` and `Property.coordinates`.
   - The UI displays: *"Verified Stay — Driver navigates straight to homestay gate."*
2. **Guest Arriving (Airport / Railway Station Transfers):**
   - In `cab-request/page.tsx`, the guest selects one of 4 predefined arrival chips:
     - `+ Bagdogra Airport (IXB)` $\rightarrow$ `lat: 26.6811, lng: 88.3392`
     - `+ NJP Railway Station` $\rightarrow$ `lat: 26.6892, lng: 88.4242`
     - `+ Siliguri Junction` $\rightarrow$ `lat: 26.7271, lng: 88.4239`
     - `+ Darjeeling Mall / Chowrasta` $\rightarrow$ `lat: 27.0372, lng: 88.2689`
   - **Privacy Guard:** The guest simply enters their **Estimated Landing/Arrival Time** (e.g., 12:45 PM) and terminal note (e.g., "Terminal Gate 1, 3 bags"). No flight/train ticket numbers are requested.

---

## 4. The 4-Stage Guest Lifecycle & Integrated Driver Allocation

The system integrates **Homestay In-House Fleet Priority** and **Waterfall Bidding Auctions** throughout the guest journey:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: PRE-ARRIVAL TRANSFER (Day -7 to Day -1)                                       │
│ 1. Booking created in stayride-expo or synced via iCal.                                │
│ 2. Server detects checkIn > 24 hours away → Sends preArrivalTransferMessage via WA.    │
│ 3. Guest taps link → Chooses Bagdogra/NJP pickup, arrival time, SUV/Sedan.             │
│ 4. ALLOCATION CASCADE:                                                                 │
│    ├── Tier 1 (Host In-House Fleet): Host gets 2-minute priority to assign staff car.  │
│    └── Tier 2 (Waterfall Auction): Cascades to nearby mountain drivers if host skips.  │
│ 5. Winning quote selected → Guest pays ~10% advance via UPI → Status = CONFIRMED.      │
│ 6. Guest receives Driver Name, Car Plate, and 4-digit Boarding PIN (pickupOtp).        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: ARRIVAL DAY AT AIRPORT / STATION (Day 0)                                      │
│ 1. Driver stages at free holding area (Bihar More / Station Outer).                   │
│ 2. 60-Minute Grace Buffer: Accounts for baggage claim delays without penalizing guest. │
│ 3. Driver moves to Arrival Gate 1 when passenger exits terminal.                       │
│ 4. Guest enters car and shares 4-digit Boarding PIN (pickupOtp).                       │
│ 5. Driver inputs PIN on web portal → Trip transitions to TRIP_STARTED.                 │
│ 6. Drop at homestay gate → Guest pays ~90% remaining cash directly to driver.          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: HOMESTAY CHECK-IN & IN-STAY SIGHTSEEING (Day 1 – Day 3)                       │
│ 1. Host taps "Check In" on mobile app → Room status updates to OCCUPIED.               │
│ 2. Welcome Sightseeing WhatsApp sent to guest (Tiger Hill Sunrise, 7-Point Tour).      │
│ 3. Guest requests Tiger Hill (04:00 AM slot):                                          │
│    ├── Tier 1: Host In-House Fleet has default priority (5% platform fee).            │
│    └── Tier 2: Ridge Cluster Pool (8 km radius). 8:00 PM evening booking cutoff rule!  │
│ 4. Ride executed with Boarding PIN. Guest rates driver 1–5 stars on web portal.        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: CHECKOUT & DOWNHILL DEPARTURE DROP (Day 4)                                    │
│ 1. Guest selects "Bagdogra Airport Drop".                                              │
│ 2. 7-Hour Safety Formula: Enforces safe pickup time accounting for mountain traffic.   │
│ 3. Downhill trip starts → Driver tagged for "Uphill Return Load" matching.             │
│ 4. Host taps "Check Out" on app → Room returns to AVAILABLE.                           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Driver Allocation & Waterfall Bidding Engine

To eliminate high Meta WhatsApp costs while ensuring rapid turnaround, dispatch follows a strict **3-Step Waterfall**:

```
                  Guest submits Cab Request (Fixed Base or Bidding)
                                        ↓
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: Homestay Host In-House Priority (First 2 Minutes)                              │
│ • Host's app receives high-priority notification:                                       │
│   "Guest Pooja needs Bagdogra drop. Assign your in-house vehicle?"                      │
│ • Host taps [Assign My Driver Ramesh] OR [Release to Mountain Pool]                     │
└────────────────────────────────────────┬────────────────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┴──────────────────────────────┐
        ▼                                                               ▼
[Host Assigns In-House Driver]                              [Host Releases or 2-Min Timeout]
• 100% fulfillment guarantee                                • Cascades to Mountain Pool
• Platform fee: 5% (min ₹100)                                           ↓
• Meta Cost: ₹0.00                                          ┌───────────────────────────────────┐
                                                            │ STAGE 2: Waterfall Pool Bidding   │
                                                            │ (Total Window: 5 Minutes)         │
                                                            └─────────────────┬─────────────────┘
                                                                              │
                                      ┌───────────────────────────────────────┴────────────────────────┐
                                      ▼                                                                ▼
                         [App Drivers (100% FREE)]                                        [WhatsApp Drivers (PAID)]
                         • FCM Push to ALL active app drivers                             • Batch 1 (0–2m): Top 3 closest
                         • 60-second headstart to claim/quote                             • Batch 2 (2–5m): Next 3–4 closest
                         • Drives organic app downloads!                                  • Meta cost capped at < ₹2.50
                                                                                                       ↓
                                                                                      (If 0 quotes after 5 minutes)
                                                                                                       ↓
                                                            ┌──────────────────────────────────────────────────┐
                                                            │ STAGE 3: Active Fallback & Escalation            │
                                                            │ • Push/WA alert to Homestay Host                 │
                                                            │ • WA alert to partner Taxi Syndicate Desk        │
                                                            │ • Guest informed honestly (charged ₹0.00)        │
                                                            └──────────────────────────────────────────────────┘
```

### Automated Auction Resolution:
- At Minute 5, `autoSelectLowestQuotes()` sorts pending bids:
  1. **Lowest Quoted Fare** wins.
  2. If fares are tied: **Highest Driver Star Rating** wins.
  3. If ratings are tied: **Earliest Submission Timestamp** wins.
- Winning quote transitions to `AWAITING_ADVANCE_PAYMENT`. Razorpay UPI link dispatched to guest.

---

## 6. The "Uphill Return Load" Matchmaking Engine

**The Problem:** Hill drivers dropping tourists at Bagdogra/NJP face an empty 75 km drive back uphill (*khali gaddi*), burning ₹1,400 in fuel.

**The Solution:**
1. When Driver Karma starts a downhill drop to Bagdogra with an estimated arrival of 11:30 AM, the server registers an availability slot:  
   `{ driverId: Karma, hub: 'BAGDOGRA_IXB', readyTime: 11:45 AM, destinationRidge: 'DARJEELING' }`.
2. The system scans incoming guest arrivals landing at Bagdogra between 12:00 PM and 2:00 PM heading towards Darjeeling.
3. Karma receives an **exclusive 15-minute priority WhatsApp offer**:
   > *"Karma, you reach Bagdogra at 11:30 AM. Uphill booking available: Guest Rahul landing at 12:45 PM for Singalila Retreat. Return Fare: ₹2,400 cash. Tap here to accept before open bidding: [Link]"*
4. **Economics:**
   - **Guest:** Saves ₹1,100 (pays ₹2,400 instead of ₹3,500 prepaid counter rates).
   - **Driver:** Grosses ₹5,400 cash for the day on one tank of fuel.
   - **StayRide:** Collects advance commissions on both legs of the journey.
   - **Deadhead waste:** **0 km**.

---

## 7. Meta WhatsApp Cost Optimization Architecture

To maintain total WhatsApp charges below **₹1.00 per completed booking**:

1. **Strict UTILITY Template Classification:**
   - Register all templates (`ASK_CAB`, `NEW_REQUEST`, `QUOTE_ACCEPTED_GUEST`, `ADVANCE_PAID_GUEST`, `ADVANCE_PAID_DRIVER`) under Meta's **Utility** category.
   - In India, Utility conversations are billed at **~₹0.12 per 24-hour window** (vs. ~₹0.85 for Marketing).
2. **Push-First Routing:** All drivers with active Expo push tokens receive free Firebase notifications (₹0.00). WhatsApp is sent only to drivers without the app, capped at 3 per batch.
3. **Web Portal Offload:** All quote viewing, counter-offering, Razorpay payment, Boarding PIN generation, and driver rating happen over HTTPS on Next.js (₹0.00).

### Lifecycle Meta Balance Sheet:
| Action | Channel | Meta Category | Cost (INR) |
| :--- | :--- | :--- | :--- |
| Pre-Arrival Invite (Day -7) | WhatsApp | Utility | **₹0.12** |
| Push to App Drivers | FCM Push | System | **₹0.00** |
| WhatsApp to Batch 1 Drivers | WhatsApp (Top 3) | Utility | **₹0.36** |
| Driver Bidding on Chrome | Web App | HTTPS | **₹0.00** |
| Razorpay UPI Payment | Web App | HTTPS | **₹0.00** |
| Confirmation + Boarding PIN | WhatsApp | Utility | **₹0.12** |
| Driver Trip Assignment | WhatsApp | Utility | **₹0.12** |
| Boarding PIN Handshake & Rating | Web App | HTTPS | **₹0.00** |
| **TOTAL METAFEES PER COMPLETED BOOKING** | — | — | **₹0.72** |

---

## 8. Implementation Roadmap & Engineering Time Estimates

The system already has ~80% of its foundational code in place (`DEFAULT_ROUTE_PRESETS`, Razorpay webhook handling, `cab-request.model.ts`, and `driver-quote/page.tsx`). 

Here is the realistic engineering breakdown to deliver the complete specification:

| Phase | Tasks & Deliverables | Target Files | Estimated Time |
| :--- | :--- | :--- | :--- |
| **Phase 1: Location & Distance Alignment** | • Fix `matchingDrivers()` to calculate distance from `doc.pickupLocation` (fallback to `doc.homestayLocation`).<br>• Add `homeStandLocation` field to driver schema.<br>• Add 1-time `navigator.geolocation` snapshot on quote button in `driver-quote/page.tsx`. | `server/src/stayride/platform.ts`<br>`server/src/models/user.model.ts`<br>`client-side/app/driver-quote/page.tsx` | **2 to 3 Days** |
| **Phase 2: Waterfall Batch Dispatcher** | • Implement `waterfall` tracking subdocument in `CabRequestSchema`.<br>• Replace simultaneous 25-driver broadcast with 3-driver Batch 1 + Batch 2 cascade.<br>• Add 1-minute serverless cron trigger in `vercel.json` for reliable execution. | `server/src/stayride/platform.ts`<br>`server/src/models/cab-request.model.ts`<br>`server/vercel.json` | **3 to 4 Days** |
| **Phase 3: Host Priority & Sightseeing Gate** | • Implement 2-minute Homestay Host priority gate before open marketplace dispatch.<br>• Implement 8:00 PM cutoff rule for next-day 03:30 AM Tiger Hill sunrise requests.<br>• Add 7-Hour Departure Formula recommendation on checkout drop screen. | `server/src/stayride/platform.ts`<br>`client-side/app/cab-request/page.tsx`<br>`stayride-expo/src/screens/FindDriverScreen.tsx` | **2 to 3 Days** |
| **Phase 4: Return-Leg Matching Engine** | • Add `findDownhillReturnDrivers()` query matching arriving tourists with descending airport drop drivers.<br>• Send 15-minute exclusive return-trip offers via WhatsApp to returning drivers. | `server/src/stayride/platform.ts`<br>`server/src/stayride/messages.ts` | **3 to 4 Days** |
| **Phase 5: Meta Utility Template Registration & QA** | • Submit updated message templates to Meta WhatsApp Cloud API under Utility category.<br>• End-to-end integration testing: Room booking $\rightarrow$ Pre-arrival WA $\rightarrow$ Quote $\rightarrow$ Razorpay UPI $\rightarrow$ PIN Boarding $\rightarrow$ Completion. | `server/src/services/whatsapp.service.ts`<br>`server/scripts/test-cab-flow.ts` | **2 Days** |
| **TOTAL ESTIMATED EFFORT** | **Full End-to-End Implementation & Testing** | **All Subsystems** | **12 to 16 Working Days (approx. 2.5 to 3 Weeks)** |

---

## 9. Summary for Developers

1. **Do not reinvent the core architecture:** The schemas (`CabRequest`, `User`, `GuestLink`), financial snapshot logic, and Razorpay webhook handlers are already rock solid.
2. **Focus on the dispatch rules:** The main upgrades are changing the distance calculation anchor point from the homestay to the pickup spot, batching WhatsApp alerts in groups of 3, and giving returning drivers first access to airport pickups.
3. **Respect mountain realities:** Always preserve the 60-minute airport baggage buffer, enforce the 8:00 PM Tiger Hill cutoff, and never charge the guest before a driver is locked into the booking.
