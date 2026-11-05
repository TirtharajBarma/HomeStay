# StayCabs Complete API Endpoint Inventory

**Document ID:** `QA/05_API_INVENTORY`  
**Revision Date:** 2026-11-06  
**Auditor:** Backend QA Lead (Agent 6)  

---

## 1. Public & Guest Endpoints (Unauthenticated / Token-Guarded)

| HTTP Method | Route Path | Rate Limiter | Auth Required | Request Payload Summary | Response Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health`, `/api/v1/health` | Global (1000/15m) | None | None | `{ status: "ok", uptime: number }` |
| `GET` | `/v1/public/config` | Global | None | None | Platform branding, features, map presets |
| `GET` | `/v1/public/legal/:doc` | Global | None | Doc key (`terms`, `privacy`, `refund`) | Markdown / HTML legal text |
| `GET` | `/v1/public/guest-links/:token` | Global | Guest Token | None | Homestay name, location, allowed vehicle classes |
| `POST` | `/v1/public/guest-links/:token/cab-requests` | Strict (30/15m) + Recaptcha | Guest Token | Pickup, drop, date, time, passengers, vehicle | `{ success: true, reference: "REQ-..." }` |
| `POST` | `/v1/public/properties/:slug/cab-requests` | Strict + Recaptcha | None | Pickup, drop, date, time, passengers, vehicle | `{ success: true, reference: "REQ-..." }` |
| `GET` | `/v1/public/cab-requests/:reference` | Global | None | None | Request status, quotes count, assigned driver, payment link |
| `POST` | `/v1/public/cab-requests/:reference/payment-claim` | Strict | None | `{ utr: string, amount: number }` | `{ success: true, status: "PENDING" }` |
| `POST` | `/v1/public/cab-requests/:reference/rate` | Strict | None | `{ stars: number, comment?: string }` | `{ success: true }` |

---

## 2. Web Driver & Mobile Driver Endpoints

| HTTP Method | Route Path | Rate Limiter | Auth Required | Request Payload Summary | Response Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/v1/public/driver-signup` | Strict + Recaptcha | None | Name, phone, vehicle details, area | `{ success: true, status: "PENDING_APPROVAL" }` |
| `GET` | `/v1/public/driver-quote` | Global | Signed Link / Phone | `?req=REQ-...&d=...` | Trip parameters, status, active quotes |
| `POST` | `/v1/public/driver-quote/quote` | Strict | Signed Link / Phone | `{ quotedFare: number, notes?: string }` | `{ success: true, quote: IDriverQuote }` |
| `POST` | `/v1/public/driver-quote/accept-counter` | Strict | Signed Link / Phone | `{ req: string, driverId: string }` | `{ success: true, status: "AWAITING_ADVANCE_PAYMENT" }` |
| `POST` | `/v1/public/driver-quote/start` | Strict | Signed Link / Phone | `{ pin: string }` (Boarding PIN) | `{ success: true, status: "TRIP_STARTED" }` |
| `POST` | `/v1/public/driver-quote/complete` | Strict | Signed Link / Phone | `{ finalFare?: number }` | `{ success: true, status: "COMPLETED" }` |
| `GET` | `/v1/public/driver-quote/wallet` | Global | Signed Link / Phone | `?driverId=...` | Balance, eligible trips, payout history |
| `POST` | `/v1/public/driver-quote/payouts/request` | Strict | Signed Link / Phone | `{ method: "UPI", upiId?: string }` | `{ success: true, payoutId: string }` |
| `POST` | `/v1/public/driver-quote/location` | Location (120/15m) | Signed Link / Phone | `{ lat: number, lng: number }` | `{ success: true }` |
| `POST` | `/v1/public/driver-quote/update-vehicle` | Strict | Signed Link / Phone | `{ model?: string, plate?: string }` | `{ success: true }` |
| `GET` | `/v1/driver/trips` | Global | Driver JWT (Active) | None | Array of active, quoted, and history trips |
| `POST` | `/v1/driver/trips/:reference/quote` | Strict | Driver JWT (Active) | `{ quotedFare: number }` | `{ success: true }` |
| `POST` | `/v1/driver/trips/:reference/start` | Strict | Driver JWT (Active) | `{ pin: string }` | `{ success: true, status: "TRIP_STARTED" }` |
| `POST` | `/v1/driver/trips/:reference/complete` | Strict | Driver JWT (Active) | `{ finalFare?: number }` | `{ success: true, status: "COMPLETED" }` |
| `GET` | `/v1/driver/wallet` | Global | Driver JWT (Active) | None | Detailed sovereign wallet breakdown |
| `POST` | `/v1/driver/payouts/request` | Strict | Driver JWT (Active) | `{ method: "UPI" | "BANK_TRANSFER", ... }` | `{ success: true, payout: IPayoutRequest }` |

---

## 3. Homestay Host & Tenant Endpoints

| HTTP Method | Route Path | Rate Limiter | Auth Required | Request Payload Summary | Response Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/v1/snapshot` | Global | Host / Driver JWT | None | Complete aggregate sync of rooms, bookings, trips, drivers |
| `GET` | `/v1/trips` | Global | Host JWT | None | All trips originated by or assigned to host |
| `POST` | `/v1/trips` | Global | Host JWT | Trip parameters | Created trip object |
| `POST` | `/v1/trips/:id/dispatch` | Global | Host JWT | None | Broadcasts trip to nearby drivers |
| `POST` | `/v1/trips/:id/confirm-quote` | Global | Host JWT | `{ driverUserId: string }` | Locks quote, triggers `AWAITING_ADVANCE_PAYMENT` |
| `POST` | `/v1/trips/:id/counter` | Global | Host JWT | `{ driverUserId: string, counterFare: number }` | Submits counter-offer to driver |
| `POST` | `/v1/trips/:id/assign` | Global | Host JWT | `{ ownDriverId: number }` | Dispatches trip to host's own fleet vehicle |
| `POST` | `/v1/trips/:id/cancel` | Global | Host JWT | `{ reason: string }` | Cancels trip and logs reason |
| `POST` | `/v1/trips/:id/rate` | Global | Host JWT | `{ stars: number, comment?: string }` | Rates driver |
| `POST` | `/v1/guest-links` | Global | Host JWT | `{ label?: string, expiresDays?: number }` | Generates new shareable guest cab link |
| `POST` | `/v1/guest-links/send` | Global | Host JWT | `{ phone: string, guestName?: string }` | Dispatches WhatsApp invite to guest |
| `GET` | `/v1/payouts/summary` | Global | Host JWT | None | Available referral commission balance |
| `POST` | `/v1/payouts/request` | Strict | Host JWT | `{ amount: number, method: "UPI", ... }` | Creates host payout request |

---

## 4. Webhook & Cron Integrations

| HTTP Method | Route Path | Security Verification | Purpose & Handling |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/webhooks/razorpay` | HMAC SHA256 (`RAZORPAY_WEBHOOK_SECRET`) | Consumes `payment.captured` & `payment_link.paid`. Calls `applyAdvancePayment`. |
| `GET` | `/v1/webhooks/whatsapp` | Meta Verify Token | Meta Cloud API webhook verification handshake. |
| `POST` | `/v1/webhooks/whatsapp` | Meta App Secret SHA256 Signature | Consumes WhatsApp delivery receipts and inbound driver/guest text replies. |
| `POST` | `/v1/auth/clerk-webhook` | Svix HMAC Signature (`CLERK_WEBHOOK_SIGNING_SECRET`) | Syncs user creation, updates, and account deletions from Clerk. |
| `GET` | `/v1/cron/cab-cycle` | `CRON_SECRET` Header / Auth | Background cron: releases unpaid expired advances, sends driver completion reminders, checks bidding fallbacks. |
| `GET` | `/v1/cron/ical-sync` | `CRON_SECRET` Header / Auth | Background cron: pulls external iCal calendars (Airbnb/Booking.com) into room availability. |

---

## 5. Platform Admin Endpoints (`/v1/admin`)

| HTTP Method | Route Path | Role Required | Operational Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/admin/overview` | Admin | High-level metrics: total revenue, active trips, pending payouts. |
| `GET` | `/v1/admin/commission/settings` | Admin | Fetches global platform fees, advance %, and vehicle configs. |
| `PUT` | `/v1/admin/commission/settings` | Admin | Updates commission splits and operational thresholds. |
| `GET` | `/v1/admin/stayride/drivers` | Admin | Lists all registered drivers across platform with status filter. |
| `PATCH`| `/v1/admin/stayride/drivers/:id/status`| Admin | Approves (`ACTIVE`), rejects (`PENDING_APPROVAL`), or blocks driver. |
| `GET` | `/v1/admin/cab-requests` | Admin | Full list of cab requests with multi-attribute filtering. |
| `POST` | `/v1/admin/cab-requests/:id/assign-driver` | Admin | Manual override: assigns specific driver and locks fare. |
| `POST` | `/v1/admin/cab-requests/:id/record-payment` | Admin | Manual override: records verified advance payment. |
| `POST` | `/v1/admin/cab-requests/:id/reject-claim` | Admin | Rejects guest's manual UPI UTR submission. |
| `POST` | `/v1/admin/cab-requests/:id/refund` | Admin | Records refund reference for cancelled booking. |
| `POST` | `/v1/admin/cab-requests/:id/no-pin-review` | Admin | Arbitrates completed trips where boarding PIN was bypassed. |
| `GET` | `/v1/admin/driver-payouts` | Admin | Lists pending and historical driver payout claims. |
| `POST` | `/v1/admin/driver-payouts/:id/settle` | Admin | Records bank UTR and marks driver payout settled. |
| `POST` | `/v1/admin/driver-payouts/:id/reject` | Admin | Rejects driver payout and unlocks associated trips. |
| `GET` | `/v1/admin/host-payouts` | Admin | Lists pending and historical homestay host payout claims. |
| `POST` | `/v1/admin/host-payouts/:id/settle` | Admin | Records bank UTR and marks host payout settled. |
| `GET` | `/v1/admin/audit-log` | Admin | Paginated immutable audit trail with actor and action filters. |
