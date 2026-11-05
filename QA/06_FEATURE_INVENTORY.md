# StayCabs Comprehensive Feature Matrix & Surface Inventory

**Document ID:** `QA/06_FEATURE_INVENTORY`  
**Revision Date:** 2026-11-06  
**Auditor:** Feature Analyst & Product Engineer (Agent 2 & Agent 9)  

---

## 1. Feature Availability Matrix by Surface

| Feature / Capability | Guest Web (`client-side`) | Driver Web (`/driver-quote`) | Host App (`stayride-expo`) | Driver App (`stayride-expo`) | Admin Portal (`admin-side`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Mountain Route Autocomplete** | YES | - | YES | - | - |
| **Multi-Destination Route Builder** | YES | - | YES | - | - |
| **Round-Trip Scheduling** | YES | - | YES | - | - |
| **Vehicle Category Selection** | YES | - | YES | YES (Profile) | YES (Filter) |
| **Target Guest Budget Option** | YES | - | YES | - | - |
| **Guest Web Link Invitation** | YES (Consume) | - | YES (Generate) | - | YES (Inspect) |
| **Driver Registration & KYC** | - | - | - | - | YES (Approve) |
| **Blind Fare Bidding** | - | YES | - | YES | - |
| **Counter-Offer Negotiation** | - | YES | YES | YES | - |
| **Online Advance Deposit** | YES (Razorpay) | - | - | - | YES (Record) |
| **UPI QR & Manual UTR Claim** | YES | - | - | - | YES (Verify) |
| **4-Digit Boarding PIN (OTP)** | YES (Receive) | YES (Verify) | YES (View) | YES (Verify) | YES (Audit) |
| **Cash-in-Hand Balance Collection**| YES (Pay) | YES (Collect) | - | YES (Collect) | - |
| **No-PIN Completion Arbitration** | - | - | - | - | YES |
| **Sovereign Wallet Earnings** | - | YES | - | YES | YES (Inspect) |
| **Driver UPI / Bank Withdrawal**| - | YES | - | YES | YES (Settle) |
| **Host Commission Withdrawal** | - | - | YES | - | YES (Settle) |
| **Own-Fleet Direct Dispatch** | - | - | YES | - | YES |
| **iCal External Calendar Sync** | - | - | YES | - | - |
| **Driver 5-Star Rating & Review**| YES | - | YES | - | YES (Audit) |
| **Meta WhatsApp Alerts** | YES | YES | YES | YES | YES |
| **Live Driver GPS Location Ping**| - | YES | - | YES | YES (Map) |
| **Account Deletion Self-Service** | YES | - | YES | YES | YES |
| **Compliance Audit Trail** | - | - | - | - | YES |

---

## 2. Granular Surface Breakdown

### 1. Guest Web Experience (`client-side/app/cab-request`)
- **Route Planning Engine**: Google Places autocomplete integration for hill stations (Darjeeling, Kalimpong, Gangtok, Siliguri, Bagdogra).
- **Desktop/Mobile Responsive Layout**: 2-column widescreen view with sticky quote summary; fluid single-column mobile view with bottom bar.
- **Trip Classifications**: Point-to-point one-way, multi-stop scenic routes, round-trips with dedicated return departure schedules.
- **Transparent Payment Split**: Instant display of advance deposit required vs remaining cash payable to the driver at destination.
- **Real-Time Request Tracker**: Polling engine showing active driver bidding count, selected driver status, vehicle plate, and driver contact card.
- **Secure Boarding Pass**: Dynamically generated pass displaying 4-digit PIN upon successful advance confirmation.

### 2. Web Driver Interface (`client-side/app/driver-quote`)
- **Frictionless Web Access**: No mandatory app installation required; drivers access directly from Meta WhatsApp alert links.
- **Blind Quoting Form**: Input field for proposed fare with instant validation against min/max fare bounds.
- **Counter-Offer Card**: Highlights host counter-offers with one-tap accept or decline.
- **Trip Start Passcode Pad**: Numeric PIN input field with remaining attempts indicator.
- **Sovereign Wallet Card**: Live view of accumulated `driverShareOfAdvance` balance and one-tap UPI payout request button.

### 3. Driver Onboarding Portal (`client-side/app/join-driver`)
- **Two-Step Progressive Flow**:
  - Step 1: Personal profile, phone number, operational hill region.
  - Step 2: Vehicle category (Sedan, SUV, 7-seater, 9-seater), model name, registration plate, union syndicate affiliation.
- **Honest Value Proposition**: Zero fake earning claims; clear focus on genuine hill passenger demand, sovereign wallet, and zero hidden platform cuts.
- **Security & Bot Defense**: Protected by Google reCAPTCHA v3 and strict IP rate limiters.

### 4. Homestay Host Mobile App (`stayride-expo`)
- **Room Inventory & Calendar**: Visual room occupancy grid, booking management, and bi-directional iCal feed synchronization.
- **Guest Transit Dispatch**: One-tap guest link generator to text guests cab request passes before arrival.
- **Driver Quote Arbitration**: Host reviews quotes submitted by local drivers, selects winner, or submits counter-offers.
- **Own-Fleet Operations**: Option to assign trips to the host's private vehicles, bypassing open driver bidding with discounted platform fee.
- **Referral Commission Wallet**: Live dashboard of accumulated guest ride referral commissions.

### 5. Administrative Control Portal (`admin-side`)
- **Overview Dashboard**: High-level telemetry on completed trips, platform commission revenue, and pending payout queues.
- **Driver KYC Management**: Review submitted registration documents, approve driver accounts to `ACTIVE`, or suspend compromised accounts.
- **Payment Reconciliation**: Review guest UPI claims, match bank transaction UTRs, and record manual advance payments.
- **Dispute Resolution**: Arbitrate trips completed without PIN, investigate passenger no-shows, and issue refunds.
- **Automated Payout Settlement**: Review host and driver withdrawal requests, verify UPI addresses, and record bank settlement references.
