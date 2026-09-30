import Image from "next/image";
import Link from "next/link";

import { formatMoney, stayHref, type Booking } from "@/lib/booking";
import type { Stay } from "@/lib/stays";

import { Icon } from "./icon";

const badge =
  "flex items-center gap-1 rounded-full border border-outline-variant/30 bg-surface/90 px-2.5 py-1 text-label-sm text-primary backdrop-blur-md shadow-sm";

export function StayCard({ stay, booking }: { stay: Stay; booking: Booking }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest sunlit-card-shadow sunlit-card-hover focus-within:border-primary">
      <div className="relative h-64 overflow-hidden bg-surface-container">
        <Image
          src={stay.image}
          alt={stay.imageAlt}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <span className={badge}>
            <Icon name="bolt" className="text-[12px] text-secondary" />
            Instant Confirmation
          </span>
          {stay.petFriendly ? (
            <span className="flex items-center gap-1 rounded-full bg-secondary-fixed px-2.5 py-1 text-label-sm text-on-secondary-fixed shadow-sm">
              <Icon name="pets" className="text-[12px]" />
              Pet Friendly
            </span>
          ) : null}
        </div>
        <div className="absolute right-3 bottom-3 rounded-lg bg-inverse-surface/85 px-3 py-1 text-title-md font-bold text-surface backdrop-blur-md">
          {formatMoney(stay.price)}{" "}
          <span className="text-body-sm font-normal text-surface-variant">/ night</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-6">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-label-sm text-outline">
            <span className="truncate">{stay.wing.toUpperCase()}</span>
            <span className="flex shrink-0 items-center gap-1 text-on-surface-variant">
              <Icon name={stay.bedIcon} className="text-[14px]" />
              {stay.occupancy}
            </span>
          </div>
          <h3 className="mb-2 font-display text-headline-sm font-semibold text-primary transition-colors duration-200 group-hover:text-secondary">
            {stay.name}
          </h3>
          <p className="mb-4 text-body-sm text-on-surface-variant">{stay.blurb}</p>
          <div className="mb-6 flex flex-wrap gap-1.5">
            {stay.amenities.map((amenity) => (
              <span
                key={amenity}
                className="rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant"
              >
                {amenity}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-4">
          <span className="flex items-center gap-1 text-label-sm font-medium text-primary">
            <Icon name={stay.highlight.icon} className="text-[14px]" />
            {stay.highlight.label}
          </span>
          <span className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-label-md text-on-primary transition-all duration-200 group-hover:bg-primary-container md:min-h-0">
            View Room &amp; Reserve
            <Icon name="arrow_forward" className="text-[15px]" />
          </span>
        </div>
      </div>

      <Link href={stayHref(stay.slug, booking)} className="absolute inset-0 rounded-xl">
        <span className="sr-only">
          {stay.name} — {stay.kindLabel}, {stay.occupancy}, {formatMoney(stay.price)} per night.
          View room details and reserve.
        </span>
      </Link>
    </article>
  );
}
