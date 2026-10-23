/**
 * Comprehensive Automated Live Vercel Production Audit Suite
 *
 * Targets:
 *   - Backend: https://home-stay-ten.vercel.app
 *   - Guest Web: https://home-stay-p5rg.vercel.app
 *   - Admin Web: https://home-stay-admin.vercel.app
 * Direct Multi-Tenant DB: MongoDB Atlas (production vs test DB)
 * Cloud Telemetry: Axiom Dataset stayride-api
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const VERCEL_BASE = (process.env.PUBLIC_API_URL || 'https://home-stay-ten.vercel.app').replace(/\/+$/, '');
const CRON_SECRET = process.env.CRON_SECRET || 'stayride_cron_secret_74b9a12c8e3f4d0a1b2c3d4e';
const MONGO_URI = process.env.MONGODB_URI || '';

interface TestResult {
  scenario: string;
  test: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(scenario: string, testName: string, fn: () => Promise<void>) {
  const start = Date.now();
  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    try {
      await fn();
      const durationMs = Date.now() - start;
      results.push({ scenario, test: testName, passed: true, durationMs });
      console.log(`  ✓ PASS [${scenario}] ${testName} (${durationMs}ms)`);
      return;
    } catch (err: any) {
      if (attempt === 1 && (err.message.includes('503') || err.message.includes('fetch failed'))) {
        console.log(`    ↳ Transient retry [${scenario}] ${testName}...`);
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      const durationMs = Date.now() - start;
      results.push({ scenario, test: testName, passed: false, durationMs, details: err.message });
      console.error(`  ✗ FAIL [${scenario}] ${testName} (${durationMs}ms)`);
      console.error(`    ↳ Error: ${err.message}`);
      return;
    }
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

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

async function main() {
  console.log('==================================================================');
  console.log('       STAYRIDE LIVE VERCEL PRODUCTION VERIFICATION SUITE         ');
  console.log(` Target Endpoint: ${VERCEL_BASE}`);
  console.log('==================================================================\n');

  let adminToken = '';
  let hostToken = '';
  let demoToken = '';
  let createdRoomId: number | null = null;
  let createdGuestId: number | null = null;
  let createdBookingId: number | null = null;
  let createdTripId: number | null = null;
  let createdDriverId = '';

  const timestamp = Date.now();
  const testHostEmail = `host.audit.${timestamp}@stayride.test`;
  const testRoomNumber = `Suite-${timestamp.toString().slice(-3)}`;
  const testDriverPhone = `98300${timestamp.toString().slice(-5)}`;
  const testDriverEmail = `driver.audit.${timestamp}@stayride.test`;

  // -------------------------------------------------------------------------
  // SCENARIO 1: SYSTEM BASELINE & PUBLIC READINESS
  // -------------------------------------------------------------------------
  console.log('--- Scenario 1: Baseline & Public Endpoints ---');

  await runTest('Baseline', 'GET /health responds 200 OK', async () => {
    const res = await fetchWithRetry(`${VERCEL_BASE}/health`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.status === 'ok', `Expected status ok, got ${data.status}`);
  });

  await runTest('Baseline', 'GET /api/v1/stayride/public/config returns presets & vehicles', async () => {
    const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/stayride/public/config`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Boolean(data.config?.vehicles?.length), 'Missing vehicles in config');
    assert(Boolean(data.config?.routePresets?.length), 'Missing route presets in config');
  });

  await runTest('Baseline', 'GET /v1/cron/ical-sync rejects unauthenticated call with 401', async () => {
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/cron/ical-sync`);
    assert(res.status === 401, `Expected 401 Unauthorized, got ${res.status}`);
  });

  await runTest('Baseline', 'GET /v1/cron/ical-sync accepts secret bearer token with 200', async () => {
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/cron/ical-sync`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
    const data = await res.json();
    assert(data.ok === true, `Expected { ok: true }, got ${JSON.stringify(data)}`);
  });

  // -------------------------------------------------------------------------
  // SCENARIO 2: ADMIN TOWER OPERATIONS
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Super Admin Tower Operations ---');

  await runTest('Admin', 'POST /api/v1/auth/login with platform admin credentials', async () => {
    const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@platform.com', password: 'adminMasterPassword2026!' }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Boolean(data.data?.token), 'Missing JWT token in response');
    assert(data.data?.user?.role === 'admin', `Expected admin role, got ${data.data?.user?.role}`);
    adminToken = data.data.token;
  });

  await runTest('Admin', 'GET /api/v1/admin/overview returns KPIs, homestays & analytics', async () => {
    assert(Boolean(adminToken), 'Admin token missing');
    const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Expected success: true');
    assert(data.data?.metrics?.totalHomestays >= 1, 'Expected at least 1 homestay in metrics');
  });

  await runTest('Admin', 'GET /api/v1/admin/commission/settings returns commission & platform rules', async () => {
    assert(Boolean(adminToken), 'Admin token missing');
    const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/commission/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Expected success: true');
    assert(typeof data.data?.globalPlatformFeePercent === 'number', 'Missing platform fee rate');
    assert(typeof data.data?.globalHomestayCommissionPercent === 'number', 'Missing homestay commission rate');
  });

  await runTest('Admin', 'GET /api/v1/admin/stayride/drivers lists active fleet drivers', async () => {
    assert(Boolean(adminToken), 'Admin token missing');
    const res = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/stayride/drivers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Expected success: true');
    assert(Array.isArray(data.items), 'Expected array of drivers in items');
  });

  // -------------------------------------------------------------------------
  // SCENARIO 3: REAL PRODUCTION HOST LIFECYCLE
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Real Production Host Workflow ---');

  await runTest('Host', 'POST /v1/auth/signup creates a new production homestay host', async () => {
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Darjeeling Alpine Host',
        email: testHostEmail,
        password: 'SecureHostPass2026!',
        homestayName: 'Alpine Pine Mist Estate',
        phone: '9830012345',
        location: 'Darjeeling, West Bengal',
        role: 'owner',
      }),
    });
    assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
    const data = await res.json();
    assert(Boolean(data.accessToken), 'Missing accessToken in signup response');
    hostToken = data.accessToken;
  });

  await runTest('Host', 'POST /v1/rooms creates a new room under the host property', async () => {
    assert(Boolean(hostToken), 'Host token missing');
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        number: testRoomNumber,
        type: 'Deluxe Alpine Suite',
        floor: '2nd Floor',
        price: 4500,
        status: 'AVAILABLE',
        note: 'Balcony mountain view',
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    assert(Boolean(data.id), 'Missing room id in response');
    assert(data.number === testRoomNumber, `Expected room number ${testRoomNumber}, got ${data.number}`);
    createdRoomId = data.id;
  });

  await runTest('Host', 'GET /v1/rooms returns the host room inventory', async () => {
    assert(Boolean(hostToken), 'Host token missing');
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/rooms`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const rooms = await res.json();
    assert(Array.isArray(rooms), 'Expected array of rooms');
    const found = rooms.some((r: any) => r.number === testRoomNumber);
    assert(found, `Newly created room '${testRoomNumber}' not found in rooms list`);
  });

  await runTest('Host', 'PUT /v1/rooms/:id updates room details and price', async () => {
    assert(Boolean(hostToken && createdRoomId), 'Host token or roomId missing');
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/rooms/${createdRoomId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        number: testRoomNumber,
        type: 'Super Deluxe Alpine Suite',
        price: 4800,
        status: 'AVAILABLE',
      }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.price === 4800, `Expected price 4800, got ${data.price}`);
  });

  await runTest('Host', 'POST /v1/guests registers a guest record', async () => {
    assert(Boolean(hostToken), 'Host token missing');
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/guests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        name: 'Priya Sharma',
        phone: '9830055555',
        email: 'priya.sharma@example.com',
        notes: 'Requested top-floor quiet room',
        marketingConsent: true,
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    assert(Boolean(data.id), 'Missing guest id in response');
    createdGuestId = data.id;
  });

  await runTest('Host', 'POST /v1/bookings creates a verified booking', async () => {
    assert(Boolean(hostToken && createdGuestId), 'Host token or guestId missing');
    const tomorrow = Date.now() + 86400000;
    const dayAfter = Date.now() + 2 * 86400000;
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        guestId: createdGuestId,
        guestName: 'Priya Sharma',
        phone: '9830055555',
        checkIn: tomorrow,
        checkOut: dayAfter,
        roomNumber: testRoomNumber,
        guests: 2,
        amount: 4800,
        source: 'Direct Website',
        paid: true,
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    assert(Boolean(data.id), 'Missing booking id');
    assert(data.roomNumber === testRoomNumber, `Expected room ${testRoomNumber}, got ${data.roomNumber}`);
    createdBookingId = data.id;
  });

  await runTest('Host', 'POST /v1/trips dispatches a guest cab booking', async () => {
    assert(Boolean(hostToken && createdGuestId && createdBookingId), 'Host token, guestId, or bookingId missing');
    const tomorrow = Date.now() + 86400000;
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        guestName: 'Priya Sharma',
        phone: '9830055555',
        pickup: 'Alpine Pine Mist Estate',
        destination: 'Bagdogra Airport (IXB)',
        date: tomorrow,
        time: '10:00 AM',
        passengers: 2,
        vehicleType: 'SUV',
        guestId: createdGuestId,
        bookingId: createdBookingId,
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    assert(Boolean(data.id), 'Missing trip id');
    assert(Boolean(data.reference), 'Missing trip reference');
    createdTripId = data.id;
  });

  await runTest('Host', 'GET /v1/snapshot retrieves unified real-time dashboard data', async () => {
    assert(Boolean(hostToken), 'Host token missing');
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/snapshot`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const snap = await res.json();
    assert(Array.isArray(snap.rooms), 'Missing rooms in snapshot');
    assert(Array.isArray(snap.guests), 'Missing guests in snapshot');
    assert(Array.isArray(snap.bookings), 'Missing bookings in snapshot');
    assert(Array.isArray(snap.trips), 'Missing trips in snapshot');
    assert(snap.rooms.some((r: any) => r.number === testRoomNumber), 'Room not found in snapshot');
    assert(snap.guests.some((g: any) => g.id === createdGuestId), 'Guest not found in snapshot');
    assert(snap.bookings.some((b: any) => b.id === createdBookingId), 'Booking not found in snapshot');
    assert(snap.trips.some((t: any) => t.id === createdTripId), 'Trip not found in snapshot');
  });

  // -------------------------------------------------------------------------
  // SCENARIO 4: REAL PRODUCTION DRIVER ONBOARDING & ADMIN APPROVAL
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Driver Onboarding & Admin Approval ---');

  await runTest('Driver', 'POST /v1/auth/signup registers a new driver (PENDING_APPROVAL)', async () => {
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tenzing Sherpa',
        email: testDriverEmail,
        password: 'SecureDriverPass2026!',
        phone: testDriverPhone,
        role: 'driver',
        vehicleType: 'SUV',
        vehicleModel: 'Toyota Innova Crysta',
        vehicleNumber: `SK01AB${timestamp.toString().slice(-4)}`,
        seats: 6,
        area: 'Gangtok & Darjeeling',
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    assert(data.role === 'driver', `Expected role driver, got ${data.role}`);
  });

  await runTest('Driver', 'Admin approves driver to ACTIVE status', async () => {
    assert(Boolean(adminToken), 'Admin token missing');
    // Find driver in pending approval list
    const listRes = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/stayride/drivers?status=PENDING_APPROVAL`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(listRes.status === 200, `Expected 200, got ${listRes.status}`);
    const listData = await listRes.json();
    const foundDriver = (listData.items || []).find((d: any) => d.email === testDriverEmail);
    assert(Boolean(foundDriver), `Driver '${testDriverEmail}' not found in pending list`);
    createdDriverId = foundDriver.id;

    // Approve driver
    const approveRes = await fetchWithRetry(`${VERCEL_BASE}/api/v1/admin/stayride/drivers/${createdDriverId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    assert(approveRes.status === 200, `Expected 200 on driver approval, got ${approveRes.status}`);
    const approveData = await approveRes.json();
    assert(approveData.success === true, 'Expected success: true on driver approval');
  });

  // -------------------------------------------------------------------------
  // SCENARIO 5: DEMO ACCOUNT ISOLATION VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Demo Mode & Multi-Tenant DB Isolation ---');

  await runTest('Demo', 'POST /v1/auth/login logs in demo@stayride.in on live Vercel', async () => {
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@stayride.in', password: 'demo' }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Boolean(data.accessToken || data.token), 'Missing demo access token');
    demoToken = data.accessToken || data.token;
  });

  await runTest('Demo', 'GET /v1/rooms with demo token fetches demo showcase rooms', async () => {
    assert(Boolean(demoToken), 'Demo token missing');
    const res = await fetchWithRetry(`${VERCEL_BASE}/v1/rooms`, {
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const rooms = await res.json();
    assert(Array.isArray(rooms) && rooms.length > 0, 'Demo account returned 0 rooms');
  });

  // -------------------------------------------------------------------------
  // SCENARIO 6: DIRECT MONGODB ATLAS VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 6: Direct MongoDB Atlas Multi-Tenant Validation ---');

  await runTest('Database', 'Direct MongoDB Atlas verification of production vs demo persistence', async () => {
    assert(Boolean(MONGO_URI), 'MONGODB_URI missing');
    const conn = await mongoose.connect(MONGO_URI, { dbName: 'production', serverSelectionTimeoutMS: 8000 });
    try {
      const prodDb = conn.connection.useDb('production');
      const testDb = conn.connection.useDb('test');

      // 1. Verify production host was persisted in 'production'
      const prodUser = await prodDb.collection('users').findOne({ email: testHostEmail.toLowerCase() });
      assert(Boolean(prodUser), `Production user '${testHostEmail}' not found in 'production' DB!`);

      // 2. Verify production room was persisted in 'production'
      const prodTenant = await prodDb.collection('stayridetenants').findOne({ 'data.homestay.email': testHostEmail.toLowerCase() });
      assert(Boolean(prodTenant), `Tenant data for host '${testHostEmail}' not found in 'production' stayridetenants collection!`);
      const rooms = prodTenant?.data?.rooms || [];
      const hasRoom = rooms.some((r: any) => r.number === testRoomNumber);
      assert(hasRoom, `Room '${testRoomNumber}' was not saved in production stayridetenants!`);

      // 3. Verify ZERO demo users/properties exist in 'production' DB
      const leakedDemoInProd = await prodDb.collection('users').findOne({ email: 'demo@stayride.in' });
      assert(!leakedDemoInProd, 'LEAK DETECTED: demo@stayride.in was found in the production database!');

      // 4. Verify demo data exists in 'test' DB
      const demoTenant = await testDb.collection('stayridetenants').findOne({ isDemo: true });
      assert(Boolean(demoTenant), 'Demo tenant document not found in test database!');
    } finally {
      await mongoose.disconnect();
    }
  });

  // -------------------------------------------------------------------------
  // SCENARIO 7: AXIOM TELEMETRY VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 7: Axiom Observability & Cloud Ingestion ---');

  await runTest('Telemetry', 'Axiom dataset stayride-api ingest test', async () => {
    const token = process.env.AXIOM_TOKEN;
    const dataset = process.env.AXIOM_DATASET;
    assert(Boolean(token && dataset), 'Axiom env variables missing');

    const res = await fetch(`https://api.axiom.co/v1/datasets/${dataset}/ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          message: 'Vercel Production Verification Suite Complete',
          environment: 'production',
          status: 'SUCCESS',
          target: VERCEL_BASE,
          hostTested: testHostEmail,
          driverTested: testDriverEmail,
          timestamp: new Date().toISOString(),
        },
      ]),
    });
    assert(res.status === 200, `Axiom ingestion failed with status ${res.status}`);
  });

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n==================================================================');
  console.log('                    AUDIT EXECUTION REPORT                        ');
  console.log('==================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log('🏆 ALL LIVE VERCEL PRODUCTION WORKFLOWS PASSED WITH 100% SUCCESS!');
  } else {
    console.error('⚠️ SOME TESTS FAILED. Review details above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
