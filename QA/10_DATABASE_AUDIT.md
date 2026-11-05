# StayCabs Database Architecture, Integrity & Schema Audit

**Document ID:** `QA/10_DATABASE_AUDIT`  
**Revision Date:** 2026-11-06  
**Auditor:** Database Auditor (Agent 7)  

---

## 1. Physical Cluster Specifications & Connection Topology

- **Cluster Provider:** MongoDB Atlas Multi-Cloud (Cluster 0)
- **Primary Endpoint:** `cluster0.1yp92vh.mongodb.net`
- **Driver Version:** Mongoose 8.x / MongoDB Node Driver 6.x
- **Connection Pool Strategy:** `maxPoolSize = 10` per serverless instance (calibrated for Atlas M0 connection headroom, max 500 connections across all concurrent functions).
- **DNS Lookup Fallback:** `dns.setServers(["8.8.8.8", "1.1.1.1"])` configured in non-Vercel environments to bypass Indian ISP SRV blocking issues.
- **Fail-Closed Safeguard:** In-memory fallback (`MongoMemoryServer`) is strictly disabled in production (`isDeployed === true`). Missing credentials throw a fatal 503 instead of risking ephemeral data loss.

---

## 2. Quantitative Census of Active Databases

| Metric | Production Database (`production`) | Demo / Test Database (`test`) |
| :--- | :--- | :--- |
| **Storage on Disk** | ~4.66 MB | ~4.16 MB |
| **Total Collections**| 19 Collections | 16 Collections |
| **`users` Count** | 4 records (Real hosts, drivers, admins) | 6 records (Demo hosts, demo drivers) |
| **`cabrequests` Count**| 24 records (Live guest and driver requests)| 7 records (Demo ride flows) |
| **`drivers` Count** | 5 records (Approved & pending fleet) | 6 records (Simulated hill drivers) |
| **`payoutrequests` Count**| 2 records (Settled host/driver claims) | 3 records (Demo settlements) |
| **`auditlogs` Count** | 107 records (Complete audit history) | 6 records (Test trace logs) |
| **`bookings` Count** | 3 records (Real homestay reservations) | 11 records (Demo bookings) |
| **`rooms` Count** | 0 records | 7 records (Demo room inventory) |
| **`properties` Count**| 2 records | 5 records (Demo estates) |
| **`stayridetenants` Count**| 7 records | 2 records |
| **`guestlinks` Count**| 4 records | 0 records |
| **`commissionsettings` Count**| 1 record (Master platform rates) | 1 record (Demo platform rates) |
| **`idempotencykeys` Count**| 3 records | 0 records |

---

## 3. Index Health & Constraint Verification

### Verified Core Indexes

1. **Partial Compound Unique Payout Locks (`payoutrequests`)**:
   - `one_pending_payout_per_tenant`: `{ tenantId: 1, status: 1 }` (Partial filter: `{ recipientType: 'HOMESTAY', status: 'PENDING' }`).
   - `one_pending_payout_per_driver`: `{ driverId: 1, status: 1 }` (Partial filter: `{ recipientType: 'DRIVER', status: 'PENDING' }`).
   - **Audit Finding**: Both indexes are built and active. Attempts to insert duplicate concurrent pending payouts for the same tenant or driver throw MongoDB E11000 duplicate key error, completely eliminating race-condition double withdrawals.

2. **Cab Request Reference Uniqueness (`cabrequests`)**:
   - `{ reference: 1 }` (Unique).
   - **Audit Finding**: Guarantees reference collisions (`REQ-XXXXXXXXXX`) are mathematically rejected.

3. **User Identity Uniqueness (`users`)**:
   - `{ email: 1 }` (Unique).
   - `{ clerkId: 1 }` (Unique, Sparse).
   - **Audit Finding**: Prevents account duplication while supporting sparse Clerk external identities.

4. **Audit Log Retention Index Purge (`auditlogs`)**:
   - A historical 60-day TTL index (`createdAt_1`) was identified and deliberately dropped on server startup (`db.ts:98-100`).
   - **Audit Finding**: Verified that `createdAt_1` TTL index is dropped in both `production` and `test`, ensuring financial audit trails and state changes are retained permanently.

---

## 4. Referential Integrity & Orphan Record Analysis

1. **Trip-to-Payout Reference Verification**:
   - Every trip in `cabrequests` with `driverPayoutId !== null` was checked against `payoutrequests`.
   - **Orphan Auto-Heal**: `releaseStaleDriverLocks()` automatically verifies that locked trips correspond to active non-rejected payouts. If a payout is deleted or orphaned, the locks are automatically cleared by the system on next wallet read.
2. **Orphan Cab Request Sweep**:
   - `cancelOrphanRequests()` runs periodically, sweeping any `CabRequest` created more than 2 minutes ago that failed to save to the tenant store. It marks them `CANCELLED` with reason "Request was not saved for the homestay" to prevent dangling zombie requests.
3. **Soft-Deleted User Isolation**:
   - Soft-deleted users have `deletedAt` stamped and `accountStatus = 'BLOCKED'`.
   - Financial ledger entries retain the user ID foreign key, ensuring historical accounting reports remain intact.

---

## 5. Production Testing Safety Guidelines

For all QA and automated scenario verification on the live cluster:
1. **Demo Database First**: Execute 100% of mutation-heavy scenarios in the `test` database (`isDemo = true`) before touching production.
2. **Strict Record Identifier Prefix**: Any test record created in the `production` database must strictly carry the prefix `STAYCABS_QA_<UNIQUE_ID>` in guest names, notes, and references.
3. **Zero Mutation of Real Records**: Pre-existing production records with IDs not generated by the QA runner must never be updated, cancelled, or deleted.
4. **Zero Live Money Transfers**: Razorpay test mode or simulation mode must be active; no real bank or UPI transfers may be executed.
