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
    <aside className="order-last lg:order-last lg:col-span-4 lg:sticky lg:top-20 self-start">
      <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-ambient">
        {/* Header: Nightly rate or Price on Request */}
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-outline-variant/40 pb-4">
          <div>
            <span className="font-display text-headline-sm font-medium text-primary tabular-nums">
              {formatNightly(stay.price)}
            </span>
            {stay.price > 0 ? (
              <span className="ml-1 text-label-sm text-outline">/ night</span>
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
            <div className="mb-6 space-y-3 border-b border-outline-variant/40 pb-5 text-body-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>
                  {formatMoney(stay.price)} × {formatNights(quote.nights).toLowerCase()}
                </span>
                <span className="font-medium text-on-surface tabular-nums">{formatMoney(quote.roomTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Hill breakfast</span>
                <span className="font-medium text-primary">Included</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Estate cleaning &amp; linens</span>
                <span className="font-medium text-on-surface tabular-nums">{formatMoney(quote.cleaning)}</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>{TAX_LABEL}</span>
                <span className="font-medium text-on-surface tabular-nums">{formatMoney(quote.tax)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-outline-variant/40 pt-3 text-body-md font-medium text-primary">
                <span>Total</span>
                <span className="font-display text-headline-sm font-medium tabular-nums">
                  {formatMoney(quote.total)}
                </span>
              </div>
              <p className="text-label-sm text-outline tabular-nums">
                {formatDateRange(booking)} · {formatNights(quote.nights).toLowerCase()} · Free
                cancellation until {formatDate(cancellationDeadline(booking.checkIn))}
              </p>
            </div>

            <Link
              href={checkoutHref(stay.slug, booking)}
              className="flex min-h-11 w-full items-center justify-center rounded-lg bg-primary py-3 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-container"
            >
              <span>Reserve room</span>
            </Link>

            <div className="mt-3 text-center">
              <p className="text-label-sm text-outline">
                No payment charged yet · Free cancellation up to 7 days before
              </p>
            </div>

            {/* Have questions for the hosts? */}
            <div className="mt-5 rounded-lg border border-outline-variant/50 bg-surface-container-low p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-container text-label-sm font-medium text-primary">
                  {host.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-primary truncate">
                    Questions about {stay.name}?
                  </p>
                  <p className="text-label-sm text-outline truncate">
                    Verified host · Usually replies in &le; 1 hr
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <a
                  href={waQuestionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-surface-container hover:bg-surface-container-high text-primary py-2 px-3 text-label-sm font-medium border border-outline-variant/60 transition-colors"
                >
                  <Icon name="chat" className="text-[14px]" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={callUrl}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-outline-variant/60 bg-surface-container hover:bg-surface-container-high px-3 py-2 text-label-sm font-medium text-primary transition-colors"
                >
                  <Icon name="call" className="text-[14px]" />
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
            <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-4 text-left">
              <div className="flex items-center gap-2 text-primary font-medium text-body-sm mb-1">
                <Icon name="handshake" className="text-[16px] text-outline" />
                <span>Direct host booking</span>
              </div>
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                This host provides custom rates tailored to your travel dates and room choices. Connect directly with the owner to confirm rates.
              </p>
            </div>

            <div className="space-y-2">
              <a
                href={waInquiryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary hover:bg-primary-container py-3 text-label-md font-medium text-on-primary transition-colors"
              >
                <Icon name="chat" className="text-base" />
                <span>Inquire on WhatsApp</span>
              </a>

              <a
                href={callUrl}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-container hover:bg-surface-container-high py-2.5 text-label-md font-medium text-on-surface transition-colors"
              >
                <Icon name="call" className="text-base text-primary" />
                <span>Call host directly</span>
              </a>

              {host.email ? (
                <a
                  href={`mailto:${host.email}?subject=${encodeURIComponent(`Stay Inquiry: ${stay.name} (${booking.checkIn} to ${booking.checkOut})`)}`}
                  className="block text-center text-label-sm text-outline hover:text-primary transition-colors py-1"
                >
                  Or email {host.email}
                </a>
              ) : null}
            </div>

            <div className="border-t border-outline-variant/30 pt-3 text-center">
              <p className="text-label-sm text-outline">
                Verified local host · Direct reservation
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
