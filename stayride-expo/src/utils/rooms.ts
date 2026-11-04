import { Booking, Room, RoomStatus } from '../types';

// Same rules as the server (server/src/stayride/store.ts: heldUntil / bookingClash / roomStatusOf),
// so the phone shows the server's answer immediately, before the next sync.
const DAY_MS = 86400000;
const IST_OFFSET = 330 * 60000;
const istDayStart = (t: number) => Math.floor((t + IST_OFFSET) / DAY_MS) * DAY_MS - IST_OFFSET;

/** Until when a booking holds its room (early checkout frees the rest; an overstay keeps it). */
export function heldUntil(b: Booking, now = Date.now()): number {
  if (b.status === 'CHECKED_OUT') return Math.min(b.checkOut, istDayStart(b.actualCheckOut ?? b.checkOut));
  if (b.status === 'CHECKED_IN') return Math.max(b.checkOut, now);
  return b.checkOut;
}

export function bookingClash(
  bookings: Booking[],
  roomNumber: string,
  checkIn: number,
  checkOut: number,
  exceptId?: number,
  bedNumber?: string
) {
  const normBed = (b?: string) => (b ? String(b).trim().toLowerCase() : '');
  const reqBed = normBed(bedNumber);

  return bookings.find((b) => {
    if (b.id === exceptId) return false;
    if (b.roomNumber !== roomNumber) return false;
    if (b.status === 'CANCELLED') return false;
    if (!(checkIn < heldUntil(b) && checkOut > b.checkIn)) return false;

    const bBed = normBed(b.bedNumber);
    if (reqBed && bBed) {
      return reqBed === bBed;
    }
    return true;
  });
}

/** MAINTENANCE is the owner's only manual status; the rest comes from today's bookings. */
export function roomStatusOf(room: Room, bookings: Booking[], now = Date.now()): RoomStatus {
  if (room.status === 'MAINTENANCE') return 'MAINTENANCE';
  const mine = bookings.filter((b) => b.roomNumber === room.number && b.status !== 'CANCELLED');
  if (room.roomType === 'DORM' && room.bedCount && room.bedCount > 1) {
    const checkedInCount = mine.filter((b) => b.status === 'CHECKED_IN').length;
    if (checkedInCount >= room.bedCount) return 'OCCUPIED';
    const activeStays = mine.filter((b) => b.status === 'CHECKED_IN' || (b.status === 'CONFIRMED' && b.checkIn <= now && now < b.checkOut));
    if (activeStays.length >= room.bedCount) return 'RESERVED';
    return 'AVAILABLE';
  }
  if (mine.some((b) => b.status === 'CHECKED_IN')) return 'OCCUPIED';
  if (mine.some((b) => b.status === 'CONFIRMED' && b.checkIn <= now && now < b.checkOut)) return 'RESERVED';
  return 'AVAILABLE';
}

/** Every room with whether it can be booked for these dates, and why not. For dorms, checks if any beds are free. */
export function roomAvailability(rooms: Room[], bookings: Booking[], checkIn: number, checkOut: number) {
  return rooms.map((room) => {
    if (room.status === 'MAINTENANCE') return { room, free: false, reason: 'Under maintenance' };
    if (room.roomType === 'DORM' && room.bedCount && room.bedCount > 1) {
      const activeMine = bookings.filter(
        (b) => b.roomNumber === room.number && b.status !== 'CANCELLED' && checkIn < heldUntil(b) && checkOut > b.checkIn
      );
      const bookedBeds = new Set(activeMine.map((b) => b.bedNumber).filter(Boolean));
      const hasFreeBeds = bookedBeds.size < room.bedCount;
      return hasFreeBeds
        ? { room, free: true, reason: '' }
        : { room, free: false, reason: `All ${room.bedCount} beds booked` };
    }
    const clash = bookingClash(bookings, room.number, checkIn, checkOut);
    return clash
      ? { room, free: false, reason: `Booked by ${clash.guestName}` }
      : { room, free: true, reason: '' };
  });
}

const minutesOf = (t?: string) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((t || '').trim());
  return m ? ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2]) : null;
};

/** When the guest must be out: the checkout day at the homestay's check-out time (midnight if none set). */
export const checkoutDueAt = (b: Booking, checkOutTime?: string) => b.checkOut + (minutesOf(checkOutTime) ?? 0) * 60000;

/** The moment has passed (e.g. a checkout date: overstay / no-show warnings). */
export const isPast = (ms: number) => Date.now() >= ms;

/** Check-in is allowed from the start of the check-in day. */
export const canCheckInNow = (b: Booking) => Date.now() >= istDayStart(b.checkIn);
