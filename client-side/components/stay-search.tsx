"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  formatDateRange,
  formatGuests,
  formatNights,
  homeHref,
  normalizeRange,
  type Booking,
  type Filters,
} from "@/lib/booking";

import { Icon } from "./icon";

type StaySearchProps = {
  booking: Booking;
  filters: Filters;
  maxGuests: number;
};

const kindOptions = [
  { value: "all", label: "All Accommodations" },
  { value: "estate", label: "Tea Estate Stays" },
  { value: "heritage", label: "Heritage Bungalows" },
  { value: "homestay", label: "Family Homestays" },
];

const fieldClass =
  "flex flex-col justify-center rounded-lg border border-outline-variant/30 bg-surface p-3";

const controlClass =
  "min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2.5 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none md:min-h-9 md:py-1 md:text-label-sm";

const hintClass = "text-label-sm text-outline";

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
      className="mb-8 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3 sunlit-card-shadow md:p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={fieldClass}>
          <label
            htmlFor="search-check-in"
            className="mb-1.5 flex items-center gap-1.5 text-label-sm text-on-surface-variant"
          >
            <Icon name="calendar_month" className="text-[15px] text-primary" />
            Check-in — Check-out
          </label>
          <span className="text-title-md font-semibold text-primary">
            {formatDateRange({ ...draft, guests })}
          </span>
          <span className={hintClass}>{formatNights(nights)}</span>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div>
              <input
                id="search-check-in"
                name="checkIn"
                type="date"
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
                className={controlClass}
              />
              <span className="sr-only">Check-in date</span>
            </div>
            <div>
              <input
                name="checkOut"
                type="date"
                aria-label="Check-out date"
                min={checkIn}
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
                className={controlClass}
              />
            </div>
          </div>
          {needsNights && (
            <span className="mt-1.5 flex items-center gap-1 text-label-sm text-secondary">
              <Icon name="info" className="text-[13px]" />
              Check-out will be set to {formatNights(nights).toLowerCase()} after arrival
            </span>
          )}
        </div>

        <div className={fieldClass}>
          <label
            htmlFor="search-guests"
            className="mb-1.5 flex items-center gap-1.5 text-label-sm text-on-surface-variant"
          >
            <Icon name="group" className="text-[15px] text-primary" />
            Guests
          </label>
          <select
            id="search-guests"
            name="guests"
            value={guests}
            onChange={(event) => setGuests(Number(event.target.value))}
            className="min-h-11 w-full cursor-pointer bg-transparent text-title-md font-semibold text-primary focus:outline-none md:min-h-9"
          >
            {Array.from({ length: maxGuests }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {formatGuests(count)}
              </option>
            ))}
          </select>
          <span className={hintClass}>Per room booking</span>
        </div>

        <div className={fieldClass}>
          <label
            htmlFor="search-kind"
            className="mb-1.5 flex items-center gap-1.5 text-label-sm text-on-surface-variant"
          >
            <Icon name="villa" className="text-[15px] text-primary" />
            Stay Type
          </label>
          <select
            id="search-kind"
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as Filters["kind"])}
            className="min-h-11 w-full cursor-pointer bg-transparent text-title-md font-semibold text-primary focus:outline-none md:min-h-9"
          >
            {kindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className={hintClass}>All Darjeeling options</span>
        </div>

        <button
          type="submit"
          className="flex min-h-14 items-stretch justify-center rounded-lg bg-primary px-6 text-label-md text-on-primary shadow-sm transition-all duration-200 hover:bg-primary-container active:scale-[0.98] sm:min-h-0 lg:min-h-14"
        >
          <span className="flex w-full items-center justify-center gap-2">
            <Icon name="search" className="text-[18px]" />
            <span>Search Stays</span>
          </span>
        </button>
      </div>
    </form>
  );
}
