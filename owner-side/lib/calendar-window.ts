/** Calendar window helpers: real date maths plus deterministic schedules. */

import {
  days as baseDays,
  roomGroups as baseGroups,
  todayIndex,
  type Day,
  type Reservation,
  type RoomGroup,
} from "./calendar-data";

export const WINDOW_DAYS = 14;

/** Oct 18, 2024 — the first day of the designed 14-day window. */
export const defaultStart = new Date(2024, 9, 18);

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `October 2024` — the heading shown above the timeline. */
export function rangeLabel(start: Date): string {
  return `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
}

/** `Oct 18 – Oct 31, 2024`, collapsing the month when it does not change. */
export function rangeCaption(start: Date): string {
  const end = addDays(start, WINDOW_DAYS - 1);
  const sameMonth = start.getMonth() === end.getMonth();
  const short = (date: Date) =>
    `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
  return sameMonth
    ? `${MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`
    : `${short(start)} – ${short(end)}, ${end.getFullYear()}`;
}

export function isDefaultWindow(start: Date): boolean {
  return isSameDay(start, defaultStart);
}

/** Occupancy for a window: share of rooms with a bar covering that night. */
export function occupancyFor(
  groups: RoomGroup[],
  dayIndex: number,
  totalRooms: number,
): string {
  let occupied = 0;
  for (const group of groups) {
    for (const room of group.rooms) {
      const staying = room.reservations.some(
        (reservation) =>
          dayIndex >= reservation.start &&
          dayIndex < reservation.start + reservation.nights,
      );
      if (staying) occupied += 1;
    }
  }
  return `${Math.round((occupied / totalRooms) * 100)}%`;
}

export function buildDays(start: Date, groups: RoomGroup[]): Day[] {
  const totalRooms = groups.reduce(
    (count, group) => count + group.rooms.length,
    0,
  );
  return Array.from({ length: WINDOW_DAYS }, (_, index) => {
    const date = addDays(start, index);
    const dow = DOW[date.getDay()];
    return {
      dow: index === todayIndex && isDefaultWindow(start) ? "TODAY" : dow,
      date: date.getDate(),
      occupancy: occupancyFor(groups, index, totalRooms),
      today: index === todayIndex && isDefaultWindow(start),
      weekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });
}

/** Small deterministic PRNG so every range renders stable, plausible data. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const guestPool = [
  "Helena Rask",
  "Tomas & Ines Vidal",
  "Marguerite Duval",
  "Owen Fitzgerald",
  "Priya Raman",
  "Noah Bergstrom",
  "Camille Ferrand",
  "Idris & Sana Karim",
  "Beatrice Lam",
  "Georgios Papas",
  "Yuki Tanabe",
  "Rosalind Pike",
  "Mateo Alvarez",
  "Freya Lindqvist",
];

const channelPool: { channel: Reservation["channel"]; tag: string }[] = [
  { channel: "direct", tag: "Direct" },
  { channel: "airbnb", tag: "Airbnb" },
  { channel: "ota", tag: "Booking" },
];

const extras = [
  "Paid in full",
  "Balance ₹0",
  "Late arrival",
  "Anniversary stay",
  "Early check-in requested",
  "Repeat guest",
];

/**
 * The designed Oct 18–31 schedule, or a deterministic schedule derived from
 * the window start so navigation lands on real, stable data.
 */
export function getSchedule(start: Date): RoomGroup[] {
  if (isDefaultWindow(start)) return baseGroups;

  const seed = Math.floor(start.getTime() / 86_400_000);
  const random = seeded(seed);
  const pick = <T,>(list: T[]): T => list[Math.floor(random() * list.length)];

  return baseGroups.map((group) => ({
    ...group,
    rooms: group.rooms.map((room, roomIndex) => {
      // A maintenance hold for one room keeps the hatched bars in the design.
      const holdRoom = roomIndex === 2 && Math.floor(random() * 3) === 0;
      const reservations: Reservation[] = [];

      if (holdRoom) {
        const start0 = Math.floor(random() * 6);
        reservations.push({
          guest: "Maintenance hold",
          start: start0,
          nights: 3 + Math.floor(random() * 3),
          channel: "blocked",
          detail: "Deep clean & boiler service",
          blocked: true,
        });
      }

      let cursor = Math.floor(random() * 3);
      const count = 2 + Math.floor(random() * 2);
      for (let i = 0; i < count && cursor < WINDOW_DAYS; i += 1) {
        const nights = Math.min(
          2 + Math.floor(random() * 4),
          WINDOW_DAYS - cursor,
        );
        if (nights < 1) break;
        const source = pick(channelPool);
        reservations.push({
          guest: pick(guestPool),
          start: cursor,
          nights,
          channel: source.channel,
          tag: source.tag,
          detail: `${nights} nts • ${pick(extras)}`,
        });
        cursor += nights + Math.floor(random() * 3);
      }

      const openSlots = cursor < WINDOW_DAYS - 2 ? [{ start: cursor, nights: 2 }] : undefined;
      return { ...room, reservations, openSlots };
    }),
  }));
}

export { baseDays, todayIndex };
