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
import { arrivalWindows, breakfastChoices, hosts, houseRules } from "@/lib/content";
import {
  formatCardNumber,
  formatCvc,
  formatExpiry,
  TEST_CARD,
  validateCard,
  type CardFields,
} from "@/lib/payment";
import type { Stay } from "@/lib/stays";
import { confirmReservation, type CheckoutState } from "@/app/checkout/actions";

import { Icon } from "./icon";

const initialState: CheckoutState = { status: "idle" };

const field =
  "mt-1.5 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-body-md text-on-surface transition-colors placeholder:text-outline focus:border-primary focus:outline-none";

const label = "text-body-sm font-medium text-on-surface";

const CARD_FIELD_NAMES: (keyof CardFields)[] = ["cardName", "cardNumber", "expiry", "cvc"];

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} className="mt-1.5 text-label-sm text-error">
      {message}
    </p>
  );
}

const submitClass =
  "group flex items-center justify-center gap-2.5 rounded-xl bg-primary-container text-title-md font-semibold text-on-primary shadow-lg shadow-primary-container/20 transition-all duration-200 hover:bg-primary hover:shadow-xl active:scale-[0.99] disabled:cursor-wait disabled:opacity-80";

function SubmitButton({ pending, label }: { pending: boolean; label?: string }) {
  return (
    <button type="submit" disabled={pending} className={`${submitClass} w-full py-4`}>
      <span>{pending ? "Confirming your sanctuary…" : (label ?? "Confirm Reservation & Pay Securely")}</span>
      <Icon
        name={pending ? "progress_activity" : "lock"}
        className={`text-base ${pending ? "animate-spin" : ""} transition-transform group-hover:translate-x-0.5`}
      />
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
      <div className="rounded-2xl border border-primary/30 bg-primary-fixed/25 p-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg">
          <Icon name="check" className="text-4xl" />
        </div>
        <h2 className="font-display text-headline-md text-primary">
          Your sanctuary awaits, {reservation.guestName.split(" ")[0]}.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-body-md text-on-surface-variant">
          A confirmation and your pre-arrival valley guide are on their way to{" "}
          <span className="font-medium text-on-surface">{reservation.email}</span>.
        </p>
      </div>

      <div className="sunlit-card-shadow overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
        <div className="flex flex-col gap-4 border-b border-outline-variant/30 bg-surface-container-low p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-label-sm uppercase tracking-widest text-outline">Confirmation</p>
            <p className="font-display text-headline-lg font-bold text-primary">
              {reservation.reference}
            </p>
          </div>
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 text-center">
            <p className="text-label-sm uppercase tracking-widest text-outline">Door PIN</p>
            <p className="font-display text-headline-md text-primary">{reservation.pin}</p>
          </div>
        </div>

        <dl className="divide-y divide-outline-variant/20">
          {[
            { label: "Sanctuary", value: reservation.stayName },
            { label: "Guests", value: reservation.guests },
            { label: "Dates", value: `${reservation.dates} • ${formatNights(reservation.nights)}` },
            { label: "Arrival", value: reservation.arrivalWindow },
            {
              label: "Farmstead Breakfast",
              value: reservation.breakfasts.length > 0 ? reservation.breakfasts.join(" • ") : "Standard farmstead morning",
            },
            { label: "Total Stay", value: reservation.total },
            {
              label: reservation.plan === "deposit" ? "Due Today (50% deposit)" : "Paid Today",
              value: reservation.dueToday,
            },
          ].map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 px-6 py-3.5">
              <dt className="text-body-sm text-on-surface-variant">{row.label}</dt>
              <dd className="text-right text-title-md font-medium text-on-surface">{row.value}</dd>
            </div>
          ))}
          {!reservation.settled && (
            <div className="flex items-baseline justify-between gap-4 px-6 py-3.5">
              <dt className="text-body-sm text-on-surface-variant">Balance due 7 days before arrival</dt>
              <dd className="text-right text-title-md font-medium text-on-surface">
                {reservation.balance}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: "directions_walk",
            title: "Getting Here",
            body: `We will send ridge directions, gate codes, and the gravel lane map to ${reservation.email} seven days before ${formatDate(booking.checkIn)}.`,
          },
          {
            icon: "key",
            title: "Arrival Ritual",
            body: `Expect a lit hearth, warm cider, and a fire-split birch stack inside ${reservation.stayName.replace("The ", "")} during your ${reservation.arrivalWindow} arrival window.`,
          },
          {
            icon: "event_available",
            title: "Plans Change",
            body: `Cancel free of charge until ${reservation.cancellationBy}, then message ${hosts.bookingEmail} and we will always do our best.`,
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5"
          >
            <Icon name={item.icon} className="mb-2 text-2xl text-primary" />
            <h3 className="mb-1 text-title-md text-on-surface">{item.title}</h3>
            <p className="text-body-sm text-on-surface-variant">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/stays/${stay.slug}?checkIn=${booking.checkIn}&checkOut=${booking.checkOut}&guests=${booking.guests}`}
          className="flex-1 rounded-xl border border-primary/40 px-5 py-3.5 text-center text-title-md text-primary transition-colors hover:bg-primary-fixed/20"
        >
          Return to {stay.name}
        </Link>
        <Link
          href={`/?checkIn=${booking.checkIn}&checkOut=${booking.checkOut}&guests=${booking.guests}#accommodations`}
          className="flex-1 rounded-xl bg-primary-container px-5 py-3.5 text-center text-title-md text-on-primary transition-colors hover:bg-primary"
        >
          Browse Other Sanctuaries
        </Link>
      </div>
    </div>
  );
}

export function CheckoutForm({ stay, booking }: { stay: Stay; booking: Booking }) {
  const [state, formAction, pending] = useActionState(confirmReservation, initialState);
  const [plan, setPlan] = useState<"card_full" | "deposit">("card_full");
  const [card, setCardState] = useState<CardFields>({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  });
  const quote = quoteFor(stay.price, booking);
  const serverErrors = state.status === "error" ? state.errors : {};
  const cardErrors = validateCard(card);
  // Card fields are validated live with the same rules the action uses, so a
  // stale server error must not mask a value the guest has since corrected.
  const contactErrors = Object.fromEntries(
    Object.entries(serverErrors).filter(
      ([field]) => !CARD_FIELD_NAMES.includes(field as keyof CardFields),
    ),
  );
  const errors = { ...contactErrors, ...cardErrors };
  const dueToday = plan === "deposit" ? quote.deposit : quote.total;

  function setCard(key: keyof CardFields, value: string) {
    setCardState((current) => ({ ...current, [key]: value }));
  }

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
          <p className="text-body-sm text-on-error-container">{state.message}</p>
        </div>
      )}

      {state.status === "error" && (
        <p className="-mt-3 text-label-sm text-outline">
          Fields marked in red still need your attention.
        </p>
      )}

      <input type="hidden" name="stay" value={stay.slug} />
      <input type="hidden" name="checkIn" value={booking.checkIn} />
      <input type="hidden" name="checkOut" value={booking.checkOut} />
      <input type="hidden" name="guests" value={booking.guests} />

      {/* Guest details */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-label-sm font-bold text-on-primary">
            1
          </span>
          <h2 className="text-title-lg text-primary">Your Details</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="firstName">
              First Name
            </label>
            <input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              placeholder="Eleanor"
              aria-invalid={Boolean(errors.firstName)}
              className={field}
            />
            {errors.firstName && (
              <p className="mt-1 text-label-sm text-error">{errors.firstName}</p>
            )}
          </div>
          <div>
            <label className={label} htmlFor="lastName">
              Last Name
            </label>
            <input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              placeholder="Vance"
              aria-invalid={Boolean(errors.lastName)}
              className={field}
            />
            {errors.lastName && (
              <p className="mt-1 text-label-sm text-error">{errors.lastName}</p>
            )}
          </div>
          <div>
            <label className={label} htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@meadowfallretreat.com"
              aria-invalid={Boolean(errors.email)}
              className={field}
            />
            {errors.email && <p className="mt-1 text-label-sm text-error">{errors.email}</p>}
          </div>
          <div>
            <label className={label} htmlFor="phone">
              Mobile Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 (555) 000-0000"
              aria-invalid={Boolean(errors.phone)}
              className={field}
            />
            {errors.phone && <p className="mt-1 text-label-sm text-error">{errors.phone}</p>}
          </div>
        </div>
      </section>

      {/* Arrival window */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-label-sm font-bold text-on-primary">
            2
          </span>
          <h2 className="text-title-lg text-primary">Arrival Plans</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {arrivalWindows.map((window, index) => (
            <label
              key={window.value}
              className="cursor-pointer rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-fixed/25"
            >
              <span className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="arrivalWindow"
                  value={window.value}
                  defaultChecked={index === 0}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-title-md text-on-surface">{window.label}</span>
              </span>
              <span className="mt-1.5 block pl-6.5 text-label-sm text-on-surface-variant">
                {window.note}
              </span>
            </label>
          ))}
        </div>
        <p className="flex items-center gap-2 text-body-sm text-on-surface-variant">
          <Icon name="info" className="text-sm text-primary" />
          Check-in from 3:00 PM • Check-out by 11:00 AM • {formatDate(booking.checkIn)}
        </p>
      </section>

      {/* Breakfast */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-label-sm font-bold text-on-primary">
            3
          </span>
          <h2 className="text-title-lg text-primary">Farmstead Breakfast Preferences</h2>
        </div>
        <div className="space-y-3">
          {breakfastChoices.map((choice, index) => (
            <label
              key={choice.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-fixed/25"
            >
              <input
                type="checkbox"
                name="breakfast"
                value={choice.value}
                defaultChecked={index === 0}
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
              />
              <span>
                <span className="block text-title-md text-on-surface">{choice.label}</span>
                <span className="mt-0.5 block text-body-sm text-on-surface-variant">
                  {choice.note}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-label-sm text-outline">
          Included with every stay — simply tell us how you would like it prepared.
        </p>
      </section>

      {/* Payment */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-label-sm font-bold text-on-primary">
            4
          </span>
          <h2 className="text-title-lg text-primary">Secure Payment</h2>
        </div>
        <fieldset className="space-y-3">
          <legend className="sr-only">Payment plan</legend>
          {[
            {
              value: "card_full" as const,
              title: `Pay in full — ${formatMoney(quote.total)}`,
              note: "Settle the entire stay today, completely hassle-free.",
            },
            {
              value: "deposit" as const,
              title: `Pay 50% deposit — ${formatMoney(quote.deposit)}`,
              note: `Balance of ${formatMoney(quote.total - quote.deposit)} due seven days before arrival.`,
            },
          ].map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-fixed/25"
            >
              <input
                type="radio"
                name="paymentPlan"
                value={option.value}
                checked={plan === option.value}
                onChange={() => setPlan(option.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
              />
              <span>
                <span className="block text-title-md text-on-surface">{option.title}</span>
                <span className="mt-0.5 block text-body-sm text-on-surface-variant">
                  {option.note}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="cardName">
              Name on Card
            </label>
            <input
              id="cardName"
              name="cardName"
              autoComplete="cc-name"
              value={card.cardName}
              onChange={(event) => setCard("cardName", event.target.value)}
              placeholder="Rowan Mercer"
              aria-invalid={Boolean(errors.cardName)}
              className={field}
            />
            <FieldError message={errors.cardName} />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="cardNumber">
              Card Number
            </label>
            <div className="relative">
              <input
                id="cardNumber"
                name="cardNumber"
                inputMode="numeric"
                autoComplete="cc-number"
                value={card.cardNumber}
                onChange={(event) => setCard("cardNumber", formatCardNumber(event.target.value))}
                placeholder="4242 4242 4242 4242"
                aria-invalid={Boolean(errors.cardNumber)}
                aria-describedby={errors.cardNumber ? "cardNumber-error" : undefined}
                className={`${field} pr-12 font-mono tracking-wide`}
              />
              <Icon
                name="lock"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
            </div>
            <FieldError id="cardNumber-error" message={errors.cardNumber} />
          </div>
          <div>
            <label className={label} htmlFor="expiry">
              Expiry
            </label>
            <input
              id="expiry"
              name="expiry"
              inputMode="numeric"
              autoComplete="cc-exp"
              value={card.expiry}
              onChange={(event) => setCard("expiry", formatExpiry(event.target.value))}
              placeholder="10 / 2028"
              aria-invalid={Boolean(errors.expiry)}
              className={field}
            />
            <FieldError message={errors.expiry} />
          </div>
          <div>
            <label className={label} htmlFor="cvc">
              CVC
            </label>
            <input
              id="cvc"
              name="cvc"
              inputMode="numeric"
              autoComplete="cc-csc"
              value={card.cvc}
              onChange={(event) => setCard("cvc", formatCvc(event.target.value))}
              placeholder="123"
              aria-invalid={Boolean(errors.cvc)}
              className={field}
            />
            <FieldError message={errors.cvc} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCardState(TEST_CARD)}
            className="inline-flex min-h-9 items-center gap-1.5 text-label-md text-primary hover:underline"
          >
            <Icon name="auto_fix_high" className="text-base" />
            Fill test card
          </button>
          <span className="text-label-sm text-outline">
            Card type is detected from the first digits
          </span>
        </div>

        <p className="rounded-xl bg-surface-container-low p-4 text-label-sm text-on-surface-variant">
          This is a demonstration storefront — no card is charged and no data leaves your browser.
        </p>
      </section>

      {/* Terms */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-label-sm font-bold text-on-primary">
            5
          </span>
          <h2 className="text-title-lg text-primary">House Rules &amp; Guest Terms</h2>
        </div>
        <ul className="space-y-2.5 text-body-sm text-on-surface-variant">
          {houseRules.map((rule) => (
            <li key={rule.text} className="flex items-start gap-2.5">
              <Icon name={rule.icon} className="mt-0.5 shrink-0 text-tertiary" />
              {rule.text}
            </li>
          ))}
          <li className="flex items-start gap-2.5">
            <Icon name="spa" className="mt-0.5 shrink-0 text-tertiary" />
            Children under 12 stay free in the adjoining loft only with written host approval.
          </li>
        </ul>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4">
          <input
            type="checkbox"
            name="terms"
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            aria-invalid={Boolean(errors.terms)}
          />
          <span className="text-body-sm text-on-surface-variant">
            I have read and agree to the house rules, quiet hours, and the host&apos;s guest terms.
            I understand free cancellation until {cancellationDeadline(booking.checkIn)}.
          </span>
        </label>
        <FieldError message={errors.terms} />
      </section>

      <div className="hidden lg:block">
        <SubmitButton pending={pending} />
      </div>

      <p className="flex items-center justify-center gap-2 text-center text-label-sm text-on-surface-variant">
        <Icon name="shield_person" className="text-base text-secondary" />
        Direct booking keeps your reservation with the family who own the house.
      </p>

      {/* Phones keep the confirm action within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/40 bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md shadow-drawer lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-title-md font-semibold text-primary">
              {formatMoney(dueToday)}
            </p>
            <p className="truncate text-label-sm text-outline">
              {plan === "deposit" ? "50% deposit" : "Paid in full"} • {formatNights(quote.nights)}
            </p>
          </div>
          <button
            type="submit"
            form="checkout-form"
            disabled={pending}
            className={`${submitClass} ml-auto min-h-12 shrink-0 px-5 text-label-md`}
          >
            {pending ? "Confirming…" : "Confirm & Pay"}
          </button>
        </div>
      </div>
    </form>
  );
}
