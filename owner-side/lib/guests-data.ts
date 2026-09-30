/** Guest directory built from the reservation schedule plus past-stay history. */

import { roomGroups, type Channel } from "./calendar-data";
import { addDays, defaultStart, isSameDay } from "./calendar-window";
import { roomUnits, type RoomUnit } from "./rooms-data";
import { baseToday, seeded, windowDates, BOOK_WINDOW_DAYS } from "./timeline";

export type GuestStatus =
  | "Arriving today"
  | "In house"
  | "Departing today"
  | "Upcoming"
  | "Past stay";

export type Guest = {
  id: string;
  name: string;
  code: string;
  room: string;
  location: string;
  category: RoomUnit["category"];
  checkIn: Date;
  checkOut: Date;
  nights: number;
  party: number;
  channel: string;
  channelTone: string;
  email: string;
  phone: string;
  origin: string;
  spend: number;
  status: GuestStatus;
  tags: string[];
  note?: string;
  vip?: boolean;
  stays: number;
  lifetime: number;
};

const channelMeta: Record<string, { label: string; tone: string }> = {
  direct: { label: "Direct", tone: "bg-primary-tint text-on-primary-container" },
  airbnb: { label: "Airbnb", tone: "bg-secondary-tint text-secondary-ink" },
  ota: { label: "Booking.com", tone: "bg-tertiary-fixed text-on-tertiary-fixed" },
};

const origins = [
  "Boston, US",
  "Austin, US",
  "Toronto, CA",
  "Munich, DE",
  "Copenhagen, DK",
  "Manchester, UK",
  "Lisbon, PT",
  "Seattle, US",
  "Chicago, US",
  "Milan, IT",
  "Oslo, NO",
  "Denver, US",
];

const mailHosts = [
  "gmail.com",
  "outlook.com",
  "proton.me",
  "hey.com",
  "fastmail.com",
  "icloud.com",
];

const tagPool = [
  "Anniversary",
  "Late arrival",
  "Gluten-free",
  "Dog friendly",
  "Writing retreat",
  "Hiking",
  "Vegan",
  "Extra towels",
  "Early check-in",
  "Repeat stay",
  "Birthday",
  "Quiet room",
];

const notes = [
  "Prefers the ground floor suite — no stairs.",
  "Requested the birch log basket by the hearth.",
  "Celebrating a 10th anniversary.",
  "Bringing a small dog, needs the pet fee waived.",
  "Asked about trail parking for two cars.",
  "Vegetarian breakfast basket, no dairy.",
  "Late arrival after 9pm, keycode will be active.",
  "Wants the espresso bar stocked before arrival.",
];

const historyNames = [
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

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

function contactFor(name: string, salt: number) {
  const random = seeded(salt + name.length * 7919);
  const host = mailHosts[Math.floor(random() * mailHosts.length)];
  const area = 203 + Math.floor(random() * 40);
  const mid = 400 + Math.floor(random() * 500);
  const last = 1000 + Math.floor(random() * 8999);
  return {
    email: `${slug(name)}@${host}`,
    phone: `+1 (${area}) ${mid}-${last}`,
    origin: origins[Math.floor(random() * origins.length)],
  };
}

function tagsFor(name: string, salt: number): string[] {
  const random = seeded(salt * 31 + name.length);
  const count = 1 + Math.floor(random() * 2);
  const tags: string[] = [];
  while (tags.length < count) {
    const tag = tagPool[Math.floor(random() * tagPool.length)];
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

function statusFor(checkIn: Date, checkOut: Date): GuestStatus {
  const today = baseToday;
  if (isSameDay(checkIn, today)) return "Arriving today";
  if (isSameDay(checkOut, today)) return "Departing today";
  if (checkIn < today && checkOut > today) return "In house";
  if (checkIn > today) return "Upcoming";
  return "Past stay";
}

const statusTone: Record<GuestStatus, string> = {
  "Arriving today": "bg-primary-tint text-on-primary-container",
  "In house": "bg-emerald-100 text-emerald-900",
  "Departing today": "bg-amber-100 text-amber-900",
  Upcoming: "bg-slate-100 text-slate-700",
  "Past stay": "bg-stone-200 text-stone-700",
};

export function statusToneFor(status: GuestStatus): string {
  return statusTone[status];
}

function roomUnitFor(code: string): RoomUnit {
  const digits = code.replace(/\D/g, "");
  return (
    roomUnits.find((room) => room.code === digits) ?? roomUnits[0]
  );
}

function nightlyFor(unit: RoomUnit, checkIn: Date): number {
  const weekend = checkIn.getDay() === 5 || checkIn.getDay() === 6;
  return weekend ? unit.weekend ?? unit.nightly : unit.nightly;
}

function charge(nights: number, rate: number, party: number): number {
  const stay = nights * rate;
  const cleaning = 40;
  const tax = Math.round(stay * 0.04);
  return stay + cleaning + tax + (party > 2 ? (party - 2) * 18 : 0);
}

/** Every live and past stay in the designed window. */
function currentGuests(): Guest[] {
  const guests: Guest[] = [];
  let index = 0;

  for (const group of roomGroups) {
    for (const room of group.rooms) {
      const unit = roomUnitFor(room.code);
      for (const reservation of room.reservations) {
        if (reservation.channel === "blocked") continue;
        const checkIn = addDays(defaultStart, reservation.start);
        const checkOut = addDays(checkIn, reservation.nights);
        const random = seeded(index * 977 + reservation.guest.length);
        const party = 1 + Math.floor(random() * Math.max(1, unit.maxGuests));
        const contact = contactFor(reservation.guest, index);
        const spend = charge(reservation.nights, nightlyFor(unit, checkIn), party);
        const stays = 1 + Math.floor(random() * 3);
        const meta = channelMeta[reservation.channel] ?? channelMeta.direct;
        const vip = stays > 2 || party >= 4;
        guests.push({
          id: `MF-2024-${8100 + index}`,
          name: reservation.guest,
          code: unit.code,
          room: unit.name,
          location: unit.location,
          category: unit.category,
          checkIn,
          checkOut,
          nights: reservation.nights,
          party,
          channel: meta.label,
          channelTone: meta.tone,
          email: contact.email,
          phone: contact.phone,
          origin: contact.origin,
          spend,
          status: statusFor(checkIn, checkOut),
          tags: reservation.tag ? [reservation.tag, ...tagsFor(reservation.guest, index)] : tagsFor(reservation.guest, index),
          note: notes[Math.floor(random() * notes.length)],
          vip,
          stays,
          lifetime: spend * stays,
        });
        index += 1;
      }
    }
  }

  return guests.sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
}

/** Completed stays that fill out the "been here before" side of the directory. */
function pastGuests(): Guest[] {
  const random = seeded(4_244);
  const sources: { label: string; tone: string }[] = [
    channelMeta.direct,
    channelMeta.airbnb,
    channelMeta.ota,
  ];
  return historyNames.map((name, index) => {
    const unit = roomUnits[Math.floor(random() * roomUnits.length)];
    const nights = 2 + Math.floor(random() * 4);
    const checkIn = addDays(baseToday, -(21 + Math.floor(random() * 150) + nights));
    const checkOut = addDays(checkIn, nights);
    const party = 1 + Math.floor(random() * unit.maxGuests);
    const contact = contactFor(name, 900 + index);
    const stay = charge(nights, nightlyFor(unit, checkIn), party);
    const stays = 1 + Math.floor(random() * 4);
    const source = sources[index % sources.length];
    return {
      id: `MF-2023-${4020 + index}`,
      name,
      code: unit.code,
      room: unit.name,
      location: unit.location,
      category: unit.category,
      checkIn,
      checkOut,
      nights,
      party,
      channel: source.label,
      channelTone: source.tone,
      email: contact.email,
      phone: contact.phone,
      origin: contact.origin,
      spend: stay,
      status: "Past stay" as const,
      tags: tagsFor(name, 500 + index),
      vip: stays > 2,
      stays,
      lifetime: stay * stays,
    };
  });
}

export const guests: Guest[] = [...currentGuests(), ...pastGuests()];

export const guestStats = {
  total: guests.length,
  inHouse: guests.filter((guest) => guest.status === "In house").length,
  arriving: guests.filter((guest) => guest.status === "Arriving today").length,
  departing: guests.filter((guest) => guest.status === "Departing today").length,
  returning: guests.filter((guest) => guest.stays > 1).length,
  vip: guests.filter((guest) => guest.vip).length,
  lifetime: guests.reduce((sum, guest) => sum + guest.lifetime, 0),
};

export type GuestDay = {
  date: Date;
  arrivals: number;
  departures: number;
  inHouse: number;
  guests: number;
  occupancy: number;
  today: boolean;
};

/** Arrival / departure / in-house counts for each day of the window. */
export function guestTimeline(start: Date, days = BOOK_WINDOW_DAYS): GuestDay[] {
  const scope = guests.filter((guest) => guest.status !== "Past stay");
  return windowDates(start, days).map((date) => {
    const arriving = scope.filter((guest) => isSameDay(guest.checkIn, date));
    const leaving = scope.filter((guest) => isSameDay(guest.checkOut, date));
    const staying = scope.filter(
      (guest) => guest.checkIn <= date && guest.checkOut > date,
    );
    return {
      date,
      arrivals: arriving.length,
      departures: leaving.length,
      inHouse: staying.length,
      guests: staying.reduce((sum, guest) => sum + guest.party, 0),
      occupancy: Math.round((staying.length / roomUnits.length) * 100),
      today: isSameDay(date, baseToday),
    };
  });
}

export function guestsByRoom(guestsIn: Guest[] = guests): Map<string, Guest[]> {
  const map = new Map<string, Guest[]>();
  for (const guest of guestsIn) {
    const list = map.get(guest.code) ?? [];
    list.push(guest);
    map.set(guest.code, list);
  }
  return map;
}

export const guestFilters: { label: string; value: string }[] = [
  { label: "Everyone", value: "all" },
  { label: "In house", value: "In house" },
  { label: "Arriving", value: "Arriving today" },
  { label: "Departing", value: "Departing today" },
  { label: "Upcoming", value: "Upcoming" },
  { label: "Past stays", value: "Past stay" },
];

export const channelOptions: { label: string; channel: Channel }[] = [
  { label: "Direct", channel: "direct" },
  { label: "Airbnb", channel: "airbnb" },
  { label: "Booking.com", channel: "ota" },
];
