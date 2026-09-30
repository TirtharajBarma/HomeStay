import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CabProgress } from "@/components/cab/cab-header";
import { DriverSearch } from "@/components/cab/driver-search";
import { TripSummary } from "@/components/cab/trip-summary";
import { Icon } from "@/components/icon";
import { findNearbyDrivers, readCabRequest, seatLabel } from "@/lib/cabs";

export const metadata: Metadata = {
  title: "Available Drivers",
  description: "Compare verified estate drivers for your Meadowfall transfer.",
};

export default async function CabDriversPage({
  searchParams,
}: PageProps<"/cab/drivers">) {
  const query = await searchParams;
  const request = readCabRequest(query);

  // A half-finished search (bookmark, refresh without params) goes back to step 1.
  if (!request) redirect("/cab");

  const matches = findNearbyDrivers(request);

  return (
    <>
      <CabProgress step={2} />
      <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant"
        >
          <Link href="/cab" className="-mx-1 inline-flex min-h-11 items-center rounded px-1 hover:text-primary">
            Cab Booking
          </Link>
          <Icon name="chevron_right" className="text-xs" />
          <span className="font-medium text-primary">Drivers</span>
        </nav>

        <div className="max-w-2xl">
          <p className="text-label-md font-semibold uppercase tracking-wider text-primary">
            {seatLabel(request.seats)} transfer
          </p>
          <h1 className="mt-1 font-display text-headline-lg-mobile font-semibold text-primary md:text-headline-lg">
            Drivers Near You
          </h1>
          <p className="mt-2 text-body-lg text-on-surface-variant">
            Every driver below is cleared by the estate and rated by guests who stayed with
            us.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-12">
          <div className="min-w-0 space-y-4 lg:col-span-8">
            <DriverSearch request={request} matches={matches} />
          </div>

          <aside className="min-w-0 lg:col-span-4 lg:sticky lg:top-24">
            <TripSummary request={request} />
            <p className="mt-4 px-1 text-label-sm leading-relaxed text-outline">
              Fares are fixed at the time of booking. If your driver is delayed, the hosts
              will meet you at the gate at no extra cost.
            </p>
          </aside>
        </div>
      </main>
    </>
  );
}
