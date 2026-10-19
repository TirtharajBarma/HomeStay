import { Booking, Homestay, PaymentMethod } from '../types';

// Same rules as the server (store.ts paidOf / balanceOf): a booking marked paid before payments were
// itemised counts as fully paid.
export const paidOf = (b: Booking) => (b.payments?.length ? b.payments.reduce((s, p) => s + p.amount, 0) : b.paid ? b.amount : 0);
export const balanceOf = (b: Booking) => Math.max(0, b.amount - paidOf(b));

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'UPI', label: 'UPI' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'OTA', label: 'Paid via OTA' },
  { value: 'OTHER', label: 'Other' },
];
export const methodLabel = (m: string) => PAYMENT_METHODS.find((x) => x.value === m)?.label || m;

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const day = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Plain-text receipt the owner can share (WhatsApp, SMS…) from their own phone. */
export function receiptText(b: Booking, homestay: Homestay): string {
  const nights = Math.max(1, Math.round((b.checkOut - b.checkIn) / 86400000));
  const lines = [
    `Receipt · ${homestay.name || 'Homestay'}`,
    `Guest: ${b.guestName}`,
    `Room ${b.roomNumber} · ${day(b.checkIn)} → ${day(b.checkOut)} (${nights} night${nights === 1 ? '' : 's'})`,
    homestay.checkInTime || homestay.checkOutTime
      ? `Check-in from ${homestay.checkInTime || '—'} · Check-out by ${homestay.checkOutTime || '—'}`
      : '',
    '',
    `Total: ${inr(b.amount)}`,
    ...(b.payments || []).map((p) => `Received ${inr(p.amount)} by ${methodLabel(p.method)} on ${day(p.at)}`),
    `Balance due: ${inr(balanceOf(b))}`,
    '',
    `Booking #${b.id}${homestay.phone ? ` · ${homestay.phone}` : ''}`,
  ];
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n').trim();
}
