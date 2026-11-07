import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutDates } from "@/components/checkout-dates";
import { CheckoutForm } from "@/components/checkout-form";
import { CheckoutMobileSummary } from "@/components/checkout-mobile-summary";
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
import { siteConfig } from "@/lib/site-config";
import { getLiveStay } from "@/lib/stays";
import { waNumber } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Secure Reservation | StayCabs",
  description: "Complete your verified homestay reservation with free cancellation.",
};

export default async function CheckoutPage({
  searchParams,
}: PageProps<"/checkout">) {
  const query = await searchParams;
  const stay = await getLiveStay(typeof query.stay === "string" ? query.stay : "");

  // A checkout without a stay sends the guest back to the catalogue
  if (!stay) redirect("/#accommodations");
  // No nightly price ("Price on request"): nothing to charge, back to stay page
  if (!(stay.price > 0)) redirect(`/stays/${stay.slug}`);

  const booking = resolveBooking(query, stay.maxGuests);
  const quote = quoteFor(stay.price, booking);

  const rawPhone = stay.phone && stay.phone.toLowerCase() !== "not provided" ? stay.phone.trim() : "";
  const effectivePhone =
    rawPhone ||
    siteConfig.supportPhone?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() ||
    "919239842574";
  const cleanPhone = waNumber(effectivePhone);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-28 sm:px-6 sm:pt-8 lg:pb-12">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant"
      >
        <Link
          href={homeHref(booking)}
          className="inline-flex min-h-8 items-center rounded hover:text-primary"
        >
          Accommodations
        </Link>
        <span className="text-outline-variant">/</span>
        <Link
          href={stayHref(stay.slug, booking)}
          className="inline-flex min-h-8 items-center rounded hover:text-primary font-medium"
        >
          {stay.name}
        </Link>
        <span className="text-outline-variant">/</span>
        <span aria-current="page" className="font-semibold text-primary">
          Confirm &amp; Pay
        </span>
      </nav>

      {/* Page Title */}
      <div className="mb-6 max-w-2xl">
        <span className="text-label-xs font-bold uppercase tracking-widest text-secondary">
          Final Step
        </span>
        <h1 className="mt-1 font-display text-2xl sm:text-headline-lg font-semibold text-primary tracking-tight">
          Complete Your Reservation
        </h1>
        <p className="mt-1 text-xs sm:text-body-md text-on-surface-variant">
          Instant booking voucher • Free cancellation until{" "}
          <strong>{cancellationDeadline(booking.checkIn)}</strong>.
        </p>
      </div>

      {/* MOBILE COMPACT TRIP SUMMARY: High conversion, takes only ~130px instead of 600px! */}
      <CheckoutMobileSummary stay={stay} booking={booking} quote={quote} />

      {/* Main Grid: Form on Left, Desktop Sticky Sidebar on Right */}
      <div className="flex flex-col lg:grid items-start gap-6 lg:gap-8 lg:grid-cols-12">
        <div className="w-full lg:col-span-7">
          <CheckoutForm stay={stay} booking={booking} />
        </div>

        {/* DESKTOP SIDEBAR TRIP SUMMARY */}
        <aside
          className="hidden lg:block w-full scroll-mt-28 lg:col-span-5 lg:sticky lg:top-24"
          id="stay-summary"
        >
          <div className="sticky-card-elevation space-y-5 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-6">
            <figure className="relative h-44 overflow-hidden rounded-xl">
              <Image
                src={stay.image}
                alt={stay.imageAlt}
                fill
                priority
                sizes="40vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
              <figcaption className="absolute bottom-3 left-3 right-3 text-white">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-white/90">
                  {stay.wing}
                </span>
                <span className="font-display text-headline-sm font-semibold truncate block">
                  {stay.name}
                </span>
              </figcaption>
            </figure>

            <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 pb-3">
              <Stars rating={stay.rating} count={stay.reviewCount} />
              <Link
                href={stayHref(stay.slug, booking)}
                className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
              >
                View stay details →
              </Link>
            </div>

            {/* Trip Details with Direct Edit Buttons */}
            <div className="space-y-3 text-body-sm">
              <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
                <div>
                  <span className="block text-xs text-on-surface-variant">Dates</span>
                  <span className="font-semibold text-on-surface">{formatDateRange(booking)}</span>
                  <span className="text-outline text-xs ml-1">({formatNights(booking.nights)})</span>
                </div>
                <CheckoutDates
                  slug={stay.slug}
                  booking={booking}
                  maxGuests={stay.maxGuests}
                  buttonLabel="Edit"
                  variant="pill"
                />
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
                <div>
                  <span className="block text-xs text-on-surface-variant">Guests</span>
                  <span className="font-semibold text-on-surface">
                    {booking.guests} Adult{booking.guests === 1 ? "" : "s"}
                  </span>
                </div>
                <CheckoutDates
                  slug={stay.slug}
                  booking={booking}
                  maxGuests={stay.maxGuests}
                  buttonLabel="Change"
                  variant="link"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">Check-in</span>
                <span className="font-medium text-xs text-on-surface">3:00 PM – 8:00 PM</span>
              </div>
            </div>

            {/* Price Details Breakdown */}
            <div className="space-y-2.5 border-y border-outline-variant/30 py-4 text-xs text-on-surface-variant">
              <div className="flex justify-between">
                <span>
                  {formatMoney(stay.price)} × {formatNights(quote.nights).toLowerCase()}
                </span>
                <span className="font-medium text-on-surface">{formatMoney(quote.roomTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Hill Breakfast &amp; Firewood</span>
                <span className="font-medium text-emerald-700">Included Free</span>
              </div>
              <div className="flex justify-between">
                <span>Estate Cleaning &amp; Linens</span>
                <span className="font-medium text-on-surface">{formatMoney(quote.cleaning)}</span>
              </div>
              <div className="flex justify-between">
                <span>{TAX_LABEL}</span>
                <span className="font-medium text-on-surface">{formatMoney(quote.tax)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-outline-variant/40 pt-3">
                <span className="text-title-md font-bold text-primary">Total Booking Amount</span>
                <span className="font-display text-headline-sm font-bold text-primary">
                  {formatMoney(quote.total)}
                </span>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <Icon name="verified_user" className="text-sm text-emerald-600" />
                <span>Direct Homestay Rate</span>
              </div>
              <p className="text-on-surface-variant leading-relaxed">
                Zero booking fees or OTA commission markups. Official voucher dispatched immediately upon confirmation.
              </p>
            </div>

            {/* Host Assistance */}
            <div className="flex items-center justify-between pt-2 text-xs text-outline border-t border-outline-variant/20">
              <span className="flex items-center gap-1">
                <Icon name="phone" className="text-xs text-primary" />
                <span>Host Helpdesk:</span>
              </span>
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
