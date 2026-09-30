import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutDates } from "@/components/checkout-dates";
import { CheckoutForm } from "@/components/checkout-form";
import { Icon } from "@/components/icon";
import { Stars } from "@/components/stars";
import {
  cancellationDeadline,
  formatDateRange,
  formatMoney,
  formatNights,
  homeHref,
  TAX_LABEL,
  quoteFor,
  resolveBooking,
  stayHref,
} from "@/lib/booking";
import { hosts } from "@/lib/content";
import { getStay } from "@/lib/stays";

export const metadata: Metadata = {
  title: "Secure Reservation",
  description: "Complete your Meadowfall Homestay reservation with free cancellation.",
};

export default async function CheckoutPage({
  searchParams,
}: PageProps<"/checkout">) {
  const query = await searchParams;
  const stay = getStay(typeof query.stay === "string" ? query.stay : "");

  // A checkout without a stay (bookmark, shared link, dropped query) sends the
  // guest back to the catalogue instead of a dead end.
  if (!stay) redirect("/#accommodations");

  const booking = resolveBooking(query, stay.maxGuests);
  const quote = quoteFor(stay.price, booking);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-28 sm:px-4 sm:px-6 sm:pt-8 lg:pb-8">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant"
      >
        <Link
          href={homeHref(booking)}
          className="-mx-1 inline-flex min-h-11 items-center rounded px-1 hover:text-primary"
        >
          Accommodations
        </Link>
        <span className="text-outline-variant">/</span>
        <Link
          href={stayHref(stay.slug, booking)}
          className="-mx-1 inline-flex min-h-11 items-center rounded px-1 hover:text-primary"
        >
          {stay.name}
        </Link>
        <span className="text-outline-variant">/</span>
        <span aria-current="page" className="font-medium text-primary">
          Secure Reservation
        </span>
      </nav>

      <div className="mb-8 max-w-2xl">
        <span className="text-label-md uppercase tracking-widest text-secondary">
          Final Step
        </span>
        <h1 className="mt-1 font-display text-headline-lg-mobile font-semibold text-primary md:text-headline-lg">
          Complete Your Reservation
        </h1>
        <p className="mt-2 text-body-lg text-on-surface-variant">
          No payment is charged until you confirm. Free cancellation until{" "}
          {cancellationDeadline(booking.checkIn)}.
        </p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <CheckoutForm stay={stay} booking={booking} />
        </div>

        <aside
          className="scroll-mt-28 lg:col-span-5 lg:sticky lg:top-24"
          id="stay-summary"
        >
          <div className="sticky-card-elevation space-y-5 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-6">
            <figure className="relative h-44 overflow-hidden rounded-xl">
              <Image
                src={stay.image}
                alt={stay.imageAlt}
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              <figcaption className="absolute bottom-3 left-3 text-white">
                <span className="block text-label-sm text-on-primary-container/90">
                  {stay.wing} • {stay.occupancy}
                </span>
                <span className="font-display text-headline-sm">{stay.name}</span>
              </figcaption>
            </figure>

            <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 pb-4">
              <Stars rating={stay.rating} count={stay.reviewCount} />
              <Link
                href={stayHref(stay.slug, booking)}
                className="inline-flex min-h-11 items-center text-label-sm text-primary hover:underline"
              >
                View stay details
              </Link>
            </div>

            <dl className="space-y-3 text-body-sm">
              <div className="flex items-center justify-between">
                <dt className="text-on-surface-variant">Your Dates</dt>
                <dd className="text-right font-medium text-on-surface">
                  {formatDateRange(booking)}
                  <span className="block text-label-sm text-outline">
                    {formatNights(booking.nights)}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-on-surface-variant">Guests</dt>
                <dd className="font-medium text-on-surface">
                  {booking.guests} Adult{booking.guests === 1 ? "" : "s"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-on-surface-variant">Check-in</dt>
                <dd className="font-medium text-on-surface">3:00 PM – 8:00 PM</dd>
              </div>
            </dl>

            <div className="space-y-3 border-y border-outline-variant/30 py-4 text-body-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>
                  {formatMoney(stay.price)} × {formatNights(quote.nights).toLowerCase()}
                </span>
                <span className="font-medium text-on-surface">
                  {formatMoney(quote.roomTotal)}
                </span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Farmstead Breakfast &amp; Firewood</span>
                <span className="font-medium text-primary">Included (Free)</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Estate Cleaning &amp; Linens</span>
                <span className="font-medium text-on-surface">{formatMoney(quote.cleaning)}</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>{TAX_LABEL}</span>
                <span className="font-medium text-on-surface">{formatMoney(quote.tax)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-outline-variant/40 pt-3">
                <span className="text-title-md font-semibold text-primary">Total</span>
                <span className="font-display text-headline-md text-primary">
                  {formatMoney(quote.total)}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-primary-fixed/25 p-4">
              <Icon name="verified_user" className="shrink-0 text-xl text-primary" />
              <p className="text-body-sm text-on-surface-variant">
                <span className="font-semibold text-on-surface">Direct booking advantage:</span>{" "}
                our lowest rate, priority breakfast delivery, and a real person on the other end
                of the lane whenever you need one.
              </p>
            </div>

            <div className="flex items-center gap-3 border-t border-outline-variant/30 pt-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed-dim/40 text-xs font-semibold text-primary">
                E&amp;T
              </span>
              <p className="text-body-sm leading-tight text-on-surface-variant">
                Questions before you book?{" "}
                <a
                  href={`mailto:${hosts.email}`}
                  className="inline-flex min-h-11 items-center text-primary hover:underline"
                >
                  {hosts.email}
                </a>
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-label-sm text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <Icon name="lock" className="text-sm text-secondary" />
              Encrypted checkout
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="event_busy" className="text-sm text-secondary" />
              Free cancellation
            </span>
            <CheckoutDates slug={stay.slug} booking={booking} maxGuests={stay.maxGuests} />
          </div>
        </aside>
      </div>
    </main>
  );
}
