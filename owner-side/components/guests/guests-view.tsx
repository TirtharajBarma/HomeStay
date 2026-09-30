"use client";

import { useMemo, useState } from "react";
import { useEstate } from "@/components/estate-provider";
import { Icon } from "@/components/icon";
import { PeriodNav } from "@/components/owner/period-nav";
import {
  PageHeader,
  PageShell,
  Panel,
  StatCard,
  fieldClass,
  ghostButton,
} from "@/components/owner/primitives";
import { useToast } from "@/components/ui/toast";
import { addDays, defaultStart, isSameDay } from "@/lib/calendar-window";
import { downloadCsv } from "@/lib/download";
import {
  guestFilters,
  guestStats,
  guestTimeline,
  guests,
  statusToneFor,
  type Guest,
} from "@/lib/guests-data";
import { baseToday, isoDate, longDate, windowCaption } from "@/lib/timeline";
import { useMoney } from "@/components/currency-provider";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const windows = [
  { key: "week", label: "7-day window", days: 7 },
  { key: "fortnight", label: "14-day window", days: 14 },
  { key: "month", label: "28-day window", days: 28 },
];

const staying = (guest: Guest, date: Date) =>
  guest.checkIn <= date && guest.checkOut > date;

export function GuestsView() {
  const { money } = useMoney();

  const { rooms, bookings } = useEstate();
  const { notify } = useToast();

  const [windowKey, setWindowKey] = useState("fortnight");
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("all");
  const [roomFilter, setRoomFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const days = windows.find((entry) => entry.key === windowKey)?.days ?? 14;
  const start = addDays(defaultStart, offset * days);
  const caption = windowCaption(start, days);
  const timeline = useMemo(() => guestTimeline(start, days), [start, days]);

  // Bookings made on the Book Rooms page join the directory immediately.
  const extra: Guest[] = bookings.map((booking) => ({
    id: booking.id,
    name: booking.guest,
    code: booking.code,
    room: booking.room,
    location: rooms.find((room) => room.code === booking.code)?.location ?? "Gumtree Valley",
    category: rooms.find((room) => room.code === booking.code)?.category ?? "Ging Lodge",
    checkIn: new Date(`${booking.checkIn}T00:00:00`),
    checkOut: new Date(`${booking.checkOut}T00:00:00`),
    nights: Math.max(
      1,
      Math.round(
        (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86_400_000,
      ),
    ),
    party: booking.party,
    channel: booking.channel,
    channelTone: "bg-surface-container text-on-surface-variant",
    email: "Added from the booking desk",
    phone: "—",
    origin: "Walk-in / phone",
    spend: booking.total,
    status: "Upcoming",
    note: booking.notes,
    tags: ["Just booked"],
    stays: 1,
    lifetime: booking.total,
  }));

  const directory = useMemo(() => {
    const day = activeDay ? new Date(`${activeDay}T00:00:00`) : null;
    const needle = query.trim().toLowerCase();

    return [...extra, ...guests].filter((guest) => {
      if (status !== "all" && guest.status !== status) return false;
      if (roomFilter !== "all" && guest.code !== roomFilter) return false;
      if (day && !staying(guest, day)) return false;
      if (needle) {
        const haystack = `${guest.name} ${guest.room} ${guest.email} ${guest.origin} ${guest.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [extra, status, roomFilter, activeDay, query]);

  const liveGuests = [...extra, ...guests];
  const activeToday = liveGuests.filter((guest) => staying(guest, baseToday));

  const exportDirectory = () => {
    downloadCsv(`gumtree-valley-guests-${status}-${roomFilter}`, [
      ["Guest", "Room", "Check-in", "Check-out", "Nights", "Guests", "Channel", "Spend", "Status"],
      ...directory.map((guest) => [
        guest.name,
        guest.room,
        guest.checkIn.toDateString(),
        guest.checkOut.toDateString(),
        guest.nights,
        guest.party,
        guest.channel,
        money(guest.spend),
        guest.status,
      ]),
    ]);
    notify(`Exported ${directory.length} guest records.`, {
      icon: "download_done",
      tone: "success",
    });
  };

  const roomRows = rooms.map((room) => {
    const inHouse = liveGuests.filter(
      (guest) => guest.code === room.code && staying(guest, baseToday),
    );
    const next = liveGuests
      .filter((guest) => guest.code === room.code && guest.checkIn > baseToday)
      .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime())[0];
    const history = liveGuests.filter((guest) => guest.code === room.code);
    return { room, inHouse, next, history };
  });

  return (
    <PageShell>
      <PageHeader
        breadcrumb="Homestay Operations"
        title="Guest Data"
        description="Everyone who has stayed or is about to, with arrivals, departures and room assignments on a single timeline."
        actions={
          <>
            <PeriodNav
              options={windows.map((entry) => ({
                ...entry,
                hint: windowCaption(defaultStart, entry.days),
              }))}
              value={windowKey}
              onChange={(key) => {
                setWindowKey(key);
                setOffset(0);
                setActiveDay(null);
              }}
              onShift={(step) => setOffset((current) => Math.min(0, current + step))}
              caption={caption}
              atLatest={offset === 0}
              icon="groups"
            />
            <button onClick={exportDirectory} className={ghostButton}>
              <Icon name="download" className="flex-shrink-0 text-[18px]" />
              Export
            </button>
          </>
        }
      />

      <div className="my-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="In house now"
          value={String(activeToday.length)}
          icon="king_bed"
          footnote={`${activeToday.reduce((sum, guest) => sum + guest.party, 0)} guests on site`}
        />
        <StatCard
          label="Arriving today"
          value={String(guestStats.arriving)}
          icon="login"
          iconTone="bg-secondary-tint text-secondary-ink"
          footnote="Check-in from 3:00 PM"
        />
        <StatCard
          label="Departing today"
          value={String(guestStats.departing)}
          icon="logout"
          iconTone="bg-secondary-tint text-secondary-ink"
          footnote="Check-out by 11:00 AM"
        />
        <StatCard
          label="Returning guests"
          value={String(guestStats.returning)}
          icon="favorite"
          footnote={`${guestStats.vip} flagged as VIP`}
        />
        <StatCard
          label="Directory size"
          value={String(liveGuests.length)}
          icon="menu_book"
          iconTone="bg-tertiary-fixed text-on-tertiary-fixed"
          footnote={`${directory.length} match your filters`}
        />
        <StatCard
          label="Lifetime value"
          value={money(
            liveGuests.reduce((sum, guest) => sum + guest.lifetime, 0),
          )}
          icon="savings"
          footnote="Across every recorded stay"
        />
      </div>

      <Panel
        title="Guest timeline"
        icon="timeline"
        caption="Arrows in, arrows out — click a day to filter the directory"
        action={
          activeDay ? (
            <button
              onClick={() => setActiveDay(null)}
              className="flex items-center gap-1.5 rounded-lg border border-outline-variant/40 px-2.5 py-1.5 text-label-sm text-label-sm text-on-surface transition-colors hover:bg-surface-container"
            >
              <Icon name="close" className="text-[15px]" />
              Clear day
            </button>
          ) : null
        }
      >
        <div className="custom-scrollbar min-w-0 overflow-x-auto">
          <div className="flex min-w-max gap-1.5">
            {timeline.map((day) => {
              const iso = isoDate(day.date);
              const isActive = activeDay === iso;
              const isToday = isSameDay(day.date, baseToday);

              return (
                <button
                  key={iso}
                  onClick={() => setActiveDay(isActive ? null : iso)}
                  aria-pressed={isActive}
                  title={`${longDate(day.date)} · ${day.arrivals} arriving, ${day.departures} departing`}
                  className={`flex w-[5.5rem] flex-col gap-1.5 rounded-lg border p-2.5 text-left transition-colors ${
                    isActive
                      ? "border-primary bg-primary-tint"
                      : isToday
                        ? "border-primary/40 bg-surface-container-lowest"
                        : "border-outline-variant/30 bg-surface-container-lowest hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-label-sm text-label-sm font-semibold text-on-surface">
                      {DOW[day.date.getDay()]} {day.date.getDate()}
                    </span>
                    {isToday ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                        Now
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1 text-label-sm text-label-sm">
                    <Icon name="arrow_downward" className="text-[12px] text-emerald-700" />
                    <span className="font-semibold text-on-surface">{day.arrivals}</span>
                    <Icon name="arrow_upward" className="text-[12px] text-hold-ink" />
                    <span className="font-semibold text-on-surface">{day.departures}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-label-sm text-label-sm text-outline">
                    <Icon name="group" className="text-[13px]" />
                    {day.guests} in house
                  </div>

                  <span className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(6, day.occupancy)}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {activeDay ? (
          <p className="mt-3 flex items-center gap-2 text-body-sm text-body-sm text-on-surface-variant">
            <Icon name="filter_alt" className="text-[16px] text-primary" />
            Showing guests staying on{" "}
            <strong className="font-semibold text-primary">
              {longDate(new Date(`${activeDay}T00:00:00`))}
            </strong>
          </p>
        ) : null}
      </Panel>

      <div className="mt-space-lg grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
        <div className="flex flex-col gap-space-lg lg:col-span-7">
          <Panel
            title="Directory"
            icon="menu_book"
            caption={`${directory.length} guests`}
            bodyClassName="-mx-1 overflow-x-auto"
          >
            <div className="mb-4 flex flex-col gap-2.5">
              <div className="flex flex-wrap gap-1.5">
                {guestFilters.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setStatus(filter.value)}
                    aria-pressed={status === filter.value}
                    className={`rounded-full px-3 py-2.5 text-label-sm text-label-sm transition-colors sm:py-1.5 ${
                      status === filter.value
                        ? "bg-primary font-semibold text-on-primary"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Icon
                    name="search"
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[16px] text-outline"
                  />
                  <label htmlFor="guest-search" className="sr-only">
                    Search guests
                  </label>
                  <input
                    id="guest-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search name, room, email or tag…"
                    className={`${fieldClass} ps-9`}
                  />
                </div>
                <label htmlFor="guest-room" className="sr-only">
                  Filter by room
                </label>
                <select
                  id="guest-room"
                  value={roomFilter}
                  onChange={(event) => setRoomFilter(event.target.value)}
                  className={`${fieldClass} sm:max-w-[13rem]`}
                >
                  <option value="all">Every room</option>
                  {rooms.map((room) => (
                    <option key={room.code} value={room.code}>
                      {room.code} · {room.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <table className="w-full min-w-[44rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/30 text-label-sm text-label-sm uppercase text-outline">
                  <th scope="col" className="px-1 pb-2 font-semibold">Guest</th>
                  <th scope="col" className="px-1 pb-2 font-semibold">Room</th>
                  <th scope="col" className="px-1 pb-2 font-semibold">Stay</th>
                  <th scope="col" className="px-1 pb-2 text-right font-semibold">Spend</th>
                  <th scope="col" className="px-1 pb-2 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {directory.slice(0, 24).map((guest) => (
                  <tr key={guest.id} className="border-b border-outline-variant/20 last:border-0">
                    <td className="px-1 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-tint text-label-sm text-label-sm font-semibold text-primary">
                          {guest.name.slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-body-md text-body-md font-medium text-on-surface">
                            {guest.name}
                            {guest.vip ? (
                              <Icon
                                name="star"
                                fill
                                className="ms-1 inline text-[14px] text-secondary-ink"
                              />
                            ) : null}
                          </p>
                          <p className="truncate text-label-sm text-label-sm text-outline">
                            {guest.origin} · {guest.stays > 1 ? `${guest.stays} stays` : "First stay"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-3">
                      <p className="text-body-md text-body-md text-on-surface">{guest.room}</p>
                      <p className="text-label-sm text-label-sm text-outline">
                        {guest.party} guest{guest.party === 1 ? "" : "s"} · {guest.channel}
                      </p>
                    </td>
                    <td className="px-1 py-3">
                      <p className="text-body-md text-body-md text-on-surface">
                        {guest.checkIn.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        {" – "}
                        {guest.checkOut.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-label-sm text-label-sm text-outline">
                        {guest.nights} night{guest.nights === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className="px-1 py-3 text-right text-body-md text-body-md font-semibold text-primary">
                      {money(guest.spend)}
                    </td>
                    <td className="px-1 py-3 text-right">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-label-sm text-label-sm font-semibold whitespace-nowrap ${statusToneFor(guest.status)}`}
                      >
                        {guest.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {directory.length === 0 ? (
              <p className="py-8 text-center text-body-md text-body-md text-outline">
                No guests match those filters.
              </p>
            ) : directory.length > 24 ? (
              <p className="pt-3 text-center text-label-sm text-label-sm text-outline">
                Showing the first 24 of {directory.length} — narrow the filters to see more.
              </p>
            ) : null}
          </Panel>
        </div>

        <div className="flex flex-col gap-space-lg lg:col-span-5">
          <Panel title="Room-wise guests" icon="meeting_room" caption="Who is in each unit">
            <ul className="flex flex-col gap-2.5">
              {roomRows.map(({ room, inHouse, next, history }) => (
                <li
                  key={room.code}
                  className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-body-md text-body-md font-semibold text-on-surface">
                        {room.name}
                      </p>
                      <p className="line-clamp-2 text-label-sm text-label-sm text-outline sm:truncate">
                        {room.code} · {room.category} · {history.length} recorded stay
                        {history.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    {room.status === "Maintenance" ? (
                      <span className="rounded-full bg-hold-surface px-2.5 py-1 text-label-sm text-label-sm font-semibold text-hold-ink">
                        Hold
                      </span>
                    ) : inHouse.length ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-label-sm text-label-sm font-semibold text-emerald-900">
                        Occupied
                      </span>
                    ) : (
                      <span className="rounded-full bg-primary-tint px-2.5 py-1 text-label-sm text-label-sm font-semibold text-on-primary-container">
                        Free today
                      </span>
                    )}
                  </div>

                  {inHouse.length ? (
                    <ul className="mt-2.5 flex flex-col gap-1.5">
                      {inHouse.map((guest) => (
                        <li
                          key={guest.id}
                          className="flex items-center justify-between gap-2 text-label-md text-label-md"
                        >
                          <span className="flex min-w-0 items-center gap-2 text-on-surface">
                            <Icon name="person" className="flex-shrink-0 text-[15px] text-primary" />
                            <span className="truncate">{guest.name}</span>
                          </span>
                          <span className="flex-shrink-0 text-outline">
                            until {guest.checkOut.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {next ? (
                    <p className="mt-2.5 flex items-center gap-1.5 text-label-sm text-label-sm text-outline">
                      <Icon name="event" className="text-[14px]" />
                      Next: {next.name} on{" "}
                      {next.checkIn.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Stay notes" icon="sticky_note_2" caption="Worth remembering">
            <ul className="flex flex-col gap-2.5">
              {liveGuests
                .filter((guest) => guest.note)
                .slice(0, 6)
                .map((guest) => (
                  <li
                    key={guest.id}
                    className="flex gap-2.5 rounded-lg bg-surface-container p-3"
                  >
                    <Icon name="format_quote" className="flex-shrink-0 text-[16px] text-primary" />
                    <div className="min-w-0">
                      <p className="text-body-sm text-body-sm text-on-surface">{guest.note}</p>
                      <p className="mt-0.5 line-clamp-2 text-label-sm text-label-sm text-outline sm:truncate">
                        {guest.name} · {guest.room}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
