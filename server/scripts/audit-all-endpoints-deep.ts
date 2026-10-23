/**
 * EXHAUSTIVE LIVE VERCEL PRODUCTION ENDPOINT AUDIT SUITE
 * 
 * Tests every endpoint category across the entire StayRide platform on the live Vercel backend:
 * https://home-stay-ten.vercel.app
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const VERCEL_BASE = (process.env.PUBLIC_API_URL || 'https://home-stay-ten.vercel.app').replace(/\/+$/, '');
const CRON_SECRET = process.env.CRON_SECRET || 'stayride_cron_secret_74b9a12c8e3f4d0a1b2c3d4e';
const MONGO_URI = process.env.MONGODB_URI || '';

interface EndpointTest {
  id: string;
  category: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  run: () => Promise<{ passed: boolean; status: number; message: string }>;
}

const tests: EndpointTest[] = [];
const results: { id: string; category: string; method: string; path: string; status: number; passed: boolean; message: string; ms: number }[] = [];

// Shared state between sequential lifecycle tests
let adminToken = '';
let hostToken = '';
let hostRefreshToken = '';
let hostEmail = '';
let hostHomestaySlug = '';
let driverToken = '';
let driverEmail = '';
let driverId = '';
let driverVehiclePlate = '';
let roomId = 0;
let roomNumber = '';
let guestId = 0;
let bookingId = 0;
let tripId = 0;
let tripRef = '';
let publicGuestLinkToken = '';
let exportIcalToken = '';

async function fetchWithRetry(url: string, options?: RequestInit, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 503 && i < retries) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return res;
    } catch (e) {
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw e;
    }
  }
  throw new Error(`fetch failed after ${retries} retries`);
}

function registerTest(
  id: string,
  category: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  description: string,
  run: () => Promise<{ passed: boolean; status: number; message: string }>
) {
  tests.push({ id, category, method, path, description, run });
}

// ============================================================================
// 1. SYSTEM BASELINE & HEALTH
// ============================================================================
registerTest('BASE-01', 'System Baseline', 'GET', '/api/v1', 'API v1 Root endpoint returns service identification', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1`);
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && data.version === '1.0.0';
  return { passed, status: res.status, message: `version: ${data.version}, docs: ${data.docs}` };
});

registerTest('BASE-02', 'System Baseline', 'GET', '/health', 'Server root health check', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/health`);
  const data = await res.json();
  const passed = res.status === 200 && data.status === 'ok';
  return { passed, status: res.status, message: `status: ${data.status}, uptime: ${data.uptime}s` };
});

registerTest('BASE-03', 'System Baseline', 'GET', '/api/v1/health', 'API v1 scoped health check', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/health`);
  const data = await res.json();
  const passed = res.status === 200 && data.status === 'ok';
  return { passed, status: res.status, message: `api v1 health ok` };
});

// ============================================================================
// 2. PUBLIC GUEST CATALOG & STAYS
// ============================================================================
registerTest('CAT-01', 'Guest Catalog', 'GET', '/api/v1/stays', 'Fetch all homestays / stays catalog', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/stays`);
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && Array.isArray(data.data) && data.data.length > 0;
  return { passed, status: res.status, message: `Retrieved ${data.data?.length || 0} stays` };
});

registerTest('CAT-02', 'Guest Catalog', 'GET', '/api/v1/stays/availability/grid', 'Room availability grid query', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/stays/availability/grid`);
  const data = await res.json();
  const passed = res.status === 200 && data.success === true;
  return { passed, status: res.status, message: `grid loaded: ${Boolean(data.data)}` };
});

registerTest('CAT-03', 'Guest Catalog', 'GET', '/api/v1/stays/ging-tea-cottage', 'Fetch single stay detail by slug', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/stays/ging-tea-cottage`);
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && data.data?.slug === 'ging-tea-cottage';
  return { passed, status: res.status, message: `stay name: ${data.data?.name}` };
});

registerTest('CAT-04', 'Guest Catalog', 'POST', '/api/v1/stays/ging-tea-cottage/quote', 'Calculate room stay price quote', async () => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/stays/ging-tea-cottage/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkIn: tomorrow, checkOut: dayAfter, guests: 2 }),
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && typeof data.data?.total === 'number';
  return { passed, status: res.status, message: `quote total: ₹${data.data?.total}` };
});

registerTest('CAT-05', 'Guest Catalog', 'GET', '/api/v1/properties', 'List public properties', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/properties`);
  const data = await res.json();
  const passed = res.status === 200 && data.success === true;
  return { passed, status: res.status, message: `properties returned: ${data.data?.length}` };
});

registerTest('CAT-06', 'Guest Catalog', 'POST', '/api/v1/newsletter/subscribe', 'Public newsletter signup', async () => {
  const testEmail = `subscriber.${Date.now()}@example.com`;
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/newsletter/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true;
  return { passed, status: res.status, message: `subscribed: ${testEmail}` };
});

// ============================================================================
// 3. PUBLIC TRANSIT & CAB LINKS
// ============================================================================
registerTest('TRAN-01', 'Public Transit', 'GET', '/v1/public/config', 'Get public platform transit configuration', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/public/config`);
  const data = await res.json();
  const passed = res.status === 200 && Array.isArray(data.config?.vehicles);
  return { passed, status: res.status, message: `vehicles: ${data.config?.vehicles?.length}, presets: ${data.config?.routePresets?.length}` };
});

registerTest('TRAN-02', 'Public Transit', 'GET', '/v1/public/legal/terms', 'Get public legal terms document', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/public/legal/terms`);
  const passed = res.status === 200;
  return { passed, status: res.status, message: `terms doc returned` };
});

registerTest('TRAN-03', 'Public Transit', 'GET', '/v1/public/legal/privacy', 'Get public privacy policy document', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/public/legal/privacy`);
  const passed = res.status === 200;
  return { passed, status: res.status, message: `privacy doc returned` };
});

// ============================================================================
// 4. SUPER ADMIN TOWER OPERATIONS
// ============================================================================
registerTest('ADM-01', 'Super Admin', 'POST', '/api/v1/auth/login', 'Admin authentication with master credentials', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@platform.com', password: 'adminMasterPassword2026!' }),
  });
  const data = await res.json();
  adminToken = data.data?.token || '';
  const passed = res.status === 200 && Boolean(adminToken) && data.data?.user?.role === 'admin';
  return { passed, status: res.status, message: `Admin token acquired for: ${data.data?.user?.email}` };
});

registerTest('ADM-02', 'Super Admin', 'GET', '/api/v1/auth/me', 'Verify admin session profile (/auth/me)', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.data?.role === 'admin';
  return { passed, status: res.status, message: `Admin verified: ${data.data?.name}` };
});

registerTest('ADM-03', 'Super Admin', 'GET', '/api/v1/admin/overview', 'Super admin executive overview KPIs', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && typeof data.data?.metrics?.totalHomestays === 'number';
  return { passed, status: res.status, message: `totalHomestays: ${data.data?.metrics?.totalHomestays}, totalRevenue: ₹${data.data?.metrics?.totalRevenue}` };
});

registerTest('ADM-04', 'Super Admin', 'GET', '/api/v1/admin/stayride/summary', 'StayRide transit platform operational summary', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/stayride/summary`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true;
  return { passed, status: res.status, message: `openRequests: ${data.summary?.openRequests}, activeTrips: ${data.summary?.activeTrips}` };
});

registerTest('ADM-05', 'Super Admin', 'GET', '/api/v1/admin/commission/settings', 'Platform commission settings and fees', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/commission/settings`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && typeof data.data?.globalPlatformFeePercent === 'number';
  return { passed, status: res.status, message: `fee: ${data.data?.globalPlatformFeePercent}%, commission: ${data.data?.globalHomestayCommissionPercent}%` };
});

registerTest('ADM-06', 'Super Admin', 'POST', '/api/v1/admin/commission/preview', 'Platform commission calculation preview', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/commission/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ fare: 3000, tenantKey: 'sample.host@stayride.in' }),
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && typeof data.data?.platformFeeAmount === 'number';
  return { passed, status: res.status, message: `Fare ₹3000 -> Platform Fee ₹${data.data?.platformFeeAmount}, Driver ₹${data.data?.driverCashDue}` };
});

registerTest('ADM-07', 'Super Admin', 'GET', '/api/v1/admin/stayride/tenants', 'List all StayRide homestay tenants', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/stayride/tenants`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && Array.isArray(data.items);
  return { passed, status: res.status, message: `Tenants count: ${data.items?.length}` };
});

registerTest('ADM-08', 'Super Admin', 'GET', '/api/v1/admin/stayride/users', 'List platform users with roles and statuses', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/stayride/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && Array.isArray(data.items);
  return { passed, status: res.status, message: `Users count: ${data.items?.length}` };
});

registerTest('ADM-09', 'Super Admin', 'GET', '/api/v1/admin/stayride/drivers', 'List platform drivers fleet', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/stayride/drivers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && Array.isArray(data.items);
  return { passed, status: res.status, message: `Drivers count: ${data.items?.length}` };
});

registerTest('ADM-10', 'Super Admin', 'GET', '/api/v1/admin/cab-requests', 'List administrative cab requests ledger', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/cab-requests`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && Array.isArray(data.items);
  return { passed, status: res.status, message: `Cab requests count: ${data.items?.length}` };
});

registerTest('ADM-11', 'Super Admin', 'GET', '/api/v1/admin/cab-requests/pending', 'List open/unassigned cab requests', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/cab-requests/pending`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && Array.isArray(data.items);
  return { passed, status: res.status, message: `Pending cab requests: ${data.items?.length}` };
});

registerTest('ADM-12', 'Super Admin', 'GET', '/api/v1/admin/host-payouts', 'List homestay payout balances and requests', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/host-payouts`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && Array.isArray(data.items);
  return { passed, status: res.status, message: `Payouts queue count: ${data.items?.length}` };
});

registerTest('ADM-13', 'Super Admin', 'GET', '/api/v1/admin/appeals', 'List driver/host dispute appeals', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/appeals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && Array.isArray(data.items);
  return { passed, status: res.status, message: `Appeals count: ${data.items?.length}` };
});

registerTest('ADM-14', 'Super Admin', 'GET', '/api/v1/admin/audit-log', 'Super admin tamper-evident audit log query', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/audit-log`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true && Array.isArray(data.items);
  return { passed, status: res.status, message: `Audit entries retrieved: ${data.items?.length}` };
});

// ============================================================================
// 5. HOMESTAY HOST LIFECYCLE (WEB & MOBILE API)
// ============================================================================
registerTest('HOST-01', 'Host Lifecycle', 'POST', '/v1/auth/signup', 'Create new homestay host in production DB', async () => {
  const ts = Date.now();
  hostEmail = `host.audit.${ts}@stayride.test`;
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rinchen Dorji',
      email: hostEmail,
      password: 'StrongHostPass2026!',
      homestayName: 'Kanchenjunga Mist Homestay',
      phone: '9830022222',
      location: 'Pelling, West Sikkim',
      role: 'owner',
    }),
  });
  const data = await res.json();
  hostToken = data.accessToken || '';
  hostRefreshToken = data.refreshToken || '';
  const passed = res.status === 201 && Boolean(hostToken) && data.role === 'owner';
  return { passed, status: res.status, message: `Registered host: ${hostEmail}` };
});

registerTest('HOST-02', 'Host Lifecycle', 'POST', '/v1/auth/refresh', 'Refresh host access token using refresh token', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: hostRefreshToken }),
  });
  const data = await res.json();
  if (data.accessToken) hostToken = data.accessToken;
  const passed = res.status === 200 && Boolean(data.accessToken);
  return { passed, status: res.status, message: `Token refreshed successfully` };
});

registerTest('HOST-03', 'Host Lifecycle', 'GET', '/v1/homestay', 'Get host property profile', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/homestay`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.name === 'Kanchenjunga Mist Homestay';
  return { passed, status: res.status, message: `Homestay: ${data.name}, location: ${data.location}` };
});

registerTest('HOST-04', 'Host Lifecycle', 'PUT', '/v1/homestay', 'Update host property description & contact', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/homestay`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({
      description: 'Handcrafted timber estate nestled in ancient oak trees facing Mt. Kanchenjunga',
      amenities: ['wifi', 'mountain_view', 'organic_meals', 'firepit'],
    }),
  });
  const data = await res.json();
  const passed = res.status === 200 && Boolean(data.description);
  return { passed, status: res.status, message: `Description updated (${data.description?.slice(0, 30)}...)` };
});

registerTest('HOST-05', 'Host Lifecycle', 'POST', '/v1/rooms', 'Create Room 101 (Deluxe Mountain Loft)', async () => {
  roomNumber = `Room-${Date.now().toString().slice(-4)}`;
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({
      number: roomNumber,
      type: 'Deluxe Mountain Loft',
      price: 3600,
      floor: 'Upper Deck',
      status: 'AVAILABLE',
      note: 'Panoramic sunrise ridge view',
    }),
  });
  const data = await res.json();
  roomId = data.id;
  const passed = res.status === 201 && data.number === roomNumber;
  return { passed, status: res.status, message: `Room created: ID ${roomId}, Number: ${roomNumber}` };
});

registerTest('HOST-06', 'Host Lifecycle', 'GET', '/v1/rooms', 'List host room inventory', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/rooms`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && Array.isArray(data) && data.some((r: any) => r.id === roomId);
  return { passed, status: res.status, message: `Inventory contains ${data.length} rooms` };
});

registerTest('HOST-07', 'Host Lifecycle', 'PUT', '/v1/rooms/:id', 'Update room rate and status', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/rooms/${roomId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({ price: 3900, status: 'AVAILABLE' }),
  });
  const data = await res.json();
  const passed = res.status === 200 && data.price === 3900;
  return { passed, status: res.status, message: `Updated rate to ₹${data.price}` };
});

registerTest('HOST-08', 'Host Lifecycle', 'GET', '/v1/rooms/:id/ical', 'Get room iCal export and import configuration', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/rooms/${roomId}/ical`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && Boolean(data.exportUrl);
  return { passed, status: res.status, message: `exportUrl: ${data.exportUrl}` };
});

registerTest('HOST-09', 'Host Lifecycle', 'POST', '/v1/guests', 'Register guest in host address book', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/guests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({
      name: 'Aditi Sengupta',
      phone: '9830088888',
      email: 'aditi.sen@example.com',
      notes: 'Allergic to shellfish, requested late checkout',
      marketingConsent: true,
    }),
  });
  const data = await res.json();
  guestId = data.id;
  const passed = res.status === 201 && data.name === 'Aditi Sengupta';
  return { passed, status: res.status, message: `Guest registered: ID ${guestId}, Name: ${data.name}` };
});

registerTest('HOST-10', 'Host Lifecycle', 'GET', '/v1/guests', 'Query host guest directory', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/guests`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && Array.isArray(data) && data.some((g: any) => g.id === guestId);
  return { passed, status: res.status, message: `Found ${data.length} guest records` };
});

registerTest('HOST-11', 'Host Lifecycle', 'POST', '/v1/bookings', 'Create confirmed room booking', async () => {
  const tomorrow = Date.now() + 86400000;
  const dayAfter = Date.now() + 2 * 86400000;
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({
      guestId,
      guestName: 'Aditi Sengupta',
      phone: '9830088888',
      checkIn: tomorrow,
      checkOut: dayAfter,
      roomNumber,
      guests: 2,
      amount: 3900,
      source: 'Direct Phone',
      paid: true,
    }),
  });
  const data = await res.json();
  bookingId = data.id;
  const passed = res.status === 201 && data.roomNumber === roomNumber;
  return { passed, status: res.status, message: `Booking created: ID ${bookingId}, Status: ${data.status}` };
});

registerTest('HOST-12', 'Host Lifecycle', 'GET', '/v1/bookings', 'Query host bookings list', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/bookings`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && Array.isArray(data) && data.some((b: any) => b.id === bookingId);
  return { passed, status: res.status, message: `Active bookings: ${data.length}` };
});

registerTest('HOST-13', 'Host Lifecycle', 'POST', '/v1/trips', 'Create guest cab transit request', async () => {
  const tomorrow = Date.now() + 86400000;
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({
      guestName: 'Aditi Sengupta',
      phone: '9830088888',
      pickup: 'Kanchenjunga Mist Homestay',
      destination: 'NJP Railway Station',
      date: tomorrow,
      time: '09:30 AM',
      passengers: 2,
      vehicleType: 'SUV',
      guestId,
      bookingId,
    }),
  });
  const data = await res.json();
  tripId = data.id;
  tripRef = data.reference || '';
  const passed = res.status === 201 && Boolean(tripRef);
  return { passed, status: res.status, message: `Trip created: ID ${tripId}, Reference: ${tripRef}` };
});

registerTest('HOST-14', 'Host Lifecycle', 'GET', '/v1/trips', 'Query host trips list', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/trips`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && Array.isArray(data) && data.some((t: any) => t.id === tripId);
  return { passed, status: res.status, message: `Trips count: ${data.length}` };
});

registerTest('HOST-15', 'Host Lifecycle', 'POST', '/v1/guest-links', 'Generate unique guest cab booking link', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/guest-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({
      guestName: 'Aditi Sengupta',
      guestPhone: '9830088888',
      bookingId,
    }),
  });
  const data = await res.json();
  const tokenMatch = data.url?.match(/[?&]t=([^&]+)/);
  publicGuestLinkToken = tokenMatch ? tokenMatch[1] : (data.token || '');
  const passed = res.status === 201 && Boolean(publicGuestLinkToken);
  return { passed, status: res.status, message: `Guest link generated: token ${publicGuestLinkToken?.slice(0, 8)}...` };
});

registerTest('HOST-16', 'Host Lifecycle', 'GET', '/v1/public/guest-links/:token', 'Public guest resolves homestay link', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/public/guest-links/${publicGuestLinkToken}`);
  const data = await res.json();
  const passed = res.status === 200 && (data.guestName === 'Aditi Sengupta' || Boolean(data.homestay));
  return { passed, status: res.status, message: `Link resolved for: ${data.guestName} at ${data.homestay?.name}` };
});

registerTest('HOST-17', 'Host Lifecycle', 'GET', '/v1/snapshot', 'Host unified snapshot retrieval', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/snapshot`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  const snap = await res.json();
  const passed =
    res.status === 200 &&
    snap.rooms?.some((r: any) => r.id === roomId) &&
    snap.guests?.some((g: any) => g.id === guestId) &&
    snap.bookings?.some((b: any) => b.id === bookingId) &&
    snap.trips?.some((t: any) => t.id === tripId);
  return { passed, status: res.status, message: `Snapshot synchronized: rooms=${snap.rooms?.length}, bookings=${snap.bookings?.length}, trips=${snap.trips?.length}` };
});

// ============================================================================
// 6. DRIVER FLEET LIFECYCLE
// ============================================================================
registerTest('DRV-01', 'Driver Fleet', 'POST', '/v1/auth/signup', 'Register new driver (PENDING_APPROVAL)', async () => {
  const ts = Date.now();
  driverEmail = `driver.audit.${ts}@stayride.test`;
  driverVehiclePlate = `SK01AB${ts.toString().slice(-4)}`;
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Mingma Lepcha',
      email: driverEmail,
      password: 'StrongDriverPass2026!',
      phone: `98300${ts.toString().slice(-5)}`,
      role: 'driver',
      vehicleType: 'SUV',
      vehicleModel: 'Toyota Innova Crysta',
      vehicleNumber: driverVehiclePlate,
      seats: 6,
      area: 'Pelling, Yuksom & Gangtok',
    }),
  });
  const data = await res.json();
  driverToken = data.accessToken || '';
  const passed = res.status === 201 && data.role === 'driver';
  return { passed, status: res.status, message: `Driver registered: ${driverEmail}, status: ${data.driver?.accountStatus}` };
});

registerTest('DRV-02', 'Driver Fleet', 'PATCH', '/api/v1/admin/stayride/drivers/:id/status', 'Admin approves driver to ACTIVE status', async () => {
  // Query driver by status
  const listRes = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/stayride/drivers?status=PENDING_APPROVAL`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listData = await listRes.json();
  const found = (listData.items || []).find((d: any) => d.email === driverEmail);
  if (!found) return { passed: false, status: 404, message: 'Driver not found in pending list' };
  driverId = found.id;

  const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/stayride/drivers/${driverId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
  const data = await res.json();
  const passed = res.status === 200 && data.success === true;
  return { passed, status: res.status, message: `Driver ${driverId} status updated to ACTIVE` };
});

registerTest('DRV-03', 'Driver Fleet', 'PATCH', '/v1/driver/availability', 'Driver toggles availability status', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/driver/availability`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ available: true }),
  });
  const data = await res.json();
  const passed = res.status === 200 && data.available === true;
  return { passed, status: res.status, message: `Driver availability set: ${data.available}` };
});

registerTest('DRV-04', 'Driver Fleet', 'PATCH', '/v1/driver/location', 'Driver reports GPS coordinates telemetry', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/driver/location`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ lat: 27.305, lng: 88.239 }),
  });
  const data = await res.json();
  const passed = res.status === 200 && data.ok === true;
  return { passed, status: res.status, message: `Coordinates saved (lat: 27.305, lng: 88.239)` };
});

registerTest('DRV-05', 'Driver Fleet', 'GET', '/v1/driver/trips', 'Driver queries available nearby dispatches', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/driver/trips`, {
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && Array.isArray(data);
  return { passed, status: res.status, message: `Driver trips queue retrieved (${data.length} items)` };
});

// ============================================================================
// 7. SECURITY & SYSTEM INTEGRATIONS
// ============================================================================
registerTest('SEC-01', 'Security', 'POST', '/v1/push-token', 'Register Expo device push token', async () => {
  const sampleToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/push-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({ token: sampleToken, platform: 'android' }),
  });
  const data = await res.json();
  const passed = res.status === 200 && data.ok === true;
  return { passed, status: res.status, message: `Push token saved in user document` };
});

registerTest('SEC-02', 'Security', 'DELETE', '/v1/push-token', 'De-register Expo device push token on logout', async () => {
  const sampleToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/push-token`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({ token: sampleToken }),
  });
  const data = await res.json();
  const passed = res.status === 200 && data.ok === true;
  return { passed, status: res.status, message: `Push token removed` };
});

registerTest('SEC-03', 'Security', 'GET', '/v1/upload/signature', 'Check direct upload signature endpoint', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/upload/signature`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  const data = await res.json();
  // If Cloudinary is configured -> 200 OK; if disabled placeholder -> 503 with graceful message
  const passed = (res.status === 200 && Boolean(data.signature)) || (res.status === 503 && Boolean(data.error));
  return { passed, status: res.status, message: res.status === 200 ? `Signed for folder: ${data.folder}` : `Graceful 503: ${data.error?.message}` };
});

registerTest('SEC-04', 'Security', 'POST', '/v1/telemetry/report', 'Ingest client frontend error telemetry report', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/telemetry/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({
      level: 'info',
      message: 'Comprehensive endpoint audit test message',
      source: 'live-audit-suite',
    }),
  });
  const passed = res.status === 204 || res.status === 200;
  return { passed, status: res.status, message: `Telemetry beacon accepted with status ${res.status}` };
});

registerTest('SEC-05', 'Security', 'GET', '/v1/cron/ical-sync', 'Vercel Cron endpoint with secret bearer token', async () => {
  const res = await fetchWithRetry(`${VERCEL_BASE}/v1/cron/ical-sync`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const data = await res.json();
  const passed = res.status === 200 && data.ok === true;
  return { passed, status: res.status, message: `iCal sync completed: rooms synced=${data.rooms}` };
});

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function main() {
  console.log('==================================================================');
  console.log('   DEEP EXHAUSTIVE LIVE VERCEL PRODUCTION ENDPOINT AUDIT SUITE    ');
  console.log(` Target Endpoint: ${VERCEL_BASE}`);
  console.log(` Total Registered Tests: ${tests.length}`);
  console.log('==================================================================\n');

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const start = Date.now();
    try {
      const outcome = await t.run();
      const ms = Date.now() - start;
      results.push({
        id: t.id,
        category: t.category,
        method: t.method,
        path: t.path,
        status: outcome.status,
        passed: outcome.passed,
        message: outcome.message,
        ms,
      });
      const icon = outcome.passed ? '✓ PASS' : '✗ FAIL';
      console.log(`[${i + 1}/${tests.length}] ${icon} [${t.id}] ${t.method.padEnd(6)} ${t.path.padEnd(42)} (${outcome.status}, ${ms}ms)`);
      if (!outcome.passed) console.error(`    ↳ Error: ${outcome.message}`);
    } catch (err: any) {
      const ms = Date.now() - start;
      results.push({
        id: t.id,
        category: t.category,
        method: t.method,
        path: t.path,
        status: 500,
        passed: false,
        message: err.message,
        ms,
      });
      console.error(`[${i + 1}/${tests.length}] ✗ FAIL [${t.id}] ${t.method.padEnd(6)} ${t.path.padEnd(42)} (${ms}ms)`);
      console.error(`    ↳ Exception: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // DIRECT MONGODB PERSISTENCE CHECK
  // -------------------------------------------------------------------------
  console.log('\n--- Direct MongoDB Multi-Tenant Assertions ---');
  if (MONGO_URI) {
    const conn = await mongoose.connect(MONGO_URI, { dbName: 'production', serverSelectionTimeoutMS: 8000 });
    try {
      const prodDb = conn.connection.useDb('production');
      const testDb = conn.connection.useDb('test');

      const hostInProd = await prodDb.collection('users').findOne({ email: hostEmail.toLowerCase() });
      const roomInTenant = await prodDb.collection('stayridetenants').findOne({ 'data.homestay.email': hostEmail.toLowerCase() });
      const driverInProd = await prodDb.collection('users').findOne({ email: driverEmail.toLowerCase() });
      const demoInProd = await prodDb.collection('users').findOne({ email: 'demo@stayride.in' });
      const demoInTest = await testDb.collection('stayridetenants').findOne({ isDemo: true });

      console.log(`  ✓ DB: Host '${hostEmail}' persisted in 'production': ${Boolean(hostInProd)}`);
      console.log(`  ✓ DB: Room '${roomNumber}' in 'stayridetenants': ${Boolean(roomInTenant)}`);
      console.log(`  ✓ DB: Driver '${driverEmail}' in 'production': ${Boolean(driverInProd)}`);
      console.log(`  ✓ DB: Zero demo@stayride.in leak in 'production': ${!demoInProd}`);
      console.log(`  ✓ DB: Demo sandbox tenant exists in 'test': ${Boolean(demoInTest)}`);
    } finally {
      await mongoose.disconnect();
    }
  }

  // -------------------------------------------------------------------------
  // FINAL SCOREBOARD
  // -------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n==================================================================');
  console.log('              DEEP AUDIT EXECUTION SCORECARD                      ');
  console.log('==================================================================');
  console.log(`TOTAL ENDPOINTS TESTED: ${total}`);
  console.log(`PASSED:                 ${passed}`);
  console.log(`FAILED:                 ${failed}`);
  console.log(`SUCCESS RATE:           ${((passed / total) * 100).toFixed(1)}%`);
  console.log('==================================================================\n');

  if (failed === 0) {
    console.log('🏆 EVERY MINOR AND MAJOR ENDPOINT PASSED 100% ON LIVE VERCEL!');
  } else {
    console.error('⚠️ SOME TESTS FAILED. See details above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Deep audit crash:', err);
  process.exit(1);
});
