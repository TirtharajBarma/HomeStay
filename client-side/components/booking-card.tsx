import Link from "next/link";

import {
  cancellationDeadline,
  checkoutHref,
  formatDate,
  formatDateRange,
  formatMoney,
  formatNightly,
  formatNights,
  TAX_LABEL,
  quoteFor,
  type Booking,
} from "@/lib/booking";
import { siteConfig } from "@/lib/site-config";
import type { Stay } from "@/lib/stays";
import { waNumber } from "@/lib/whatsapp";

import { BookingControls } from "./booking-controls";
import { Icon } from "./icon";
import { Stars } from "./stars";

function getHostContact(stay: Stay) {
  const rawPhone = stay.phone && stay.phone.toLowerCase() !== "not provided" ? stay.phone.trim() : "";
  const effectivePhone =
    rawPhone ||
    siteConfig.supportPhone?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() ||
    "919239842574";

  const cleanPhone = waNumber(effectivePhone);
  const email = stay.email?.trim() || siteConfig.supportEmail || "bookings@staycabs.in";

  // Initials from stay name (e.g. "Tirtharaj Homestay" -> "TH")
  const initials =
    stay.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "SH";

  return { rawPhone, effectivePhone, cleanPhone, email, initials, hasDirectPhone: Boolean(rawPhone) };
}

export function BookingCard({ stay, booking }: { stay: Stay; booking: Booking }) {
  const quote = quoteFor(stay.price, booking);
  const host = getHostContact(stay);

  const waInquiryMessage = `Hello! I would like to inquire about booking ${stay.name} for ${booking.nights} night${booking.nights > 1 ? "s" : ""} (${booking.checkIn} to ${booking.checkOut}) for ${booking.guests} guest${booking.guests > 1 ? "s" : ""}. Please let me know room availability and price.`;
  const waInquiryUrl = `https://wa.me/${host.cleanPhone}?text=${encodeURIComponent(waInquiryMessage)}`;

  const waQuestionMessage = `Hello! I have a question about staying at ${stay.name} (${booking.nights} night${booking.nights > 1 ? "s" : ""}, ${booking.checkIn} to ${booking.checkOut}, ${booking.guests} guest${booking.guests > 1 ? "s" : ""}). Could you please assist me?`;
  const waQuestionUrl = `https://wa.me/${host.cleanPhone}?text=${encodeURIComponent(waQuestionMessage)}`;

  const callUrl = `tel:${host.effectivePhone.replace(/\s+/g, "")}`;

  return (
    <aside className="order-last lg:order-last lg:col-span-4 lg:sticky lg:top-24 self-start">
      <div className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-6 sticky-card-elevation">
        {/* Header: Nightly rate or Price on Request */}
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-outline-variant/30 pb-4">
          <div>
            <span className="font-display text-headline-lg font-bold text-primary">
              {formatNightly(stay.price)}
            </span>
            {stay.price > 0 ? (
              <span className="ml-1 text-body-sm text-on-surface-variant">/ night</span>
            ) : null}
          </div>
          <Stars rating={stay.rating} count={stay.reviewCount} />
        </div>

        {/* Date & Guest Selectors */}
        <BookingControls slug={stay.slug} booking={booking} maxGuests={stay.maxGuests} />

        {stay.price > 0 ? (
          /* =======================================================
             CASE 1: ONLINE INSTANT RESERVATION AVAILABLE
             ======================================================= */
          <>
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
              className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-container py-3.5 text-label-md text-on-primary shadow-md transition-all duration-200 hover:bg-primary hover:shadow-lg tap-spring active:scale-95"
            >
              <span>Reserve Your Stay</span>
              <Icon
                name="arrow_forward"
                className="text-sm transition-transform group-hover:translate-x-0.5"
              />
            </Link>

            <div className="mt-4 space-y-1.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-label-sm text-on-surface-variant">
                <Icon name="lock" className="text-sm text-secondary" />
                <span>No payment charged yet</span>
              </div>
              <p className="text-[11px] leading-tight text-outline">
                Free cancellation up to 7 days before check-in • Best direct rate
              </p>
            </div>

            {/* Have questions for the hosts? (Tactile & Connected) */}
            <div className="mt-5 rounded-xl border border-outline-variant/40 bg-surface-container-low/70 p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                  {host.initials}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-surface" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-primary truncate">
                    Have questions about {stay.name}?
                  </p>
                  <p className="text-[11px] text-outline flex items-center gap-1">
                    <Icon name="bolt" className="text-[11px] text-secondary" />
                    <span>Verified Host • Usually replies in &le; 1 hr</span>
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <a
                  href={waQuestionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white py-2 px-3 text-xs font-semibold shadow-2xs tap-spring active:scale-95 transition-all"
                >
                  <Icon name="chat" className="text-[14px]" />
                  <span>Chat on WhatsApp</span>
                </a>
                <a
                  href={callUrl}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface tap-spring active:scale-95 transition-all"
                >
                  <Icon name="call" className="text-[14px] text-primary" />
                  <span>Call</span>
                </a>
              </div>
            </div>
          </>
        ) : (
          /* =======================================================
             CASE 2: DIRECT HOST PRICING (PRICE ON REQUEST / ASK OWNER)
             ======================================================= */
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low/70 p-4 text-left">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
                <Icon name="handshake" className="text-[16px] text-secondary" />
                <span>Direct Host Booking</span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                This host provides custom rates tailored to your travel dates, room choices, and meal preferences. Connect directly with the owner to check availability and lock in your rate.
              </p>
            </div>

            <div className="space-y-2.5">
              <a
                href={waInquiryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 py-3.5 text-xs sm:text-label-md font-bold text-white shadow-md tap-spring active:scale-95 transition-all"
              >
                <Icon name="chat" className="text-base" />
                <span>Inquire on WhatsApp</span>
              </a>

              <a
                href={callUrl}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container py-3 text-xs sm:text-label-md font-semibold text-on-surface tap-spring active:scale-95 transition-all"
              >
                <Icon name="call" className="text-base text-primary" />
                <span>Call Host Directly</span>
              </a>

              {host.email ? (
                <a
                  href={`mailto:${host.email}?subject=${encodeURIComponent(`Stay Inquiry: ${stay.name} (${booking.checkIn} to ${booking.checkOut})`)}`}
                  className="block text-center text-[11px] text-outline hover:text-primary transition-colors py-1"
                >
                  Or email {host.email}
                </a>
              ) : null}
            </div>

            <div className="border-t border-outline-variant/30 pt-3 text-center">
              <p className="text-[11px] text-outline flex items-center justify-center gap-1.5">
                <Icon name="verified_user" className="text-[13px] text-emerald-600" />
                <span>Verified Local Host • Zero Commission Markup</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
