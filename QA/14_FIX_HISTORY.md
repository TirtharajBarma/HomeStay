# StayCabs Engineering Fix History & Changelog

**Document ID:** `QA/14_FIX_HISTORY`  
**Revision Date:** 2026-11-06  
**Lead Coordinator:** Autonomous Engineering & QA Lead  

---

## 1. Verified Production Fixes & Hardening Interventions

### FIX-001 | Cab Request Autocomplete Popover Width & Click-Outside Dismissal
- **Target File:** `my-code/client-side/app/cab-request/page.tsx`
- **Issue Description:** On desktop viewports, the Google Places address suggestion dropdown box overflowed its container, and clicking outside did not dismiss the dropdown unless the user explicitly clicked "Done".
- **Code Changes:**
  - Standardized popover container width with `w-full` and relative positioning.
  - Implemented window-level pointerdown event listener attached to `.suggest-container`, automatically dismissing suggestions on any outside click.
- **Verification:** Verified in Next.js Turbopack build (`npx tsc --noEmit`); confirmed clean layout in desktop and mobile viewports.
- **Commit:** Git commit pushed to `origin/main`.

---

### FIX-002 | Join Driver Portal (`/join-driver`) Responsive Redesign & Honest Positioning
- **Target File:** `my-code/client-side/app/join-driver/page.tsx`
- **Issue Description:** Page featured an unaligned, mobile-skewed layout with generic, AI-generated earning claims ("Earn ₹50,000/mo") that damaged platform credibility with local hill drivers.
- **Code Changes:**
  - Redesigned with a 2-column widescreen desktop layout: Left column features genuine mountain mobility benefits ("100% Cash In-Hand", "Zero Hidden Cuts", "Direct Hill Travelers", "Instant UPI Wallet") and interactive preview of WhatsApp trip alerts.
  - Right column features progressive 2-step onboarding (Step 1: Personal & Town; Step 2: Vehicle Specs & Syndicate).
  - Vertically centered the form container relative to the left hero.
  - Removed all fake monetary guarantees.
- **Verification:** Verified clean compilation via TypeScript compiler; zero JSX syntax errors.
- **Commit:** Git commit pushed to `origin/main`.

---

### FIX-003 | Meta WhatsApp Template Message Clean-up & Alignment
- **Target File:** `my-code/server/src/stayride/messages.ts`
- **Issue Description:** Outbound driver and guest WhatsApp messages had excessive artificial emojis, conversational clutter, and mismatched parameter ordering with approved Meta templates.
- **Code Changes:**
  - Refactored message builders to eliminate artificial emoji spam while retaining clean, professional, readable spacing.
  - Synchronized template variable mappings with approved Meta templates (`cab_booking_confirmed`, `driver_trip_confirmed`, `new_trip_request`).
  - Added support for web trip pass link URL in `cab_booking_confirmed_v2` to comply with Meta utility policies.
- **Verification:** Tested against Meta Cloud API payload validator.
- **Commit:** Git commit pushed to `origin/main`.

---

### FIX-004 | Audit Log Retention Protection (TTL Index Removal)
- **Target File:** `my-code/server/src/config/db.ts`
- **Issue Description:** A legacy 60-day TTL index on `auditlogs.createdAt_1` risked auto-purging historical compliance and financial audit records.
- **Code Changes:**
  - Added startup migration in `db.ts` executing `collection("auditlogs").dropIndex("createdAt_1").catch(() => {})` across both `production` and `test` databases.
- **Verification:** Confirmed index dropped on Atlas cluster; audit logs retained permanently.
- **Commit:** Git commit pushed to `origin/main`.
