# StayCabs Financial Logic, Commission Splits & Wallet Audit

**Document ID:** `QA/11_FINANCIAL_AUDIT`  
**Revision Date:** 2026-11-06  
**Auditor:** Senior Financial Logic Auditor (Agent 8)  

---

## 1. Core Mathematical Model & The Law of Rupee Conservation

The StayCabs financial engine is governed by strict mathematical conservation rules implemented in `server/src/services/commission.service.ts`:

$$\text{Agreed Fare} \equiv \text{Platform Fee} + \text{Homestay Commission} + \text{Driver Net Take-Home}$$

```mermaid
flowchart TD
    AF[Total Agreed Fare: ₹3,000] --> Adv[Online Advance Collected: ₹500<br/>• Covers Escrow & Commission<br/>• Floored by Min Advance Floor]
    AF --> RemCash[Remaining Cash / UPI to Driver: ₹2,500<br/>• Collected in hand at destination]

    Adv --> PF[Platform Fee: ₹150 (5%)]
    Adv --> HC[Homestay Host Referral: ₹150 (5%)]
    Adv --> DSA[Driver Share of Advance Surplus: ₹200<br/>• Credited to Driver Sovereign Wallet]

    RemCash --> DNet[Driver Net Take-Home: ₹2,700]
    DSA --> DNet

    style AF fill:#f9f,stroke:#333,stroke-width:2px
    style DNet fill:#bbf,stroke:#333,stroke-width:2px
```

### Definitive Invariant Equations

1. **Total Commission**:
   $$\text{Total Commission} = \text{Platform Fee} + \text{Homestay Commission}$$
2. **Advance Required from Guest**:
   $$\text{Advance Amount} = \min(\text{Agreed Fare}, \max(\text{Min Advance Floor}, \text{Total Commission}, \text{Agreed Fare} \times \text{Advance Rate}))$$
3. **Driver Sovereign Wallet Credit (`driverShareOfAdvance`)**:
   $$\text{driverShareOfAdvance} = \max(0, \text{Advance Amount} - \text{Total Commission})$$
4. **Cash Collected In Hand by Driver**:
   $$\text{remainingCashToDriver} = \max(0, \text{Agreed Fare} - \text{Advance Amount})$$
5. **Driver Total Net Earnings**:
   $$\text{driverPayoutAmount} = \text{remainingCashToDriver} + \text{driverShareOfAdvance} \equiv \text{Agreed Fare} - \text{Total Commission}$$

---

## 2. Invariant Proof Across Operational Test Cases

| Scenario | Input Fare | Platform Fee (5%) | Host Comm (5%) | Total Comm (10%) | Min Floor | Advance Paid | Cash to Driver | Driver Wallet Share | Driver Total Take-Home | Check Sum |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Standard Mountain Trip** | ₹3,000 | ₹150 | ₹150 | ₹300 | ₹500 | ₹500 | ₹2,500 | ₹200 | ₹2,700 | ₹3,000 ✅ |
| **Exact 10% Advance** | ₹4,000 | ₹200 | ₹200 | ₹400 | ₹400 | ₹400 | ₹3,600 | ₹0 | ₹3,600 | ₹4,000 ✅ |
| **High Advance (25%)** | ₹5,000 | ₹250 | ₹250 | ₹500 | ₹500 | ₹1,250 | ₹3,750 | ₹750 | ₹4,500 | ₹5,000 ✅ |
| **Odd Rupee Fractional** | ₹3,333 | ₹167 | ₹167 | ₹334 | ₹500 | ₹500 | ₹2,833 | ₹166 | ₹2,999 | ₹3,333 ✅ |
| **Small Local Fare** | ₹600 | ₹30 | ₹30 | ₹60 | ₹500 | ₹500 | ₹100 | ₹440 | ₹540 | ₹600 ✅ |
| **Fare Below Floor** | ₹400 | ₹20 | ₹20 | ₹40 | ₹500 | ₹400 | ₹0 | ₹360 | ₹360 | ₹400 ✅ |
| **Own-Fleet Trip** | ₹3,000 | ₹90 (3%)| ₹0 (0%) | ₹90 | ₹0 | ₹90 | ₹2,910 | ₹0 | ₹2,910 | ₹3,000 ✅ |

> [!NOTE]
> In 100% of examined scenarios, $\text{PF} + \text{HC} + \text{Driver Take-Home} \equiv \text{Agreed Fare}$. Integer rounding discrepancies never produce fractional leaks or negative driver balances.

---

## 3. Driver Sovereign Wallet Lifecycle Audit

```mermaid
stateDiagram-v2
    [*] --> Ineligible: Ride Confirmed / In Progress
    Ineligible --> Eligible: Ride COMPLETED & Advance Paid
    Eligible --> LockedInPayout: Driver Requests Payout (POST /driver/payouts/request)
    LockedInPayout --> Settled: Admin Verifies Bank Transfer & Inputs UTR
    LockedInPayout --> Eligible: Admin Rejects Payout (Locks Released)
    Settled --> [*]: Payout History Archived
```

### Safety Controls Verified in Implementation:
1. **Payout Hold Safeguard (`PAYOUT_HOLD`)**:
   - Completed rides where boarding PIN was bypassed (`completedWithoutPin === true`) are automatically held out of payout eligibility.
   - Rides flagged as passenger no-show (`noShow === true`) or pending refund (`refundStatus !== 'NONE'`) are strictly excluded.
2. **Atomic Trip Locking**:
   - `requestDriverPayout` locks eligible trips atomically:
     ```typescript
     Cab.updateMany({ _id: { $in: ids }, driverPayoutId: null }, { $set: { driverPayoutId: String(payoutId) } })
     ```
   - If the locked trip count does not exactly equal the eligible list length (detecting a race condition), the payout request is aborted, deleted, and all locked trips are freed.
3. **Optimistic Concurrency Lock**:
   - Driver client passes `expectedAmount`. If the available balance changed during form review, server rejects with `409 CONFLICT`, prompting driver to review revised balance.
4. **Rejection Auto-Recovery**:
   - When an admin rejects a payout, `rejectPayout` resets `driverPayoutId = null` on all locked trips, immediately making the funds available again in the driver's wallet.

---

## 4. Homestay Host Referral Commission Audit

- **Referral Credit Rule**: Homestay hosts earn their referral commission (`homestayCommissionAmount`, default 5%) only upon confirmed ride completion.
- **Own-Fleet Exemption**: If the host dispatches their private vehicle, `hcPercent` is set to `0%` because the homestay retains 100% of the driver fare, and only a discounted platform fee (`ownFleetFeePercent`, default 3%) is charged.
- **Host Payout Isolation**: Homestay payouts are isolated by tenant key (`tenantId`). A host can have at most one pending payout request at a time (`one_pending_payout_per_tenant` index).
- **Admin Settlement**: Settling a host payout stamps `status = 'SETTLED'`, records bank UTR number, and updates `commissionPaid = true` across all associated bookings.

---

## 5. Audit Findings & Security Guarantees

1. **Negative Debt Prevention**: The advance amount collected from the guest is guaranteed to be $\ge \text{Total Commission}$. Drivers are NEVER placed into negative debt or forced to pay commission out of pocket.
2. **Snapshot Immutability**: All rates, split amounts, and payout shares are frozen in `financialSnapshot` upon quote acceptance. Admin updates to global settings never alter past bookings.
3. **Traceability**: All financial mutations (advances, claims, voids, payout requests, settlements, rejections) generate immutable entries in `auditlogs`.
