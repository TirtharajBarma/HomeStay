/** Deterministic revenue model: rooms, cabs and the commission they carry. */

import { money, moneyCompact } from "./currency";
import { roomUnits, type RoomUnit } from "./rooms-data";
import {
  MONTHS,
  isToday,
  isWeekend,
  seeded,
  shortDate,
  windowDates,
} from "./timeline";

export type RangeKey = "today" | "week" | "fortnight" | "month" | "quarter" | "year";

export type RangeOption = {
  key: RangeKey;
  label: string;
  days: number;
};

export const rangeOptions: RangeOption[] = [
  { key: "today", label: "Today", days: 1 },
  { key: "week", label: "Last 7 days", days: 7 },
  { key: "fortnight", label: "Last 14 days", days: 14 },
  { key: "month", label: "This month", days: 31 },
  { key: "quarter", label: "Last 90 days", days: 90 },
  { key: "year", label: "Year to date", days: 298 },
];

/** Share of the cab fare the estate keeps. Drivers take the rest. */
export const CAB_COMMISSION_RATE = 0.18;
export const CAB_FARE = 68;

export type DayStat = {
  date: Date;
  label: string;
  dow: string;
  roomsSold: number;
  occupancy: number;
  guests: number;
  roomRevenue: number;
  cabTrips: number;
  cabRevenue: number;
  cabCommission: number;
  weekend: boolean;
  today: boolean;
};

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Autumn foliage peak through mid-November, soft shoulder either side. */
function seasonLift(date: Date): number {
  const day = date.getDate();
  if (date.getMonth() === 9) return 0.86 + Math.min(day, 24) / 120;
  if (date.getMonth() === 10) return 0.9 - Math.max(0, day - 15) / 90;
  if (date.getMonth() === 6 || date.getMonth() === 7) return 0.78;
  if (date.getMonth() === 4 || date.getMonth() === 8) return 0.6;
  return 0.5;
}

export function dayStat(date: Date): DayStat {
  const random = seeded(Math.floor(date.getTime() / 86_400_000));
  const weekend = isWeekend(date);
  const lift = seasonLift(date) + (weekend ? 0.1 : 0) + (random() - 0.5) * 0.12;
  const occupancy = Math.min(1, Math.max(0.18, lift));
  const roomsSold = Math.min(roomUnits.length, Math.round(occupancy * roomUnits.length));
  const guests = roomsSold * (1 + Math.floor(random() * 3));
  const rate = 178 + Math.round(random() * 84) + (weekend ? 22 : 0);
  const roomRevenue = roomsSold * rate;
  const cabTrips = Math.max(0, Math.round(guests * (0.34 + random() * 0.26)));
  const cabRevenue = cabTrips * (CAB_FARE + Math.round(random() * 26));
  return {
    date,
    label: shortDate(date),
    dow: DOW[date.getDay()],
    roomsSold,
    occupancy: Math.round(occupancy * 100),
    guests,
    roomRevenue,
    cabTrips,
    cabRevenue,
    cabCommission: Math.round(cabRevenue * CAB_COMMISSION_RATE),
    weekend,
    today: isToday(date),
  };
}

export function rangeStats(start: Date, days: number): DayStat[] {
  return windowDates(start, days).map(dayStat);
}

export type Totals = {
  revenue: number;
  roomRevenue: number;
  cabRevenue: number;
  cabCommission: number;
  driverPayout: number;
  guests: number;
  roomNights: number;
  occupancy: number;
  adr: number;
  cabTrips: number;
  avgStay: number;
  revenuePerGuest: number;
};

export function totalsFor(days: DayStat[]): Totals {
  const roomRevenue = days.reduce((sum, day) => sum + day.roomRevenue, 0);
  const cabRevenue = days.reduce((sum, day) => sum + day.cabRevenue, 0);
  const cabCommission = Math.round(cabRevenue * CAB_COMMISSION_RATE);
  const roomNights = days.reduce((sum, day) => sum + day.roomsSold, 0);
  const guests = days.reduce((sum, day) => sum + day.guests, 0);
  const capacity = days.length * roomUnits.length;
  return {
    roomRevenue,
    cabRevenue,
    cabCommission,
    driverPayout: cabRevenue - cabCommission,
    revenue: roomRevenue + cabRevenue,
    guests,
    roomNights,
    occupancy: capacity ? Math.round((roomNights / capacity) * 100) : 0,
    adr: roomNights ? Math.round(roomRevenue / roomNights) : 0,
    cabTrips: days.reduce((sum, day) => sum + day.cabTrips, 0),
    avgStay: guests ? 2 + (roomNights / guests) * 1.4 : 0,
    revenuePerGuest: guests ? Math.round((roomRevenue + cabRevenue) / guests) : 0,
  };
}

export type ServiceRow = {
  key: string;
  label: string;
  detail: string;
  icon: string;
  gross: number;
  cost: number;
  costLabel: string;
  net: number;
  share: number;
  tone: string;
  bar: string;
};

/** Rooms and cabs side by side, with what each one actually pays out. */
export function serviceBreakdown(totals: Totals): ServiceRow[] {
  const rows: ServiceRow[] = [
    {
      key: "rooms",
      label: "Rooms & stay",
      detail: `${totals.roomNights} room nights sold`,
      icon: "king_bed",
      gross: totals.roomRevenue,
      cost: Math.round(totals.roomRevenue * 0.11),
      costLabel: "Cleaning, linens & OTA fees (11%)",
      net: totals.roomRevenue - Math.round(totals.roomRevenue * 0.11),
      share: 0,
      tone: "bg-primary-tint text-primary",
      bar: "bg-primary",
    },
    {
      key: "cabs",
      label: "Cabs & transfers",
      detail: `${totals.cabTrips} airport & valley trips`,
      icon: "local_taxi",
      gross: totals.cabRevenue,
      cost: totals.driverPayout,
      costLabel: `Driver payout (${Math.round((1 - CAB_COMMISSION_RATE) * 100)}%)`,
      net: totals.cabCommission,
      share: 0,
      tone: "bg-secondary-tint text-secondary-ink",
      bar: "bg-secondary",
    },
  ];
  return rows.map((row) => ({ ...row, share: totals.revenue ? row.gross / totals.revenue : 0 }));
}

export type RoomStat = {
  code: string;
  name: string;
  category: RoomUnit["category"];
  nights: number;
  occupancy: number;
  guests: number;
  revenue: number;
  commission: number;
  share: number;
  maintenance?: boolean;
};

const roomWeights: Record<string, number> = {
  "101": 0.19,
  "102": 0.17,
  "201": 0.21,
  "202": 0.15,
  "301": 0.2,
  "302": 0.08,
};

export function roomBreakdown(days: DayStat[]): RoomStat[] {
  const totals = totalsFor(days);
  return roomUnits
    .map((room) => {
      const weight = roomWeights[room.code] ?? 0.16;
      const maintenance = room.status === "Maintenance";
      const nights = maintenance
        ? Math.round(totals.roomNights * weight * 0.4)
        : Math.round(totals.roomNights * weight);
      const revenue = Math.round(totals.roomRevenue * weight);
      return {
        code: room.code,
        name: room.name,
        category: room.category,
        nights,
        occupancy: days.length
          ? Math.min(100, Math.round((nights / days.length) * (maintenance ? 0.6 : 1.08)))
          : 0,
        guests: Math.round(nights * 2.1),
        revenue,
        commission: Math.round(revenue * 0.11),
        share: totals.roomRevenue ? revenue / totals.roomRevenue : 0,
        maintenance,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export type GuestMixRow = { label: string; count: number; share: number; tone: string };

export function guestMix(totals: Totals): GuestMixRow[] {
  const returning = Math.round(totals.guests * 0.28);
  const first = totals.guests - returning;
  const rows = [
    { label: "First-time stays", count: first, tone: "bg-primary" },
    { label: "Returning guests", count: returning, tone: "bg-primary-container" },
  ];
  return rows.map((row) => ({
    ...row,
    share: totals.guests ? row.count / totals.guests : 0,
  }));
}

export const guestMixNote =
  "Guests who receive the handwritten welcome basket book direct three times more often.";

export function revenueLabel(days: DayStat[]): string {
  const revenue = days.reduce((sum, day) => sum + day.roomRevenue + day.cabRevenue, 0);
  return money(revenue);
}

export function axisLabel(value: number): string {
  return moneyCompact(value);
}

export function monthName(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
