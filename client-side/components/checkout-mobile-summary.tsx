"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

import {
  formatDateRange,
  formatMoney,
  formatNights,
  TAX_LABEL,
  type Booking,
  type Quote,
} from "@/lib/booking";
import type { Stay } from "@/lib/stays";

import { CheckoutDates } from "./checkout-dates";
import { Icon } from "./icon";
import { Stars } from "./stars";

export function CheckoutMobileSummary({
  stay,
  booking,
  quote,
}: {
  stay: Stay;
  booking: Booking;
  quote: Quote;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="block lg:hidden mb-6 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-ambient">
      {/* Top row: Thumbnail & Stay info */}
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-outline-variant/40">
          <Image
            src={stay.image}
            alt={stay.imageAlt}
            fill
            sizes="56px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-label-sm text-outline truncate">
            {stay.wing}
          </p>
          <h2 className="font-display text-body-md font-medium text-primary truncate">
            {stay.name}
          </h2>
          <div className="mt-0.5 flex items-center gap-2">
            <Stars rating={stay.rating} count={stay.reviewCount} />
          </div>
        </div>
      </div>

      {/* Trip details: Dates & Guests with direct Edit Modal */}
      <div className="mt-3.5 pt-3 border-t border-outline-variant/30 space-y-2">
        <div className="flex items-center justify-between text-body-sm">
          <div>
            <span className="text-on-surface-variant">Dates: </span>
            <span className="font-medium text-on-surface tabular-nums">{formatDateRange(booking)}</span>
            <span className="text-outline text-label-sm ml-1 tabular-nums">({formatNights(booking.nights)})</span>
          </div>
          <CheckoutDates
            slug={stay.slug}
            booking={booking}
            maxGuests={stay.maxGuests}
            buttonLabel="Edit"
            variant="pill"
          />
        </div>

        <div className="flex items-center justify-between text-body-sm">
          <div>
            <span className="text-on-surface-variant">Guests: </span>
            <span className="font-medium text-on-surface">
              {booking.guests} adult{booking.guests === 1 ? "" : "s"}
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
      </div>

      {/* Price summary row with toggle */}
      <div className="mt-3 pt-3 border-t border-outline-variant/30">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between text-left cursor-pointer"
        >
          <div>
            <span className="text-label-sm text-outline block">Total</span>
            <span className="font-display text-headline-sm font-medium text-primary tabular-nums">
              {formatMoney(quote.total)}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-label-sm font-medium text-primary">
            <span>{expanded ? "Hide breakdown" : "Price breakdown"}</span>
            <Icon name={expanded ? "expand_less" : "expand_more"} className="text-sm" />
          </span>
        </button>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-outline-variant/20 space-y-2 text-label-sm text-on-surface-variant animate-in fade-in duration-150">
            <div className="flex justify-between">
              <span>
                {formatMoney(stay.price)} × {formatNights(quote.nights).toLowerCase()}
              </span>
              <span className="font-medium text-on-surface tabular-nums">{formatMoney(quote.roomTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Hill breakfast</span>
              <span className="font-medium text-primary">Included</span>
            </div>
            <div className="flex justify-between">
              <span>Estate cleaning &amp; linens</span>
              <span className="font-medium text-on-surface tabular-nums">{formatMoney(quote.cleaning)}</span>
            </div>
            <div className="flex justify-between">
              <span>{TAX_LABEL}</span>
              <span className="font-medium text-on-surface tabular-nums">{formatMoney(quote.tax)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
