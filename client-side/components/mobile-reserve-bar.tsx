import Link from "next/link";

import {
  checkoutHref,
  formatMoney,
  formatNights,
  type Booking,
} from "@/lib/booking";
import type { Stay } from "@/lib/stays";

import { Icon } from "./icon";

/**
 * Phones have no room for a sticky sidebar, so the reserve action and running
 * total live in a bottom bar that only shows below the large breakpoint.
 */
export function MobileReserveBar({ stay, booking }: { stay: Stay; booking: Booking }) {
  return (
    <div className="sticky bottom-0 z-40 border-t border-outline-variant/40 bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md shadow-drawer lg:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-headline-sm font-semibold text-primary">
            {formatMoney(stay.price)}{" "}
            <span className="font-body text-body-sm font-normal text-on-surface-variant">
              / night
            </span>
          </p>
          <p className="truncate text-label-sm text-outline">
            {formatNights(booking.nights)} • {booking.guests} Adult
            {booking.guests === 1 ? "" : "s"} • {stay.occupancy}
          </p>
        </div>
        <Link
          href={checkoutHref(stay.slug, booking)}
          className="ml-auto flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-primary-container px-5 text-label-md text-on-primary shadow-md active:scale-[0.99]"
        >
          Reserve
          <Icon name="arrow_forward" className="text-base" />
        </Link>
      </div>
    </div>
  );
}
