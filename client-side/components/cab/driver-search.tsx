"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DriverCard } from "@/components/cab/driver-card";
import { Icon } from "@/components/icon";
import { cabHref, seatLabel, type CabDriver, type CabRequest } from "@/lib/cabs";

const SEARCH_MS = 1400;

function DriverSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border border-outline-variant/50 bg-surface-container-lowest"
    >
      <div className="flex items-start gap-4 p-5">
        <span className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-surface-container-high" />
        <div className="flex-1 space-y-2.5">
          <div className="h-5 w-40 animate-pulse rounded bg-surface-container-high" />
          <div className="h-4 w-28 animate-pulse rounded bg-surface-container-high" />
          <div className="h-4 w-56 animate-pulse rounded bg-surface-container-high" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px border-y border-outline-variant/40 bg-outline-variant/40 sm:grid-cols-4">
        {[0, 1, 2, 3].map((slot) => (
          <div key={slot} className="space-y-2 bg-surface-container-lowest px-4 py-3">
            <div className="h-3 w-14 animate-pulse rounded bg-surface-container-high" />
            <div className="h-5 w-20 animate-pulse rounded bg-surface-container-high" />
          </div>
        ))}
      </div>
      <div className="p-5">
        <div className="ml-auto h-12 w-36 animate-pulse rounded-xl bg-surface-container-high" />
      </div>
    </div>
  );
}

/**
 * Holds the "Finding drivers nearby…" beat before revealing the matches the
 * server already resolved, so the search reads as a real lookup.
 */
export function DriverSearch({
  request,
  matches,
}: {
  request: CabRequest;
  matches: CabDriver[];
}) {
  const [searching, setSearching] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setSearching(false), SEARCH_MS);

    return () => clearTimeout(timer);
  }, []);

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-8 text-center sunlit-card-shadow">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-primary">
          <Icon name="no_transfer" className="text-2xl" />
        </span>
        <h2 className="mt-4 font-display text-headline-sm font-semibold text-primary">
          No {seatLabel(request.seats).toLowerCase()}s free right now
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-body-sm text-on-surface-variant">
          Every estate driver is already on a run for that window. Try a smaller class, or
          call the hosts and we will arrange a private transfer.
        </p>
        <Link
          href={cabHref(request)}
          className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary-container px-6 text-label-md font-semibold text-on-primary transition-colors hover:bg-primary"
        >
          <Icon name="swap_horiz" className="text-sm" />
          Change seat capacity
        </Link>
      </div>
    );
  }

  return (
    <section aria-label="Available drivers" aria-busy={searching}>
      <div aria-live="polite" className="sr-only">
        {searching
          ? "Finding drivers nearby."
          : `${matches.length} drivers available for your trip.`}
      </div>

      <div className="mb-4 flex items-center gap-2 text-title-md font-semibold text-primary">
        {searching ? (
          <>
            <Icon name="progress_activity" className="animate-spin text-primary" />
            <span>Finding drivers nearby…</span>
          </>
        ) : (
          <>
            <Icon name="check_circle" className="text-primary" />
            <span>
              {matches.length} drivers for this trip
            </span>
          </>
        )}
      </div>

      <div className="space-y-4">
        {searching
          ? [0, 1, 2].map((slot) => <DriverSkeleton key={slot} />)
          : matches.map((driver) => (
              <DriverCard key={driver.id} driver={driver} request={request} />
            ))}
      </div>
    </section>
  );
}
