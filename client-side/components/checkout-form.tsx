"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  cancellationDeadline,
  formatDate,
  formatMoney,
  formatNights,
  quoteFor,
  type Booking,
} from "@/lib/booking";
import { arrivalWindows, houseRules } from "@/lib/content";
import type { Stay } from "@/lib/stays";
import { confirmReservation, type CheckoutState } from "@/app/checkout/actions";

import { FieldError } from "./field-error";
import { Icon } from "./icon";

const initialState: CheckoutState = { status: "idle" };

const field =
  "mt-1.5 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3.5 py-2.5 text-body-md text-on-surface transition-colors placeholder:text-outline focus:border-primary focus:outline-none";

const label = "text-xs font-semibold uppercase tracking-wider text-on-surface-variant";

const submitClass =
  "group flex items-center justify-center gap-2.5 rounded-xl bg-primary text-title-md font-semibold text-on-primary shadow-md transition-all duration-200 hover:bg-primary-container active:scale-[0.98] disabled:cursor-wait disabled:opacity-80";

function SubmitButton({ pending, labelText }: { pending: boolean; labelText: string }) {
  return (
    <button type="submit" disabled={pending} className={`${submitClass} w-full py-3.5`}>
      <Icon
        name={pending ? "progress_activity" : "lock"}
        className={`text-base ${pending ? "animate-spin" : ""}`}
      />
      <span>{pending ? "Confirming your stay…" : labelText}</span>
    </button>
  );
}

function Confirmation({
  state,
  stay,
  booking,
}: {
  state: Extract<CheckoutState, { status: "confirmed" }>;
  stay: Stay;
  booking: Booking;
}) {
  const { reservation } = state;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/20 p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-md">
          <Icon name="check" className="text-3xl" />
        </div>
        <span className="text-label-sm font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
          Booking Confirmed
        </span>
        <h2 className="mt-1 font-display text-headline-md text-primary">
          Your Himalayan retreat awaits, {reservation.guestName.split(" ")[0]}!
        </h2>
        <p className="mx-auto mt-2 max-w-md text-body-sm text-on-surface-variant">
          Your reservation voucher and pre-arrival guide have been sent to{" "}
          <span className="font-semibold text-on-surface">{reservation.email}</span>.
        </p>
      </div>

      <div className="sunlit-card-shadow overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
        <div className="flex flex-col gap-3 border-b border-outline-variant/30 bg-surface-container-low p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-label-xs uppercase tracking-widest text-outline">Reservation Reference</p>
            <p className="font-display text-headline-lg font-bold text-primary">
              {reservation.reference}
            </p>
          </div>
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-center">
            <p className="text-label-xs uppercase tracking-widest text-outline">Arrival PIN</p>
            <p className="font-mono text-title-lg font-bold text-primary">{reservation.pin}</p>
          </div>
        </div>

        <dl className="divide-y divide-outline-variant/20">
          {[
            { label: "Homestay", value: reservation.stayName },
            { label: "Guests", value: reservation.guests },
            { label: "Dates", value: `${reservation.dates} • ${formatNights(reservation.nights)}` },
            { label: "Arrival Window", value: reservation.arrivalWindow },
            { label: "Hill Breakfast", value: "Fresh local hill breakfast daily (Included)" },
            { label: "Total Booking Value", value: reservation.total },
            {
              label: reservation.plan === "deposit" ? "Paid Today (50% Deposit)" : "Paid Today (Full Settlement)",
              value: reservation.dueToday,
            },
          ].map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 px-5 py-3">
              <dt className="text-body-sm text-on-surface-variant">{row.label}</dt>
              <dd className="text-right text-body-sm font-semibold text-on-surface">{row.value}</dd>
            </div>
          ))}
          {!reservation.settled && (
            <div className="flex items-baseline justify-between gap-4 px-5 py-3 bg-amber-500/5">
              <dt className="text-body-sm text-on-surface-variant">Balance Due at Check-in</dt>
              <dd className="text-right text-body-sm font-bold text-secondary">
                {reservation.balance}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: "directions_car",
            title: "Door-to-Door Cab",
            body: `Need an airport or station transfer from NJP / Bagdogra directly to ${stay.name}? Book your verified mountain cab anytime from your guest portal.`,
          },
          {
            icon: "cottage",
            title: "Host Coordination",
            body: `Your host has received your reservation. Fresh mountain tea and a warm greeting will be ready upon your arrival.`,
          },
          {
            icon: "event_available",
            title: "Flexible Cancellation",
            body: `Cancel free of charge until ${reservation.cancellationBy}. Full transparent refund guarantee.`,
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4"
          >
            <Icon name={item.icon} className="mb-2 text-xl text-primary" />
            <h3 className="mb-1 text-title-md font-semibold text-primary">{item.title}</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row pt-2">
        <Link
          href={`/stays/${stay.slug}?checkIn=${booking.checkIn}&checkOut=${booking.checkOut}&guests=${booking.guests}`}
          className="flex-1 rounded-xl border border-outline-variant/60 py-3 text-center text-xs sm:text-title-md font-semibold text-primary transition-colors hover:bg-surface-container tap-spring"
        >
          Return to {stay.name}
        </Link>
        <Link
          href={`/?checkIn=${booking.checkIn}&checkOut=${booking.checkOut}&guests=${booking.guests}#accommodations`}
          className="flex-1 rounded-xl bg-primary py-3 text-center text-xs sm:text-title-md font-semibold text-on-primary transition-colors hover:bg-primary-container tap-spring"
        >
          Explore More Stays
        </Link>
      </div>
    </div>
  );
}

export function CheckoutForm({ stay, booking }: { stay: Stay; booking: Booking }) {
  const [state, formAction, pending] = useActionState(confirmReservation, initialState);
  const [plan, setPlan] = useState<"card_full" | "deposit">("deposit");
  const [showSpecialRequest, setShowSpecialRequest] = useState(false);

  const quote = quoteFor(stay.price, booking);
  const errors = state.status === "error" ? state.errors : {};
  const dueToday = plan === "deposit" ? quote.deposit : quote.total;

  if (state.status === "confirmed") {
    return <Confirmation state={state} stay={stay} booking={booking} />;
  }

  return (
    <form id="checkout-form" action={formAction} className="space-y-6" noValidate>
      {state.status === "error" && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/40 p-4"
        >
          <Icon name="error" className="shrink-0 text-lg text-error" />
          <div>
            <p className="text-body-sm font-semibold text-on-error-container">{state.message}</p>
            <p className="mt-0.5 text-xs text-on-error-container/80">
              Please review the highlighted fields below to continue.
            </p>
          </div>
        </div>
      )}

      <input type="hidden" name="stay" value={stay.slug} />
      <input type="hidden" name="checkIn" value={booking.checkIn} />
      <input type="hidden" name="checkOut" value={booking.checkOut} />
      <input type="hidden" name="guests" value={booking.guests} />

      {/* STEP 1: GUEST CONTACT INFORMATION */}
      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-outline-variant/30 pb-3 mb-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
            1
          </span>
          <h2 className="font-display text-title-lg font-semibold text-primary">Guest Information</h2>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="firstName">
              First Name *
            </label>
            <input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              placeholder="e.g. Rahul"
              aria-invalid={Boolean(errors.firstName)}
              className={field}
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-error font-medium">{errors.firstName}</p>
            )}
          </div>

          <div>
            <label className={label} htmlFor="lastName">
              Last Name *
            </label>
            <input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              placeholder="e.g. Sharma"
              aria-invalid={Boolean(errors.lastName)}
              className={field}
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-error font-medium">{errors.lastName}</p>
            )}
          </div>

          <div>
            <label className={label} htmlFor="email">
              Email Address *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="rahul@example.com"
              aria-invalid={Boolean(errors.email)}
              className={field}
            />
            <p className="mt-1 text-[11px] text-outline">Voucher &amp; directions sent here</p>
            {errors.email && <p className="mt-0.5 text-xs text-error font-medium">{errors.email}</p>}
          </div>

          <div>
            <label className={label} htmlFor="phone">
              WhatsApp / Mobile Number *
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="e.g. 9876543210"
              aria-invalid={Boolean(errors.phone)}
              className={field}
            />
            <p className="mt-1 text-[11px] text-outline">Used for WhatsApp alert &amp; check-in gate</p>
            {errors.phone && <p className="mt-0.5 text-xs text-error font-medium">{errors.phone}</p>}
          </div>
        </div>

        {/* Optional arrival & special requests expander */}
        <div className="mt-4 pt-3 border-t border-outline-variant/20">
          {!showSpecialRequest ? (
            <button
              type="button"
              onClick={() => setShowSpecialRequest(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline tap-spring"
            >
              <Icon name="add_circle" className="text-sm" />
              <span>Add arrival time window or special requests (optional)</span>
            </button>
          ) : (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div>
                <label className={label} htmlFor="arrivalWindow">
                  Estimated Arrival Window
                </label>
                <select id="arrivalWindow" name="arrivalWindow" className={field}>
                  {arrivalWindows.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label} ({w.note})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={label} htmlFor="notes">
                  Special Requests / Dietary Notes
                </label>
                <input
                  id="notes"
                  name="notes"
                  placeholder="e.g. Need pure vegetarian meals, late arrival from airport..."
                  className={field}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* STEP 2: PAYMENT PLAN & SETTLEMENT */}
      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-outline-variant/30 pb-3 mb-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
            2
          </span>
          <h2 className="font-display text-title-lg font-semibold text-primary">Payment Schedule</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              value: "deposit" as const,
              badge: "Most Flexible",
              title: `50% Advance Deposit`,
              amount: formatMoney(quote.deposit),
              note: `Pay ${formatMoney(quote.deposit)} now. Balance ${formatMoney(quote.total - quote.deposit)} payable at check-in.`,
            },
            {
              value: "card_full" as const,
              badge: "One-Time",
              title: `Pay in Full`,
              amount: formatMoney(quote.total),
              note: `Settle 100% now (${formatMoney(quote.total)}). Zero pending dues upon arrival.`,
            },
          ].map((option) => {
            const isSelected = plan === option.value;
            return (
              <label
                key={option.value}
                className={`relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all tap-spring ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                    : "border-outline-variant/50 bg-surface-container-lowest hover:border-outline-variant"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="rounded-full bg-primary-fixed/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      {option.badge}
                    </span>
                    <input
                      type="radio"
                      name="paymentPlan"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => setPlan(option.value)}
                      className="h-4 w-4 accent-primary"
                    />
                  </div>
                  <p className="text-title-md font-semibold text-on-surface">{option.title}</p>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{option.note}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-baseline justify-between">
                  <span className="text-xs text-outline">Due today:</span>
                  <span className="font-display text-title-lg font-bold text-primary">
                    {option.amount}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        {/* Accepted Payment Modes (Real Indian Hospitality Standards) */}
        <div className="mt-5 rounded-xl border border-outline-variant/30 bg-surface-container-low/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Icon name="verified_user" className="text-sm text-emerald-600" />
              <span>Instant Payment Gateway (UPI / QR / Cards / NetBanking)</span>
            </div>
            <span className="text-[11px] text-outline">256-Bit SSL Encrypted</span>
          </div>
          <p className="mt-1 text-[11px] text-on-surface-variant leading-relaxed">
            Supports Google Pay, PhonePe, Paytm, BHIM UPI, Visa, MasterCard, RuPay, and Indian NetBanking. Zero convenience markup.
          </p>
        </div>
      </section>

      {/* STEP 3: HOUSE RULES & TERMS */}
      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-outline-variant/30 pb-3 mb-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
            3
          </span>
          <h2 className="font-display text-title-lg font-semibold text-primary">Terms &amp; Cancellation</h2>
        </div>

        <div className="space-y-2 mb-4 text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <Icon name="check_circle" className="text-emerald-600 text-sm shrink-0" />
            <span>
              <strong>Free Cancellation:</strong> Full refund if cancelled before{" "}
              {cancellationDeadline(booking.checkIn)}.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="check_circle" className="text-emerald-600 text-sm shrink-0" />
            <span>
              <strong>Quiet Hours:</strong> 10:00 PM – 7:00 AM to preserve serene Himalayan tranquility.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="check_circle" className="text-emerald-600 text-sm shrink-0" />
            <span>
              <strong>Check-in Timing:</strong> From 3:00 PM • Check-out by 11:00 AM.
            </span>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low p-3.5 transition-colors has-[:checked]:border-primary">
          <input
            type="checkbox"
            name="terms"
            defaultChecked
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            aria-invalid={Boolean(errors.terms)}
          />
          <span className="text-xs text-on-surface leading-relaxed">
            I agree to the house rules, peaceful mountain guidelines, and understand the free cancellation policy.
          </span>
        </label>
        {errors.terms && <p className="mt-1 text-xs text-error font-medium">{errors.terms}</p>}
      </section>

      {/* Desktop Submit Button */}
      <div className="hidden lg:block pt-2">
        <SubmitButton
          pending={pending}
          labelText={`Confirm Reservation • Pay ${formatMoney(dueToday)}`}
        />
        <p className="mt-2 text-center text-xs text-outline flex items-center justify-center gap-1.5">
          <Icon name="lock" className="text-xs text-emerald-600" />
          <span>Official host voucher and door instructions dispatched immediately upon confirmation.</span>
        </p>
      </div>

      {/* Mobile Sticky Action Bar (Smooth, Compact, Thumb-Friendly) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/40 bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md shadow-drawer lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-headline-sm font-bold text-primary">
              {formatMoney(dueToday)}
            </p>
            <p className="truncate text-label-xs text-outline">
              {plan === "deposit" ? "50% deposit due" : "Paid in full"} • {formatNights(quote.nights)}
            </p>
          </div>
          <button
            type="submit"
            form="checkout-form"
            disabled={pending}
            className={`${submitClass} ml-auto min-h-12 shrink-0 px-5 text-label-md shadow-md`}
          >
            <Icon
              name={pending ? "progress_activity" : "lock"}
              className={`text-sm ${pending ? "animate-spin" : ""}`}
            />
            <span>{pending ? "Confirming…" : "Confirm & Pay"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
