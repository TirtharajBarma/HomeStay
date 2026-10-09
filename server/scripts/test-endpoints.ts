/**
 * End-to-end HTTP test suite for Tirtha Backend.
 * Tests every endpoint across Auth (JWT 15m), Properties, Rooms, Bookings, Guests, Drivers, Cabs, Analytics, and Newsletter.
 * Also verifies real-world multi-step scenarios:
 *   Owner registers/logs in -> adds room -> guest searches stays -> sees new room ->
 *   owner edits price -> guest gets new quote -> guest books -> double booking blocked ->
 *   guest appears in CRM -> analytics updates.
 */

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5050/api/v1";
const HEALTH_URL = BASE_URL.replace("/api/v1", "/health");

type TestResult = {
  category: string;
  name: string;
  endpoint: string;
  method: string;
  status: number;
  expectedStatus: number;
  passed: boolean;
  durationMs: number;
  details?: string;
};

const results: TestResult[] = [];

async function runTest(
  category: string,
  name: string,
  method: string,
  path: string,
  expectedStatus: number,
  body?: any,
  checkFn?: (data: any) => boolean | string,
  customHeaders?: Record<string, string>
) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const start = performance.now();
  let status = 0;
  let passed = false;
  let details = "";

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...customHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    status = res.status;
    const durationMs = Math.round(performance.now() - start);

    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (status === expectedStatus) {
      if (checkFn) {
        const checkResult = checkFn(data);
        if (checkResult === true) {
          passed = true;
        } else {
          passed = false;
          details = typeof checkResult === "string" ? checkResult : "Custom validation failed";
        }
      } else {
        passed = true;
      }
    } else {
      passed = false;
      details = `Expected ${expectedStatus}, received ${status}. ${JSON.stringify(data).slice(0, 100)}`;
    }

    results.push({
      category,
      name,
      endpoint: path,
      method,
      status,
      expectedStatus,
      passed,
      durationMs,
      details,
    });
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    results.push({
      category,
      name,
      endpoint: path,
      method,
      status: 0,
      expectedStatus,
      passed: false,
      durationMs,
      details: `Network/Fetch error: ${err.message}`,
    });
  }
}

async function runAllTests() {
  console.log("==================================================================");
  console.log("     TIRTHA PRODUCTION BACKEND - COMPLETE MULTI-SCENARIO SUITE    ");
  console.log(` Target Base: ${BASE_URL}`);
  console.log("==================================================================\n");

  // 1. Health & System
  await runTest("System", "Health Check", "GET", HEALTH_URL, 200, undefined, (d) => {
    return d.status === "ok" && d.service === "tirtha-backend";
  });

  // 2. Auth & JWT (15-minute Token Lifespan)
  const testUserEmail = `guest_${Date.now()}@tirtha-estate.com`;
  let guestJwtToken = "";
  let guestUserId = "";

  await runTest(
    "Auth",
    "Register New Guest User",
    "POST",
    "/auth/register",
    201,
    {
      name: "Tirtha Guest",
      email: testUserEmail,
      password: "guestPassword123!",
      role: "guest",
      phone: "+91 98300 99999",
    },
    (d) => {
      if (d.success && d.data?.token && d.data?.expiresIn === "15m") {
        guestJwtToken = d.data.token;
        guestUserId = d.data.user?.id;
        return true;
      }
      return "Missing token or 15m expiration in registration response";
    }
  );

  await runTest(
    "Auth",
    "Login with User Credentials (Returns 15m JWT)",
    "POST",
    "/auth/login",
    200,
    {
      email: testUserEmail,
      password: "guestPassword123!",
    },
    (d) => {
      if (d.success && d.data?.token && d.data?.expiresInSeconds === 900) {
        guestJwtToken = d.data.token;
        return true;
      }
      return "Login failed to return 15m token";
    }
  );

  await runTest(
    "Auth",
    "Inspect Current User (/auth/me with Bearer Token)",
    "GET",
    "/auth/me",
    200,
    undefined,
    (d) => d.success && d.data?.email === testUserEmail,
    { Authorization: `Bearer ${guestJwtToken}` }
  );

  await runTest(
    "Auth",
    "Reject Access without Token (401 Unauthorized)",
    "GET",
    "/auth/me",
    401,
    undefined,
    (d) => d.success === false && !!d.error
  );

  await runTest(
    "Auth",
    "Reject Access with Invalid Token (401 Unauthorized)",
    "GET",
    "/auth/me",
    401,
    undefined,
    (d) => d.success === false,
    { Authorization: "Bearer invalid.token.payload" }
  );

  // 3. Properties & Profile
  await runTest("Property", "Get Estate Profile", "GET", "/properties/profile", 200, undefined, (d) => {
    return d.success && !!d.data?.name;
  });

  await runTest(
    "Property",
    "Update Estate Profile",
    "PATCH",
    "/properties/profile",
    200,
    { bio: "Darjeeling hillside heritage cottage hosted by Tirtha team." },
    (d) => d.success === true
  );

  const testLocId = `loc_test_${Date.now()}`;
  await runTest(
    "Property",
    "Add Estate Location",
    "POST",
    "/properties/locations",
    201,
    { id: testLocId, name: "Batasia Loop Lookout", address: "Hill Cart Rd, Darjeeling", kind: "Viewpoint", distance: "4.2 km" },
    (d) => d.success === true
  );

  await runTest(
    "Property",
    "Update Estate Location",
    "PATCH",
    `/properties/locations/${testLocId}`,
    200,
    { address: "Hill Cart Rd, West Bengal" },
    (d) => d.success === true
  );

  await runTest(
    "Property",
    "Delete Estate Location",
    "DELETE",
    `/properties/locations/${testLocId}`,
    200,
    undefined,
    (d) => d.success === true
  );

  // 4. Multi-Scenario: Owner Creates Room -> Guest Sees it in Stays List
  const customRoomCode = `RM-VISTA-${Math.floor(100 + Math.random() * 900)}`;
  const customRoomSlug = customRoomCode.toLowerCase();

  await runTest(
    "Scenario",
    `[Step 1] Owner Creates Room (${customRoomCode})`,
    "POST",
    "/rooms",
    201,
    {
      code: customRoomCode,
      slug: customRoomSlug,
      name: "Kanchenjunga Vista Loft",
      category: "Chiyabari Lofts",
      kind: "loft",
      nightly: 3600,
      maxGuests: 3,
      petFriendly: true,
      blurb: "Panoramic glass pavilion overlooking the snow peaks.",
    },
    (d) => d.success && d.data?.code === customRoomCode
  );

  await runTest(
    "Scenario",
    `[Step 2] Guest Sees New Room in Stays Catalog (/stays)`,
    "GET",
    "/stays",
    200,
    undefined,
    (d) => {
      if (d.success && Array.isArray(d.data)) {
        const found = d.data.some((r: any) => r.code === customRoomCode || r.slug === customRoomSlug);
        return found ? true : `Room ${customRoomCode} not visible in client stays list`;
      }
      return "Invalid stays response";
    }
  );

  // Scenario: Owner Edits Price -> Guest Gets Dynamic Quote
  await runTest(
    "Scenario",
    `[Step 3] Owner Updates Room Nightly Rate to ₹4,200`,
    "PATCH",
    `/rooms/${customRoomCode}`,
    200,
    { nightly: 4200 },
    (d) => d.success && d.data?.nightly === 4200
  );

  await runTest(
    "Scenario",
    `[Step 4] Guest Quotes 3 Nights (₹4,200 * 3 + ₹900 cln + 12% GST)`,
    "POST",
    `/stays/${customRoomSlug}/quote`,
    200,
    { checkIn: "2026-11-20", checkOut: "2026-11-23", guests: 2 },
    (d) => {
      // 3 nights * 4200 = 12600. Cleaning = 900. Tax = 12% of 13500 = 1620. Total = 15120.
      return d.success && d.data?.nights === 3 && (d.data?.nightly === 4200 || d.data?.nightlyRate === 4200) && d.data?.total === 15120;
    }
  );

  // Scenario: Guest Books Room -> Real-time Conflict Guard
  let scenarioBookingRef = "";
  await runTest(
    "Scenario",
    `[Step 5] Guest Books Room (${customRoomCode})`,
    "POST",
    "/reservations",
    201,
    {
      roomCode: customRoomCode,
      checkIn: "2026-11-20",
      checkOut: "2026-11-23",
      guests: 2,
      firstName: "Tirtha",
      lastName: "Traveler",
      email: "traveler.tirtha@example.com",
      phone: "+91 98300 77777",
      channel: "direct",
    },
    (d) => {
      if (d.success && d.data?.reference) {
        scenarioBookingRef = d.data.reference;
        return true;
      }
      return "Missing booking reference";
    }
  );

  await runTest(
    "Scenario",
    `[Step 6] Overlapping Booking Is Blocked (Conflict Detection)`,
    "POST",
    "/reservations",
    400,
    {
      roomCode: customRoomCode,
      checkIn: "2026-11-21", // Overlaps with 20-23
      checkOut: "2026-11-24",
      guests: 2,
      firstName: "Second",
      lastName: "Requester",
      email: "second@example.com",
      phone: "+91 98300 88888",
    },
    (d) => d.success === false && d.error?.includes("already reserved")
  );

  // Scenario: Guest Automatically Appears in CRM
  await runTest(
    "Scenario",
    `[Step 7] Guest Automatically Appears in Host CRM Directory`,
    "GET",
    "/guests?query=Traveler",
    200,
    undefined,
    (d) => d.success && Array.isArray(d.data) && d.data.length > 0 && d.data[0].email === "traveler.tirtha@example.com"
  );

  // Scenario: Owner Puts Room on Maintenance Hold -> Booking Blocked
  await runTest(
    "Scenario",
    `[Step 8] Owner Places Maintenance Hold on Room`,
    "POST",
    `/rooms/${customRoomCode}/holds`,
    200,
    {
      label: "Winter Hearth Deep Clean",
      startDate: "2026-12-01",
      endDate: "2026-12-10",
    },
    (d) => d.success === true && d.data?.status === "Maintenance"
  );

  await runTest(
    "Scenario",
    `[Step 9] Booking During Maintenance Hold Is Prevented`,
    "POST",
    "/reservations",
    400,
    {
      roomCode: customRoomCode,
      checkIn: "2026-12-02",
      checkOut: "2026-12-05",
      guests: 2,
      firstName: "Hold",
      lastName: "Requester",
      email: "hold@example.com",
      phone: "+91 98300 00001",
    },
    (d) => d.success === false && d.error?.includes("maintenance")
  );

  await runTest(
    "Scenario",
    `[Step 10] Owner Releases Maintenance Hold`,
    "DELETE",
    `/rooms/${customRoomCode}/holds`,
    200,
    undefined,
    (d) => d.success === true && d.data?.status === "Active"
  );

  // Clean up scenario test room
  await runTest(
    "Scenario",
    `[Step 11] Owner Removes Temporary Suite`,
    "DELETE",
    `/rooms/${customRoomCode}`,
    200,
    undefined,
    (d) => d.success === true
  );

  // 5. Existing Core Stays & Booking Suite
  await runTest("Rooms", "List All Baseline Rooms", "GET", "/rooms", 200, undefined, (d) => {
    return d.success && Array.isArray(d.data) && d.data.length >= 6;
  });

  await runTest("Rooms", "Filter Rooms by Category (cottage)", "GET", "/rooms?category=cottage", 200, undefined, (d) => {
    return d.success && Array.isArray(d.data);
  });

  await runTest("Rooms", "Get 14-day Availability Grid", "GET", "/rooms/availability/grid?days=14", 200, undefined, (d) => {
    return d.success && Array.isArray(d.data);
  });

  await runTest("Bookings", "List All Confirmed Bookings", "GET", "/bookings", 200, undefined, (d) => {
    return d.success && Array.isArray(d.data);
  });

  if (scenarioBookingRef) {
    await runTest("Bookings", `Get Booking Detail (${scenarioBookingRef})`, "GET", `/bookings/${scenarioBookingRef}`, 200, undefined, (d) => {
      return d.success && d.data?.reference === scenarioBookingRef;
    });

    await runTest("Bookings", `Cancel Booking (${scenarioBookingRef})`, "PATCH", `/bookings/${scenarioBookingRef}/cancel`, 200, undefined, (d) => {
      return d.success && d.data?.status === "cancelled";
    });
  }

  // 6. Guests CRM Timeline
  await runTest("Guests", "Get Guest In/Out Timeline (14 days)", "GET", "/guests/timeline?days=14", 200, undefined, (d) => {
    return d.success && Array.isArray(d.data);
  });

  // 7. Drivers & Hill Cabs
  let testDriverId = "";
  await runTest("Drivers", "List Vetted Hill Drivers", "GET", "/drivers", 200, undefined, (d) => {
    if (d.success && Array.isArray(d.data) && d.data.length > 0) {
      testDriverId = d.data[0].id || d.data[0]._id;
      return true;
    }
    return "No drivers found";
  });

  await runTest("Cabs", "Get Known Hill Transit Places", "GET", "/cabs/places", 200, undefined, (d) => {
    return d.success && Array.isArray(d.data) && d.data.length > 0;
  });

  await runTest(
    "Cabs",
    "Calculate Hill Fare Quote",
    "POST",
    "/cabs/quote",
    200,
    {
      pickup: "Bagdogra Airport (IXB)",
      dropoff: "Meadowfall Homestay",
      pickupCoords: [88.3286, 26.6812],
      dropoffCoords: [88.2627, 27.041],
      seats: 4,
    },
    (d) => d.success && d.quotes?.length > 0 && d.distanceKm > 0
  );

  let createdCabBookingRef = "";
  await runTest(
    "Cabs",
    "Book Hill Cab Transfer (Driver Status -> 'On a trip')",
    "POST",
    "/cabs/bookings",
    201,
    {
      driverId: testDriverId || "DRV-101",
      guestName: "Tirtha Guest",
      email: "tirtha.guest@example.com",
      phone: "+91 98300 54321",
      pickup: "Bagdogra Airport (IXB)",
      dropoff: "Meadowfall Homestay",
      pickupCoords: [88.3286, 26.6812],
      dropoffCoords: [88.2627, 27.041],
      date: "2026-11-15",
      time: "14:30",
      seats: 4,
      totalFare: 2850,
    },
    (d) => {
      if (d.success && d.data?.reference) {
        createdCabBookingRef = d.data.reference;
        return true;
      }
      return "Missing cab booking reference";
    }
  );

  await runTest("Cabs", "Get Hill Driver Payouts Ledger", "GET", "/cabs/payouts", 200, undefined, (d) => {
    return d.success && typeof d.data?.totalPayouts === "number";
  });

  if (testDriverId) {
    await runTest(
      "Drivers",
      `Update Driver Status (${testDriverId})`,
      "PATCH",
      `/drivers/${testDriverId}/status`,
      200,
      { status: "Active" },
      (d) => d.success === true
    );
  }

  // 8. Analytics & Financials
  await runTest("Analytics", "Get Estate Financial Analytics (Month)", "GET", "/analytics?range=month", 200, undefined, (d) => {
    return d.success && typeof d.data?.totals?.revenue === "number";
  });

  await runTest("Analytics", "Export Estate Analytics CSV", "GET", "/analytics/export?range=month", 200, undefined, (d) => {
    return typeof d === "string" && d.includes("Date,Rooms Sold,Occupancy %");
  });

  // 9. Newsletter
  await runTest(
    "Newsletter",
    "Subscribe to Seasonal Letters",
    "POST",
    "/newsletter/subscribe",
    200,
    { email: "guest.seasonal@example.com" },
    (d) => d.success === true
  );

  // 10. Super-Admin Platform Overview (Branch 4 in Architectural Diagram)
  await runTest(
    "Admin",
    "Get Super-Admin Overview (Homestays, Drivers, Platform Revenue)",
    "GET",
    "/admin/overview",
    200,
    undefined,
    (d) => {
      return (
        d.success === true &&
        d.data?.metrics?.totalHomestays >= 1 &&
        d.data?.metrics?.totalDrivers >= 1 &&
        Array.isArray(d.data?.homestays) &&
        Array.isArray(d.data?.drivers) &&
        typeof d.data?.metrics?.financials?.estateGross === "number"
      );
    }
  );

  // 11. Multi-Homestay Owner Isolation Test (Branch 2 in Architectural Diagram)
  const ownerAEmail = `host.a.${Date.now()}@darjeeling-stays.com`;
  const ownerBEmail = `host.b.${Date.now()}@darjeeling-stays.com`;

  let ownerAToken = "";
  let ownerBToken = "";
  let ownerAId = "";
  let ownerBId = "";

  await runTest(
    "MultiOwner",
    "Register Owner A (Tirtha Pine Crest)",
    "POST",
    "/auth/register",
    201,
    { name: "Owner A", email: ownerAEmail, password: "SecurePassword123!", role: "owner" },
    (d) => {
      if (d.success && d.data?.token) {
        ownerAToken = d.data.token;
        ownerAId = d.data.user.id;
        return true;
      }
      return false;
    }
  );

  await runTest(
    "MultiOwner",
    "Register Owner B (Misty Cloud Villa)",
    "POST",
    "/auth/register",
    201,
    { name: "Owner B", email: ownerBEmail, password: "SecurePassword123!", role: "owner" },
    (d) => {
      if (d.success && d.data?.token) {
        ownerBToken = d.data.token;
        ownerBId = d.data.user.id;
        return true;
      }
      return false;
    }
  );

  // Owner A creates a room
  const roomACode = `RM-A-${Date.now().toString().slice(-4)}`;
  await runTest(
    "MultiOwner",
    "Owner A creates a room",
    "POST",
    "/rooms",
    201,
    {
      code: roomACode,
      name: "Pine Crest Suite A",
      location: "Ging Valley",
      category: "Pine Cottages",
      kind: "cottage",
      nightly: 5500,
      maxGuests: 2,
      ownerId: ownerAId,
      homestayName: "Tirtha Pine Crest",
    },
    (d) => d.success === true && d.data.code === roomACode,
    { Authorization: `Bearer ${ownerAToken}` }
  );

  // Owner B creates a room
  const roomBCode = `RM-B-${Date.now().toString().slice(-4)}`;
  await runTest(
    "MultiOwner",
    "Owner B creates a room",
    "POST",
    "/rooms",
    201,
    {
      code: roomBCode,
      name: "Misty Cloud Suite B",
      location: "Chiyabari",
      category: "Cloud Lofts",
      kind: "loft",
      nightly: 7200,
      maxGuests: 3,
      ownerId: ownerBId,
      homestayName: "Misty Cloud Villa",
    },
    (d) => d.success === true && d.data.code === roomBCode,
    { Authorization: `Bearer ${ownerBToken}` }
  );

  // Owner A queries rooms (scoped)
  await runTest(
    "MultiOwner",
    "Owner A queries rooms (sees only their own room)",
    "GET",
    `/rooms?ownerId=${ownerAId}`,
    200,
    undefined,
    (d) => {
      const hasA = d.data.some((r: any) => r.code === roomACode);
      const hasB = d.data.some((r: any) => r.code === roomBCode);
      return hasA && !hasB;
    },
    { Authorization: `Bearer ${ownerAToken}` }
  );

  // Guest queries all stays (unauthenticated, public sees both stays)
  await runTest(
    "MultiOwner",
    "Public guest sees both Owner A and Owner B rooms",
    "GET",
    "/stays",
    200,
    undefined,
    (d) => {
      const hasA = d.data.some((r: any) => r.code === roomACode);
      const hasB = d.data.some((r: any) => r.code === roomBCode);
      return hasA && hasB;
    }
  );

  // Clean up test rooms
  await fetch(`${BASE_URL}/rooms/${roomACode}`, { method: "DELETE" });
  await fetch(`${BASE_URL}/rooms/${roomBCode}`, { method: "DELETE" });

  // Print Summary Table
  console.log("\n------------------------------------------------------------------");
  console.log("                       TEST EXECUTION REPORT                      ");
  console.log("------------------------------------------------------------------");
  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    const statusIcon = r.passed ? "✓ PASS" : "✗ FAIL";
    const statusColor = r.passed ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    if (r.passed) passedCount++;
    else failedCount++;

    console.log(
      `${statusColor}${statusIcon}${reset} [${r.category.padEnd(9)}] ${r.method.padEnd(6)} ${r.endpoint.padEnd(42)} (${r.durationMs}ms)`
    );
    if (!r.passed && r.details) {
      console.log(`       ↳ Error: ${r.details}`);
    }
  }

  console.log("------------------------------------------------------------------");
  console.log(`TOTAL: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log("==================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
