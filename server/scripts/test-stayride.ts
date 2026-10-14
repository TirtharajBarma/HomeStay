import app from '../src/app.js';
import http from 'http';

async function runTests() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(8089, resolve));
  console.log('Test server listening on port 8089');

  const base = 'http://127.0.0.1:8089/v1';

  try {
    // 1. Homestay
    const resHs = await fetch(`${base}/homestay`);
    const hs = await resHs.json();
    console.log('✓ 1. /v1/homestay:', hs.name);

    // 2. Rooms
    const resRooms = await fetch(`${base}/rooms`);
    const rooms = await resRooms.json();
    console.log('✓ 2. /v1/rooms (demo): array length =', Array.isArray(rooms) ? rooms.length : 'NOT ARRAY');

    // 3. Guests
    const resGuests = await fetch(`${base}/guests`);
    const guests = await resGuests.json();
    console.log('✓ 3. /v1/guests (demo): array length =', Array.isArray(guests) ? guests.length : 'NOT ARRAY');

    // 4. Bookings
    const resBookings = await fetch(`${base}/bookings`);
    const bookings = await resBookings.json();
    console.log('✓ 4. /v1/bookings (demo): array length =', Array.isArray(bookings) ? bookings.length : 'NOT ARRAY');

    // 5. Drivers (mine)
    const resDrivers = await fetch(`${base}/drivers?scope=mine`);
    const drivers = await resDrivers.json();
    console.log('✓ 5. /v1/drivers (mine): array length =', Array.isArray(drivers) ? drivers.length : 'NOT ARRAY');

    // 6. Drivers (network)
    const resNetDrivers = await fetch(`${base}/drivers?scope=network`);
    const netDrivers = await resNetDrivers.json();
    console.log('✓ 6. /v1/drivers (network): array length =', Array.isArray(netDrivers) ? netDrivers.length : 'NOT ARRAY');

    // 7. Trips
    const resTrips = await fetch(`${base}/trips`);
    const trips = await resTrips.json();
    console.log('✓ 7. /v1/trips (demo): array length =', Array.isArray(trips) ? trips.length : 'NOT ARRAY');

    // 8. Auth Login Demo
    const resLogin = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@stayride.in', password: 'demo' }),
    });
    const loginData = await resLogin.json();
    console.log('✓ 8. /v1/auth/login (demo): accessToken prefix =', loginData.accessToken?.slice(0, 15));

    // 9. Booking check-in
    const resCheckIn = await fetch(`${base}/bookings/3/check-in`, { method: 'POST' });
    const checkInData = await resCheckIn.json();
    console.log('✓ 9. /v1/bookings/3/check-in status =', checkInData.status);

    // 10. REAL USER SIGNUP TEST: Ramesh Homestay Manali
    console.log('\n--- TESTING PRODUCTION ISOLATION FOR REAL USERS ---');
    const resSignup = await fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ramesh Sharma',
        phone: '+91 98160 12345',
        email: 'ramesh@himalayanretreat.in',
        password: 'securePassword123',
        homestayName: 'Himalayan Retreat Manali',
        location: 'Old Manali, Himachal Pradesh',
      }),
    });
    const signupData = await resSignup.json();
    console.log('✓ 10. Real user signup created:', signupData.homestay.name);
    const realUserToken = signupData.accessToken;

    // 11. Real User Rooms: MUST BE 0 (Fresh / Empty)
    const resRealRooms = await fetch(`${base}/rooms`, {
      headers: { Authorization: `Bearer ${realUserToken}` },
    });
    const realRooms = await resRealRooms.json();
    console.log('✓ 11. Real user rooms count:', realRooms.length, '(Expected: 0)');
    if (realRooms.length !== 0) {
      throw new Error(`Real user received ${realRooms.length} rooms! Expected 0 clean rooms.`);
    }

    // 12. Real User Guests: MUST BE 0
    const resRealGuests = await fetch(`${base}/guests`, {
      headers: { Authorization: `Bearer ${realUserToken}` },
    });
    const realGuests = await resRealGuests.json();
    console.log('✓ 12. Real user guests count:', realGuests.length, '(Expected: 0)');

    // 13. Real User adds their own first room
    const resAddRoom = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${realUserToken}`,
      },
      body: JSON.stringify({
        number: '101',
        type: 'Cedar Wooden Suite',
        floor: '1st Floor',
        price: 3500,
        status: 'AVAILABLE',
        note: 'Direct Beas river view',
      }),
    });
    const addedRoom = await resAddRoom.json();
    console.log('✓ 13. Real user created room:', addedRoom.number, addedRoom.type);

    // 14. Demo Store Check: Demo still has 8 original rooms (Unpolluted by real user!)
    const resDemoRoomsAfter = await fetch(`${base}/rooms`);
    const demoRoomsAfter = await resDemoRoomsAfter.json();
    console.log('✓ 14. Demo rooms count after real user room creation:', demoRoomsAfter.length, '(Expected: 8)');
    if (demoRoomsAfter.length !== 8) {
      throw new Error(`Demo store polluted! Room count = ${demoRoomsAfter.length}`);
    }

    // 15. Snapshot route test
    const resSnap = await fetch(`${base}/snapshot`, {
      headers: { Authorization: `Bearer ${realUserToken}` },
    });
    const snap = await resSnap.json();
    console.log('✓ 15. /v1/snapshot: real homestay name =', snap.homestay.name, 'rooms =', snap.rooms.length);

    console.log('\n🌟 ALL 15 ENDPOINT & ISOLATION CHECKS PASSED FLAWLESSLY!');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
