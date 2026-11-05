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
| **SCEN-001** | One-Way Mountain Transfer | Bagdogra Airport to Darjeeling, 2 pax, SUV, valid future time. | `CabRequest` created in `FINDING_DRIVER`, reference `REQ-XXXXXXXXXX` generated, driver WhatsApp alerts triggered. | `NOT TESTED` |
| **SCEN-002** | Round-Trip with Return Date | NJP Station to Kalimpong, return 3 days later, 4 pax, Sedan. | `isRoundTrip = true`, `returnDate` and `returnTime` stamped, quotes reflect round-trip scope. | `NOT TESTED` |
| **SCEN-003** | Multi-Stop Scenic Itinerary | Gangtok -> Tsomgo Lake -> Baba Mandir -> Gangtok (3 stops). | `destinations` array stores ordered stops with lat/lng and notes, total route captured. | `NOT TESTED` |
| **SCEN-004** | Missing Pickup Coordinates | Address string provided, but GPS reverse geocode unavailable. | Falls back to text address search, assigns homestay default location coordinates, request succeeds. | `NOT TESTED` |
| **SCEN-005** | Past Date/Time Request | Scheduled date timestamp set to 2 hours in the past. | Server rejects with `400 BAD_REQUEST (INVALID_TRIP_TIME)`: trip date must be in future. | `NOT TESTED` |
| **SCEN-006** | Zero or Negative Passengers | Passenger count = 0 or -2. | Validation rejects with `400 BAD_REQUEST (INVALID_PASSENGER_COUNT)`. | `NOT TESTED` |
| **SCEN-007** | High Passenger Count for Vehicle | 8 passengers selected for Sedan (max 4). | Form clamps or rejects with suggestion to upgrade to 9-seater or SUV. | `NOT TESTED` |
| **SCEN-008** | Target Guest Budget Input | Guest specifies optional budget of ₹2,500 for Bagdogra-Darjeeling. | `guestBudget = 2500` stored in `CabRequest` and displayed to drivers as guidance. | `NOT TESTED` |
| **SCEN-009** | ReCAPTCHA Bot Rejection | Bot script triggers request without valid reCAPTCHA v3 token. | Server middleware returns `403 FORBIDDEN (RECAPTCHA_FAILED)`. No DB document created. | `NOT TESTED` |
| **SCEN-010** | Special Guest Notes Sanitization | Guest inputs `<script>alert(1)</script>` in trip notes. | Stored safely, HTML-escaped by client rendering, zero XSS vulnerability. | `NOT TESTED` |

---

## Category 2: Guest Web Link Token Validation (SCEN-011 to SCEN-018)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-011** | Valid Guest Link Access | Token `GL-ABC123XYZ` issued by active homestay host. | Resolves property details, homestay area, allowed vehicles, renders booking form. | `NOT TESTED` |
| **SCEN-012** | Expired Guest Link | Token accessed 15 days after expiration date. | Returns `410 GONE (LINK_EXPIRED)`: prompts guest to contact homestay for a new link. | `NOT TESTED` |
| **SCEN-013** | Revoked Guest Link | Host deleted guest link from Expo app dashboard. | Returns `404 NOT_FOUND (LINK_NOT_FOUND)`. | `NOT TESTED` |
| **SCEN-014** | Blocked Host Guest Link | Homestay account blocked by admin for policy violation. | Returns `403 FORBIDDEN (HOST_ACCOUNT_SUSPENDED)`: guest cannot book via suspended host. | `NOT TESTED` |
| **SCEN-015** | Feature Disabled Host Link | Admin toggled `guestCabLinks = false` for this tenant. | Returns `403 FORBIDDEN (FEATURE_LOCKED)`: explains cab links are disabled for this estate. | `NOT TESTED` |
| **SCEN-016** | Malformed Token String | Path contains SQL/NoSQL payload `GL-' OR 1=1--`. | Sanitizer and validator reject with `400 BAD_REQUEST (INVALID_TOKEN)`. | `NOT TESTED` |
| **SCEN-017** | Rate Limiting on Guest Link | Attacker polls token endpoint 100 times in 1 minute. | IP blocked by `strictLimiter` with `429 TOO_MANY_REQUESTS`. | `NOT TESTED` |
| **SCEN-018** | Guest Link Scope Stamping | Request submitted via `GL-...`. | `CabRequest.propertyId` and `CabRequest.guestLinkId` stamped with exact host identity. | `NOT TESTED` |

---

## Category 3: Driver Registration & KYC (SCEN-019 to SCEN-028)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-019** | Standard Driver Onboarding | Driver fills `/join-driver`: name, 10-digit phone, SUV, plate WB-74-XXXX. | User created with `role = 'driver'`, `accountStatus = 'PENDING_APPROVAL'`, audit log recorded. | `NOT TESTED` |
| **SCEN-020** | Duplicate Phone Registration | Driver attempts signup with phone number already in use. | Rejects with `409 CONFLICT (PHONE_ALREADY_REGISTERED)`: directs to login or recovery. | `NOT TESTED` |
| **SCEN-021** | Invalid Indian Phone Format | Driver inputs `12345` or non-standard phone number. | Rejects with `400 BAD_REQUEST (INVALID_PHONE_NUMBER)`. | `NOT TESTED` |
| **SCEN-022** | Vehicle Category Selection | Driver selects "7-seater", model "Innova Crysta", 7 seats. | `vehicle.type = '7-seater'`, `vehicle.seats = 7` stored accurately. | `NOT TESTED` |
| **SCEN-023** | Taxi Union Affiliation | Driver selects `UNION`, inputs "Darjeeling Motor Syndicate". | `driverCategory = 'UNION'`, `unionName = 'Darjeeling Motor Syndicate'` stored. | `NOT TESTED` |
| **SCEN-024** | Terms & Age 18+ Consent | Driver checks "I agree to Terms & confirm 18+". | `termsAcceptedAt = now()`, `termsVersion` stamped in `User` record. | `NOT TESTED` |
| **SCEN-025** | Unchecked Consent Rejection | Driver unchecks terms checkbox and submits form. | Client validation blocks submission; API rejects with `400 BAD_REQUEST (TERMS_REQUIRED)`. | `NOT TESTED` |
| **SCEN-026** | Admin Driver Approval | Admin approves driver via `/v1/admin/stayride/drivers/:id/status`. | `accountStatus` transitions to `ACTIVE`, WhatsApp welcome notification sent. | `NOT TESTED` |
| **SCEN-027** | Admin Driver Rejection | Admin marks driver `PENDING_APPROVAL` with rejection note. | Driver cannot quote; status page shows pending verification notice. | `NOT TESTED` |
| **SCEN-028** | Admin Driver Account Suspension| Admin flags driver `BLOCKED` due to safety infraction. | Driver JWT revoked instantly via `tokenVersion` increment; driver cannot access portal. | `NOT TESTED` |

---

## Category 4: Driver Account States & Access Gates (SCEN-029 to SCEN-036)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-029** | Active Driver Quoting Access | Driver with `accountStatus === 'ACTIVE'` quotes on open trip. | Quote accepted, added to `CabRequest.quotes`, returns `200 OK`. | `NOT TESTED` |
| **SCEN-030** | Pending Driver Quoting Blocked | Driver with `accountStatus === 'PENDING_APPROVAL'` attempts quote. | Rejects with `403 FORBIDDEN (DRIVER_PENDING_APPROVAL)`. | `NOT TESTED` |
| **SCEN-031** | Blocked Driver Quoting Blocked | Driver with `accountStatus === 'BLOCKED'` attempts quote. | Rejects with `403 FORBIDDEN (ACCOUNT_BLOCKED)`. | `NOT TESTED` |
| **SCEN-032** | Soft-Deleted Driver Gate | Driver with `deletedAt !== null` attempts login. | Rejects with `401 UNAUTHORIZED (ACCOUNT_DELETED)`. Financial history preserved. | `NOT TESTED` |
| **SCEN-033** | Driver Session Revocation | Admin revokes sessions via `/v1/admin/stayride/users/:id/revoke-sessions`. | `tokenVersion` increments; existing JWT returns `401 TOKEN_REVOKED`. | `NOT TESTED` |
| **SCEN-034** | Role Tampering Defense | Driver attempts to call owner endpoint `/v1/trips/:id/dispatch`. | `requireRole('owner')` rejects with `403 FORBIDDEN (INSUFFICIENT_PERMISSIONS)`. | `NOT TESTED` |
| **SCEN-035** | Availability Toggle Off | Driver sets `isAvailable = false`. | Driver excluded from new broadcast notifications; existing active trips unaffected. | `NOT TESTED` |
| **SCEN-036** | WhatsApp Alerts Opt-Out | Driver toggles `whatsappAlerts = false`. | Driver receives only Expo push notifications; Meta WhatsApp dispatch bypassed. | `NOT TESTED` |

---

## Category 5: Driver Bidding & Quoting Policies (SCEN-037 to SCEN-046)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-037** | First Driver Quote | Driver A quotes ₹3,000 on `FINDING_DRIVER` request. | `status` transitions to `QUOTE_RECEIVED`, quote stamped with driver details. | `NOT TESTED` |
| **SCEN-038** | Second Competing Quote | Driver B quotes ₹2,800 on same request. | Request contains 2 quotes in `quotes` array; neither driver sees the other's quote. | `NOT TESTED` |
| **SCEN-039** | Quote Update / Re-Bidding | Driver A updates quote from ₹3,000 to ₹2,750. | Existing quote updated in place; timestamp refreshed; quotes count remains 2. | `NOT TESTED` |
| **SCEN-040** | Zero or Negative Quote Fare | Driver submits `quotedFare = 0` or `-500`. | Validation rejects with `400 BAD_REQUEST (INVALID_FARE)`: fare must be positive. | `NOT TESTED` |
| **SCEN-041** | Excessive Fare Boundary | Driver submits `quotedFare = 500000` (exceeds `MAX_FARE`). | Validation rejects with `400 BAD_REQUEST (FARE_EXCEEDS_MAXIMUM)`. | `NOT TESTED` |
| **SCEN-042** | Quoting on Taken Trip | Driver attempts to quote after host accepted another driver. | Rejects with `409 CONFLICT (TRIP_NO_LONGER_OPEN)`. | `NOT TESTED` |
| **SCEN-043** | Quoting on Cancelled Trip | Driver attempts to quote on cancelled request. | Rejects with `409 CONFLICT (REQUEST_CANCELLED)`. | `NOT TESTED` |
| **SCEN-044** | Driver Quoting Own Vehicle Match| SUV driver quotes on Sedan-only request. | Allowed if driver vehicle accommodates requested capacity; notes display vehicle model. | `NOT TESTED` |
| **SCEN-045** | Note Field Sanitization | Driver includes 500-word essay in quote notes. | String clamped to 300 characters, whitespace trimmed, zero script injection. | `NOT TESTED` |
| **SCEN-046** | Concurrent Quote Submission | 5 drivers submit quotes at the exact same millisecond. | MongoDB atomic `$push` appends all 5 quotes cleanly without race conditions. | `NOT TESTED` |

---

## Category 6: Bidding Timeout & Expiration (SCEN-047 to SCEN-054)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-047** | Zero-Quote Bidding Expiration | Request receives 0 quotes within `quoteBiddingWindowMin` (4 hours). | Background cron marks `status = EXPIRED`, alerts host to revise fare or re-dispatch. | `NOT TESTED` |
| **SCEN-048** | Unaccepted Quotes Expiration | Request receives 3 quotes, but host takes no action before deadline. | Status transitions to `EXPIRED`; drivers receive notification that request timed out. | `NOT TESTED` |
| **SCEN-049** | Late Quote Submission Rejection | Driver submits quote 5 minutes after `biddingClosesAt`. | API rejects with `400 BAD_REQUEST (BIDDING_WINDOW_CLOSED)`. | `NOT TESTED` |
| **SCEN-050** | Bidding Fallback Trigger | Zero quotes after 50% of window elapsed. | Dispatcher triggers `nearbyFallback`: alerts top-rated active drivers in wider radius. | `NOT TESTED` |
| **SCEN-051** | Single Fallback Alert Per Trip | Fallback conditions remain true across multiple cron cycles. | Stamped `biddingFallbackAlertSentAt`; alert fires exactly ONCE, avoiding spam. | `NOT TESTED` |
| **SCEN-052** | Expired Trip Re-Dispatch | Host clicks "Re-Open Bidding" on expired request. | Resets `biddingClosesAt` to `now + window`, status back to `FINDING_DRIVER`. | `NOT TESTED` |
| **SCEN-053** | Guest View on Expired Request | Guest visits status page of expired request. | Displays honest notice: "No drivers available for this time; please adjust route/time." | `NOT TESTED` |
| **SCEN-054** | Audit Trail on Expiration | Bidding window expires and cron sweeps. | Audit log records `action: 'cab.bidding_expired'`, actor: `'system'`. | `NOT TESTED` |

---

## Category 7: Host Counter-Offers & Negotiation (SCEN-055 to SCEN-064)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-055** | Host Proposes Counter-Offer | Driver quotes ₹3,200; Host counters at ₹2,800. | Quote stamped with `counterFare = 2800`, `counterAt = now()`, WhatsApp alert to driver. | `NOT TESTED` |
| **SCEN-056** | Driver Accepts Counter-Offer | Driver taps "Accept ₹2,800" via web link. | Request locks at ₹2,800, transitions to `AWAITING_ADVANCE_PAYMENT`, payment link issued. | `NOT TESTED` |
| **SCEN-057** | Driver Declines Counter-Offer | Driver rejects counter-offer. | `counterFare` cleared; original quote of ₹3,200 remains active in bidding pool. | `NOT TESTED` |
| **SCEN-058** | Counter-Offer Higher Than Quote | Host enters counter-offer ₹3,500 on ₹3,000 quote. | Rejected with `400 BAD_REQUEST (COUNTER_MUST_BE_LOWER)`: counter cannot exceed quote. | `NOT TESTED` |
| **SCEN-059** | Counter-Offer Below Floor | Host enters counter-offer ₹100 on ₹3,000 mountain trip. | Rejected with `400 BAD_REQUEST (FARE_BELOW_MINIMUM)`. | `NOT TESTED` |
| **SCEN-060** | Concurrent Counter Acceptance | Driver accepts counter while Host accepts competing quote. | Atomic conditional update wins; second operation receives `409 CONFLICT`. | `NOT TESTED` |
| **SCEN-061** | Counter-Offer on Expired Request | Host attempts counter after bidding window closed. | Rejects with `400 BAD_REQUEST (BIDDING_CLOSED)`. | `NOT TESTED` |
| **SCEN-062** | Multiple Counters on Different Drivers | Host counters Driver A at ₹2,700 and Driver B at ₹2,600. | Both quotes reflect respective counters; first driver to accept wins the booking. | `NOT TESTED` |
| **SCEN-063** | Outbid Quote Revocation | Driver A accepts counter; Driver B's quote marked `outbid = true`. | Driver B notified that another driver confirmed the trip. | `NOT TESTED` |
| **SCEN-064** | Financial Snapshot on Counter | Counter accepted at ₹2,800. | `financialSnapshot` accurately computed using ₹2,800 as `agreedFare`. | `NOT TESTED` |

---

## Category 8: Financial Calculations & Invariants (SCEN-065 to SCEN-076)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-065** | Standard Split Invariant | Agreed fare ₹3,000, PF = 5%, HC = 5%, Advance = 15%, Min Advance = ₹500. | PF = ₹150, HC = ₹150, Advance = ₹500 (floored), Remaining Cash = ₹2,500, Driver Share = ₹200. Total = ₹3,000. | `NOT TESTED` |
| **SCEN-066** | Exact Advance = Commission Case | Agreed fare ₹4,000, PF = 5% (₹200), HC = 5% (₹200), Advance = 10% (₹400). | Advance = ₹400 = Total Comm. Driver Share = ₹0. Remaining Cash = ₹3,600. Driver Payout = ₹3,600. | `NOT TESTED` |
| **SCEN-067** | High Advance Rate Case | Agreed fare ₹5,000, Advance = 25% (₹1,250), Total Comm = 10% (₹500). | Driver Share = ₹750. Remaining Cash = ₹3,750. Net Driver = ₹4,500 = ₹5,000 - ₹500. Conservation exact. | `NOT TESTED` |
| **SCEN-068** | Small Fare Min Floor Clamp | Agreed fare ₹600, PF = 5% (₹30), HC = 5% (₹30), Min Advance Floor = ₹500. | Advance = ₹500. Comm = ₹60. Driver Share = ₹440. Cash to Driver = ₹100. Net Driver = ₹540. | `NOT TESTED` |
| **SCEN-069** | Fare Smaller Than Min Floor | Agreed fare ₹400, Min Advance Floor = ₹500. | Advance capped at agreed fare: `advanceAmount = 400`. Remaining Cash = ₹0. | `NOT TESTED` |
| **SCEN-070** | Own-Fleet Financial Split | Host private driver, Fare ₹3,000, Own Fleet Fee = 3% (₹90), HC = 0%. | Advance = ₹90 (only platform fee). Remaining Cash = ₹2,910. Driver Share = ₹0. | `NOT TESTED` |
| **SCEN-071** | Zero-Fee Own-Fleet Promotion | Admin sets `ownFleetFeePercent = 0` and `ownFleetMinFee = 0`. | Advance = ₹0. Status transitions directly to `CONFIRMED` without payment step. | `NOT TESTED` |
| **SCEN-072** | Property Commission Override | Estate X has custom agreement: PF = 3%, HC = 7%. Fare ₹10,000. | PF = ₹300, HC = ₹700. Global 5%/5% rates bypassed in favor of tenant override. | `NOT TESTED` |
| **SCEN-073** | Rounding Invariant Check | Fare with odd number ₹3,333, 5% rates (₹166.65). | All monetary fields rounded to integer rupees: `PF + HC + Net Driver === 3333`. Zero fractional loss. | `NOT TESTED` |
| **SCEN-074** | Immutability on Rate Change | Booking confirmed with PF = 5%. Admin later changes global PF to 8%. | Existing booking `financialSnapshot` remains 5%. New rate applies only to future quotes. | `NOT TESTED` |
| **SCEN-075** | Invalid Commission Guard | Admin attempts setting Advance % (8%) lower than Total Comm (10%). | Mongoose schema validator throws error: Advance cannot be less than total commission. | `NOT TESTED` |
| **SCEN-076** | Zero Cash Balance Case | 100% advance collected online (Advance = Agreed Fare). | `remainingCashToDriver = 0`. Guest pays ₹0 to driver. Entire driver earnings in wallet. | `NOT TESTED` |

---

## Category 9: Payment Gateway & Webhook Reconciliation (SCEN-077 to SCEN-086)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-077** | Razorpay Advance Capture Webhook | Webhook `payment.captured` arrives with valid HMAC SHA256 signature. | `advancePaid = true`, boarding PIN generated, status `CONFIRMED`, notifications dispatched. | `NOT TESTED` |
| **SCEN-078** | Tampered Webhook Signature | Attacker posts fake payment webhook with forged signature. | Backend rejects with `401 UNAUTHORIZED (INVALID_WEBHOOK_SIGNATURE)`. DB unchanged. | `NOT TESTED` |
| **SCEN-079** | Idempotent Duplicate Webhook | Razorpay retries same webhook delivery 3 times. | First call transitions to `CONFIRMED`; subsequent 2 calls return `200 OK` with zero duplicate side effects. | `NOT TESTED` |
| **SCEN-080** | Webhook for Cancelled Trip | Payment captures after guest cancelled booking. | Logged in `unmatchedPayments`, admin alerted for immediate refund, status remains `CANCELLED`. | `NOT TESTED` |
| **SCEN-081** | Underpaid Gateway Amount | Razorpay captures ₹300 when required advance was ₹500. | Payment flagged as mismatched; trip not confirmed until shortfall resolved. | `NOT TESTED` |
| **SCEN-082** | Simulation Mode Advance | Development environment with `PAYMENT_GATEWAY_MODE = simulation`. | Test payment link simulates instant capture without calling real Razorpay API. | `NOT TESTED` |
| **SCEN-083** | Replaced Payment Link Capture | Advance expired, new driver selected, guest pays old link. | `paymentLinkIds` array tracks historical links; payment successfully matches and attributes. | `NOT TESTED` |
| **SCEN-084** | Gateway Down Fallback to UPI QR | Gateway API offline; guest switches to UPI QR scan. | Dynamic QR displays verified VPA, allows guest to submit UTR for manual claim. | `NOT TESTED` |
| **SCEN-085** | Payment Link Expiration Sync | Guest opens Razorpay link after `advanceDueAt` passed. | Gateway displays "Link Expired", preventing guest from paying dead invoice. | `NOT TESTED` |
| **SCEN-086** | Audit Trail on Gateway Payment | Webhook processed successfully. | Audit log records `action: 'cab.advance_paid'`, payment ID, method, and transaction timestamp. | `NOT TESTED` |

---

## Category 10: Manual UPI QR & Payment Claims (SCEN-087 to SCEN-096)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-087** | Guest Submits Valid UPI UTR | Guest scans QR, pays ₹500, inputs 12-digit UTR `428192839182`. | `paymentClaim` stored with status `PENDING`, admin notified to verify bank statement. | `NOT TESTED` |
| **SCEN-088** | Admin Approves UPI Claim | Admin matches bank credit and approves claim via `/cab-requests/:id/record-payment`. | `advancePaid = true`, status transitions to `CONFIRMED`, boarding PIN issued. | `NOT TESTED` |
| **SCEN-089** | Admin Rejects Fraudulent Claim | Guest submits fake UTR; admin rejects via `/cab-requests/:id/reject-claim`. | `paymentClaim.status = 'REJECTED'`, reason recorded, guest notified to re-submit or use gateway. | `NOT TESTED` |
| **SCEN-090** | Duplicate UTR Prevention | Second guest submits identical UTR previously claimed. | System warns admin of duplicate UTR usage across bookings, flags potential fraud. | `NOT TESTED` |
| **SCEN-091** | Short UTR Format Validation | Guest inputs "1234" (less than valid banking UTR length). | Form validation enforces 12-character alphanumeric bank reference standard. | `NOT TESTED` |
| **SCEN-092** | Payment Claim During Expired State | Guest pays via UPI after booking expired. | Claim accepted as pending payment; admin can revive booking or process refund. | `NOT TESTED` |
| **SCEN-093** | Guest Re-Submission on Rejection | Guest corrects mistyped UTR and re-submits claim. | Replaces rejected claim with new `PENDING` claim; status remains `AWAITING_ADVANCE_PAYMENT`. | `NOT TESTED` |
| **SCEN-094** | Payment Note Stamping | Admin enters bank note: "Verified via HDFC Current A/c". | `paymentNote` and `paymentRecordedBy` stamped permanently on booking record. | `NOT TESTED` |
| **SCEN-095** | Payment Voiding Action | Admin mistakenly verified wrong payment and voids it. | Stored in `voidedPayments` array with reason; booking reverts to unpaid state. | `NOT TESTED` |
| **SCEN-096** | WhatsApp Notice on Claim Approval | Admin approves UPI payment claim. | Guest receives Meta WhatsApp template `cab_booking_confirmed` with boarding pass. | `NOT TESTED` |

---

## Category 11: Unpaid Advance Expiration & Driver Release (SCEN-097 to SCEN-104)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-097** | Advance Due Window Elapsed | Request held in `AWAITING_ADVANCE_PAYMENT`; 45 min passes without payment. | `releaseUnpaidAdvances` cron runs: status reverts to `FINDING_DRIVER`, confirmed driver released. | `NOT TESTED` |
| **SCEN-098** | Reviving Outbid Quotes | Driver was released due to unpaid advance; other drivers quoted earlier. | Previous quotes revived from `REJECTED (outbid)` to `PENDING`; host can select alternate driver. | `NOT TESTED` |
| **SCEN-099** | Host WhatsApp Alert on Expiry | Advance payment window passes unpaid. | Host receives alert: "Guest did not complete advance payment in time. Driver released." | `NOT TESTED` |
| **SCEN-100** | Driver WhatsApp Alert on Release | Confirmed driver released due to guest non-payment. | Driver receives alert: "Trip hold released due to guest payment timeout. You are available for other rides." | `NOT TESTED` |
| **SCEN-101** | Payment Arrives During Release Race| Guest pays gateway in same second cron releases hold. | Atomic lock: if payment confirms, cron release is aborted; trip remains `CONFIRMED`. | `NOT TESTED` |
| **SCEN-102** | Late Payment on Released Trip | Guest pays after trip was already released and taken by another. | Logged in `unmatchedPayments`; admin initiates instant refund to guest account. | `NOT TESTED` |
| **SCEN-103** | Guest View on Expired Advance | Guest opens expired payment link. | Page informs guest payment window closed; offers option to re-request trip. | `NOT TESTED` |
| **SCEN-104** | Audit Trail on Advance Release | Cron releases unpaid advance hold. | Audit log records `action: 'cab.advance_released'`, actor: `'system'`. | `NOT TESTED` |

---

## Category 12: Boarding PIN (OTP) & Verification (SCEN-105 to SCEN-114)

| ID | Title / Target Flow | Test Conditions & Inputs | Expected Invariant / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCEN-105** | Cryptographic 4-Digit PIN Generation | Advance payment confirmed. | `pickupOtp` generated as 4-digit numeric string (`0000` to `9999`) using crypto random. | `NOT TESTED` |
| **SCEN-106** | Boarding PIN Display on Guest Pass | Guest views digital trip pass on `staycabs.in`. | PIN prominently displayed: "Share this 4-digit PIN with your driver upon boarding". | `NOT TESTED` |
| **SCEN-107** | Boarding PIN Hidden from Driver | Driver views trip details in app/web link before passenger arrives. | PIN field is completely absent from driver API response (`select: false` or omitted). | `NOT TESTED` |
| **SCEN-108** | Correct PIN Enters Trip Started | Driver meets guest, enters correct 4-digit PIN. | `status` transitions to `TRIP_STARTED`, `startedAt = now()`, `pickupOtpAttempts = 0`. | `NOT TESTED` |
| **SCEN-109** | Incorrect PIN Attempt Incremented | Driver inputs wrong PIN "9999". | API rejects with `400 BAD_REQUEST (INVALID_PIN)`. `pickupOtpAttempts` increments to 1. | `NOT TESTED` |
| **SCEN-110** | 5-Attempt PIN Lockout Defense | Driver inputs 5 consecutive incorrect PINs. | PIN input locked (`pickupOtpAttempts >= 5`); driver instructed to call support/host. | `NOT TESTED` |
| **SCEN-111** | Admin PIN Override | Host verifies guest identity and admin unlocks locked trip. | Admin executes `/v1/admin/cab-requests/:id/start`, transitions trip to `TRIP_STARTED`. | `NOT TESTED` |
| **SCEN-112** | Trip Start Before Confirmation Guard | Driver attempts to enter PIN on `AWAITING_ADVANCE_PAYMENT` trip. | Rejects with `409 CONFLICT (TRIP_NOT_CONFIRMED)`. | `NOT TESTED` |
| **SCEN-113** | Double PIN Entry Idempotency | Driver double-taps "Verify PIN" button. | First call starts trip; second call returns `200 OK (ALREADY_STARTED)` cleanly. | `NOT TESTED` |
| **SCEN-114** | Audit Log on Trip Start | Driver starts trip with PIN. | Audit log records `action: 'cab.trip_started'`, driver ID, and timestamp. | `NOT TESTED` |

---

## Category 13 to Category 42: Comprehensive Scenario Continuum (SCEN-115 to SCEN-320)

*(Summary index of remaining 206 master scenarios covering Categories 13 through 42)*:
- **Cat 13: Trip Execution & GPS Pings** (SCEN-115 to SCEN-122): Driver location updates, route deviation alerts, background location throttle (120/15m).
- **Cat 14: Cash-in-Hand Collection** (SCEN-123 to SCEN-130): Exact cash collection, passenger payment disputes, driver receipt confirmation.
- **Cat 15: Trip Completion & Auto-Completion** (SCEN-131 to SCEN-140): Driver manual completion, 12-hour cron sweep, completion reminders.
- **Cat 16: No-PIN Completion Arbitration** (SCEN-141 to SCEN-148): `completedWithoutPin` flag, `PAYOUT_HOLD` enforcement, admin investigation, no-show refund.
- **Cat 17: Driver Sovereign Wallet Accounting** (SCEN-149 to SCEN-158): Surplus advance credit, wallet balance aggregation, multi-trip accumulation.
- **Cat 18: Driver Payout Requests** (SCEN-159 to SCEN-168): Threshold enforcement (₹100), single pending payout constraint, atomic trip locking.
- **Cat 19: Driver Payout Settlement & UTR** (SCEN-169 to SCEN-178): Admin settlement, bank UTR recording, locked trip settlement stamp, WhatsApp confirmation.
- **Cat 20: Driver Payout Rejections** (SCEN-179 to SCEN-186): Admin rejection with reason, automatic trip unlocking, wallet balance restoration.
- **Cat 21: Homestay Host Commission** (SCEN-187 to SCEN-196): Host commission credit upon completion, host payout claims, host settlement ledger.
- **Cat 22: Homestay Own-Fleet Operations** (SCEN-197 to SCEN-206): Private driver assignment, 0% host commission, reduced platform fee, direct cash.
- **Cat 23: Driver 5-Star Ratings & Reviews** (SCEN-207 to SCEN-214): Guest rating, host rating, once-only rating transition (`rating: null`), comment clamping.
- **Cat 24: Cancellations Pre-Confirmation** (SCEN-215 to SCEN-222): Zero-cost cancellation by guest/host, instant request archival.
- **Cat 25: Cancellations Post-Confirmation** (SCEN-223 to SCEN-232): Advance refund pending flag, driver reassignment on driver cancellation, admin refund recording.
- **Cat 26: Passenger No-Show Handling** (SCEN-233 to SCEN-240): Driver reports no-show, host verifies, admin retains advance, driver compensation.
- **Cat 27: Driver Vehicle Updates & Plate Notices** (SCEN-241 to SCEN-248): Vehicle change, WhatsApp guest alert rate limiting (max 1 per 10m).
- **Cat 28: WhatsApp Cloud API Dispatch** (SCEN-249 to SCEN-258): Template variable count validation, approved template fallback, delivery status tracking.
- **Cat 29: Expo Push Notification Dispatch** (SCEN-259 to SCEN-266): Token registration, multi-device delivery, invalid token purging.
- **Cat 30: iCal Inbound Calendar Sync** (SCEN-267 to SCEN-274): External OTA calendar import (Airbnb/Booking.com), date block conflicts, background cron.
- **Cat 31: iCal Export Calendar Feed** (SCEN-275 to SCEN-280): Room calendar export token, VEVENT iCalendar formatting, timezone accuracy.
- **Cat 32: Multi-Tenant Database Isolation** (SCEN-281 to SCEN-288): Demo tenant routes to `test` DB, live tenant routes to `production` DB, zero data leakage.
- **Cat 33: Distributed Rate Limiting & DoS** (SCEN-289 to SCEN-296): Strict limiter lockout, memory store fail-open, Mongo store fail-closed.
- **Cat 34: NoSQL Injection & Sanitization** (SCEN-297 to SCEN-302): Query operator stripping (`$where`, `$regex`, `$gt`), parameter pollution defense.
- **Cat 35: JWT Authentication & Session Revocation** (SCEN-303 to SCEN-308): Token signature verification, `tokenVersion` bump on logout, expired token handling.
- **Cat 36: Clerk Identity Provider Bridge** (SCEN-309 to SCEN-314): Clerk session sync, Svix webhook signature verification, phone number resolution.
- **Cat 37: Admin Operations & Platform Settings** (SCEN-315 to SCEN-320): Commission updates, operational thresholds, telemetry logging, error masking.
