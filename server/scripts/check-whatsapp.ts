// Run: npx tsx scripts/check-whatsapp.ts
// Checks phone normalisation, that nothing sends while WhatsApp is off, and the phone-privacy rule.
import './no-telemetry.js'; // must stay the first import
import assert from 'node:assert/strict';
import { toWhatsAppNumber, sendWhatsApp, verifyMetaSignature, verifyHandshake, opaqueData, readOpaqueData, recordWhatsAppWebhook } from '../src/services/whatsapp.service.js';
import * as messages from '../src/stayride/messages.js';
import { logger } from '../src/utils/logger.js';

assert.equal(toWhatsAppNumber('98320 12345'), '919832012345');
assert.equal(toWhatsAppNumber('+91 98320-12345'), '919832012345');
assert.equal(toWhatsAppNumber('09830112345'), '919830112345');
assert.equal(toWhatsAppNumber('00919830112345'), '919830112345');
assert.equal(toWhatsAppNumber('919830112345'), '919830112345');
assert.equal(toWhatsAppNumber('12345'), null);
assert.equal(toWhatsAppNumber(''), null);

delete process.env.WHATSAPP_DISPATCH_MODE;
const built = messages.askCabMessage('Asha', 'Hill View', 'https://x/y');
assert.equal(await sendWhatsApp(false, { ...built, to: '9832012345' }), 'SKIPPED');
assert.equal(await sendWhatsApp(true, { ...built, to: '9832012345' }), 'SKIPPED');

const doc = {
  guestName: 'Asha', guestPhone: '9111111111', assignedDriverName: 'Pema', assignedDriverPhone: '9222222222',
  homestayName: 'Hill View', vehicleType: 'SUV', date: Date.now(), time: '09:00 AM', agreedFare: 3000, advanceAmount: 900,
  remainingCashAmount: 2100, pickupLocation: { address: 'Hill View' }, destinations: [{ address: 'Batasia Loop' }],
};
// before payment: neither side sees the other's phone
assert.ok(!messages.quoteAcceptedGuestMessage(doc, 'https://x', 30).text.includes('9222222222'));
assert.ok(!messages.quoteAcceptedDriverMessage('Pema', 'REQ-1').text.includes('9111111111'));
// after payment: both do
assert.ok(messages.advancePaidGuestMessage(doc).text.includes('9222222222'));
assert.ok(messages.advancePaidDriverMessage(doc).text.includes('9111111111'));
// template variables carry what the plain text shows (approved bodies use these counts)
assert.equal(messages.newRequestMessage(doc, 'https://q').params[3], 'SUV');
assert.equal(messages.advancePaidGuestMessage({ ...doc, pickupOtp: 4821 }).params.length, 7);
assert.deepEqual(messages.boardingPinGuestMessage('4821').params, ['4821']);
const driverParams = messages.advancePaidDriverMessage({ ...doc, reference: 'SR-1' }, 'https://d').params;
assert.equal(driverParams[1], 'SR-1');
assert.equal(driverParams[7], 'https://d');
// builders carry the trip context that goes to Meta as biz_opaque_callback_data
assert.deepEqual(messages.advancePaidDriverMessage({ ...doc, reference: 'SR-1', propertyId: 'h@x.in', assignedDriverUserId: 'd1' }).context, { ref: 'SR-1', tenantId: 'h@x.in', driverId: 'd1' });

// webhook signature: sha256= + hex HMAC-SHA256(raw body, app secret)
const SIG = 'sha256=afd29cf60a0538787bef1d5c82c0253e6f8782f3957bbb07b00698376010f8d7';
assert.ok(verifyMetaSignature('{"entry":[]}', SIG, 'meta-app-secret'));
assert.ok(verifyMetaSignature(Buffer.from('{"entry":[]}'), SIG.toUpperCase().replace('SHA256=', 'sha256='), 'meta-app-secret'));
assert.ok(!verifyMetaSignature('{"entry":[1]}', SIG, 'meta-app-secret')); // body changed
assert.ok(!verifyMetaSignature('{"entry":[]}', SIG, 'other-secret'));
assert.ok(!verifyMetaSignature('{"entry":[]}', SIG.slice(7), 'meta-app-secret')); // prefix missing
assert.ok(!verifyMetaSignature('{"entry":[]}', undefined, 'meta-app-secret'));
assert.ok(!verifyMetaSignature('{"entry":[]}', SIG, '')); // secret not set
assert.ok(!verifyMetaSignature('{"entry":[]}', SIG, 'replace-with-meta-app-secret')); // placeholder = not set

// verify-token handshake
const hub = { 'hub.mode': 'subscribe', 'hub.verify_token': 'tok-123', 'hub.challenge': '98765' };
assert.equal(verifyHandshake(hub, 'tok-123'), '98765');
assert.equal(verifyHandshake({ ...hub, 'hub.verify_token': 'tok-124' }, 'tok-123'), null);
assert.equal(verifyHandshake({ ...hub, 'hub.mode': 'unsubscribe' }, 'tok-123'), null);
assert.equal(verifyHandshake(hub, ''), null);

// biz_opaque_callback_data stays under Meta's 512 chars, and round-trips
const long = 'x'.repeat(1000);
assert.ok(opaqueData('QUOTE_ACCEPTED_GUEST', { ref: long, tenantId: long, driverId: long }).length <= 512);
assert.deepEqual(readOpaqueData(opaqueData('NEW_REQUEST', { ref: 'SR-1', tenantId: 'h@x.in' })), { event: 'NEW_REQUEST', ref: 'SR-1', tenantId: 'h@x.in', driverId: undefined });
assert.deepEqual(readOpaqueData('not json'), {});

// webhook path masks phones (a delivered status is Axiom-only, so nothing touches the DB here)
const seen: any[] = [];
const info = logger.info.bind(logger);
logger.info = (message: string, meta?: any) => void seen.push({ message, meta });
await recordWhatsAppWebhook({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered', recipient_id: '919832012345', biz_opaque_callback_data: opaqueData('NEW_REQUEST', { ref: 'SR-1' }), pricing: { category: 'utility' } }] } }] }] });
logger.info = info;
assert.equal(seen.length, 1);
assert.equal(seen[0].meta.metadata.to, '******2345');
assert.equal(seen[0].meta.metadata.ref, 'SR-1');
assert.equal(seen[0].meta.metadata.pricingCategory, 'utility');
assert.ok(!JSON.stringify(seen).includes('9832012345'));
console.log('whatsapp checks passed');
