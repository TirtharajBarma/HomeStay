/** Window arithmetic shared by the analytics, booking and guest timelines. */

import { addDays } from "./calendar-window";

/** Oct 24, 2024 — the "today" the whole demo is anchored to. */
export const baseToday = new Date(2024, 9, 24);

/** Availability window for the booking grid, in days. */
export const BOOK_WINDOW_DAYS = 14;

export const MONTHS = [
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

export const MONTHS_SHORT = MONTHS.map((month) => month.slice(0, 3));

export const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function windowDates(start: Date, days: number): Date[] {
  return Array.from({ length: days }, (_, index) => addDays(start, index));
}

/** Moves a window forward or backward by whole windows. */
export function shiftWindow(start: Date, days: number, delta: number): Date {
  return addDays(start, delta * days);
}

/** `Oct 18 – Oct 31, 2024`, collapsing the month when it does not change. */
export function windowCaption(start: Date, days: number): string {
  const end = addDays(start, days - 1);
  if (days === 1) {
    return `${MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
  }
  if (start.getMonth() === end.getMonth()) {
    return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

export function shortDate(date: Date): string {
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

export function longDate(date: Date): string {
  return `${DOW_SHORT[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

export function isToday(date: Date): boolean {
  const today = baseToday;
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}

/** `2024-10-24` in local time — matches what `<input type="date">` produces. */
export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Small deterministic PRNG so every date renders stable, plausible numbers. */
export function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

