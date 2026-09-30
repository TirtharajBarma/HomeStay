import Link from "next/link";

import { Icon } from "@/components/icon";
import {
  cabHref,
  formatCabTime,
  formatDistance,
  seatLabel,
  tripDistance,
  type CabRequest,
} from "@/lib/cabs";
import { formatDate } from "@/lib/booking";

/** Read-only recap of the trip, shown on the driver and confirmation steps. */
export function TripSummary({ request }: { request: CabRequest }) {
  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 sunlit-card-shadow">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-headline-sm font-semibold text-primary">
          Your Trip
        </h2>
        <Link
          href={cabHref(request)}
          className="inline-flex min-h-11 items-center gap-1 text-label-sm text-primary hover:underline"
        >
          <Icon name="edit" className="text-sm" />
          Edit
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-3">
          <Icon name="my_location" className="mt-0.5 text-lg text-primary" />
          <div className="min-w-0">
            <p className="text-label-sm uppercase tracking-wider text-outline">Pickup</p>
            <p className="text-body-md font-medium text-on-surface">{request.source.label}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Icon name="location_on" className="mt-0.5 text-lg text-primary" />
          <div className="min-w-0">
            <p className="text-label-sm uppercase tracking-wider text-outline">Destination</p>
            <p className="text-body-md font-medium text-on-surface">{request.destination.label}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-outline-variant/40 pt-4 text-body-sm text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="calendar_month" className="text-base text-primary" />
          {formatDate(request.date)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="straighten" className="text-base text-primary" />
          {formatDistance(tripDistance(request))}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="schedule" className="text-base text-primary" />
          {formatCabTime(request.time)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="airline_seat_recline_normal" className="text-base text-primary" />
          {seatLabel(request.seats)}
        </span>
      </div>
    </div>
  );
}
