"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { NewBookingDialog } from "@/components/new-booking-dialog";
import { reservationKey, useCalendar } from "./calendar-provider";
import type { Day, Reservation, Room } from "@/lib/calendar-data";
import { addDays, WINDOW_DAYS } from "@/lib/calendar-window";

const GRID_TEMPLATE = "280px repeat(14, minmax(78px, 1fr))";

/** Channel colour + border pairing, resolved once per reservation. */
const channelStyle: Record<
  Reservation["channel"],
  { bar: string; text: string; sub: string }
> = {
  direct: {
    bar: "bg-primary-tint border-primary-container/40",
    text: "text-on-primary-container",
    sub: "text-primary-container/70",
  },
  airbnb: {
    bar: "bg-secondary-tint border-secondary-container/50",
    text: "text-secondary-ink",
    sub: "text-secondary-ink/70",
  },
  ota: {
    bar: "bg-blue-50 border-blue-200",
    text: "text-blue-900",
    sub: "text-blue-900/70",
  },
  blocked: {
    bar: "bg-hold-surface border-outline-variant",
    text: "text-hold-ink",
    sub: "text-hold-ink/70",
  },
};

function ReservationBar({
  reservation,
  active,
  onSelect,
}: {
  reservation: Reservation;
  active: boolean;
  onSelect: () => void;
}) {
  const style = channelStyle[reservation.channel];

  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      title={`${reservation.guest} • ${reservation.detail}`}
      className={`flex h-10 w-full items-center justify-between overflow-hidden rounded-md border px-2 text-left transition-all hover:shadow-md ${style.bar} ${
        active ? "ring-2 ring-primary ring-offset-1" : ""
      } ${
        reservation.blocked
          ? "border-dashed bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(138,101,43,0.08)_4px,rgba(138,101,43,0.08)_8px)]"
          : ""
      } ${reservation.emphasis ? "ring-1 ring-inset ring-primary/15" : ""}`}
    >
      <div className="flex min-w-0 flex-col">
        <span
          className={`truncate text-label-sm text-label-sm font-semibold ${style.text}`}
        >
          {reservation.guest}
        </span>
        <span
          className={`truncate text-[10px] leading-tight ${style.sub} ${
            reservation.blocked ? "font-bold" : ""
          }`}
        >
          {reservation.detail}
        </span>
      </div>
      <div className="ml-1 flex flex-col items-center gap-0.5 pl-1">
        {reservation.tag ? (
          <span
            className={`text-[9px] leading-none font-bold tracking-wide uppercase ${style.text}`}
          >
            {reservation.tag}
          </span>
        ) : null}
        {reservation.trailing ? (
          <Icon
            name={reservation.trailing.icon}
            className={`text-[14px] ${reservation.trailing.tone}`}
          />
        ) : null}
      </div>
    </button>
  );
}

function OpenSlot({
  onBook,
  label,
}: {
  onBook: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onBook}
      title={`Book ${label}`}
      className="flex h-10 w-full items-center justify-center rounded-md border border-dashed border-outline-variant bg-surface-container-lowest text-label-sm text-label-sm text-outline transition-colors hover:border-primary-container/50 hover:bg-primary-tint/40 hover:text-primary"
    >
      + Book
    </button>
  );
}

const COLUMN_COUNT = WINDOW_DAYS;

/** Left offset + width for a bar, as percentages of the 14-day track. */
function span(start: number, nights: number) {
  return {
    left: `${(start / COLUMN_COUNT) * 100}%`,
    width: `calc(${(nights / COLUMN_COUNT) * 100}% - 4px)`,
  };
}

type RowProps = {
  room: Room;
  days: Day[];
  todayIndex: number;
  selectedKey: string | null;
  onSelect: (reservation: Reservation) => void;
  onBook: (room: Room) => void;
};

function RoomRow({ room, days, todayIndex, selectedKey, onSelect, onBook }: RowProps) {
  return (
    <div
      className="grid border-b border-outline-variant/25 last:border-b-0"
      style={{ gridTemplateColumns: GRID_TEMPLATE }}
    >
      <div className="sticky left-0 z-10 flex flex-col justify-center border-r border-outline-variant/30 bg-surface-container-lowest px-4 py-3">
        <span className="text-label-sm text-label-sm text-outline">{room.code}</span>
        <span className="text-title-md text-title-md font-semibold text-on-surface">
          {room.name}
        </span>
        <span className="text-label-sm text-label-sm text-on-surface-variant">
          {room.note}
        </span>
      </div>

      <div className="relative col-span-14 min-h-[60px]">
        {/* Column guides behind the bars. */}
        <div className="pointer-events-none absolute inset-0 flex" aria-hidden>
          {days.map((day, index) => (
            <div
              key={day.date}
              className={
                index === todayIndex
                  ? "w-full border-l-2 border-primary/30 bg-primary/3"
                  : day.weekend
                    ? "w-full bg-surface-container/40"
                    : "w-full"
              }
            />
          ))}
        </div>

        <div className="absolute inset-0 p-1">
          {room.reservations.map((reservation) => (
            <div
              key={`${room.code}-${reservation.guest}`}
              className="absolute top-1 bottom-1"
              style={span(reservation.start, reservation.nights)}
            >
              <ReservationBar
                reservation={reservation}
                active={selectedKey === reservationKey(room, reservation)}
                onSelect={() => onSelect(reservation)}
              />
            </div>
          ))}
          {room.openSlots?.map((slot) => (
            <div
              key={`${room.code}-slot-${slot.start}`}
              className="absolute top-1 bottom-1"
              style={span(slot.start, slot.nights)}
            >
              <OpenSlot onBook={() => onBook(room)} label={room.name} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type GroupList = ReturnType<typeof useCalendar>["groups"];
type RoomUnit = GroupList[number]["rooms"][number];

function TimelineView({
  days,
  todayIndex,
  groups,
  selectedKey,
  onSelect,
  onBook,
}: Omit<RowProps, "room"> & { groups: GroupList }) {
  return (
    <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_1px_3px_rgba(45,48,46,0.04)]">
      <p className="flex items-center gap-2 border-b border-outline-variant/25 bg-surface-container/50 px-4 py-2 text-label-sm text-label-sm text-outline md:hidden">
        <Icon name="swipe" className="flex-shrink-0 text-[16px] text-primary" />
        Swipe horizontally to see the full 14-day range
      </p>
      <div className="custom-scrollbar overflow-x-auto overscroll-x-contain">
        <div className="min-w-[1380px]">
          {/* Sticky date header. */}
          <div
            className="sticky top-0 z-20 grid border-b border-outline-variant/40 bg-surface-container/70 backdrop-blur-sm"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            <div className="sticky left-0 z-10 flex items-center gap-2 border-r border-outline-variant/30 bg-surface-container/95 px-4 py-3 backdrop-blur-sm">
              <Icon name="meeting_room" className="text-[18px] text-outline" />
              <span className="text-label-md text-label-md font-semibold text-on-surface-variant">
                Accommodation
              </span>
            </div>
            {days.map((day, index) => (
              <div
                key={`${day.dow}-${day.date}`}
                className={
                  index === todayIndex
                    ? "flex flex-col items-center justify-center border-l-2 border-primary bg-primary/8 py-2.5"
                    : day.weekend
                      ? "flex flex-col items-center justify-center border-l border-outline-variant/25 bg-surface-container py-2.5"
                      : "flex flex-col items-center justify-center border-l border-outline-variant/25 py-2.5"
                }
              >
                <span
                  className={
                    index === todayIndex
                      ? "text-label-sm text-label-sm font-bold text-primary"
                      : "text-label-sm text-label-sm text-outline"
                  }
                >
                  {day.dow}
                </span>
                <span
                  className={
                    index === todayIndex
                      ? "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-body-md text-body-md font-bold text-on-primary"
                      : "text-body-lg text-body-lg font-medium text-on-surface"
                  }
                >
                  {day.date}
                </span>
                <span
                  className={
                    index === todayIndex
                      ? "text-label-sm text-label-sm font-semibold text-primary"
                      : "text-label-sm text-label-sm text-on-surface-variant"
                  }
                >
                  {day.occupancy}
                </span>
              </div>
            ))}
          </div>

          {groups.map((group) => (
            <div key={group.title}>
              <div className="flex items-center gap-2.5 border-b border-outline-variant/30 bg-primary-tint/60 px-4 py-2.5">
                <Icon name={group.icon} className="text-[18px] text-primary-container" />
                <span className="text-label-md text-label-md font-bold tracking-wider text-primary">
                  {group.title}
                </span>
                <span className="text-label-sm text-label-sm text-outline">
                  {group.meta}
                </span>
              </div>
              {group.rooms.map((room) => (
                <RoomRow
                  key={room.code}
                  room={room}
                  days={days}
                  todayIndex={todayIndex}
                  selectedKey={selectedKey}
                  onSelect={onSelect}
                  onBook={onBook}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const MONTH_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MonthView({
  start,
  groups,
  todayIndex,
}: {
  start: Date;
  groups: ReturnType<typeof useCalendar>["groups"];
  todayIndex: number;
}) {
  const first = new Date(start.getFullYear(), start.getMonth(), 1);
  const daysInMonth = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0,
  ).getDate();
  const lead = first.getDay();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), i + 1),
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const arrivalsFor = (date: Date) => {
    const offset = Math.round(
      (date.getTime() - start.getTime()) / 86_400_000,
    );
    if (offset < 0 || offset >= WINDOW_DAYS) return [];
    return groups.flatMap((group) =>
      group.rooms.flatMap((room) =>
        room.reservations
          .filter((reservation) => reservation.start === offset)
          .map((reservation) => ({ room, reservation })),
      ),
    );
  };

  const monthLabel = start.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_1px_3px_rgba(45,48,46,0.04)]">
      <header className="flex items-center justify-between gap-3 border-b border-outline-variant/30 bg-surface-container/70 px-4 py-3">
        <h2 className="text-headline-sm text-headline-sm font-semibold text-on-surface">
          {monthLabel}
        </h2>
        <span className="text-label-sm text-label-sm text-outline">
          Arrivals highlighted · shaded days are weekends
        </span>
      </header>
      <div className="grid grid-cols-7 border-b border-outline-variant/30 bg-surface-container/40">
        {MONTH_DOW.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-label-sm text-label-sm font-semibold text-on-surface-variant"
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.slice(0, 1)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, index) => {
          if (!date) {
            return <div key={`pad-${index}`} className="min-h-[92px] border-b border-r border-outline-variant/20 bg-surface-container/30" />;
          }
          const arrivals = arrivalsFor(date);
          const weekend = date.getDay() === 0 || date.getDay() === 6;
          const offset = Math.round(
            (date.getTime() - start.getTime()) / 86_400_000,
          );
          return (
            <div
              key={date.toISOString()}
              className={`min-h-[92px] border-b border-r border-outline-variant/20 p-1.5 ${
                weekend ? "bg-surface-container/40" : ""
              } ${offset === todayIndex ? "bg-primary/8 ring-1 ring-inset ring-primary/30" : ""}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-label-sm text-label-sm ${
                  offset === todayIndex
                    ? "bg-primary font-bold text-on-primary"
                    : "text-on-surface-variant"
                }`}
              >
                {date.getDate()}
              </span>
              <ul className="mt-1 space-y-0.5">
                {arrivals.slice(0, 2).map(({ room, reservation }) => (
                  <li key={`${room.code}-${reservation.guest}-${date.getDate()}`}>
                    <span
                      className={`block truncate rounded px-1 py-0.5 text-[10px] leading-tight font-medium ${
                        reservation.channel === "direct"
                          ? "bg-primary-tint text-on-primary-container"
                          : reservation.channel === "airbnb"
                            ? "bg-secondary-tint text-secondary-ink"
                            : reservation.channel === "ota"
                              ? "bg-blue-50 text-blue-900"
                              : "bg-hold-surface text-hold-ink"
                      }`}
                      title={`${reservation.guest} · ${room.name}`}
                    >
                      {reservation.guest}
                    </span>
                  </li>
                ))}
                {arrivals.length > 2 ? (
                  <li className="px-1 text-[10px] text-outline">
                    +{arrivals.length - 2} more
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ListView({
  start,
  reservations,
  onSelect,
  onBook,
}: {
  start: Date;
  reservations: ReturnType<typeof useCalendar>["reservations"];
  onSelect: (entry: {
    room: RoomUnit;
    groupTitle: string;
    reservation: Reservation;
  }) => void;
  onBook: (room: RoomUnit) => void;
}) {
  const fmt = (date: Date) =>
    date.toLocaleString("en-US", { month: "short", day: "numeric" });

  return (
    <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_1px_3px_rgba(45,48,46,0.04)]">
      <header className="flex items-center justify-between gap-3 border-b border-outline-variant/30 bg-surface-container/70 px-4 py-3">
        <h2 className="text-headline-sm text-headline-sm font-semibold text-on-surface">
          {reservations.length} reservations
        </h2>
        <span className="text-label-sm text-label-sm text-outline">
          Sorted by arrival
        </span>
      </header>
      {reservations.length === 0 ? (
        <p className="px-4 py-10 text-center text-body-md text-body-md text-outline">
          No reservations in this range.
        </p>
      ) : (
        <ul className="divide-y divide-outline-variant/20">
          {reservations
            .slice()
            .sort((a, b) => a.reservation.start - b.reservation.start)
            .map(({ room, reservation }) => {
              const checkIn = addDays(start, reservation.start);
              const checkOut = addDays(start, reservation.start + reservation.nights);
              const style = channelStyle[reservation.channel];
              return (
                <li key={`${room.code}-${reservation.guest}`}>
                  <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                    <button
                      onClick={() =>
                        onSelect({ room, groupTitle: "", reservation })
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${style.bar}`}
                      >
                        <Icon
                          name={
                            reservation.channel === "blocked"
                              ? "build"
                              : reservation.channel === "direct"
                                ? "person"
                                : "sync"
                          }
                          className={`text-[18px] ${style.text}`}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-md text-body-md font-semibold text-on-surface">
                          {reservation.guest}
                        </span>
                        <span className="block truncate text-label-sm text-label-sm text-outline">
                          {room.name} • {reservation.detail}
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center gap-2 sm:flex-shrink-0">
                      <span className="rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-label-sm text-on-surface-variant">
                        {fmt(checkIn)} – {fmt(checkOut)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-label-sm text-label-sm font-semibold ${style.bar} ${style.text}`}
                      >
                        {reservation.tag ?? "Direct"}
                      </span>
                      <button
                        onClick={() => onBook(room)}
                        className="rounded-lg border border-outline-variant/40 px-3 py-1.5 text-label-sm text-label-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                      >
                        Book
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}

export function TimelineGrid() {
  const {
    view,
    start,
    addWalkIn,
    days,
    groups,
    todayIndex,
    selected,
    selectedKey,
    select,
    reservations,
  } = useCalendar();
  const { clearSelection } = useCalendar();
  const [booking, setBooking] = useState<{ open: boolean; room?: string }>({
    open: false,
  });

  const onSelect = (room: Room, reservation: Reservation) => select(room, reservation);

  return (
    <>
      {view === "timeline" ? (
        <TimelineView
          days={days}
          todayIndex={todayIndex}
          groups={groups}
          selectedKey={selectedKey}
          onSelect={(reservation) => {
            for (const group of groups) {
              const room = group.rooms.find((entry) =>
                entry.reservations.includes(reservation),
              );
              if (room) {
                onSelect(room, reservation);
                return;
              }
            }
          }}
          onBook={(room) => setBooking({ open: true, room: room.name })}
        />
      ) : null}

      {view === "month" ? (
        <MonthView start={start} groups={groups} todayIndex={todayIndex} />
      ) : null}

      {view === "list" ? (
        <ListView
          start={start}
          reservations={reservations}
          onSelect={({ room, reservation }) => onSelect(room, reservation)}
          onBook={(room) => setBooking({ open: true, room: room.name })}
        />
      ) : null}

      {selected ? (
        <button
          onClick={clearSelection}
          className="sr-only"
          aria-label="Clear reservation selection"
        >
          Clear selection
        </button>
      ) : null}

      <NewBookingDialog
        open={booking.open}
        defaultRoom={booking.room}
        onClose={() => setBooking({ open: false })}
        title="Reserve this unit"
        rooms={groups.flatMap((group) => group.rooms.map((room) => room.name))}
        onCreated={addWalkIn}
      />
    </>
  );
}
