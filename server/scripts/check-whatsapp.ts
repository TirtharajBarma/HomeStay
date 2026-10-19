// Run: npx tsx scripts/check-whatsapp.ts
// Checks phone normalisation, that nothing sends while WhatsApp is off, and the phone-privacy rule.
import assert from 'node:assert/strict';
import { toWhatsAppNumber, sendWhatsApp } from '../src/services/whatsapp.service.js';
import * as messages from '../src/stayride/messages.js';

assert.equal(toWhatsAppNumber('98320 12345'), '919832012345');
assert.equal(toWhatsAppNumber('+91 98320-12345'), '919832012345');
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
console.log('whatsapp checks passed');
