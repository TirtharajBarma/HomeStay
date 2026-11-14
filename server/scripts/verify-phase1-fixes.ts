import './no-telemetry.js';
import assert from 'node:assert/strict';
import { BookingController } from '../src/controllers/booking.controller.js';
import { BookingService } from '../src/services/booking.service.js';
import { eligibleFilter, driverHasOverlap, pickupsOverlap, OVERLAP_MS } from '../src/stayride/platform.js';
import { CabRequest } from '../src/models/cab-request.model.js';

console.log('🧪 Starting Phase 1 Remediation Verification...\n');

// ---------------------------------------------------------------------------
// Test 1: Booking IDOR & Guest PII Zero-Trust Verification
// ---------------------------------------------------------------------------
console.log('▶ Test 1: Booking IDOR & Zero-Trust Guest Verification');

const mockBooking = {
  reference: 'BK-999001',
  pin: '5432',
  ownerId: 'owner_abc_123',
  guestName: 'Tirtharaj Barma',
  email: 'guest@example.com',
  phone: '+91 98765 43210',
  toObject: () => ({
    reference: 'BK-999001',
    pin: '5432',
    ownerId: 'owner_abc_123',
    guestName: 'Tirtharaj Barma',
    email: 'guest@example.com',
    phone: '+91 98765 43210',
  }),
};

// Mock BookingService.getBookingByReference
const originalGetByRef = BookingService.getBookingByReference;
(BookingService as any).getBookingByReference = async (ref: string) => (ref === 'BK-999001' ? mockBooking : null);

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

// 1a. Unauthenticated attacker without verification -> 401
{
  const req: any = { params: { reference: 'BK-999001' }, query: {}, headers: {} };
  const res = createMockRes();
  await BookingController.getBookingByReference(req, res);
  assert.equal(res.statusCode, 401, 'Unauthenticated query without verification must return 401');
  assert.equal(res.body.success, false);
}

// 1b. Attacker guessing random phone -> 401
{
  const req: any = { params: { reference: 'BK-999001' }, query: { phone: '9999999999' }, headers: {} };
  const res = createMockRes();
  await BookingController.getBookingByReference(req, res);
  assert.equal(res.statusCode, 401, 'Mismatched phone must return 401');
}

// 1c. Legitimate guest supplying phone -> 200, but secret door PIN is masked
{
  const req: any = { params: { reference: 'BK-999001' }, query: { phone: '9876543210' }, headers: {} };
  const res = createMockRes();
  await BookingController.getBookingByReference(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.guestName, 'Tirtharaj Barma');
  assert.equal(res.body.data.pin, undefined, 'Door PIN must not be disclosed via phone lookup alone');
}

// 1d. Guest supplying secret PIN -> 200 with PIN
{
  const req: any = { params: { reference: 'BK-999001' }, query: { pin: '5432' }, headers: {} };
  const res = createMockRes();
  await BookingController.getBookingByReference(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.pin, '5432', 'PIN provided by guest must remain visible');
}

// 1e. Authenticated Owner session -> 200 with PIN
{
  const req: any = { params: { reference: 'BK-999001' }, query: {}, headers: {}, user: { id: 'owner_abc_123', role: 'owner' } };
  const res = createMockRes();
  await BookingController.getBookingByReference(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.pin, '5432', 'Homestay owner must see the booking PIN');
}

console.log('✅ Test 1 Passed: Zero-Trust Guest Booking Lookup secures all PII.\n');

// ---------------------------------------------------------------------------
// Test 2: Host Payout Settlement & Double-Cashout Defense
// ---------------------------------------------------------------------------
console.log('▶ Test 2: Host Payout Settlement & Double-Cashout Defense');

// 2a. Verify CabRequest model schema contains hostSettlementStatus
assert.ok(CabRequest.schema.path('hostSettlementStatus'), 'CabRequestSchema must define hostSettlementStatus');
assert.ok(CabRequest.schema.path('hostSettledAt'), 'CabRequestSchema must define hostSettledAt');

// 2b. Verify eligibleFilter enforces hostSettlementStatus: { $ne: 'SETTLED' }
const filter = eligibleFilter('tenant_test_123');
assert.deepEqual(
  filter.hostSettlementStatus,
  { $ne: 'SETTLED' },
  'eligibleFilter must strictly exclude trips where hostSettlementStatus is SETTLED'
);
assert.equal(filter.hostPayoutId, null);
assert.equal(filter.status, 'COMPLETED');

console.log('✅ Test 2 Passed: Settled host trips can never be paid twice.\n');

// ---------------------------------------------------------------------------
// Test 3: Driver Overlap Window & Schedule Boundaries
// ---------------------------------------------------------------------------
console.log('▶ Test 3: Driver Overlap & Schedule Window Math');

const pickupA = 1731664800000; // Reference timestamp
const pickupB_2hrLater = pickupA + 2 * 3600000;
const pickupC_3hrLater = pickupA + 3 * 3600000;
const pickupD_4hrLater = pickupA + 4 * 3600000;

assert.equal(pickupsOverlap(pickupA, pickupB_2hrLater), true, 'Trips within 2 hours must overlap');
assert.equal(pickupsOverlap(pickupA, pickupC_3hrLater), false, 'Trips 3 hours apart must not overlap');
assert.equal(pickupsOverlap(pickupA, pickupD_4hrLater), false, 'Trips 4 hours apart must not overlap');

console.log('✅ Test 3 Passed: 3-hour driver schedule exclusivity verified.\n');

// Restore mocked methods
BookingService.getBookingByReference = originalGetByRef;

console.log('🎉 ALL PHASE 1 VERIFICATION TESTS PASSED SUCCESSFULLY!');
