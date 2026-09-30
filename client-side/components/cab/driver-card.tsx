import Link from "next/link";

import { Icon } from "@/components/icon";
import { Stars } from "@/components/stars";
import {
  confirmedHref,
  formatDistance,
  formatEta,
  formatFare,
  type CabDriver,
  type CabRequest,
} from "@/lib/cabs";

export function DriverCard({
  driver,
  request,
}: {
  driver: CabDriver;
  request: CabRequest;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest sunlit-card-shadow">
      <div className="flex items-start gap-4 p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-fixed/50 font-display text-headline-sm font-semibold text-primary">
          {driver.name
            .split(" ")
            .map((part) => part[0])
            .join("")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="font-display text-headline-sm font-semibold text-primary">
              {driver.name}
            </h3>
            {driver.rating >= 4.9 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed/40 px-2 py-0.5 text-label-sm font-medium text-primary">
                <Icon name="verified" filled className="text-sm" />
                Top Rated
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <Stars rating={driver.rating} count={driver.reviews} />
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="directions_car" className="text-base text-primary" />
              {driver.vehicle}
            </span>
            <span aria-hidden="true">•</span>
            <span>{driver.colour}</span>
            <span aria-hidden="true">•</span>
            <span className="font-medium text-on-surface">{driver.plate}</span>
          </p>

          <p className="mt-2 text-body-sm text-on-surface-variant">{driver.note}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-px border-y border-outline-variant/40 bg-outline-variant/40 min-[360px]:grid-cols-2 sm:grid-cols-4">
        <div className="bg-surface-container-lowest px-4 py-3">
          <dt className="text-label-sm uppercase tracking-wider text-outline">Arrives</dt>
          <dd className="text-title-md font-semibold text-primary">
            {formatEta(driver.etaMinutes)}
          </dd>
        </div>
        <div className="bg-surface-container-lowest px-4 py-3">
          <dt className="text-label-sm uppercase tracking-wider text-outline">Seats</dt>
          <dd className="text-title-md font-semibold text-primary">{driver.seats}</dd>
        </div>
        <div className="bg-surface-container-lowest px-4 py-3">
          <dt className="text-label-sm uppercase tracking-wider text-outline">Luggage</dt>
          <dd className="text-title-md font-semibold text-primary">{driver.luggage} cases</dd>
        </div>
        <div className="bg-surface-container-lowest px-4 py-3">
          <dt className="text-label-sm uppercase tracking-wider text-outline">Est. Fare</dt>
          <dd className="text-title-md font-semibold text-primary">{formatFare(driver.fare)}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-label-sm text-outline">
          {driver.languages} • {formatDistance(driver.distanceKm)} • Cash or UPI on arrival
        </p>
        <Link
          href={confirmedHref(request, driver.id)}
          className="group flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-container px-6 text-label-md font-semibold text-on-primary transition-all duration-200 hover:bg-primary active:scale-[0.99]"
        >
          <span>Book Now</span>
          <Icon
            name="arrow_forward"
            className="text-sm transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </article>
  );
}
