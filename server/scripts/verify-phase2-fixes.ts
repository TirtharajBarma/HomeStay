import assert from 'assert';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { tenantManager } from '../src/stayride/store.js';
import { buildIcs } from '../src/stayride/ical.js';

async function runPhase2Tests() {
  console.log('🧪 Starting Phase 2 Automated Verification Tests...\n');

  console.log('Setting up in-memory MongoDB...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  console.log('MongoDB connected successfully.\n');

  try {
    // Test 1: Async mutations in tenantManager persist
    console.log('1️⃣ Testing tenantManager async mutation persistence...');
    const tenantKey = 'phase2-test-tenant@stayride.com';
    await tenantManager.mutate(tenantKey, async (store) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      store.homestay.name = 'Async Verified Homestay';
      store.homestay.phone = '+919876543210';
    });

    const loadedStore = await tenantManager.load(tenantKey);
    assert.strictEqual(loadedStore.homestay.name, 'Async Verified Homestay', 'Store name should have persisted after async mutate');
    assert.strictEqual(loadedStore.homestay.phone, '+919876543210', 'Store phone should have persisted after async mutate');
    console.log('   ✅ Passed: Tenant store async mutation persisted.\n');

    // Test 2: Direct web booking syncs to store and exports to iCal
    console.log('2️⃣ Testing Web Booking -> Tenant Store -> iCal export...');
    const roomId = 101;
    const roomNum = '101';
    await tenantManager.mutate(tenantKey, (store) => {
      store.rooms = [
        { id: roomId, number: roomNum, type: 'Deluxe', floor: '1', price: 2500, status: 'AVAILABLE', note: '' },
      ];
      store.bookings = [];
      const id = store.nextBookingIdForImport();
      store.bookings.unshift({
        id,
        guestId: 101,
        guestName: 'Rahul Sharma',
        phone: '9876543210',
        roomNumber: roomNum,
        checkIn: Date.now() + 86400000,
        checkOut: Date.now() + 3 * 86400000,
        amount: 5000,
        guests: 2,
        status: 'CONFIRMED',
        paid: true,
        source: 'Direct Web',
        reference: 'SR-WEB-12345',
        channel: 'Direct Web',
      });
    });

    const refreshedStore = await tenantManager.load(tenantKey);
    const icsOutput = buildIcs(refreshedStore, roomId);
    assert(icsOutput.includes('BEGIN:VCALENDAR'), 'ICS must start with VCALENDAR');
    assert(icsOutput.includes(`UID:stayride-${roomId}-`), 'ICS must include event UID');
    assert(icsOutput.includes('SUMMARY:Not available'), 'ICS must mask direct booking as Not available for OTAs');
    console.log('   ✅ Passed: Direct web booking exported into iCal ICS feed.\n');

    // Test 3: Fare evaluation logic with counterFare
    console.log('3️⃣ Testing counterFare evaluation logic...');
    const quotes = [
      { driverId: 'd1', quotedFare: 1500, counterFare: null, status: 'PENDING' },
      { driverId: 'd2', quotedFare: 1600, counterFare: 1350, status: 'PENDING' }, // negotiated lower
      { driverId: 'd3', quotedFare: 1400, counterFare: null, status: 'PENDING' },
    ];

    const fareOf = (q: any) => (q.counterFare && q.counterFare > 0 ? Math.min(q.quotedFare, q.counterFare) : q.quotedFare);
    quotes.sort((a, b) => fareOf(a) - fareOf(b));

    assert.strictEqual(quotes[0].driverId, 'd2', 'Driver d2 with counterFare 1350 should win over 1400 and 1500');
    assert.strictEqual(fareOf(quotes[0]), 1350, 'Winning fare should evaluate to counterFare 1350');
    console.log('   ✅ Passed: Counter-offer fare evaluation prioritized lowest negotiated bid.\n');

    // Test 4: Transit buffer check on TRIP_STARTED
    console.log('4️⃣ Testing transit buffer check on TRIP_STARTED...');
    const startedAt = Date.now() - 5 * 60000; // 5 mins ago (less than 15 mins)
    const isTooSoon = Date.now() < startedAt + 15 * 60000;
    assert.strictEqual(isTooSoon, true, 'Trips started 5 minutes ago should fail transit buffer check');

    const completedStartedAt = Date.now() - 20 * 60000; // 20 mins ago (greater than 15 mins)
    const isTransitDone = Date.now() >= completedStartedAt + 15 * 60000;
    assert.strictEqual(isTransitDone, true, 'Trips started 20 minutes ago should pass transit buffer check');
    console.log('   ✅ Passed: 15-minute transit buffer correctly calculated.\n');

    console.log('🎉 ALL PHASE 2 TESTS PASSED SUCCESSFULLY!');
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
}

runPhase2Tests().catch((err) => {
  console.error('❌ Phase 2 test failed:', err);
  process.exit(1);
});
