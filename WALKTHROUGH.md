# Nakh Platform: Developer & QA Manual Walkthrough Guide

This document is a step-by-step, manual testing and verification guide for engineers, QA testers, and product reviewers. If you are new to the codebase, this guide explains exactly **what the application is**, **which URLs to open**, **what credentials to use**, **what to click**, and **what to expect on screen**.

---

## 📌 Context: What is Nakh?

**Nakh** is a 4-sided marketplace designed for hill tourism in Darjeeling and the Eastern Himalayas:
1. **Travelers (Guests)**: Can discover boutique hillside homestays, book rooms, and reserve door-to-door mountain cabs with upfront rupee fares.
2. **Homestay Hosts (Owners)**: Get a 100% free Property Management System (PMS) with an interactive 14-day tape chart calendar, room inventory manager, guest CRM, and fleet roster.
3. **Cab Drivers**: Receive point-to-point transit dispatches on their mobile terminal PWA, advance trip statuses, and take home 82% of fares while paying an 18% platform fee.
4. **Super Admin**: Monitors network-wide Gross Booking Volume (GBV), moderates homestay listings, and settles driver payouts via UPI.

---

## 🚦 Pre-Flight Check: Ensure Services are Running

Before you start manual testing, make sure all 5 services are running on their assigned ports:

| Service | Port | Local URL |
|:---|:---:|:---|
| **Central API Server** | `5050` | `http://localhost:5050/api/v1` |
| **Client Portal (Guest OTA)** | `3000` | `http://localhost:3000` |
| **Owner Portal (Host PMS)** | `3001` | `http://localhost:3001` |
| **Driver Portal (Terminal PWA)** | `3002` | `http://localhost:3002` |
| **Admin Portal (Control Tower)** | `3003` | `http://localhost:3003` |

> 💡 **Quick Port Check in Terminal**:
> ```bash
> lsof -nP -iTCP:5050 -iTCP:3000 -iTCP:3001 -iTCP:3002 -iTCP:3003 -sTCP:LISTEN
> ```
> If any service is missing, consult the [Quick Start section in README.md](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/README.md#-quick-start-run-locally).

---

## 👤 Walkthrough 1: Guest / Traveler Journey

**Target URL**: `http://localhost:3000`

### Step 1.1: Browse the Accommodations Catalog
1. Open your browser and navigate to `http://localhost:3000/`.
2. **What to observe**:
   - The sunlit editorial hero banner: *"Restful Stays in Darjeeling, West Bengal"*.
   - Filter pill tags (*All, Cottages, Tea Terraces, Lofts*).
   - Property cards (e.g. *Ging Tea Cottage*, *Tiger Hill View Suite*) showing verified nightly rates in ₹, capacity, and amenities.
   - Testimonials, estate values, and FAQ accordion at the bottom.

### Step 1.2: Inspect Stay Details
1. Click on **"Ging Tea Cottage"** or navigate directly to `http://localhost:3000/stays/ging-tea-cottage`.
2. **What to observe**:
   - High-resolution photo gallery carousel.
   - Amenities badges (*Bukhari Stove, Copper Bathtub, Tea Garden View*).
   - "Reserve Your Stay" pricing card on the right with dates and guest selector.

### Step 1.3: Complete a Room Reservation
1. Click **"Reserve This Stay"** or navigate to `http://localhost:3000/checkout?stay=ging-tea-cottage`.
2. **What to observe**:
   - The form fields (**First Name**, **Last Name**, **Email Address**, **Mobile Number**) start **completely empty** with clean placeholder hints.
3. **Fill the Form**:
   - First Name: `Rahul`
   - Last Name: `Mukherjee`
   - Email: `rahul.traveler@example.com`
   - Mobile: `+91 98300 12345`
   - Arrival Plans: Select any arrival window (e.g., *Morning 10:00 - 13:00*).
   - Hill Breakfast: Pick any breakfast option.
   - Payment Details:
     - Click the **"Fill test card"** button (or manually type Card Number `4242 4242 4242 4242`, Expiry `10 / 2028`, CVC `123`, Name `Rahul Mukherjee`).
   - Agreement: Check the checkbox: *"I have read and agree to the house rules..."*.
4. Click **"Confirm Reservation & Pay Securely"**.
5. **Expected Outcome**:
   - The screen transitions to a green confirmation voucher:
   - *"Your stay awaits, Rahul."*
   - Displays a unique booking reference (e.g. `MF-882163`) and a **4-digit digital door PIN** (e.g. `4192`).

### Step 1.4: Book a Point-to-Point Mountain Cab
1. In the header navigation, click **"Cab Booking"** or visit `http://localhost:3000/cab`.
2. **What to observe**:
   - Point-to-point location selector with pickup and dropoff points.
3. Select route:
   - Pickup: `Ging Tea Estate`
   - Dropoff: `Darjeeling Railway Station`
   - Date: Select today or tomorrow.
   - Time: `10:00 AM`
   - Seats: `4 Seater`
4. Click **"Find Available Drivers"**.
5. **Expected Outcome**:
   - Lands on `http://localhost:3000/cab/drivers`.
   - Lists verified estate drivers (e.g., *Sonam Lama*, *Pintu Rai*, *Tenzin Bhutia*) with car models, guest ratings, and upfront ₹ fares.
6. Click **"Book Driver"** on any driver card.
7. **Expected Outcome**:
   - Lands on `http://localhost:3000/cab/confirmed`.
   - Displays the official transfer voucher with driver photo badge, car number plate, and booking reference.

---

## 👤 Walkthrough 2: Homestay Owner / Host Journey

**Target URL**: `http://localhost:3001`

### Step 2.1: Host Authentication
1. Open `http://localhost:3001/login`.
2. **What to observe**:
   - Clean login screen with tabs: **Email/Password**, **Google**, and **OTP**.
   - Input fields for Email and Password are clean placeholders.
3. **Log in with the Showcase Demo Account**:
   - Email: `owner@estate.com`
   - Password: `estatePassword123!`
   - Click **"Sign In to Host Portal"** (or click the quick shortcut **"Explore Live Showcase Estate"**).
4. **Expected Outcome**:
   - Authenticates and redirects automatically to the **Analytics Dashboard** (`http://localhost:3001/analytics`).

### Step 2.2: Performance Analytics Dashboard (`/analytics`)
1. **What to observe**:
   - **Total revenue** tile (combining room earnings + cab transit commissions).
   - **Total guests** tile with revenue per guest calculation.
   - **Room revenue** & **Occupancy %** tiles.
   - **Average Daily Rate (ADR)** and **Cab Transfers** counter.
   - Period navigation bar (*7-day, 14-day, 28-day windows*) and "Export CSV" button.

### Step 2.3: Visual Availability Tape Chart (`/book`)
1. In the sidebar, click **"Book Rooms"** or visit `http://localhost:3001/book`.
2. **What to observe**:
   - A 14-day interactive availability calendar grid.
   - Room rows listed on the left (*Pine Valley Suite*, *Himalayan Ridge Loft*, etc.).
   - Date columns across the top with booked slots marked in green.
   - 3-step walk-in booking wizard (*Choose rooms ➔ Pick dates ➔ Guest & save*).

### Step 2.4: Estate Profile & Room Management (`/profile`)
1. In the sidebar, click **"Edit Profile"** or visit `http://localhost:3001/profile`.
2. Click on the **"Rooms"** tab.
3. **What to observe**:
   - Room inventory cards showing nightly rate, weekend surcharge, max capacity, bed label, and amenities.
4. Click the **"Add room"** button.
5. **Expected Outcome**:
   - The **"Add Room Unit"** modal opens smoothly.
   - Input fields display clear placeholder hints (`e.g. Garden Cottage`, `e.g. 2400`) rather than hardcoded mock strings.
6. Click **"Cancel"** to close the dialog.

### Step 2.5: Guest CRM Directory (`/guests`)
1. In the sidebar, click **"Guest Data"** or visit `http://localhost:3001/guests`.
2. **What to observe**:
   - The full guest directory table with columns for Guest Name, Room, Dates, Channel (*Direct Website, MakeMyTrip, Airbnb*), and Spend.
   - Status pills (*Checked in*, *Arriving*, *Completed*).
3. Test search: Type `Rai` or `Rahul` in the search bar.
4. **Expected Outcome**:
   - The guest table filters instantly in real time without refreshing the page.

### Step 2.6: Fleet Drivers Roster (`/drivers`)
1. In the sidebar, click **"Add Drivers"** or visit `http://localhost:3001/drivers`.
2. **What to observe**:
   - The driver fleet roster showing local estate drivers, vehicle plates, phone numbers, ratings, and total trips completed.
   - Prominent **"Add driver"** button to invite new local drivers.

### Step 2.7: Multi-Tenancy & Zero-State Verification (`/register`)
To verify that real/new hosts do **NOT** see demo data:
1. Log out or open an Incognito browser window to `http://localhost:3001/register`.
2. **What to observe**:
   - Clean registration form: *Host / Owner Full Name*, *Host Email*, *Mobile Number*, *Password*, *Homestay Location*.
   - All fields have empty defaults.
3. Fill in new host details:
   - Name: `Tenzin Norbu`
   - Email: `tenzin.host@testdarjeeling.in`
   - Password: `testPassword2026!`
   - Phone: `+91 98322 00112`
   - Homestay Name: `Kanchenjunga Vista Homestay`
   - Address: `Upper Lebong Road, Darjeeling`
4. Click **"Create Free Host Account"**.
5. **Expected Outcome**:
   - The new host logs in to a **true zero-state dashboard**:
   - **0 rooms**, **0 bookings**, **0 guests**, and **₹0 revenue**.
   - Demo data is 100% isolated and never leaks to new accounts.

---

## 👤 Walkthrough 3: Hill Cab Driver Journey

**Target URL**: `http://localhost:3002`

### Step 3.1: Driver Terminal Login
1. Open `http://localhost:3002/login` (recommended: use mobile viewport or responsive mode in DevTools).
2. **What to observe**:
   - The **Driver Terminal** card with clean phone and PIN inputs.
3. **Log in with Driver Credentials**:
   - Mobile: `+91 98300 41042`
   - 4-Digit PIN: `1234`
4. Click **"Sign In to Driver Terminal"**.
5. **Expected Outcome**:
   - Authenticates and redirects to `http://localhost:3002/`.

### Step 3.2: Duty Status & Live Dispatch Dashboard
1. **What to observe**:
   - Driver profile header: `Dipu Tamang` • `WB 06 AB 4432`.
   - **Duty & Dispatch Status Toggle** with 3 options:
     - 🟢 **Available**
     - 🟡 **On a Trip**
     - ⚫ **Offline**
2. Click **"On a Trip"**, then click **"Available"**.
   - Observe the live status pill updates immediately with smooth styling transitions.
3. **Inspect Earnings Metrics**:
   - **Gross Fare**: Total fare collected in cash/UPI from travelers.
   - **Net Payout (82%)**: Driver's take-home pay.
   - **Platform Fee (18%)**: Retained by the platform.
4. **Advance Assigned Trip Status**:
   - Under *"Today's Assigned Hill Trips"*, find an assigned trip card.
   - Notice the progression button: **"Mark En Route"**.
   - Click **"Mark En Route"** ➔ Status transitions to **En Route** (button changes to **"Mark Arrived"**).
   - Click **"Mark Arrived"** ➔ Status transitions to **Arrived** (button changes to **"Complete Trip"**).
   - Click **"Complete Trip"** ➔ Trip status updates to **Completed** and increments the completed counter.

---

## 👤 Walkthrough 4: Super Admin Control Tower Journey

**Target URL**: `http://localhost:3003`

### Step 4.1: Super Admin Login
1. Open `http://localhost:3003/login`.
2. **What to observe**:
   - Dark-mode **Control Tower Admin** login screen.
3. **Log in with Admin Credentials**:
   - Email: `admin@platform.com`
   - Password: `adminMasterPassword2026!`
4. Click **"Authenticate Administrator"**.
5. **Expected Outcome**:
   - Authenticates and lands on `http://localhost:3003/`.

### Step 4.2: Platform Overview & Global KPIs
1. **What to observe**:
   - **Gross Volume**: Total network spend across rooms and hill cabs in ₹.
   - **Platform Cut (18%)**: Net platform revenue earned.
   - **Pending Payouts**: Payouts awaiting founder/admin UPI settlement.
   - **Network Properties**: Active homestays across the network.
   - **Fleet Drivers**: Verified hill drivers.
   - Navigation tabs: **Driver Payout Settlement Desk** and **Homestay Property Verification Desk**.

### Step 4.3: Homestay Property Verification Desk
1. Click the **"Homestay Property Verification Desk"** tab.
2. **What to observe**:
   - List of all registered properties (*Gumtree Valley*, *Meadowfall*, etc.).
   - Host contact info (Owner name, email, phone).
   - Platform commission rate (18%).
   - Room unit counts and active status badges.

### Step 4.4: Driver Payout Settlement via UPI
1. Click the **"Driver Payout Settlement Desk"** tab.
2. **What to observe**:
   - The ledger of cab transfers showing Passenger, Driver, Total Fare, 18% Platform Cut, and 82% Driver Payout.
   - Pending trips display an amber **"Pending"** badge with an actionable **"Settle via UPI"** button.
3. Click **"Settle via UPI"** on any pending trip.
4. **Expected Outcome**:
   - The settlement modal opens with driver payout amount.
5. In the *Bank / UPI Transaction Reference ID* field, enter:
   - `UPI-HDFC-202610-998822`
6. Click **"Confirm Settlement"**.
7. **Expected Outcome**:
   - The modal closes, the pending trip transitions to a green **"Settled"** pill displaying the UPI reference ID, and the pending payout total automatically decrements.

---

## 🛠️ Developer FAQ & Troubleshooting

### Q1: What test card numbers can I use on checkout?
Use the standard test credit card:
- **Card Number**: `4242 4242 4242 4242`
- **Expiry**: `10 / 2028`
- **CVC**: `123`
- Or simply click the **"Fill test card"** button right above the card fields on the checkout page.

### Q2: What OTP should I use for SMS phone verification?
Any phone number verification flow accepts OTP `123456` in development/demo mode.

### Q3: What is the driver login PIN?
All seeded drivers use the 4-digit PIN `1234`.

### Q4: How do I re-run the automated Playwright browser test suite?
You can run the end-to-end Python Playwright suite anytime:
```bash
python3 /Users/tirtharaj/.gemini/antigravity-cli/brain/4e4ee3b5-721e-449d-84df-68d43e467a6f/scratch/test_ui_walkthrough.py
```
It tests all 4 portals in sequence and outputs 21 visual screenshots in `scratch/screenshots/`.

### Q5: How do I run the 60-point backend API audit?
Run the automated cURL script:
```bash
bash /Users/tirtharaj/.gemini/antigravity-cli/brain/4e4ee3b5-721e-449d-84df-68d43e467a6f/scratch/run_audit_curl_tests.sh
```
All 60 tests execute against the live API on port 5050 and report individual pass/fail results.
