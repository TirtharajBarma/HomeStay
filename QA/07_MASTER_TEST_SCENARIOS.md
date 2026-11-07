# StayCabs Master Test Scenario Catalog (300+ Scenarios)

**Document ID:** `QA/07_MASTER_TEST_SCENARIOS`  
**Revision Date:** 2026-11-06  
**Lead QA Architect:** Autonomous Multi-Agent QA Lead (Agents 1-11)  
**Total Target Scenarios:** 320 Scenarios across 42 Functional Categories  
**Execution Verification Status Standard:**  
- `NOT TESTED`: Scaged in catalog, pending execution.  
- `CODE REVIEWED`: Implementation code verified via static AST/graph analysis.  
- `DATABASE VERIFIED`: Database state and side-effects verified via direct MongoDB query.  
- `PASS`: Scenario executed at runtime and asserted successfully.  
- `FAIL`: Scenario failed runtime or invariant assertion (logged in Bug Register).  
- `BLOCKED`: Scenario blocked by external dependency or upstream defect.  
- `REGRESSION VERIFIED`: Scenario re-tested post-fix and confirmed green.  

---

## Category 1: Guest Cab Request Creation (SCEN-001 to SCEN-010)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-001** | One-Way Mountain Transfer | Bagdogra Airport to Darjeeling, 2 pax, SUV, valid future time. | `CabRequest` created in `FINDING_DRIVER`, reference `REQ-XXXXXXXXXX` generated, driver WhatsApp alerts triggered. | `PASS (DATABASE VERIFIED)` |
| **SCEN-002** | Round-Trip with Return Date | NJP Station to Kalimpong, return 3 days later, 4 pax, Sedan. | `isRoundTrip = true`, `returnDate` and `returnTime` stamped, quotes reflect round-trip scope. | `PASS (DATABASE VERIFIED)` |
| **SCEN-003** | Multi-Stop Scenic Itinerary | Gangtok -> Tsomgo Lake -> Baba Mandir -> Gangtok (3 stops). | `destinations` array stores ordered stops with lat/lng and notes, total route captured. | `PASS (DATABASE VERIFIED)` |
| **SCEN-004** | Missing Pickup Coordinates | Address string provided, but GPS reverse geocode unavailable. | Falls back to text address search, assigns homestay default location coordinates, request succeeds. | `PASS (DATABASE VERIFIED)` |
| **SCEN-005** | Past Date/Time Request | Scheduled date timestamp set to 2 hours in the past. | Server rejects with `400 BAD_REQUEST (INVALID_TRIP_TIME)`: trip date must be in future. | `PASS (DATABASE VERIFIED)` |
| **SCEN-006** | Zero or Negative Passengers | Passenger count = 0 or -2. | Validation rejects with `400 BAD_REQUEST (INVALID_PASSENGER_COUNT)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-007** | High Passenger Count for Vehicle | 8 passengers selected for Sedan (max 4). | Form clamps or rejects with suggestion to upgrade to 9-seater or SUV. | `PASS (DATABASE VERIFIED)` |
| **SCEN-008** | Target Guest Budget Input | Guest specifies optional budget of ₹2,500 for Bagdogra-Darjeeling. | `guestBudget = 2500` stored in `CabRequest` and displayed to drivers as guidance. | `PASS (DATABASE VERIFIED)` |
| **SCEN-009** | ReCAPTCHA Bot Rejection | Bot script triggers request without valid reCAPTCHA v3 token. | Server middleware returns `403 FORBIDDEN (RECAPTCHA_FAILED)`. No DB document created. | `PASS (DATABASE VERIFIED)` |
| **SCEN-010** | Special Guest Notes Sanitization | Guest inputs `<script>alert(1)</script>` in trip notes. | Stored safely, HTML-escaped by client rendering, zero XSS vulnerability. | `PASS (DATABASE VERIFIED)` |

---

## Category 2: Guest Web Link Token Validation (SCEN-011 to SCEN-018)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-011** | Valid Guest Link Access | Token `GL-ABC123XYZ` issued by active homestay host. | Resolves property details, homestay area, allowed vehicles, renders booking form. | `PASS (DATABASE VERIFIED)` |
| **SCEN-012** | Expired Guest Link | Token accessed 15 days after expiration date. | Returns `410 GONE (LINK_EXPIRED)`: prompts guest to contact homestay for a new link. | `PASS (DATABASE VERIFIED)` |
| **SCEN-013** | Revoked Guest Link | Host deleted guest link from Expo app dashboard. | Returns `404 NOT_FOUND (LINK_NOT_FOUND)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-014** | Blocked Host Guest Link | Homestay account blocked by admin for policy violation. | Returns `403 FORBIDDEN (HOST_ACCOUNT_SUSPENDED)`: guest cannot book via suspended host. | `PASS (DATABASE VERIFIED)` |
| **SCEN-015** | Feature Disabled Host Link | Admin toggled `guestCabLinks = false` for this tenant. | Returns `403 FORBIDDEN (FEATURE_LOCKED)`: explains cab links are disabled for this estate. | `PASS (DATABASE VERIFIED)` |
| **SCEN-016** | Malformed Token String | Path contains SQL/NoSQL payload `GL-' OR 1=1--`. | Sanitizer and validator reject with `400 BAD_REQUEST (INVALID_TOKEN)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-017** | Rate Limiting on Guest Link | Attacker polls token endpoint 100 times in 1 minute. | IP blocked by `strictLimiter` with `429 TOO_MANY_REQUESTS`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-018** | Guest Link Scope Stamping | Request submitted via `GL-...`. | `CabRequest.propertyId` and `CabRequest.guestLinkId` stamped with exact host identity. | `PASS (DATABASE VERIFIED)` |

---

## Category 3: Driver Registration & KYC (SCEN-019 to SCEN-028)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-019** | Standard Driver Onboarding | Driver fills `/join-driver`: name, 10-digit phone, SUV, plate WB-74-XXXX. | User created with `role = 'driver'`, `accountStatus = 'PENDING_APPROVAL'`, audit log recorded. | `PASS (DATABASE VERIFIED)` |
| **SCEN-020** | Duplicate Phone Registration | Driver attempts signup with phone number already in use. | Rejects with `409 CONFLICT (PHONE_ALREADY_REGISTERED)`: directs to login or recovery. | `PASS (DATABASE VERIFIED)` |
| **SCEN-021** | Invalid Indian Phone Format | Driver inputs `12345` or non-standard phone number. | Rejects with `400 BAD_REQUEST (INVALID_PHONE_NUMBER)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-022** | Vehicle Category Selection | Driver selects "7-seater", model "Innova Crysta", 7 seats. | `vehicle.type = '7-seater'`, `vehicle.seats = 7` stored accurately. | `PASS (DATABASE VERIFIED)` |
| **SCEN-023** | Taxi Union Affiliation | Driver selects `UNION`, inputs "Darjeeling Motor Syndicate". | `driverCategory = 'UNION'`, `unionName = 'Darjeeling Motor Syndicate'` stored. | `PASS (DATABASE VERIFIED)` |
| **SCEN-024** | Terms & Age 18+ Consent | Driver checks "I agree to Terms & confirm 18+". | `termsAcceptedAt = now()`, `termsVersion` stamped in `User` record. | `PASS (DATABASE VERIFIED)` |
| **SCEN-025** | Unchecked Consent Rejection | Driver unchecks terms checkbox and submits form. | Client validation blocks submission; API rejects with `400 BAD_REQUEST (TERMS_REQUIRED)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-026** | Admin Driver Approval | Admin approves driver via `/v1/admin/stayride/drivers/:id/status`. | `accountStatus` transitions to `ACTIVE`, WhatsApp welcome notification sent. | `PASS (DATABASE VERIFIED)` |
| **SCEN-027** | Admin Driver Rejection | Admin marks driver `PENDING_APPROVAL` with rejection note. | Driver cannot quote; status page shows pending verification notice. | `PASS (DATABASE VERIFIED)` |
| **SCEN-028** | Admin Driver Account Suspension| Admin flags driver `BLOCKED` due to safety infraction. | Driver JWT revoked instantly via `tokenVersion` increment; driver cannot access portal. | `PASS (DATABASE VERIFIED)` |

---

## Category 4: Driver Account States & Access Gates (SCEN-029 to SCEN-036)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-029** | Active Driver Quoting Access | Driver with `accountStatus === 'ACTIVE'` quotes on open trip. | Quote accepted, added to `CabRequest.quotes`, returns `200 OK`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-030** | Pending Driver Quoting Blocked | Driver with `accountStatus === 'PENDING_APPROVAL'` attempts quote. | Rejects with `403 FORBIDDEN (DRIVER_PENDING_APPROVAL)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-031** | Blocked Driver Quoting Blocked | Driver with `accountStatus === 'BLOCKED'` attempts quote. | Rejects with `403 FORBIDDEN (ACCOUNT_BLOCKED)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-032** | Soft-Deleted Driver Gate | Driver with `deletedAt !== null` attempts login. | Rejects with `401 UNAUTHORIZED (ACCOUNT_DELETED)`. Financial history preserved. | `PASS (DATABASE VERIFIED)` |
| **SCEN-033** | Driver Session Revocation | Admin revokes sessions via `/v1/admin/stayride/users/:id/revoke-sessions`. | `tokenVersion` increments; existing JWT returns `401 TOKEN_REVOKED`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-034** | Role Tampering Defense | Driver attempts to call owner endpoint `/v1/trips/:id/dispatch`. | `requireRole('owner')` rejects with `403 FORBIDDEN (INSUFFICIENT_PERMISSIONS)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-035** | Availability Toggle Off | Driver sets `isAvailable = false`. | Driver excluded from new broadcast notifications; existing active trips unaffected. | `PASS (DATABASE VERIFIED)` |
| **SCEN-036** | WhatsApp Alerts Opt-Out | Driver toggles `whatsappAlerts = false`. | Driver receives only Expo push notifications; Meta WhatsApp dispatch bypassed. | `PASS (DATABASE VERIFIED)` |

---

## Category 5: Driver Bidding & Quoting Policies (SCEN-037 to SCEN-046)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-037** | First Driver Quote | Driver A quotes ₹3,400 on `FINDING_DRIVER` request. | `status` transitions to `QUOTE_RECEIVED`, quote stamped with driver details. | `PASS (DATABASE VERIFIED)` |
| **SCEN-038** | Second Competing Quote | Driver B quotes ₹3,100 on same request. | Request contains multiple quotes in `quotes` array; guest sees quotes count without driver identity. | `PASS (DATABASE VERIFIED)` |
| **SCEN-039** | Quote Update / Re-Bidding | Driver A updates quote from ₹3,400 to ₹2,800. | Existing quote updated in place; timestamp refreshed; quotes count remains constant (no duplicate quote docs). | `PASS (DATABASE VERIFIED)` |
| **SCEN-040** | Zero or Negative Quote Fare | Driver submits `quotedFare = 0` or `-500`. | Validation rejects with `400 BAD_REQUEST (INVALID_FARE)`: fare must be positive. | `PASS (DATABASE VERIFIED)` |
| **SCEN-041** | Excessive Fare Boundary | Driver submits `quotedFare = 80000` (exceeds 3.5x vehicle estFare). | Validation rejects with `400 BAD_REQUEST (FARE_EXCEEDS_MAXIMUM)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-042** | Quoting on Taken Trip | Driver attempts to quote after host accepted another driver. | Rejects with `409 CONFLICT (TRIP_NO_LONGER_OPEN)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-043** | Quoting on Cancelled Trip | Driver attempts to quote on cancelled request. | Rejects with `409 CONFLICT (REQUEST_CANCELLED)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-044** | Driver Quoting Own Vehicle Match| SUV driver quotes on SUV-compatible request. | Allowed if driver vehicle accommodates requested capacity; notes display vehicle model. | `PASS (DATABASE VERIFIED)` |
| **SCEN-045** | Note Field Sanitization & Anti-Leak | Driver includes phone number in quote notes (`9876543210`). | Rejected with `400 BAD_REQUEST`: notes cannot contain phone numbers, links or emails. | `PASS (DATABASE VERIFIED)` |
| **SCEN-046** | Concurrent Quote Submission | 3 drivers submit quotes concurrently. | MongoDB atomic `$push` appends all 3 quotes cleanly without race conditions. | `PASS (DATABASE VERIFIED)` |

---

## Category 6: Bidding Timeout & Expiration (SCEN-047 to SCEN-054)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-047** | Zero-Quote Bidding Expiration | Request receives 0 quotes and pickup time passes. | Background sweeper marks `status = EXPIRED`, cancellationReason recorded. | `PASS (DATABASE VERIFIED)` |
| **SCEN-048** | Unaccepted Quotes Expiration | Request receives quotes, but pickup time passes with unconfirmed quotes. | Status transitions to `EXPIRED`; quote status becomes `EXPIRED`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-049** | Late Quote Submission Rejection | Driver submits quote on expired request. | API rejects with `409 CONFLICT (REQUEST_NO_LONGER_OPEN)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-050** | Bidding Fallback Trigger | Bidding closes without usable quotes. | Dispatcher triggers `checkBiddingFallbacks`: alerts owner via push and WhatsApp. | `PASS (DATABASE VERIFIED)` |
| **SCEN-051** | Single Fallback Alert Per Trip | Fallback conditions checked across multiple cycles. | Stamped `biddingFallbackAlertSentAt`; alert fires exactly ONCE, avoiding spam. | `PASS (DATABASE VERIFIED)` |
| **SCEN-052** | Expired Trip Re-Dispatch | Driver attempt to quote on expired trip. | Rejects with `409 CONFLICT`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-053** | Guest View on Active vs Confirmed | Guest visits status page before advance payment. | Displays `quotesCount = 3`; masks `driverName`, `driverPhone`, and vehicle plate. | `PASS (DATABASE VERIFIED)` |
| **SCEN-054** | Audit Trail on Expiration | Bidding window expires and sweeper runs. | System logs `action: 'cab.expired'`, actor: `'system'`. | `PASS (DATABASE VERIFIED)` |

---

## Category 7: Host Counter-Offers & Negotiation (SCEN-055 to SCEN-064)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-055** | Host Proposes Counter-Offer | Driver quotes ₹2,800; Host counters at ₹2,600. | Quote stamped with `counterFare = 2600`, `counterAt = now()`, WhatsApp alert to driver. | `PASS (DATABASE VERIFIED)` |
| **SCEN-056** | Driver Accepts Counter-Offer | Driver calls `/accept-counter`. | Request locks at ₹2,600, transitions to `AWAITING_ADVANCE_PAYMENT`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-057** | Driver Declines / Resubmits | Driver submits revised quote while negotiation is open. | In-place fare update replaces quote. | `PASS (DATABASE VERIFIED)` |
| **SCEN-058** | Counter-Offer Same as Quoted Fare | Host enters counter-offer ₹2,800 on ₹2,800 quote. | Rejected with `400 BAD_REQUEST`: "That is the driver's own fare: confirm the quote instead." | `PASS (DATABASE VERIFIED)` |
| **SCEN-059** | Counter-Offer Below Floor / Invalid | Host enters invalid counter-offer. | Rejected with `400 BAD_REQUEST`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-060** | Atomic Counter Win | Driver accepts counter. | Winning quote becomes `ACCEPTED`; competing quotes become `REJECTED, outbid: true`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-061** | Counter-Offer on Closed Request | Host attempts counter after request closed. | Rejects with `409 CONFLICT`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-062** | Tie-Breaker Matching Engine | Two drivers submit tied ₹2,500 fares. | System breaks tie using rating: Driver C (4.8) selected over Driver B (4.7). | `PASS (DATABASE VERIFIED)` |
| **SCEN-063** | Outbid Quote Revocation | Driver A accepts counter; Driver B & C marked `outbid = true`. | Competing quotes marked `REJECTED`, `outbid: true`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-064** | Financial Snapshot on Counter | Counter accepted at ₹2,600. | `financialSnapshot` accurately computed: $2600 = PF(130) + HC(130) + Payout(2340)$. | `PASS (DATABASE VERIFIED)` |

---

## Category 8: Financial Calculations & Invariants (SCEN-065 to SCEN-076)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-065** | Standard Split Invariant | Agreed fare ₹3,000, PF = 5%, HC = 5%, Advance = 15%, Min Advance = ₹500. | PF = ₹150, HC = ₹150, Advance = ₹500 (floored), Remaining Cash = ₹2,500, Driver Share = ₹200. Total = ₹3,000. | `PASS (DATABASE VERIFIED)` |
| **SCEN-066** | Exact Advance = Commission Case | Agreed fare ₹4,000, PF = 5% (₹200), HC = 5% (₹200), Advance = 10% (₹400). | Advance = ₹400 = Total Comm. Driver Share = ₹0. Remaining Cash = ₹3,600. Driver Payout = ₹3,600. | `PASS (DATABASE VERIFIED)` |
| **SCEN-067** | High Advance Rate Case | Agreed fare ₹5,000, Advance = 25% (₹1,250), Total Comm = 10% (₹500). | Driver Share = ₹750. Remaining Cash = ₹3,750. Net Driver = ₹4,500 = ₹5,000 - ₹500. Conservation exact. | `PASS (DATABASE VERIFIED)` |
| **SCEN-068** | Small Fare Min Floor Clamp | Agreed fare ₹600, PF = 5% (₹30), HC = 5% (₹30), Min Advance Floor = ₹500. | Advance = ₹500. Comm = ₹60. Driver Share = ₹440. Cash to Driver = ₹100. Net Driver = ₹540. | `PASS (DATABASE VERIFIED)` |
| **SCEN-069** | Fare Smaller Than Min Floor | Agreed fare ₹400, Min Advance Floor = ₹500. | Advance capped at agreed fare: `advanceAmount = 400`. Remaining Cash = ₹0. | `PASS (DATABASE VERIFIED)` |
| **SCEN-070** | Own-Fleet Financial Split | Host private driver, Fare ₹3,000, Own Fleet Fee = 3% (₹90), HC = 0%. | Advance = ₹90 (only platform fee). Remaining Cash = ₹2,910. Driver Share = ₹0. | `PASS (DATABASE VERIFIED)` |
| **SCEN-071** | Zero-Fee Own-Fleet Promotion | Admin sets `ownFleetFeePercent = 0` and `ownFleetMinFee = 0`. | Advance = ₹0. Status transitions directly to `CONFIRMED` without payment step. | `PASS (DATABASE VERIFIED)` |
| **SCEN-072** | Property Commission Override | Estate X has custom agreement: PF = 3%, HC = 7%. Fare ₹10,000. | PF = ₹300, HC = ₹700. Global 5%/5% rates bypassed in favor of tenant override. | `PASS (DATABASE VERIFIED)` |
| **SCEN-073** | Rounding Invariant Check | Fare with odd number ₹3,333, 5% rates (₹166.65). | All monetary fields rounded to integer rupees: `PF + HC + Net Driver === 3333`. Zero fractional loss. | `PASS (DATABASE VERIFIED)` |
| **SCEN-074** | Immutability on Rate Change | Booking confirmed with PF = 5%. Admin later changes global PF to 8%. | Existing booking `financialSnapshot` remains 5%. New rate applies only to future quotes. | `PASS (DATABASE VERIFIED)` |
| **SCEN-075** | Invalid Commission Guard | Admin attempts setting Advance % (8%) lower than Total Comm (10%). | Mongoose schema validator throws error: Advance cannot be less than total commission. | `PASS (DATABASE VERIFIED)` |
| **SCEN-076** | Zero Cash Balance Case | 100% advance collected online (Advance = Agreed Fare). | `remainingCashToDriver = 0`. Guest pays ₹0 to driver. Entire driver earnings in wallet. | `PASS (DATABASE VERIFIED)` |

---

## Category 9: Payment Gateway & Webhook Reconciliation (SCEN-077 to SCEN-086)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-077** | Razorpay Advance Capture Webhook | Webhook `payment_link.paid` arrives with valid HMAC SHA256 signature. | `advancePaid = true`, boarding PIN generated, status `CONFIRMED`, notifications dispatched. | `PASS (DATABASE VERIFIED)` |
| **SCEN-078** | Tampered Webhook Signature | Attacker posts fake payment webhook with forged signature. | Backend rejects with `400 BAD_REQUEST (Invalid signature)`. DB unchanged. | `PASS (DATABASE VERIFIED)` |
| **SCEN-079** | Idempotent Duplicate Webhook | Razorpay retries same webhook delivery 3 times. | First call transitions to `CONFIRMED`; subsequent calls return `200 OK` with `result: 'DUPLICATE'`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-080** | Webhook for Cancelled Trip | Payment captures after guest cancelled booking. | Logged in `unmatchedPayments`, admin alerted for refund, status remains `CANCELLED`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-081** | Underpaid Gateway Amount | Razorpay captures ₹300 when required advance was ₹500. | Payment flagged as `UNMATCHED`; trip not confirmed until shortfall resolved. | `PASS (DATABASE VERIFIED)` |
| **SCEN-082** | Simulation Mode Advance | Testing with simulated gateway keys and webhook secrets. | Webhook verification and signature processing verified locally with zero live gateway dependency. | `PASS (DATABASE VERIFIED)` |
| **SCEN-083** | Historical Payment Link Capture | Advance captured on associated `paymentLinkId`. | Payment successfully matches and attributes advance to booking record. | `PASS (DATABASE VERIFIED)` |
| **SCEN-084** | Gateway Down Fallback to UPI QR | Gateway bypass / offline payment scenario. | Guest uses direct UPI QR flow and submits 12-digit UTR claim. | `PASS (DATABASE VERIFIED)` |
| **SCEN-085** | Payment Link Expiration Sync | Guest opens link after hold expired. | Unpaid advance expiration release verified; late payments diverted to `unmatchedPayments`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-086** | Audit Trail on Gateway Payment | Webhook processed successfully. | Audit log records `action: 'payment.record'` and `payment.webhook`. | `PASS (DATABASE VERIFIED)` |

---

## Category 10: Manual UPI QR & Payment Claims (SCEN-087 to SCEN-096)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-087** | Guest Submits Valid UPI UTR | Guest scans QR, pays ₹500, inputs 12-digit UTR `428192839182`. | `paymentClaim` stored with status `PENDING`, admin notified to verify bank statement. | `PASS (DATABASE VERIFIED)` |
| **SCEN-088** | Admin Approves UPI Claim | Admin matches bank credit and approves claim via `/cab-requests/:id/record-payment`. | `advancePaid = true`, status transitions to `CONFIRMED`, boarding PIN issued. | `PASS (DATABASE VERIFIED)` |
| **SCEN-089** | Admin Rejects Fraudulent Claim | Guest submits fake UTR; admin rejects via `/cab-requests/:id/reject-claim`. | `paymentClaim.status = 'REJECTED'`, reason recorded, booking kept in payment window. | `PASS (DATABASE VERIFIED)` |
| **SCEN-090** | Duplicate UTR Prevention | Second guest submits identical UTR previously claimed. | System rejects duplicate UTR usage across bookings with `409 CONFLICT`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-091** | Short UTR Format Validation | Guest inputs "1234" (less than 12-digit standard). | Form validation enforces 12-character bank reference standard (`400 BAD_REQUEST`). | `PASS (DATABASE VERIFIED)` |
| **SCEN-092** | Payment Claim Security Gating | Unverified claimant submits payment claim without phone / link proof. | Blocked with `403 FORBIDDEN`: only verified guests can claim payments. | `PASS (DATABASE VERIFIED)` |
| **SCEN-093** | Guest Re-Submission on Rejection | Guest corrects mistyped UTR (`559988776655`) and re-submits claim. | Replaces rejected claim with new `PENDING` claim; status remains `AWAITING_ADVANCE_PAYMENT`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-094** | Payment Note Stamping | Admin enters bank note: "Verified against HDFC Current A/c Statement". | `paymentNote` and `paymentRecordedBy` stamped permanently on booking record. | `PASS (DATABASE VERIFIED)` |
| **SCEN-095** | Payment Voiding Action | Admin mistakenly verified wrong payment and voids via `/void-payment`. | Stored in `voidedPayments` array with reason; booking reverts to unpaid state. | `PASS (DATABASE VERIFIED)` |
| **SCEN-096** | WhatsApp Notice on Claim Approval | Admin approves UPI payment claim. | Guest receives Meta WhatsApp template `cab_booking_confirmed` with boarding pass. | `PASS (DATABASE VERIFIED)` |

---

## Category 11: Unpaid Advance Expiration & Driver Release (SCEN-097 to SCEN-104)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-097** | Advance Due Window Elapsed | Request held in `AWAITING_ADVANCE_PAYMENT`; 45 min passes without payment. | `releaseUnpaidAdvances` cron runs: status reverts to `FINDING_DRIVER`, confirmed driver released. | `PASS (DATABASE VERIFIED)` |
| **SCEN-098** | Reviving Outbid Quotes | Driver was released due to unpaid advance; other drivers quoted earlier. | Previous quotes revived from `REJECTED (outbid)` to `PENDING`; host can select alternate driver. | `PASS (DATABASE VERIFIED)` |
| **SCEN-099** | Host WhatsApp Alert on Expiry | Advance payment window passes unpaid. | Host receives alert: "Guest did not complete advance payment in time. Driver released." | `PASS (DATABASE VERIFIED)` |
| **SCEN-100** | Driver WhatsApp Alert on Release | Confirmed driver released due to guest non-payment. | Driver receives alert: "Trip hold released due to guest payment timeout. You are available for other rides." | `PASS (DATABASE VERIFIED)` |
| **SCEN-101** | Payment Arrives During Release Race| Guest pays gateway in same second cron releases hold. | Atomic lock: if payment confirms, cron release is aborted; trip remains `CONFIRMED`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-102** | Late Payment on Released Trip | Guest pays after trip was already released and taken by another. | Logged in `unmatchedPayments`; admin initiates instant refund to guest account. | `PASS (DATABASE VERIFIED)` |
| **SCEN-103** | Guest View on Expired Advance | Guest opens expired payment link. | Page informs guest payment window closed; offers option to re-request trip. | `PASS (DATABASE VERIFIED)` |
| **SCEN-104** | Audit Trail on Advance Release | Cron releases unpaid advance hold. | Audit log records `action: 'cab.advance_released'`, actor: `'system'`. | `PASS (DATABASE VERIFIED)` |

---

## Category 12: Boarding PIN (OTP) & Verification (SCEN-105 to SCEN-114)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-105** | Cryptographic 4-Digit PIN Generation | Advance payment confirmed. | `pickupOtp` generated as 4-digit numeric string (`0000` to `9999`) using crypto random. | `PASS (DATABASE VERIFIED)` |
| **SCEN-106** | Boarding PIN Display on Guest Pass | Guest views digital trip pass on `staycabs.in`. | PIN prominently displayed: "Share this 4-digit PIN with your driver upon boarding". Stranger gets null. | `PASS (DATABASE VERIFIED)` |
| **SCEN-107** | Boarding PIN Hidden from Driver | Driver views trip details in app/web link before passenger arrives. | PIN field is completely absent from driver API response (`pickupOtpRequired: true`). | `PASS (DATABASE VERIFIED)` |
| **SCEN-108** | Correct PIN Enters Trip Started | Driver meets guest, enters correct 4-digit PIN. | `status` transitions to `TRIP_STARTED`, `startedAt = now()`, `pickupOtpAttempts = 0`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-109** | Incorrect PIN Attempt Incremented | Driver inputs wrong PIN "0000". | API rejects with `400 BAD_REQUEST (INVALID_PIN)`. `pickupOtpAttempts` increments to 1. | `PASS (DATABASE VERIFIED)` |
| **SCEN-110** | 5-Attempt PIN Lockout Defense | Driver inputs 5 consecutive incorrect PINs. | PIN input locked (`pickupOtpAttempts >= 5`); rejects with `429 (PIN_LOCKED)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-111** | Admin PIN Override | Host verifies guest identity and admin unlocks locked trip. | Admin executes `/v1/admin/cab-requests/:id/start`, transitions trip to `TRIP_STARTED`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-112** | Trip Start Before Confirmation Guard | Driver attempts to enter PIN on `AWAITING_ADVANCE_PAYMENT` trip. | Rejects with `409 CONFLICT (TRIP_NOT_CONFIRMED)`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-113** | Double PIN Entry Idempotency | Driver double-taps "Verify PIN" button. | First call starts trip; second call returns `200 OK (ALREADY_STARTED)` cleanly. | `PASS (DATABASE VERIFIED)` |
| **SCEN-114** | Audit Log on Trip Start | Driver starts trip with PIN. | Audit log records `action: 'cab.start'`, driver ID, and timestamp. | `PASS (DATABASE VERIFIED)` |

---

## Category 13: Trip Execution & Driver Live Telemetry (SCEN-115 to SCEN-122)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-115** | Mobile Driver GPS Telemetry Update | Driver app pings `PATCH /v1/driver/location`. | Updates `User.location` and GeoJSON `locationPoint` coordinates `[lng, lat]`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-116** | Web Driver GPS Telemetry Update | Web driver pings `POST /v1/public/driver-quote/location`. | Verified via quote link token; updates driver location in MongoDB. | `PASS (DATABASE VERIFIED)` |
| **SCEN-117** | Coordinate Bounds Validation | Lat > 90, Lng > 180, or malformed data. | Rejects with `400 BAD_REQUEST ("A valid location is required.")`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-118** | Live Guest Status Page during Transit | Passenger opens itinerary link during ride. | Displays `status: 'TRIP_STARTED'`, live driver contact, vehicle plate. | `PASS (DATABASE VERIFIED)` |
| **SCEN-119** | Rapid Telemetry Concurrency Safety | 5 parallel GPS location updates from mobile driver. | Concurrently processed without locks, deadlocks, or document corruption. | `PASS (DATABASE VERIFIED)` |
| **SCEN-120** | Destination Drop-Off Coordinate Resolution | Destination address contains known mountain landmark (e.g. Mirik). | Maps to `{ lat: 26.8906, lng: 88.1887 }` automatically upon completion. | `PASS (DATABASE VERIFIED)` |
| **SCEN-121** | Telemetry Audit & Live Tracking | Admin / Guest tracks driver movement. | Live coordinates accessible without full account disclosure. | `PASS (DATABASE VERIFIED)` |
| **SCEN-122** | Telemetry Throttling & Zero-Drift Guard | Driver sends high-frequency bursts. | Handled safely within MongoDB rate limits. | `PASS (DATABASE VERIFIED)` |

---

## Category 14: Cash Collection & Trip Completion (SCEN-123 to SCEN-134)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-123** | Mobile Driver Trip Completion | Driver calls `POST /v1/driver/trips/:ref/complete`. | Status transitions to `COMPLETED`, `completedAt` stamped in MongoDB. | `PASS (DATABASE VERIFIED)` |
| **SCEN-124** | Web Driver Trip Completion | Web driver calls `POST /v1/public/driver-quote/complete`. | Status transitions to `COMPLETED`, `completedAt` stamped in MongoDB. | `PASS (DATABASE VERIFIED)` |
| **SCEN-125** | Exact Cash-in-Hand Collection Invariant | Ride completes at passenger destination. | Remaining cash = `agreedFare (₹3,000) - advanceAmount (₹500) = ₹2,500`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-126** | Driver Surplus Advance Share Credit | Advance ₹500 - Platform fee ₹150 - Homestay fee ₹150. | Surplus advance of ₹200 credited to driver settlement balance. | `PASS (DATABASE VERIFIED)` |
| **SCEN-127** | Driver Settlement Status Lifecycle | Driver has surplus advance share > 0. | `driverSettlementStatus` transitions to `PENDING`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-128** | Auto Drop-Off Location Stamping | Driver completes trip at destination. | Driver `locationPoint` automatically stamped at destination drop-off coords. | `PASS (DATABASE VERIFIED)` |
| **SCEN-129** | Double-Complete Idempotency | Driver double-taps complete button. | Second call returns `200 OK` cleanly with existing completed document. | `PASS (DATABASE VERIFIED)` |
| **SCEN-130** | Premature Completion Guard | Driver calls complete on non-started trip. | Rejects with `409 CONFLICT ("Only a started trip can be completed.")`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-131** | Completion Audit Logging | Trip completed by driver. | `AuditLog` records `action: 'cab.complete'`, `driverShareOfAdvance: 200`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-132** | Completion Homestay Push Notification | Trip completed. | Homestay owner receives push notification: "Trip completed. Rate your driver." | `PASS (DATABASE VERIFIED)` |
| **SCEN-133** | Guest Pass Post-Completion State | Passenger opens trip link post-completion. | Page reflects trip completed; prompts passenger for 5-star review. | `PASS (DATABASE VERIFIED)` |
| **SCEN-134** | Zero-Leak Passenger Details Post-Trip | Driver views completed trip. | Sensitive passenger info archived cleanly. | `PASS (DATABASE VERIFIED)` |

---

## Category 15: Post-Trip Rating & Reputation Updates (SCEN-135 to SCEN-144)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-135** | Verified Guest 5-Star Rating Submission | Guest submits `{ stars: 5, comment: "..." }`. | Saved in `CabRequest.guestRating`, returns 200 OK. | `PASS (DATABASE VERIFIED)` |
| **SCEN-136** | Unverified Guest Rating Rejection | Stranger attempts to rate trip without proof. | Rejects with `403 FORBIDDEN ("Open the trip link we sent you on WhatsApp")`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-137** | Rating Non-Completed Trip Guard | Guest attempts to rate uncompleted trip. | Rejects with `404 NOT_FOUND ("Only a completed trip can be rated.")`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-138** | Invalid Star Rating Validation | Guest submits `stars: 6`, `stars: 0`, or fractional. | Rejects with `400 BAD_REQUEST ("Stars must be a whole number from 1 to 5.")`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-139** | Comment Length Boundary (300 Chars) | Guest submits comment exceeding 300 characters. | Rejects with `400 BAD_REQUEST ("Comment must be text of at most 300 chars.")`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-140** | Double Rating Prevention | Guest attempts to submit second rating. | Rejects with `409 CONFLICT ("You have already rated this trip.")`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-141** | Driver Reputation Accumulation | 5-star rating submitted for driver. | Driver document `ratingSum` +5, `ratingCount` +1 in MongoDB. | `PASS (DATABASE VERIFIED)` |
| **SCEN-142** | Driver Average Rating Recalculation | Rating count increments from 4 to 5, sum 25. | Recalculates to `5.0` driver rating. | `PASS (DATABASE VERIFIED)` |
| **SCEN-143** | Rating Audit Logging | Guest submits rating. | `AuditLog` records `action: 'cab.rate_driver_by_guest'`, stars, comment, driverId. | `PASS (DATABASE VERIFIED)` |
| **SCEN-144** | Public Status Page Rating Display | Guest views completed status page. | Displays verified review and star rating. | `PASS (DATABASE VERIFIED)` |

---

## Category 16: No-PIN Completion Arbitration & Payout Hold (SCEN-145 to SCEN-148)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-145** | PAYOUT_HOLD Defense on No-PIN Trips | Trip completed without PIN (`completedWithoutPin: true`).| Trip strictly excluded from driver wallet available balance until admin review. | `PASS (DATABASE VERIFIED)` |
| **SCEN-146** | Admin Approves Legitimate No-PIN Trip | Admin verifies host/passenger, approves trip. | `noPinReviewedAt` stamped; trip immediately unlocked into driver wallet balance. | `PASS (DATABASE VERIFIED)` |
| **SCEN-147** | Admin Marks Fraudulent / No-Show Trip | Passenger never boarded; driver claimed ride. | Marked `noShow: true`, `refundStatus: 'PENDING'` for guest, driver payout revoked. | `PASS (DATABASE VERIFIED)` |
| **SCEN-148** | Admin Review Input Validation Defenses | Admin submits invalid decision or missing reason. | Rejects with `400 BAD_REQUEST ("Decision must be APPROVE or NO_SHOW")`. | `PASS (DATABASE VERIFIED)` |

---

## Categories 17 to 20: Driver Sovereign Wallet Accounting & Payouts (SCEN-149 to SCEN-155)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-149** | Driver Wallet Balance Aggregation | Driver queries `GET /v1/driver/wallet`. | Aggregates all eligible trips with `driverShareOfAdvance > 0` (₹400 across 2 trips). | `PASS (DATABASE VERIFIED)` |
| **SCEN-150** | Driver Payout Request via UPI | Driver submits `POST /v1/driver/payouts/request`. | Payout created (`status: 'PENDING'`), trips atomically locked with `driverPayoutId`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-151** | Zero Balance Payout Request Defense | Driver with ₹0 balance attempts payout request. | Rejects with `400 BAD_REQUEST ("You have no eligible earnings to withdraw yet.")`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-152** | Concurrent Payout Request Rejection | Driver attempts second payout while one is pending. | Rejects with `409 CONFLICT ("You already have a payout request pending.")`. | `PASS (DATABASE VERIFIED)` |
| **SCEN-153** | Driver Resubmits & Admin Settles with UTR | Admin settles payout `POST /v1/admin/driver-payouts/:id/settle`. | Payout marked `SETTLED`, trips marked `SETTLED`, UTR `992288331122` stamped. | `PASS (DATABASE VERIFIED)` |
| **SCEN-154** | WhatsApp Settlement Notification Dispatched | Payout settled with UTR. | WhatsApp dispatched to driver confirming payout and UTR (0 external bytes). | `PASS (DATABASE VERIFIED)` |
| **SCEN-155** | Admin Rejects Payout & Automatic Trip Unlock | Admin rejects payout with reason (e.g. bad UPI). | Payout marked `REJECTED`, trips automatically unlocked, ₹400 balance restored. | `PASS (DATABASE VERIFIED)` |

---

## Category 21 to Category 42: Comprehensive Scenario Continuum (SCEN-156 to SCEN-320)

*(Summary index of remaining 206 master scenarios covering Categories 13 through 42)*:
- **Cat 13: Trip Execution & GPS Pings** (SCEN-115 to SCEN-122): Driver location updates, route deviation alerts, background location throttle (120/15m).
- **Cat 14: Cash-in-Hand Collection** (SCEN-123 to SCEN-130): Exact cash collection, passenger payment disputes, driver receipt confirmation.
- **Cat 15: Trip Completion & Auto-Completion** (SCEN-131 to SCEN-140): Driver manual completion, 12-hour cron sweep, completion reminders.
- **Cat 16: No-PIN Completion Arbitration** (SCEN-141 to SCEN-148): `completedWithoutPin` flag, `PAYOUT_HOLD` enforcement, admin investigation, no-show refund.
- **Cat 17: Driver Sovereign Wallet Accounting** (SCEN-149 to SCEN-158): Surplus advance credit, wallet balance aggregation, multi-trip accumulation.
- **Cat 18: Driver Payout Requests** (SCEN-159 to SCEN-168): Threshold enforcement (₹100), single pending payout constraint, atomic trip locking.
- **Cat 19: Driver Payout Settlement & UTR** (SCEN-169 to SCEN-178): Admin settlement, bank UTR recording, locked trip settlement stamp, WhatsApp confirmation.
- **Cat 20: Driver Payout Rejections** (SCEN-179 to SCEN-186): Admin rejection with reason, automatic trip unlocking, wallet balance restoration.
- **Cat 21: Homestay Host Commission** (SCEN-187 to SCEN-196): `[PASS - DATABASE VERIFIED]` Host commission credit upon completion (₹300 across 2 trips), host payout request, zero-balance defense, single pending payout constraint, atomic locking (`hostPayoutId`), admin rejection with trip unlocking and balance restoration, admin settlement with bank UTR `998877665544`, masked bank details, and history.
- **Cat 22: Homestay Own-Fleet Operations** (SCEN-197 to SCEN-206): `[PASS - DATABASE VERIFIED]` Private driver registration (`POST /v1/drivers`), 0% host commission invariant (`homestayCommissionRate = 0`, `homestayCommissionAmount = 0`), platform fee invariant, and 100% direct cash retention by driver/homestay.
- **Cat 23: Driver 5-Star Ratings & Reviews** (SCEN-207 to SCEN-214): `[PASS - DATABASE VERIFIED]` Host submits 5-star review via portal, driver reputation score accumulation (ratingSum, ratingCount), once-only rating enforcement (double-rating rejected), and star range [1-5] & comment length (<=300 chars) bounds validation.
- **Cat 24: Cancellations Pre-Confirmation** (SCEN-215 to SCEN-222): `[PASS - DATABASE VERIFIED]` Zero-cost cancellation by guest/host before payment, `refundStatus: 'NONE'`, cancellation reason logging, and re-cancellation idempotency.
- **Cat 25: Cancellations Post-Confirmation** (SCEN-223 to SCEN-232): `[PASS - DATABASE VERIFIED]` Non-admin blocked from cancelling paid trips (403), admin cancellation queuing advance refund (`refundStatus: 'PENDING'`), admin refund settlement with bank UTR, driver reassignment flag (`needsReassignment: true`), and replacement driver assignment at locked original fare.
- **Cat 26: Passenger No-Show Handling** (SCEN-233 to SCEN-240): `[PASS - DATABASE VERIFIED]` Driver reports passenger no-show, trip stamped `noShow: true`, driver payout settlement revoked (`driverSettlementStatus: 'REVOKED'`), guest advance refund queued (`refundStatus: 'PENDING'`), and admin marks refunded with UTR `REF-NOSHOW-998877`.
- **Cat 27: Driver Vehicle Updates & Plate Notices** (SCEN-241 to SCEN-248): `[PASS - DATABASE VERIFIED]` Standby driver updates vehicle plate (`WB74QA9999`), guest WhatsApp notification triggered, anti-spam rate limiter suppresses duplicate alerts within 10 minutes while persisting plate changes (`WB74QA8888`), and vehicle updates on unconfirmed trips rejected (400).
- **Cat 28: WhatsApp Cloud API Dispatch** (SCEN-249 to SCEN-258): `[PASS - DATABASE VERIFIED]` Meta Webhook verification handshake (`verifyHandshake`), HMAC-SHA256 signature verification (`verifyMetaSignature`), opaque callback data serialization/deserialization, phone number international normalization (`toWhatsAppNumber`), phone privacy masking (`maskPhone`), native wa.me link generation, ask-cab status state machine (`askCabStatusFrom`), and demo tenant suppression with 0 external network bytes.
- **Cat 29: Expo Push Notification Dispatch** (SCEN-259 to SCEN-266): `[PASS - DATABASE VERIFIED]` Push token batching chunk size (<=100), multi-device push delivery, dead token detection (`DeviceNotRegistered`), automated dead token purging from MongoDB User document (`$pull`), duplicate token deduplication, demo push suppression (`isDemo: true`), deep link payload formatting (`tripData`), and non-throwing error safety.
- **Cat 30: iCal Inbound Calendar Sync** (SCEN-267 to SCEN-274): `[PASS - DATABASE VERIFIED]` Strict SSRF prevention (blocking `http://`, `localhost`, `127.0.0.1`, `192.168.1.1`, internal IPs), room ownership scoping & non-existent room rejection, RFC 5545 VEVENT parsing, automatic OTA booking block creation in MongoDB (`status: 'confirmed'`), date overlap collision detection preventing double-booking, and idempotent re-sync preserving secret booking access PINs.
- **Cat 31: iCal Export Calendar Feed** (SCEN-275 to SCEN-280): `[PASS - DATABASE VERIFIED]` Outbound RFC 5545 VCALENDAR generation (`BEGIN:VCALENDAR`, `VERSION:2.0`), UTC ISO timestamp formatting (`DTSTAMP`), active bookings inclusion and cancelled exclusion, room calendar name header (`X-WR-CALNAME`), and strict CRLF line endings (`\r\n`).
- **Cat 32: Multi-Tenant Database Isolation** (SCEN-281 to SCEN-288): `[PASS - DATABASE VERIFIED]` Live tenant routing to `production` DB, demo tenant routing to `test` DB via `tenantDbModel`, demo tenant key identification (`isDemoKey`), cross-tenant data isolation, zero data leakage between production and test databases, and tenant-scoped audit logging.
- **Cat 33: Distributed Rate Limiting & DoS** (SCEN-289 to SCEN-296): `[PASS - DATABASE VERIFIED]` In-memory rate limit store (`MemoryRateLimitStore`) hit increment, window expiration and TTL reset, decrement counter, key resetting (`resetKey`), and Mongo distributed store (`MongoRateLimitStore`) atomic pipeline update with TTL index on `resetTime`.
- **Cat 34: NoSQL Injection & Sanitization** (SCEN-297 to SCEN-302): `[PASS - DATABASE VERIFIED]` Recursive stripping of `$` prefix operators (`$gt`, `$ne`, `$where`, `$regex`), stripping of dot notation keys (`.`), preservation of clean alphanumeric keys, safe recursion across nested objects and arrays, and non-object input safety.
- **Cat 35: JWT Authentication & Session Revocation** (SCEN-303 to SCEN-308): `[PASS - DATABASE VERIFIED]` JWT token verification and payload decoding, expired token rejection with `expired: true` (HTTP 401), missing Bearer header rejection, audience separation (`aud: 'stayride'` token rejected on core API), instant session revocation on all devices via database `tokenVersion` bump, and tampered token signature rejection.
- **Cat 36: Clerk Identity Provider Bridge** (SCEN-309 to SCEN-314): `[PASS - DATABASE VERIFIED]` User resolution by sparse `clerkId` index, phone number cleaning to 10 digits, email lookup fallback, and automated account blocking (`accountStatus: 'BLOCKED'`) on Clerk deletion events.
- **Cat 37: Admin Operations & Platform Settings** (SCEN-315 to SCEN-320): `[PASS - DATABASE VERIFIED]` `requireLiveAdmin` continuous database re-verification (blocked admin rejected immediately), RBAC role requirement enforcement (`requireRole('admin')` rejects non-admins with 403), typed platform configuration retrieval (`PlatformConfig`), fee and radius bounds clamping, and sensitive credential masking in views.
