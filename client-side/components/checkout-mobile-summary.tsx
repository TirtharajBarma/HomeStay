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
    <div className="block lg:hidden mb-6 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-xs">
      {/* Top row: Thumbnail & Stay info */}
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-outline-variant/30">
          <Image
            src={stay.image}
            alt={stay.imageAlt}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-outline truncate">
            {stay.wing}
          </p>
          <h2 className="font-display text-title-md font-semibold text-primary truncate">
            {stay.name}
          </h2>
          <div className="mt-0.5 flex items-center gap-2">
            <Stars rating={stay.rating} count={stay.reviewCount} />
          </div>
        </div>
      </div>

      {/* Trip details: Dates & Guests with direct Edit Modal */}
      <div className="mt-3.5 pt-3 border-t border-outline-variant/20 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="text-on-surface-variant">Dates: </span>
            <span className="font-semibold text-on-surface">{formatDateRange(booking)}</span>
            <span className="text-outline ml-1">({formatNights(booking.nights)})</span>
          </div>
          <CheckoutDates
            slug={stay.slug}
            booking={booking}
            maxGuests={stay.maxGuests}
            buttonLabel="Edit"
            variant="pill"
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="text-on-surface-variant">Guests: </span>
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
      </div>

      {/* Price summary row with toggle */}
      <div className="mt-3 pt-3 border-t border-outline-variant/20">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between text-left tap-spring"
        >
          <div>
            <span className="text-[11px] text-outline block">Total Booking Price</span>
            <span className="font-display text-headline-sm font-bold text-primary">
              {formatMoney(quote.total)}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <span>{expanded ? "Hide details" : "Price breakdown"}</span>
            <Icon name={expanded ? "expand_less" : "expand_more"} className="text-base" />
          </span>
        </button>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-outline-variant/20 space-y-2 text-xs text-on-surface-variant animate-in fade-in duration-150">
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
          </div>
        )}
      </div>
    </div>
  );
}
