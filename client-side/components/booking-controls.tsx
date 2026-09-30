"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  formatDate,
  formatDateRange,
  formatGuests,
  formatNights,
  normalizeRange,
  stayHref,
  type Booking,
} from "@/lib/booking";

import { Icon } from "./icon";

const block =
  "rounded-xl border border-outline-variant/60 bg-surface-container-low p-3 transition-colors hover:border-primary/50";

const inputClass =
  "min-h-11 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2.5 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none md:min-h-9 md:py-1.5 md:text-body-sm";

/**
 * Dates and party size live in the URL, so editing them here re-runs the
 * server-side quote without a full client round trip of booking state.
 */
export function BookingControls({
  slug,
  booking,
  maxGuests,
}: {
  slug: string;
  booking: Booking;
  maxGuests: number;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(booking.checkIn);
  const [checkOut, setCheckOut] = useState(booking.checkOut);
  const [guests, setGuests] = useState(booking.guests);
  const [notice, setNotice] = useState<string | null>(null);

  const draft = normalizeRange(checkIn, checkOut);

  function commit(next: { checkIn: string; checkOut: string; guests: number }) {
    const range = normalizeRange(next.checkIn, next.checkOut);
    const party = Math.min(Math.max(next.guests || 1, 1), maxGuests);
    const repaired = range.checkIn !== next.checkIn || range.checkOut !== next.checkOut;

    setCheckIn(range.checkIn);
    setCheckOut(range.checkOut);
    setGuests(party);
    setNotice(
      repaired
        ? `Dates adjusted to ${formatNights(range.nights).toLowerCase()} from ${formatDate(range.checkIn)}`
        : null,
    );

    router.replace(
      stayHref(slug, {
        checkIn: range.checkIn,
        checkOut: range.checkOut,
        guests: party,
      }),
      { scroll: false },
    );
  }

  return (
    <div className="mb-6 space-y-3">
      <div className={block}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            Stay Dates
          </span>
          <span className="text-label-sm font-medium text-primary">
            {formatNights(draft.nights)} Selected
          </span>
        </div>
        <div className="mb-2 flex items-center gap-2 text-on-surface">
          <Icon name="calendar_month" className="text-base text-primary" />
          <span className="text-title-md font-medium">
            {formatDateRange({ ...draft, guests })}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="sr-only">Check-in</span>
            <input
              type="date"
              value={checkIn}
              onChange={(event) => commit({ checkIn: event.target.value, checkOut, guests })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="sr-only">Check-out</span>
            <input
              type="date"
              value={checkOut}
              min={checkIn}
              onChange={(event) => commit({ checkIn, checkOut: event.target.value, guests })}
              className={inputClass}
            />
          </label>
        </div>
        <p aria-live="polite" className="mt-1.5 text-label-sm text-outline">
          {notice ? (
            <span className="text-secondary">
              <Icon name="info" className="mr-1 align-[-2px] text-[13px]" />
              {notice}
            </span>
          ) : (
            <>
              Check-in from 3:00 PM • Check-out by 11:00 AM • {formatDate(draft.checkIn)}
            </>
          )}
        </p>
      </div>

      <div className={block}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            Guests
          </span>
          <span className="text-label-sm text-on-surface-variant">Max {maxGuests} Adults</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-on-surface">
            <Icon name="person" className="text-base text-primary" />
            <select
              aria-label="Number of guests"
              value={guests}
              onChange={(event) => commit({ checkIn, checkOut, guests: Number(event.target.value) })}
              className="min-h-11 w-full cursor-pointer bg-transparent text-title-md font-medium focus:outline-none md:min-h-9"
            >
              {Array.from({ length: maxGuests }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {formatGuests(count)}
                </option>
              ))}
            </select>
          </div>
          <Icon name="expand_more" className="shrink-0 text-sm text-outline" />
        </div>
      </div>
    </div>
  );
}
