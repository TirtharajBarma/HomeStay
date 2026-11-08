"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  checkoutHref,
  formatDateRange,
  formatGuests,
  formatNights,
  normalizeRange,
  type Booking,
} from "@/lib/booking";

import { DateInput } from "./date-input";
import { Icon } from "./icon";

const dateInputClass =
  "min-h-11 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest focus-within:border-primary transition-colors";

const inputClass =
  "min-h-11 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none transition-colors";

/**
 * Lets the guest modify check-in/out or guest counts in a centered, bulletproof modal
 * that never overflows mobile screens or clips content.
 */
export function CheckoutDates({
  slug,
  booking,
  maxGuests,
  buttonLabel = "Edit",
  variant = "pill",
}: {
  slug: string;
  booking: Booking;
  maxGuests: number;
  buttonLabel?: string;
  variant?: "pill" | "link";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checkIn, setCheckIn] = useState(booking.checkIn);
  const [checkOut, setCheckOut] = useState(booking.checkOut);
  const [guests, setGuests] = useState(booking.guests);

  const [prevBooking, setPrevBooking] = useState(booking);
  if (
    booking.checkIn !== prevBooking.checkIn ||
    booking.checkOut !== prevBooking.checkOut ||
    booking.guests !== prevBooking.guests
  ) {
    setPrevBooking(booking);
    setCheckIn(booking.checkIn);
    setCheckOut(booking.checkOut);
    setGuests(booking.guests);
  }

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [open]);

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Change reservation dates"
        className={
          variant === "pill"
            ? "inline-flex items-center gap-1.5 rounded-full border border-outline-variant/60 bg-surface-container-high/60 px-2.5 py-1 text-label-sm font-medium text-primary hover:bg-surface-container-high transition-colors active:opacity-90"
            : "inline-flex items-center gap-1 text-label-sm font-medium text-primary hover:underline transition-colors"
        }
      >
        <Icon name="calendar_today" className="text-[13px]" />
        <span>{buttonLabel}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm transition-all duration-300"
          onClick={() => setOpen(false)}
        >
          <div
            id="checkout-dates-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="w-full max-w-sm rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 sm:p-6 shadow-ambient transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3 mb-4">
              <div>
                <h3 id="modal-title" className="font-display text-headline-sm font-medium text-primary">
                  Change stay dates
                </h3>
                <p className="text-label-sm text-outline">Total pricing recalculates automatically</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>

            {/* Current draft range pill */}
            <div className="mb-4 rounded-xl bg-surface-container-low p-3 text-center">
              <p className="font-display text-body-md font-medium text-primary">
                {formatDateRange({ ...draft, guests })}
              </p>
              <p className="text-label-sm text-outline font-medium">
                {formatNights(draft.nights)} • {formatGuests(guests)}
              </p>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="mb-1 block text-label-sm font-medium text-on-surface-variant">Check-in</span>
                  <DateInput
                    id="checkout-modal-check-in"
                    ariaLabel="Check-in date (DD/MM/YYYY)"
                    placeholder="Check-in"
                    value={checkIn}
                    onChange={setCheckIn}
                    className={dateInputClass}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-label-sm font-medium text-on-surface-variant">Check-out</span>
                  <DateInput
                    id="checkout-modal-check-out"
                    ariaLabel="Check-out date (DD/MM/YYYY)"
                    placeholder="Check-out"
                    min={checkIn}
                    value={checkOut}
                    onChange={setCheckOut}
                    className={dateInputClass}
                  />
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-label-sm font-medium text-on-surface-variant">Guests</span>
                <select
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className={inputClass}
                >
                  {Array.from({ length: maxGuests }, (_, i) => i + 1).map((count) => (
                    <option key={count} value={count}>
                      {formatGuests(count)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 text-label-md font-medium rounded-xl border border-outline-variant/60 text-on-surface hover:bg-surface-container transition-colors active:opacity-90"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={!changed}
                className="flex-1 py-2.5 text-label-md font-medium rounded-xl bg-primary text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:opacity-90"
              >
                Update dates
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
