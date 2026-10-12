# Hospitality & Hill Transit Network — Documentation Index

This directory maintains all master specifications, architectural plans, data schemas, API contracts, and operational execution plans for the 4-sided platform connecting **Travelers (Client)**, **Homestay Hosts (Owner)**, **Cab Drivers**, and the **Super Admin** via the centralized Node.js + Express backend server.

---

## Documentation Index

| File | Purpose |
| :--- | :--- |
| **[`00_REQUIREMENTS.md`](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/docs/00_REQUIREMENTS.md)** | Core domain overview, the 4-sided business model, free PMS hook, high-margin cab transfers, and OTA synchronization requirements. |
| **[`01_ARCHITECTURE.md`](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/docs/01_ARCHITECTURE.md)** | Single domain + 4 isolated subdomains topology, zero code-leak security design, role-based JWT auth, and free-first technology matrix. |
| **[`02_DATA_SCHEMA.md`](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/docs/02_DATA_SCHEMA.md)** | Canonical shared Mongoose schemas harmonizing Multi-Tenant Properties, Rooms, Bookings, Guests CRM, Drivers, and Cab Trips. |
| **[`03_API_CONTRACT.md`](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/docs/03_API_CONTRACT.md)** | Complete REST API endpoint reference (`/api/v1/*`), request bodies, response formats, and status codes. |
| **[`04_CLIENT_OWNER_INTEGRATION.md`](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/docs/04_CLIENT_OWNER_INTEGRATION.md)** | Integration guide for connecting client-side server actions and owner-side `estate-provider` to the live backend server. |
| **[`05_TODO.md`](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/docs/05_TODO.md)** | Granular master checklist with checkboxes and milestones across all 6 phases. |

---

## Portals & Runtime Ports

- **Client Application (`yourdomain.com`)**: `http://localhost:3000` (`/Users/tirtharaj/Desktop/Desktop/github/nakh/client-side`)
  - Public catalog & dedicated stay page: `yourdomain.com/h/:slug`
- **Owner Dashboard (`owner.yourdomain.com`)**: `http://localhost:3001` (`/Users/tirtharaj/Desktop/Desktop/github/nakh/owner-side`)
  - Free PMS, room inventory, live calendar, local driver roster
- **Driver Portal (`driver.yourdomain.com`)**: `http://localhost:3002` (Mobile PWA)
  - Daily trip dispatches, pickup status toggles, earnings ledger
- **Super Admin (`admin.yourdomain.com`)**: `http://localhost:3003` (Control Tower)
  - Marketplace financials, driver payout settlement desk, property approvals
- **Central API Server (`api.yourdomain.com`)**: `http://localhost:5050/api/v1` (`/Users/tirtharaj/Desktop/Desktop/github/nakh/server`)
