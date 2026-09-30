import Link from "next/link";

import {
  cancellationDeadline,
  checkoutHref,
  formatDate,
  formatDateRange,
  formatMoney,
  formatNights,
  TAX_LABEL,
  quoteFor,
  type Booking,
} from "@/lib/booking";
import { hosts } from "@/lib/content";
import type { Stay } from "@/lib/stays";

import { BookingControls } from "./booking-controls";
import { Icon } from "./icon";
import { Stars } from "./stars";

export function BookingCard({ stay, booking }: { stay: Stay; booking: Booking }) {
  const quote = quoteFor(stay.price, booking);

  return (
    <aside className="order-first lg:order-last lg:col-span-4 lg:sticky lg:top-24">
      <div className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-6 sticky-card-elevation">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-outline-variant/30 pb-4">
          <div>
            <span className="font-display text-headline-lg font-bold text-primary">
              {formatMoney(stay.price)}
            </span>
            <span className="ml-1 text-body-sm text-on-surface-variant">/ night</span>
          </div>
          <Stars rating={stay.rating} count={stay.reviewCount} />
        </div>

        <BookingControls slug={stay.slug} booking={booking} maxGuests={stay.maxGuests} />

        <div className="mb-6 space-y-3 border-b border-outline-variant/30 pb-5 text-body-sm">
          <div className="flex justify-between text-on-surface-variant">
            <span>
              {formatMoney(stay.price)} × {formatNights(quote.nights).toLowerCase()}
            </span>
            <span className="font-medium text-on-surface">{formatMoney(quote.roomTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              Hill Breakfast &amp; Firewood
              <Icon name="eco" className="text-xs text-primary" />
            </span>
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
          <div className="flex items-baseline justify-between border-t border-outline-variant/40 pt-3 text-title-md font-semibold text-primary">
            <span>Total</span>
            <span className="font-display text-headline-sm">
              {formatMoney(quote.total)}
            </span>
          </div>
          <p className="text-label-sm text-outline">
            {formatDateRange(booking)} • {formatNights(quote.nights).toLowerCase()} • free
            cancellation until {formatDate(cancellationDeadline(booking.checkIn))}
          </p>
        </div>

        <Link
          href={checkoutHref(stay.slug, booking)}
          className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-container py-3.5 text-label-md text-on-primary shadow-md transition-all duration-200 hover:bg-primary hover:shadow-lg active:scale-[0.99]"
        >
          <span>Reserve Your Stay</span>
          <Icon
            name="arrow_forward"
            className="text-sm transition-transform group-hover:translate-x-0.5"
          />
        </Link>

        <div className="mt-5 space-y-2 text-center">
          <div className="flex items-center justify-center gap-1.5 text-label-sm text-on-surface-variant">
            <Icon name="lock" className="text-sm text-secondary" />
            <span>No payment charged yet</span>
          </div>
          <p className="text-label-sm leading-tight text-on-surface-variant">
            Free cancellation up to 7 days before check-in • Direct booking best rate guaranteed
          </p>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-outline-variant/30 pt-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed-dim/40 text-xs font-semibold text-primary">
            E&amp;T
          </span>
          <div className="text-left text-body-sm leading-tight">
            <span className="text-on-surface">Have questions for the hosts?</span>
            <a
              href={`mailto:${hosts.email}`}
              className="mt-0.5 inline-flex min-h-11 items-center text-label-sm text-primary hover:underline"
            >
              Message {hosts.names}
            </a>
          </div>
        </div>

      </div>
    </aside>
  );
}
