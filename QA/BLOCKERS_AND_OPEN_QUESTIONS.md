# StayCabs Technical Blockers, Open Architecture Questions & Assumptions

**Document ID:** `QA/BLOCKERS_AND_OPEN_QUESTIONS`  
**Revision Date:** 2026-11-06  
**Auditor:** Principal Software Architect (Agent 1)  

---

## 1. Active Technical Boundaries & Blockers

### BLK-001 | Meta WhatsApp Cloud API Template Deletion Scope
- **Category:** Third-Party Cloud Integration (Meta for Developers)
- **Status:** `EXTERNAL_ACTION_REQUIRED`
- **Description:** Attempting to delete rejected WhatsApp templates (`trip_confirmed_guest`, `booking_confirmed_guest`, `advance_paid_driver`, `advance_paid_guest`) via MCP or Cloud API throws:
  ```json
  { "error": { "message": "(#100) Need permission on either WhatsApp Business Account or owner/shared business", "code": 100 } }
  ```
- **Root Cause:** The active Meta System User Access Token possesses the `whatsapp_business_messaging` permission (authorizing message transmission and template reading), but lacks the administrative `whatsapp_business_management` permission required to delete templates via API.
- **Remediation / User Action:** Delete the 4 rejected templates manually via the Meta Business Manager UI (WhatsApp Manager -> Message Templates). Note: Active message sending is unblocked as the codebase uses approved templates (`cab_booking_confirmed`, `driver_trip_confirmed`, `new_trip_request`).

---

### BLK-002 | Meta WhatsApp Webhook Callback Configuration
- **Category:** Inbound Webhook Dispatch
- **Status:** `VERIFICATION_REQUIRED`
- **Description:** Meta WhatsApp requires an active webhook subscription to receive delivery receipts (`sent`, `delivered`, `read`) and driver/guest text replies.
- **Verification Needed:** Confirm that in Meta App Dashboard -> WhatsApp -> Configuration:
  - Callback URL is set to: `https://api.staycabs.in/v1/webhooks/whatsapp`
  - Verify Token matches: value of `WHATSAPP_VERIFY_TOKEN` in server environment.
  - Webhook fields subscribed: `messages`.

---

## 2. Open Architecture Questions & Design Decisions

### Q-001 | Fallback Client UPI ID Configuration
- **Context:** In `client-side/.env.local`, `NEXT_PUBLIC_UPI_ID = ` is currently empty.
- **Question for Stakeholders:** What is the primary registered merchant UPI ID / VPA (e.g. `staycabs@icici` or `staycabs@okhdfcbank`) that should be embedded for offline QR code generation when the backend platform configuration is unreachable?

### Q-002 | Global Rate Limiter Storage Strategy on Serverless
- **Context:** The global limiter (`MemoryRateLimitStore`) resets on cold starts and partitions counters per warm Vercel instance, whereas the strict limiter (`MongoRateLimitStore`) is globally shared.
- **Question for Stakeholders:** Is it preferred to keep global limiting lightweight in-memory (relying on Cloudflare/Vercel Edge DDoS defense), or migrate the global limiter to MongoDB (which introduces one DB query per API request)?

### Q-003 | Live Razorpay Gateway Activation Timeline
- **Context:** `PAYMENT_GATEWAY_MODE` is currently set to `simulation`.
- **Question for Stakeholders:** When are live merchant credentials (`RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`) scheduled to be flipped to `live` mode for genuine passenger card and UPI advance collections?

---

## 3. Mission Assumptions

1. **Database Safety Mandate**: Production database (`production`) contains real user accounts and historical bookings; all mutation testing must be conducted in the `test` database (`isDemo = true`) or use explicitly marked test records prefixed with `STAYCABS_QA_<UNIQUE_ID>`.
2. **Serverless Cold Starts**: All database connection listeners and startup migrations in `db.ts` must execute idempotently and asynchronously to avoid introducing cold-start latency spikes on Vercel.
3. **Rupee Conservation**: Every financial formula must guarantee that total money collected online plus cash collected by the driver equals the agreed fare to the exact integer rupee.
