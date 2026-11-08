"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  formatGuests,
  formatNights,
  homeHref,
  normalizeRange,
  type Booking,
  type Filters,
} from "@/lib/booking";

import { DateInput } from "./date-input";
import { Icon } from "./icon";

type StaySearchProps = {
  booking: Booking;
  filters: Filters;
  maxGuests: number;
};

const kindOptions = [
  { value: "all", label: "All Accommodations" },
  { value: "cottage", label: "Cottages" },
  { value: "loft", label: "Lofts" },
  { value: "cabin", label: "Cabins" },
];

const fieldClass =
  "flex flex-col justify-between rounded-lg border border-outline-variant/60 bg-surface p-3 min-h-[88px] transition-colors focus-within:border-primary";

const dateControlClass =
  "h-9 w-full rounded-md border border-outline-variant/60 bg-surface-container-lowest focus-within:border-primary transition-colors";

const selectClass =
  "h-9 w-full rounded-md border border-outline-variant/60 bg-surface-container-lowest px-2 text-body-sm tabular-nums text-on-surface focus:border-primary focus:outline-none";

const hintClass = "text-label-sm text-outline tabular-nums";

export function StaySearch({ booking, filters, maxGuests }: StaySearchProps) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(booking.checkIn);
  const [checkOut, setCheckOut] = useState(booking.checkOut);
  const [guests, setGuests] = useState(booking.guests);
  const [kind, setKind] = useState(filters.kind);

  const draft = normalizeRange(checkIn, checkOut);
  const nights = draft.nights;
  const needsNights = draft.checkOut !== checkOut || draft.checkIn !== checkIn;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      `${homeHref({ ...draft, guests }, { kind, petFriendly: filters.petFriendly })}#accommodations`,
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-3 shadow-ambient md:p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
        {/* Dates */}
        <div className={`${fieldClass} sm:col-span-2 lg:col-span-4`}>
          <div className="flex items-center justify-between">
            <label
              htmlFor="search-check-in"
              className="text-label-sm font-medium text-on-surface-variant"
            >
              Dates
            </label>
            <span className={hintClass}>{formatNights(nights)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <DateInput
                id="search-check-in"
                name="checkIn"
                ariaLabel="Check-in date (DD/MM/YYYY)"
                placeholder="Check-in"
                value={checkIn}
                onChange={setCheckIn}
                className={dateControlClass}
              />
              <span className="sr-only">Check-in date</span>
            </div>
            <div>
              <DateInput
                id="search-check-out"
                name="checkOut"
                ariaLabel="Check-out date (DD/MM/YYYY)"
                placeholder="Check-out"
                min={checkIn}
                value={checkOut}
                onChange={setCheckOut}
                className={dateControlClass}
              />
            </div>
          </div>

          {needsNights && (
            <span className="mt-1 text-[11px] text-secondary">
              Check-out: {formatNights(nights).toLowerCase()} after arrival
            </span>
          )}
        </div>

        {/* Guests */}
        <div className={`${fieldClass} sm:col-span-1 lg:col-span-2`}>
          <div className="flex items-center justify-between">
            <label
              htmlFor="search-guests"
              className="text-label-sm font-medium text-on-surface-variant"
            >
              Guests
            </label>
            <span className={hintClass}>1–4 per room</span>
          </div>
          <div className="mt-1">
            <select
              id="search-guests"
              name="guests"
              value={guests}
              onChange={(event) => setGuests(Number(event.target.value))}
              className={`${selectClass} cursor-pointer font-medium text-primary`}
            >
              {Array.from({ length: maxGuests }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {formatGuests(count)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stay Type */}
        <div className={`${fieldClass} sm:col-span-1 lg:col-span-3`}>
          <div className="flex items-center justify-between">
            <label
              htmlFor="search-kind"
              className="text-label-sm font-medium text-on-surface-variant"
            >
              Accommodation type
            </label>
            <span className={hintClass}>All valley stays</span>
          </div>
          <div className="mt-1">
            <select
              id="search-kind"
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as Filters["kind"])}
              className={`${selectClass} cursor-pointer font-medium text-primary`}
            >
              {kindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col justify-center sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-primary cursor-pointer shadow-ambient"
          >
            <Icon name="search" className="text-[18px]" />
            <span>Search stays</span>
          </button>
        </div>
      </div>
    </form>
  );
}
