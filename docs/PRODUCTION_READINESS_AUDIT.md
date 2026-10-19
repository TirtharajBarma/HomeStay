# Production Readiness Audit — StayRide

Status: **NOT production-ready** for the stated goal ("admin supreme, everything in sync, guest → cab → admin → commission").

Method: static, read-only review of source. No DB was running, so no runtime/e2e execution. Claims marked **[verified]** were read directly in source this session; **[agent]** come from sub-agent audits (not re-verified line-by-line).

---

## 1. One-line verdict

The security fixes are done and the StayRide platform (Expo + new admin + `CabRequest`) is internally consistent — but the stack runs **two parallel, unreconciled data stores** (legacy `Booking`/`CabTrip` vs StayRide blob/`CabRequest`), and the admin cannot see or manage tenant-internal data. Guest activity does not reach the owner/admin. That is the blocker.

---

## 2. Sync matrix (what actually talks to what)

| Flow | Writes to | Read by owner app | Read by admin | Reconciled? |
|---|---|---|---|---|
| Guest web (`client-side`) booking | **legacy `Booking`** via `/reservations` alias [verified] | no | legacy admin tab only | ❌ |
| Expo owner app booking | **StayRide blob** `store.bookings` [verified] | yes | ❌ not exposed | ❌ |
| Guest cab (`client-side/app/cab`) | **legacy `CabTrip`** [verified] | no | legacy admin tab only | ❌ |
| Expo guest-link cab → `CabRequest` | StayRide `CabRequest` | via snapshot | new admin cab queue | ✅ (platform-only) |
| Driver app (Expo) | `CabRequest` actions | — | yes | ✅ |

Evidence:
- `server/src/routes/index.ts:32` — `/reservations` is an alias for legacy `bookingRoutes`. [verified]
- `server/src/services/booking.service.ts:2,37,96` — legacy service builds a legacy `Booking` document. [verified]
- `server/src/stayride/routes.ts:1211` — `GET /stayride/bookings` returns the **blob** `store.bookings`. [verified]
- `server/src/stayride/store.ts:345` — `createBooking` writes **only** `this.bookings` (blob). [verified]
- `server/src/stayride/routes.ts:26` — `getBookingModel` is **exported but never called** → the intended blob→legacy mirror was never wired. [verified]
- `client-side/app/cab/confirmed/page.tsx:58` — guest cab confirm persists to legacy **`CabTrip`**. [verified]

**Consequence:** a guest booking on the website is invisible to the homestay owner in the Expo app and to the new admin. A guest cab is invisible to the new cab queue.

---

## 3. Bugs / gaps that block production

### CRITICAL

**C1 — Guest→owner booking is split across two stores, no reconciliation.** [verified]
Guest web → legacy `Booking`; owner app → blob. `getBookingModel` mirror is dead code. Fix: pick one store. Either (a) route `client-side` checkout to `POST /stayride/bookings` (blob) and deprecate legacy `/reservations`, or (b) wire the mirror both directions with a reconciliation job. Until then the owner literally cannot see website bookings.

**C2 — Cab split: guest `CabTrip` vs platform `CabRequest`.** [verified]
Website cab bookings go to legacy `CabTrip`; the new admin queue and driver app operate on `CabRequest`. Fix: funnel all cab creation through `CabRequest` (or expose `CabTrip` in the platform queue).

### HIGH

**H1 — Admin is not supreme over tenant-internal data.** [verified]
StayRide admin routes cover commission, tenants, users, drivers, cab-requests, payouts, appeals, audit — but there is **no admin path to read a tenant's guests / rooms / bookings**, which live in the tenant blob. `stayride-admin.routes.ts` has none. Fix: add admin read endpoints over the tenant store (read-only oversight + override).

**H2 — Admin UI missing Users / Tenants management.** [verified]
Server exposes `GET /stayride/users`, `PATCH /users/:id/role`, `/users/:id/status`, `PUT /stayride/tenants/:tenantKey/controls`, but the frontend tabs are only Overview / Commission / Drivers / Cab requests / Payouts / Appeals / Audit. No Users or Tenants UI. Fix: add the tabs.

### MEDIUM

**M1 — Per-property commission override is dead.** [verified]
`propertyOverrides` is only set as a default `[]` (`commission.service.ts:59`) and declared in the model; nothing reads it when computing splits, and no endpoint writes it. The UI (`admin-side/.../stayride-admin.tsx` ~:337) shows an "override" badge, implying a control that doesn't exist. Fix: apply overrides in the split function and add a write endpoint, or remove the UI.

**H2b — Cross-tenant driver exposure.** [verified]
`sanitizeOpenRequest` (`server/src/stayride/platform.ts`) returns all open `CabRequest`s platform-wide to any approved driver, including `pickup` and `homestayName` (it correctly omits guest PII). Fix: scope open requests to the driver's tenant.

**H3 — Room double-booking race / cross-store double-booking.** [agent]
Both `store.createBooking` and `BookingService.createBooking` do read-then-write overlap checks with no unique index/transaction. Two stores also don't see each other's bookings for the same room. Fix: unique index on (room, date-range) or an atomic reservation, single store.

**H4 — Legacy `owner-side` analytics are fabricated.** [verified]
`owner-side/lib/analytics-data.ts:71` generates `cabTrips` via `Math.random()` — fake numbers presented as analytics. If `owner-side` is shipped anywhere, remove it or wire real data.

### LOW

**L1 — Cross-DB audit write.** [agent] `stayride-admin.routes.ts:35` — the `PUT /commission/settings` audit call omits the `demo` arg, so the audit row lands in the production DB even for demo changes.

**L2 — Dead/duplicate apps.** [verified] `owner-side/` and `driver-side/` legacy Next apps still exist alongside `stayride-expo`; `client-side/` is the guest web. Decide what is actually deployed.

---

## 4. What IS done and correct

- **Security**: Google tokeninfo verification, PIN redaction, IDOR guards, tenant-DB fail-closed 503 — all present in source. Admin routes guarded by `requireRole('admin')` (`admin.routes.ts:10`). [verified]
- **Demo vs production DB isolation**: uses `tenantDbModel(isDemo, ...)` with fail-closed 503 when Mongo is down. One leak only (L1). [agent]
- **Commission engine (platform)**: admin-editable global rates — defaults platform 5% / homestay 10% / advance 15% / min advance 300 (`commission.service.ts:47-58`); validation enforces `pf + hc < 100`, `adv` 5–100. [verified]
- **CabRequest money lifecycle**: unique indexes on `advancePaymentId` and one-pending-payout-per-tenant; assign → record-payment → complete → driver-settled → payout flow exists. [agent]
- **Expo offline outbox**: persisted per-account queue, single-flight flush, 2xx adopt / 5xx+401 retry / other-4xx+410 terminal, snapshot merge. [agent]
- Builds: server `npm run build` green; admin build + `tsc` green; Expo `tsc --noEmit` clean.

---

## 5. Go-live checklist (independent of the blockers)

- [ ] Resolve C1 (guest↔owner bookings) and C2 (cab store).
- [ ] Point Expo `eas.json` env + admin `NEXT_PUBLIC_API_URL` at the live HTTPS API.
- [ ] Production Clerk keys.
- [ ] Remove iOS `NSAllowsArbitraryLoads` (`app.json`) before App Store.
- [ ] Move the in-memory cron to a scheduled job (Vercel serverless won't run it).
- [ ] Payments stay **manual/admin-recorded** (Razorpay intentionally not integrated).
- [ ] No SMS provider configured → prod OTP unusable; password login works. Decide.
- [ ] Fix L1 (`demo` arg on commission audit).

---

## 6. Suggested fix order

1. C1 — unify guest→owner bookings onto one store (biggest user-visible break).
2. C2 — unify cab creation onto `CabRequest`.
3. H1 + H2 — give admin read/manage over tenant data (guests/rooms/bookings) + UI.
4. H3 — atomic room reservation + single store.
5. H-medium/low — propertyOverrides wiring, driver tenant scoping, L1/L2.
