# Tirtha Backend & Integration Documentation Index

This directory maintains all technical specifications, requirements, data schemas, API contracts, integration bridges, and live progress tracking for connecting **Client-Side** and **Owner-Side** via the **Node.js + tsx Backend Server** in `/server`.

---

## Documentation Index

| File | Purpose |
| :--- | :--- |
| **[`00_REQUIREMENTS.md`](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/docs/00_REQUIREMENTS.md)** | Core domain overview (Homestays & Darjeeling Cab Transfers), user roles, and immediate Phase 1 boundaries (Owner <-> Client connect). |
| **[`01_ARCHITECTURE.md`](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/docs/01_ARCHITECTURE.md)** | Technical design, Node.js + tsx runtime, Express server layers (Routes -> Controllers -> Services -> Storage), error handling, and directory structure. |
| **[`02_DATA_SCHEMA.md`](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/docs/02_DATA_SCHEMA.md)** | Canonical shared data models harmonizing Client `Stay` and Owner `RoomUnit`, Bookings, Guests CRM, Drivers Fleet, and Financials. |
| **[`03_API_CONTRACT.md`](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/docs/03_API_CONTRACT.md)** | Complete REST API endpoint reference (`/api/v1/*`), request bodies, response formats, and status codes. |
| **[`04_CLIENT_OWNER_INTEGRATION.md`](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/docs/04_CLIENT_OWNER_INTEGRATION.md)** | Integration guide for connecting `client-side` server actions and `owner-side` `estate-provider` to the live backend server. |
| **[`05_TODO.md`](file:///Users/tirtharaj/Desktop/Desktop/github/nakh/docs/05_TODO.md)** | Granular master checklist with checkboxes and milestones to track progress without losing scope. |

---

## Quick Reference
- **Client App**: `http://localhost:5500` (`/Users/tirtharaj/Desktop/Desktop/github/nakh/client-side`)
- **Owner Portal**: `http://localhost:5501` (`/Users/tirtharaj/Desktop/Desktop/github/nakh/owner-side`)
- **Backend API**: `http://localhost:5050/api/v1` (`/Users/tirtharaj/Desktop/Desktop/github/nakh/server`)
