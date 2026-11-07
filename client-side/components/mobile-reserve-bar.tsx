"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  checkoutHref,
  formatNightly,
  formatNights,
  type Booking,
} from "@/lib/booking";
import { siteConfig } from "@/lib/site-config";
import type { Stay } from "@/lib/stays";
import { waNumber } from "@/lib/whatsapp";

import { Icon } from "./icon";

/**
 * Phones have no room for a sticky sidebar, so the reserve action and running
 * total live in a bottom bar that only shows below the large breakpoint.
 * It automatically slides down out of view when the guest reaches the footer,
 * ensuring all support links and policies are completely unobstructed.
 */
export function MobileReserveBar({ stay, booking }: { stay: Stay; booking: Booking }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Hide when the footer enters the viewport
        setHidden(entry.isIntersecting);
      },
      { rootMargin: "0px 0px -20px 0px", threshold: 0.05 }
    );

    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const rawPhone = stay.phone && stay.phone.toLowerCase() !== "not provided" ? stay.phone.trim() : "";
  const effectivePhone =
    rawPhone ||
    siteConfig.supportPhone?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() ||
    "919239842574";
  const cleanPhone = waNumber(effectivePhone);

  const waInquiryMessage = `Hello! I would like to inquire about booking ${stay.name} for ${booking.nights} night${booking.nights > 1 ? "s" : ""} (${booking.checkIn} to ${booking.checkOut}) for ${booking.guests} guest${booking.guests > 1 ? "s" : ""}. Please let me know room availability and price.`;
  const waInquiryUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waInquiryMessage)}`;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/40 bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md shadow-drawer transition-transform duration-300 ease-in-out lg:hidden ${
        hidden ? "translate-y-full pointer-events-none opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-headline-sm font-semibold text-primary">
            {formatNightly(stay.price)}{" "}
            {stay.price > 0 ? (
              <span className="font-body text-body-sm font-normal text-on-surface-variant">
                / night
              </span>
            ) : null}
          </p>
          <p className="truncate text-label-sm text-outline">
            {formatNights(booking.nights)} • {booking.guests} Adult
            {booking.guests === 1 ? "" : "s"} • {stay.occupancy}
          </p>
        </div>

        {stay.price > 0 ? (
          <Link
            href={checkoutHref(stay.slug, booking)}
            className="ml-auto flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-primary-container px-5 text-label-md font-bold text-on-primary shadow-md tap-spring active:scale-95 transition-all"
          >
            <span>Reserve</span>
            <Icon name="arrow_forward" className="text-base" />
          </Link>
        ) : (
          <a
            href={waInquiryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-label-md font-bold text-white shadow-md tap-spring active:scale-95 transition-all"
          >
            <Icon name="chat" className="text-base" />
            <span>Ask Host</span>
          </a>
        )}
      </div>
    </div>
  );
}
