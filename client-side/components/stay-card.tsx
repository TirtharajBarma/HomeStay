import Image from "next/image";
import Link from "next/link";

import { formatNightly, stayHref, type Booking } from "@/lib/booking";
import type { Stay } from "@/lib/stays";

import { Icon } from "./icon";

const badge =
  "flex items-center gap-1 rounded-full border border-outline-variant/30 bg-surface/90 px-1.5 py-0.5 md:px-2.5 md:py-1 text-[9px] sm:text-[10px] md:text-label-sm text-primary backdrop-blur-md shadow-2xs font-medium";

export function StayCard({ stay, booking }: { stay: Stay; booking: Booking }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl md:rounded-2xl border border-outline-variant/50 bg-surface-container-lowest sunlit-card-shadow sunlit-card-hover tap-spring focus-within:border-primary">
      {/* Photo Banner */}
      <div className="relative h-32 xs:h-36 sm:h-48 md:h-64 overflow-hidden bg-surface-container">
        <Image
          src={stay.image}
          alt={stay.imageAlt}
          fill
          sizes="(min-width: 1024px) 33vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 md:top-3 md:left-3 flex flex-wrap gap-1 sm:gap-1.5 md:gap-2">
          <span className={badge}>
            <Icon name="bolt" className="text-[10px] sm:text-[11px] md:text-[12px] text-secondary" />
            <span className="hidden xs:inline">Instant</span>
          </span>
          {stay.petFriendly ? (
            <span className="flex items-center gap-1 rounded-full bg-secondary-fixed px-1.5 py-0.5 sm:px-2 md:px-2.5 md:py-1 text-[9px] sm:text-[10px] md:text-label-sm text-on-secondary-fixed shadow-2xs font-medium">
              <Icon name="pets" className="text-[10px] sm:text-[11px] md:text-[12px]" />
              <span className="hidden xs:inline">Pet Friendly</span>
            </span>
          ) : null}
        </div>
        <div className="absolute right-1.5 bottom-1.5 sm:right-2.5 sm:bottom-2.5 md:right-3 md:bottom-3 rounded-md sm:rounded-lg md:rounded-xl bg-inverse-surface/85 px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-3 text-[10px] sm:text-xs md:text-title-md font-bold text-surface backdrop-blur-md shadow-xs">
          {formatNightly(stay.price)}{" "}
          {stay.price > 0 ? <span className="text-[9px] sm:text-[10px] md:text-body-sm font-normal text-surface-variant">/ nt</span> : null}
        </div>
      </div>

      {/* Card Details */}
      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-4 md:p-6">
        <div>
          <div className="mb-0.5 sm:mb-1 flex items-center justify-between gap-1 text-[9px] sm:text-[10px] md:text-label-sm font-semibold tracking-wider text-outline uppercase">
            <span className="truncate">{stay.wing}</span>
            <span className="flex shrink-0 items-center gap-0.5 sm:gap-1 text-on-surface-variant font-normal normal-case">
              <Icon name={stay.bedIcon} className="text-[11px] sm:text-[13px] md:text-[14px]" />
              <span className="truncate">{stay.occupancy}</span>
            </span>
          </div>
          <h3 className="mb-1 sm:mb-1.5 font-display text-xs xs:text-sm sm:text-base md:text-headline-sm font-semibold text-primary transition-colors duration-200 group-hover:text-secondary line-clamp-1">
            {stay.name}
          </h3>
          <p className="hidden sm:block mb-2 text-xs sm:text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed">
            {stay.blurb}
          </p>
          <div className="hidden xs:flex mb-2 sm:mb-3 md:mb-5 flex-wrap gap-1 md:gap-1.5 overflow-hidden max-h-5 sm:max-h-7 md:max-h-none">
            {stay.amenities.slice(0, 3).map((amenity) => (
              <span
                key={amenity}
                className="rounded-full bg-surface-container px-1.5 py-0.5 sm:px-2 md:px-2.5 md:py-1 text-[9px] sm:text-[10px] md:text-label-sm text-on-surface-variant whitespace-nowrap"
              >
                {amenity}
              </span>
            ))}
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 border-t border-outline-variant/30 pt-2 sm:pt-3 md:pt-4">
          <span className="hidden sm:flex items-center gap-1 text-[11px] md:text-label-sm font-medium text-primary truncate">
            {stay.highlight && (
              <>
                <Icon name={stay.highlight.icon} className="text-[12px] sm:text-[13px] md:text-[14px] shrink-0" />
                <span className="truncate">{stay.highlight.label}</span>
              </>
            )}
          </span>
          <span className="w-full sm:w-auto inline-flex shrink-0 items-center justify-center gap-1 rounded-md sm:rounded-lg md:rounded-xl bg-primary px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 text-[10px] sm:text-xs md:text-label-md font-semibold text-on-primary transition-all duration-200 group-hover:bg-primary-container group-active:scale-95 shadow-2xs">
            <span>Reserve</span>
            <Icon name="arrow_forward" className="text-[10px] sm:text-[12px] md:text-[15px]" />
          </span>
        </div>
      </div>

      <Link href={stayHref(stay.slug, booking)} className="absolute inset-0 rounded-xl md:rounded-2xl">
        <span className="sr-only">
          {stay.name} — {stay.kindLabel}, {stay.occupancy}, {stay.price > 0 ? `${formatNightly(stay.price)} per night` : formatNightly(stay.price)}.
          View room details and reserve.
        </span>
      </Link>
    </article>
  );
}
