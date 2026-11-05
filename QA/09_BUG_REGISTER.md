# StayCabs Master Bug & Vulnerability Register

**Document ID:** `QA/09_BUG_REGISTER`  
**Revision Date:** 2026-11-06  
**Auditor:** Autonomous QA Lead & Security Engineers (Agents 1-11)  

---

## 1. Defect Summary by Severity

| Severity Level | Open | Fixed | Verified | Total |
| :--- | :---: | :---: | :---: | :---: |
| **CRITICAL** (Loss of funds, security breach, total outage) | 0 | 0 | 0 | **0** |
| **HIGH** (Business rule violation, partial lock, data drift) | 1 | 0 | 0 | **1** |
| **MEDIUM** (Edge-case inconsistency, UI layout flaw, rate limit skew) | 3 | 0 | 0 | **3** |
| **LOW** (Minor visual flaw, missing translation, cosmetic) | 1 | 0 | 0 | **1** |
| **TOTAL** | **5** | **0** | **0** | **5** |

---

## 2. Granular Bug Catalog

### BUG-001 | Un-Transactioned Two-Phase Write on Driver Star Ratings
- **Severity:** `MEDIUM`
- **Impact Area:** Driver Platform Reputation & Rating Aggregations
- **Affected Components:** `server/src/stayride/platform.ts:rateDriver()` and `rateDriverByGuest()`
- **Discovery Note:** Line 2950: `// ponytail: two writes; a crash between them loses one rating from the average (the trip stays rated).`
- **Description:** When an owner or passenger rates a driver, the first write updates `CabRequest.rating` / `guestRating` via `findOneAndUpdate`. The second write updates `User.updateOne({ _id: assignedDriverUserId }, { $inc: { ratingSum, ratingCount } })`. If the serverless execution terminates or network times out between these two operations, the trip remains marked as rated (`rating != null`), preventing retries, while the driver's aggregate rating in `users` never receives the increment.
- **Root Cause:** Lack of a compensating reconciliation job or unified atomic session.
- **Recommended Remediation:** Either wrap in MongoDB multi-document transaction where supported, or introduce an idempotent background reconciliation script / cron task that recalculates `ratingSum` and `ratingCount` from completed `cabrequests`.
- **Status:** `OPEN` / `INVESTIGATING`

---

### BUG-002 | Global Rate Limiter Memory Store Partitioning on Serverless
- **Severity:** `MEDIUM`
- **Impact Area:** Rate Limiting & DoS Protection
- **Affected Components:** `server/src/app.ts:66` (`MemoryRateLimitStore("g:")`)
- **Discovery Note:** Line 59: `// ponytail: in-memory store, so the 1000/15 min ceiling is per warm Vercel instance, not per IP overall (N instances = N x 1000).`
- **Description:** The global rate limiter on `/api` and `/v1` routes uses `MemoryRateLimitStore`. Under high serverless auto-scaling (e.g. 10 warm Vercel instances), an attacker can execute $10 \times 1,000 = 10,000$ requests per 15-minute window before triggering a 429 block on any single instance.
- **Root Cause:** In-memory store does not share counters across ephemeral serverless containers. Note: The strict limiter (`strictLimiter`) correctly uses `MongoRateLimitStore` (`s:`), which is shared.
- **Recommended Remediation:** Migrate the global limiter to `MongoRateLimitStore("g:")` or Redis if global IP enforcement becomes necessary, or configure Cloudflare / Vercel Edge Firewall rules.
- **Status:** `OPEN` / `MONITORING`

---

### BUG-003 | Meta WhatsApp Utility Template Flagging on "PIN" Keyword
- **Severity:** `HIGH`
- **Impact Area:** Guest and Driver WhatsApp Notifications
- **Affected Components:** Meta Cloud API WhatsApp Templates & `server/src/stayride/messages.ts`
- **Discovery Note:** Meta flagged and rejected 4 templates (`trip_confirmed_guest`, `booking_confirmed_guest`, `advance_paid_driver`, `advance_paid_guest`) due to the presence of the word "PIN" or "OTP" in Utility category templates without two-factor authentication template tags.
- **Impact:** Direct delivery of raw PIN via WhatsApp was halted; currently mitigated via web trip pass URL `cab_booking_confirmed_v2` where the guest clicks their private pass link to view their boarding PIN.
- **Root Cause:** Meta WhatsApp Cloud API Category policy updates (Q3 2024 - 2026) requiring strict utility/authentication template compliance.
- **Remediation Plan:** Transition 100% of guest boarding notices to the web pass URL pattern (`cab_booking_confirmed_v2`), delete rejected legacy templates via Meta Business Manager UI, and monitor template delivery receipts.
- **Status:** `OPEN` / `FIX_PROPOSED`

---

### BUG-004 | Empty Fallback Client UPI ID in Environment Configuration
- **Severity:** `MEDIUM`
- **Impact Area:** Guest Web Payment QR Code Fallback
- **Affected Components:** `client-side/.env.local` (`NEXT_PUBLIC_UPI_ID = `)
- **Description:** In `client-side/.env.local`, the key `NEXT_PUBLIC_UPI_ID` is set to an empty string. If the dynamic platform configuration endpoint fails to return a verified bank VPA, the client-side QR fallback has no default VPA to construct a valid UPI URI (`upi://pay?pa=...`).
- **Root Cause:** Empty environment variable string in production configuration file.
- **Recommended Remediation:** Populate `NEXT_PUBLIC_UPI_ID` with the registered StayCabs merchant VPA in `client-side/.env.local` and Vercel project environment variables.
- **Status:** `OPEN` / `FIX_PROPOSED`

---

### BUG-005 | API URL Path Prefix Discrepancy Across Native & Web Envs
- **Severity:** `LOW`
- **Impact Area:** Architectural Consistency & Route Documentation
- **Affected Components:** `stayride-expo/.env` (`/v1`) vs `client-side/.env.local` (`/api/v1`)
- **Description:** `stayride-expo/.env` specifies `EXPO_PUBLIC_API_URL = https://api.staycabs.in/v1`, whereas web clients specify `NEXT_PUBLIC_API_URL = https://api.staycabs.in/api/v1`. While `app.ts` provides backward-compatible routing by mounting both `/v1` and `/api/v1/stayride`, new developers or audit scripts may face path confusion when testing endpoints.
- **Root Cause:** Evolutionary API versioning where mobile adapted `/v1` and web marketplace used `/api/v1`.
- **Recommended Remediation:** Document route mount aliases in architecture guide and ensure all future API integration tests test both mounting prefixes.
- **Status:** `OPEN` / `DOCUMENTED`
