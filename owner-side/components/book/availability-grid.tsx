"use client";

import { useMoney } from "@/components/currency-provider";
import { Icon } from "@/components/icon";
import type { EstateBooking, EstateRoom } from "@/components/estate-provider";
import type { RoomGroup } from "@/lib/calendar-data";
import { baseToday, isWeekend, isoDate, shortDate, windowDates } from "@/lib/timeline";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The schedule keys rooms as "Room 101"; the estate list uses bare codes. */
const bare = (code: string) => code.replace(/\D/g, "");

type Cell = {
  kind: "open" | "booked" | "blocked" | "past";
  label?: string;
};

const initials = (name: string) =>
  name
    .split(/\s|&/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

type AvailabilityGridProps = {
  rooms: EstateRoom[];
  schedule: RoomGroup[];
  start: Date;
  days: number;
  bookings: EstateBooking[];
  /** Fires on a free, bookable cell. */
  onPick: (room: EstateRoom, date: Date) => void;
};

export function AvailabilityGrid({
  rooms,
  schedule,
  start,
  days,
  bookings,
  onPick,
}: AvailabilityGridProps) {
  const { money } = useMoney();
  const calendar = windowDates(start, days);

  const scheduleFor = (code: string) => {
    for (const group of schedule) {
      const match = group.rooms.find((room) => bare(room.code) === code);
      if (match) return match;
    }
    return undefined;
  };

  const cellFor = (room: EstateRoom, date: Date, index: number): Cell => {
    if (date < baseToday) return { kind: "past" };
    if (room.status === "Maintenance") return { kind: "blocked", label: "Maintenance" };

    const reserved = scheduleFor(room.code)?.reservations.find(
      (reservation) => index >= reservation.start && index < reservation.start + reservation.nights,
    );
    if (reserved) {
      return reserved.channel === "blocked"
        ? { kind: "blocked", label: reserved.detail }
        : { kind: "booked", label: reserved.guest };
    }

    const iso = isoDate(date);
    const own = bookings.find(
      (booking) => booking.code === room.code && booking.checkIn <= iso && booking.checkOut > iso,
    );
    return own ? { kind: "booked", label: own.guest } : { kind: "open" };
  };

  const legend: { kind: Cell["kind"]; label: string; className: string }[] = [
    { kind: "open", label: "Open", className: "bg-surface-container-lowest border-outline-variant/40" },
    { kind: "booked", label: "Booked", className: "bg-primary-tint border-primary/25" },
    { kind: "blocked", label: "Maintenance", className: "bg-hold-surface border-hold-ink/30" },
    { kind: "past", label: "Past", className: "bg-surface-container/60 border-outline-variant/20" },
  ];

  return (
    <section className="clay-card clay-lift overflow-hidden rounded-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 p-5">
        <div>
          <h2 className="text-title-sm text-title-sm font-semibold text-primary">
            Date-wise availability
          </h2>
          <p className="mt-0.5 text-label-sm text-label-sm text-outline">
            <span className="hidden sm:inline">Click any open day to start a booking</span>
            <span className="sm:hidden">Tap an open day below to start a booking</span>
          </p>
        </div>

        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {legend.map((entry) => (
            <li key={entry.kind} className="flex items-center gap-1.5 text-label-sm text-label-sm text-on-surface-variant">
              <span className={`inline-block h-3 w-3 rounded border ${entry.className}`} />
              {entry.label}
            </li>
          ))}
        </ul>
      </header>

      {/* Phones get a day-by-day list — a 28-column table is unusable there. */}
      <ul className="divide-y divide-outline-variant/20 lg:hidden">
        {calendar.map((date, index) => {
          const isToday = isoDate(date) === isoDate(baseToday);
          return (
            <li key={isoDate(date)} className="px-4 py-3">
              <p className="mb-2 flex items-baseline gap-2">
                <span className={`text-body-md text-body-md font-semibold ${isToday ? "text-primary" : "text-on-surface"}`}>
                  {isToday ? "Today" : shortDate(date)}
                </span>
                {isWeekend(date) ? (
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-label-sm text-label-sm text-outline">
                    Weekend
                  </span>
                ) : null}
              </p>
              <div className="flex flex-col gap-1.5">
                {rooms.map((room) => {
                  const cell = cellFor(room, date, index);
                  if (cell.kind === "open") {
                    return (
                      <button
                        key={room.code}
                        onClick={() => onPick(room, date)}
                        data-testid={`mobile-open-${room.code}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-outline-variant/50 px-3 py-2 text-left transition-colors hover:border-solid hover:border-primary hover:bg-primary-tint"
                      >
                        <span className="min-w-0 flex-1 truncate text-label-md text-label-md text-on-surface">
                          {room.name}
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-1.5 text-label-sm text-label-sm text-outline">
                          {money(room.nightly)}
                          <Icon name="add_circle" className="text-[18px] text-primary" />
                        </span>
                      </button>
                    );
                  }
                  const meta = {
                    booked: { cls: "border-primary/25 bg-primary-tint text-on-primary-container", icon: "event_available" },
                    blocked: { cls: "border-hold-ink/30 bg-hold-surface text-hold-ink", icon: "handyman" },
                    past: { cls: "border-outline-variant/20 bg-surface-container/60 text-outline-variant", icon: "history" },
                  }[cell.kind];
                  return (
                    <div
                      key={room.code}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${meta.cls}`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Icon name={meta.icon} className="flex-shrink-0 text-[15px]" />
                        <span className="truncate text-label-md text-label-md">{room.name}</span>
                      </span>
                      <span className="flex-shrink-0 truncate text-label-sm text-label-sm">
                        {cell.kind === "past" ? "Past" : cell.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="custom-scrollbar hidden min-w-0 overflow-x-auto lg:block">
        <table className="w-full min-w-[60rem] border-collapse">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-56 border-b border-outline-variant/30 bg-surface-container-lowest px-5 py-2.5 text-left text-label-sm text-label-sm font-semibold uppercase text-outline"
              >
                Room
              </th>
              {calendar.map((date) => (
                <th
                  key={isoDate(date)}
                  scope="col"
                  className={`border-b border-outline-variant/30 px-1 py-2.5 text-center text-label-sm text-label-sm ${
                    isoDate(date) === isoDate(baseToday)
                      ? "bg-primary-tint text-primary"
                      : "text-outline"
                  }`}
                >
                  <span className="block font-semibold">{DOW[date.getDay()]}</span>
                  <span className="block text-body-sm text-body-sm">
                    {isoDate(date) === isoDate(baseToday) ? "Today" : date.getDate()}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rooms.map((room) => (
              <tr key={room.code} className="border-b border-outline-variant/20 last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface-container-lowest px-5 py-2.5 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container text-label-sm text-label-sm font-semibold text-primary">
                      {room.code}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-body-md text-body-md font-medium text-on-surface">
                        {room.name}
                      </p>
                      <p className="truncate text-label-sm text-label-sm text-outline">
                        {room.location}
                      </p>
                    </div>
                  </div>
                </th>

                {calendar.map((date, index) => {
                  const cell = cellFor(room, date, index);
                  const base =
                    "group relative h-14 border-l border-outline-variant/20 px-1 py-1.5 align-middle";

                  if (cell.kind === "open") {
                    return (
                      <td key={isoDate(date)} className={base}>
                        <button
                          onClick={() => onPick(room, date)}
                          title={`Book ${room.name} on ${shortDate(date)}`}
                          className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant/50 transition-colors hover:border-solid hover:border-primary hover:bg-primary-tint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                        >
                          <span className="text-label-sm text-label-sm font-semibold text-outline transition-colors group-hover:hidden">
                            {money(room.nightly)}
                          </span>
                          <Icon
                            name="add"
                            className="hidden text-[18px] text-primary group-hover:block"
                          />
                        </button>
                      </td>
                    );
                  }

                  if (cell.kind === "booked") {
                    return (
                      <td key={isoDate(date)} className={`${base} bg-primary-tint/60`}>
                        <div
                          title={cell.label}
                          className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-primary/25 bg-primary-tint px-1 text-center"
                        >
                          <span className="text-label-sm text-label-sm font-semibold text-on-primary-container">
                            {initials(cell.label ?? "")}
                          </span>
                          <span className="truncate text-[10px] leading-3 text-primary">
                            {cell.label}
                          </span>
                        </div>
                      </td>
                    );
                  }

                  if (cell.kind === "blocked") {
                    return (
                      <td key={isoDate(date)} className={`${base} bg-hold-surface`}>
                        <div
                          title={cell.label}
                          className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-hold-ink/30 px-1 text-center"
                        >
                          <Icon name="handyman" className="text-[15px] text-hold-ink" />
                          <span className="truncate text-[10px] leading-3 text-hold-ink">
                            {cell.label}
                          </span>
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td key={isoDate(date)} className={`${base} bg-surface-container/50`}>
                      <div className="flex h-full w-full items-center justify-center rounded-lg border border-outline-variant/20">
                        <span className="text-label-sm text-label-sm text-outline-variant">
                          {date.getDate()}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
