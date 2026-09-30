"use client";

export const BOOKINGS_BLURB =
  "Every reservation, guest profile, and stay note in one place — across direct, Airbnb, and OTA channels.";

const points = [
  "Searchable reservation ledger with channel sync status",
  "Guest profiles, preferences, and repeat-stay history",
  "Balance tracking, deposits, and outstanding balances",
];

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { roomGroups, todayIndex } from "@/lib/calendar-data";
import { downloadCsv } from "@/lib/download";

const monthDay = 18;
const ratePerNight: Record<string, number> = {
  "Oak Hearth Suite": 180,
  "Willow Brook Cabin": 145,
  "Maple Corner Studio": 125,
  "The Stables": 210,
  "Loft Barn": 165,
  "Garden Greenhouse": 130,
};

const channelLabel: Record<string, string> = {
  direct: "Direct",
  airbnb: "Airbnb",
  ota: "Booking.com",
  blocked: "Blocked",
};

type LedgerRow = {
  key: string;
  guest: string;
  room: string;
  code: string;
  detail: string;
  channel: string;
  start: number;
  end: number;
  nights: number;
  total: number;
  balance: number;
};

const ledger: LedgerRow[] = roomGroups.flatMap((group) =>
  group.rooms.flatMap((room) =>
    room.reservations.map((reservation) => {
      const nights = reservation.nights;
      const total = (ratePerNight[room.name] ?? 150) * nights;
      const deposit = total >= 400 ? Math.round(total * 0.5) : total;
      return {
        key: `${room.code}-${reservation.guest}-${reservation.start}`,
        guest: reservation.guest,
        room: room.name,
        code: room.code,
        detail: reservation.detail,
        channel: channelLabel[reservation.channel] ?? reservation.channel,
        start: reservation.start,
        end: reservation.start + nights - 1,
        nights,
        total,
        balance: total - deposit,
      };
    }),
  ),
);

const date = (index: number) => `Oct ${monthDay + index}`;

const money = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });

const filters = ["All stays", "In-house", "Arriving", "Departing"] as const;
type Filter = (typeof filters)[number];

function matches(row: LedgerRow, filter: Filter) {
  if (filter === "In-house") return row.start <= todayIndex && row.end >= todayIndex;
  if (filter === "Arriving") return row.start === todayIndex;
  if (filter === "Departing") return row.end === todayIndex;
  return true;
}

export function BookingsView() {
  const [filter, setFilter] = useState<Filter>("All stays");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LedgerRow | null>(null);
  const { notify } = useToast();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ledger.filter(
      (row) =>
        matches(row, filter) &&
        (needle === "" ||
          row.guest.toLowerCase().includes(needle) ||
          row.room.toLowerCase().includes(needle) ||
          row.channel.toLowerCase().includes(needle)),
    );
  }, [filter, query]);

  return (
    <main className="mt-14 min-h-screen lg:mt-16 lg:ml-[var(--rail-w)]">
      <div className="mx-auto max-w-[1360px] p-4 pb-space-xl md:p-space-lg">
        <div className="mb-6 flex flex-col gap-1.5 border-b border-outline-variant/30 pb-6">
          <nav className="flex items-center gap-2 text-label-sm text-label-sm text-outline">
            <span>Homestay Operations</span>
            <Icon name="chevron_right" className="text-[14px]" />
            <span className="font-medium text-primary">
              Reservations &amp; Guest Directory
            </span>
          </nav>
          <h1 className="text-headline-lg-mobile text-headline-lg-mobile font-semibold tracking-tight text-primary md:text-headline-lg">
            Bookings &amp; Guests
          </h1>
          <p className="max-w-2xl text-body-md text-body-md text-on-surface-variant">
            {BOOKINGS_BLURB}
          </p>
        </div>

        <section className="clay-card rounded-xl p-4 md:p-space-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-tint text-primary">
              <Icon name="group" className="text-[24px]" />
            </span>
            <div className="min-w-0">
              <h2 className="text-headline-sm text-headline-sm font-semibold text-primary">
                Reservation ledger
              </h2>
              <p className="text-body-sm text-body-sm text-outline">
                Oct 18 – Oct 31, 2024 · {ledger.length} reservations across 6 units
              </p>
            </div>
            <button
              onClick={() => {
                downloadCsv("meadowfall-bookings", [
                  ["Guest", "Unit", "Code", "Arrival", "Departure", "Nights", "Channel", "Total", "Balance"],
                  ...rows.map((row) => [
                    row.guest,
                    row.room,
                    row.code,
                    date(row.start),
                    date(row.end),
                    String(row.nights),
                    row.channel,
                    money(row.total),
                    money(row.balance),
                  ]),
                ]);
                notify(`Exported ${rows.length} reservations.`, {
                  icon: "download_done",
                  tone: "success",
                });
              }}
              className="ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-outline-variant/50 px-3 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
            >
              <Icon name="download" className="text-[18px]" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div
              role="group"
              aria-label="Filter reservations"
              className="custom-scrollbar flex overflow-x-auto rounded-lg border border-outline-variant/30 bg-surface-container p-1 text-label-sm text-label-sm"
            >
              {filters.map((option) => (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  aria-pressed={filter === option}
                  className={
                    filter === option
                      ? "flex-shrink-0 rounded bg-surface-container-lowest px-3 py-1.5 font-semibold text-primary shadow-xs"
                      : "flex-shrink-0 whitespace-nowrap px-3 py-1.5 text-on-surface-variant transition-colors hover:text-on-surface"
                  }
                >
                  {option}
                  <span className="ml-1.5 text-outline">
                    {ledger.filter((row) => matches(row, option)).length}
                  </span>
                </button>
              ))}
            </div>

            <label className="relative flex-1">
              <span className="sr-only">Search guests, units, or channels</span>
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search guest, unit, or channel"
                className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest py-2 pl-10 pr-3 text-body-md text-body-md text-on-surface"
              />
            </label>
          </div>

          <p className="mt-3 text-label-sm text-label-sm text-outline" aria-live="polite">
            {rows.length} of {ledger.length} reservations
          </p>

          <div className="custom-scrollbar mt-3 overflow-x-auto rounded-lg border border-outline-variant/30">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="bg-surface-container text-label-sm text-label-sm text-on-surface-variant">
                  {["Guest", "Unit", "Stay", "Nights", "Channel", "Total", "Balance", ""].map(
                    (heading) => (
                      <th
                        key={heading || "actions"}
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 font-semibold"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-t border-outline-variant/20 text-body-sm text-body-sm text-on-surface transition-colors hover:bg-surface-container-lowest"
                  >
                    <td className="px-4 py-3 font-semibold text-on-surface">
                      {row.guest}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">
                      {row.room}
                      <span className="ml-1.5 text-outline">{row.code}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">
                      {date(row.start)} → {date(row.end)}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.nights}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-label-sm text-label-sm ${
                          row.channel === "Direct"
                            ? "bg-primary/10 text-primary"
                            : row.channel === "Blocked"
                              ? "bg-surface-container text-outline"
                              : "bg-secondary/15 text-secondary"
                        }`}
                      >
                        {row.channel}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">
                      {money(row.total)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 font-medium ${
                        row.balance > 0 ? "text-secondary" : "text-primary"
                      }`}
                    >
                      {row.balance > 0 ? money(row.balance) : "Paid"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(row)}
                        className="rounded-md border border-outline-variant/50 px-2.5 py-1.5 text-label-sm text-label-sm font-semibold text-primary transition-colors hover:bg-primary-tint"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-lowest px-4 py-10 text-center text-body-md text-body-md text-outline">
              No reservations match this search.
            </p>
          ) : null}

          <ul className="mt-6 grid grid-cols-1 gap-3 border-t border-outline-variant/25 pt-5 sm:grid-cols-3">
            {points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2.5 rounded-lg bg-surface-container p-4"
              >
                <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-secondary" />
                <span className="text-body-sm text-body-sm text-on-surface-variant">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.guest ?? "Guest"}
        description={selected ? `${selected.room} · ${selected.code}` : undefined}
        icon="person"
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                if (!selected) return;
                notify(`Message drafted to ${selected.guest}.`, {
                  icon: "mail",
                });
                setSelected(null);
              }}
              className="rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
            >
              Message guest
            </button>
            <button
              onClick={() => {
                if (!selected) return;
                notify(`Opening folio for ${selected.guest}.`, { icon: "receipt_long" });
                setSelected(null);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
            >
              Open folio
            </button>
          </>
        }
      >
        {selected ? (
          <dl className="space-y-2 text-body-md text-body-md">
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Stay</dt>
              <dd className="text-on-surface">
                {date(selected.start)} → {date(selected.end)} ({selected.nights} nights)
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Channel</dt>
              <dd className="text-on-surface">{selected.channel}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Stay note</dt>
              <dd className="text-on-surface">{selected.detail}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-outline-variant/30 pt-2">
              <dt className="text-on-surface-variant">Outstanding</dt>
              <dd className="font-semibold text-primary">
                {selected.balance > 0 ? money(selected.balance) : "Paid in full"}
              </dd>
            </div>
          </dl>
        ) : null}
      </Modal>
    </main>
  );
}
