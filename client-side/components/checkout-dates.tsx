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

import { Icon } from "./icon";

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

  // Sync internal state when external booking query changes
  useEffect(() => {
    setCheckIn(booking.checkIn);
    setCheckOut(booking.checkOut);
    setGuests(booking.guests);
  }, [booking.checkIn, booking.checkOut, booking.guests]);

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
            ? "inline-flex items-center gap-1.5 rounded-full border border-outline-variant/60 bg-surface-container-high/60 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-surface-container-high tap-spring active:scale-95 transition-all"
            : "inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline tap-spring"
        }
      >
        <Icon name="calendar_today" className="text-[13px]" />
        <span>{buttonLabel}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        >
          <div
            id="checkout-dates-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="w-full max-w-sm rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-5 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3 mb-4">
              <div>
                <h3 id="modal-title" className="font-display text-headline-sm font-semibold text-primary">
                  Change Stay Window
                </h3>
                <p className="text-[11px] text-outline">Total pricing recalculates automatically</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container tap-spring active:scale-90"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>

            {/* Current draft range pill */}
            <div className="mb-4 rounded-xl bg-surface-container-low p-3 text-center">
              <p className="font-display text-title-md font-semibold text-primary">
                {formatDateRange({ ...draft, guests })}
              </p>
              <p className="text-xs text-outline font-medium">
                {formatNights(draft.nights)} • {formatGuests(guests)}
              </p>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-on-surface-variant">Check-in</span>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-on-surface-variant">Check-out</span>
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-on-surface-variant">Guests</span>
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
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-outline-variant/60 text-on-surface hover:bg-surface-container tap-spring active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={!changed}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-primary text-on-primary shadow-xs hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed tap-spring active:scale-95 transition-all"
              >
                Update Dates
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
