import Image from "next/image";
import Link from "next/link";

import { formatNightly, stayHref, type Booking } from "@/lib/booking";
import type { Stay } from "@/lib/stays";

import { Icon } from "./icon";

export function StayCard({ stay, booking }: { stay: Stay; booking: Booking }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest sunlit-card-shadow sunlit-card-hover focus-within:border-primary">
      {/* Photo Frame */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-container">
        <Image
          src={stay.image}
          alt={stay.imageAlt}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-opacity duration-300 group-hover:opacity-95"
        />
        {stay.petFriendly && (
          <div className="absolute top-2.5 left-2.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-surface/90 px-2 py-0.5 text-label-sm font-medium text-primary backdrop-blur-xs shadow-xs">
              <Icon name="pets" className="text-[12px] text-outline" />
              <span>Pet-friendly</span>
            </span>
          </div>
        )}
      </div>

      {/* Card Details */}
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2 text-label-sm text-outline">
            <span className="truncate">{stay.wing}</span>
            <span className="shrink-0 tabular-nums">{stay.occupancy}</span>
          </div>

          <h3 className="font-display text-base sm:text-headline-sm font-medium text-primary group-hover:text-primary-container transition-colors line-clamp-1">
            {stay.name}
          </h3>

          <p className="mt-1 text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed">
            {stay.blurb}
          </p>
        </div>

        {/* Pricing & Reservation Row */}
        <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-outline-variant/40 pt-3">
          <div>
            <span className="font-display text-base sm:text-title-md font-medium text-primary tabular-nums">
              {formatNightly(stay.price)}
            </span>
            {stay.price > 0 && (
              <span className="ml-1 text-label-sm text-outline">/ night</span>
            )}
          </div>

          <span className="inline-flex items-center text-label-sm font-medium text-primary transition-colors group-hover:text-primary-container">
            <span>View room</span>
            <Icon name="chevron_right" className="text-[14px]" />
          </span>
        </div>
      </div>

      <Link href={stayHref(stay.slug, booking)} className="absolute inset-0 rounded-xl">
        <span className="sr-only">
          {stay.name} — {stay.kindLabel}, {stay.occupancy}, {stay.price > 0 ? `${formatNightly(stay.price)} per night` : formatNightly(stay.price)}. View room details and reserve.
        </span>
      </Link>
    </article>
  );
}
