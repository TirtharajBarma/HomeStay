"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  checkoutHref,
  formatDateRange,
  formatGuests,
  formatNights,
  normalizeRange,
  type Booking,
} from "@/lib/booking";

import { Icon } from "./icon";

const inputClass =
  "min-h-11 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2.5 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none";

/** Lets the guest correct their window without leaving the reservation flow. */
export function CheckoutDates({
  slug,
  booking,
  maxGuests,
}: {
  slug: string;
  booking: Booking;
  maxGuests: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checkIn, setCheckIn] = useState(booking.checkIn);
  const [checkOut, setCheckOut] = useState(booking.checkOut);
  const [guests, setGuests] = useState(booking.guests);

  const draft = normalizeRange(checkIn, checkOut);
  const changed =
    draft.checkIn !== booking.checkIn ||
    draft.checkOut !== booking.checkOut ||
    guests !== booking.guests;

  function apply() {
    router.replace(
      checkoutHref(slug, {
        checkIn: draft.checkIn,
        checkOut: draft.checkOut,
        guests: Math.min(Math.max(guests, 1), maxGuests),
      }),
      { scroll: false },
    );
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="checkout-dates"
        className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-label-md text-primary transition-colors hover:bg-surface-container"
      >
        <Icon name={open ? "close" : "refresh"} className="text-base" />
        {open ? "Cancel" : "Change dates"}
      </button>

      {open && (
        <div
          id="checkout-dates"
          className="absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-drawer"
        >
          <p className="mb-3 text-title-md text-primary">
            {formatDateRange({ ...draft, guests })}
          </p>
          <p className="mb-3 text-label-sm text-outline">
            {formatNights(draft.nights)} • change the window and the total updates instantly.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-label-sm text-on-surface-variant">Check-in</span>
              <input
                type="date"
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-label-sm text-on-surface-variant">Check-out</span>
              <input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(event) => setCheckOut(event.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="mt-2 block">
            <span className="mb-1 block text-label-sm text-on-surface-variant">Guests</span>
            <select
              value={guests}
              onChange={(event) => setGuests(Number(event.target.value))}
              className={inputClass}
            >
              {Array.from({ length: maxGuests }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {formatGuests(count)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={apply}
            disabled={!changed}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-container text-label-md text-on-primary transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Update my dates
            <Icon name="check" className="text-base" />
          </button>
        </div>
      )}
    </div>
  );
}
