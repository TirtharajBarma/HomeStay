import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CabProgress } from "@/components/cab/cab-header";
import { TripSummary } from "@/components/cab/trip-summary";
import { Icon } from "@/components/icon";
import { Stars } from "@/components/stars";
import {
  cabReference,
  driversHref,
  findNearbyDrivers,
  formatEta,
  formatFare,
  readCabRequest,
} from "@/lib/cabs";

export const metadata: Metadata = {
  title: "Cab Booked",
  description: "Your Meadowfall estate transfer is confirmed.",
};

export default async function CabConfirmedPage({
  searchParams,
}: PageProps<"/cab/confirmed">) {
  const query = await searchParams;
  const request = readCabRequest(query);
  const driverId = typeof query.driver === "string" ? query.driver : "";

  // A confirmation without a real match is not a confirmation.
  if (!request) redirect("/cab");

  const driver = findNearbyDrivers(request).find((match) => match.id === driverId);
  if (!driver) redirect(driversHref(request));

  const reference = cabReference(request, driver.id);

  return (
    <>
      <CabProgress step={3} />
      <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed/50 text-primary">
            <Icon name="check_circle" className="text-4xl" />
          </span>
          <p className="mt-4 text-label-md font-semibold uppercase tracking-wider text-primary">
            Booking {reference}
          </p>
          <h1 className="mt-1 font-display text-headline-lg-mobile font-semibold text-primary md:text-headline-lg">
            Your Cab Is Booked
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-body-lg text-on-surface-variant">
            {driver.name} will meet you at your pickup point. We have sent the details to your
            confirmation email.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-4 lg:col-span-7">
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 sunlit-card-shadow sm:p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-fixed/50 font-display text-headline-md font-semibold text-primary">
                  {driver.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-headline-sm font-semibold text-primary">
                    {driver.name}
                  </h2>
                  <Stars rating={driver.rating} count={driver.reviews} />
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
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-outline-variant/40 bg-outline-variant/40 min-[360px]:grid-cols-2 sm:grid-cols-3">
                <div className="bg-surface-container-lowest px-4 py-3.5">
                  <dt className="text-label-sm uppercase tracking-wider text-outline">
                    Driver reaches you
                  </dt>
                  <dd className="text-title-md font-semibold text-primary">
                    {formatEta(driver.etaMinutes)}
                  </dd>
                </div>
                <div className="bg-surface-container-lowest px-4 py-3.5">
                  <dt className="text-label-sm uppercase tracking-wider text-outline">
                    Vehicle
                  </dt>
                  <dd className="text-title-md font-semibold text-primary">
                    {driver.seats} seats
                  </dd>
                </div>
                <div className="col-span-2 bg-surface-container-lowest px-4 py-3.5 sm:col-span-1">
                  <dt className="text-label-sm uppercase tracking-wider text-outline">
                    Fare paid
                  </dt>
                  <dd className="text-title-md font-semibold text-primary">
                    {formatFare(driver.fare)}
                  </dd>
                </div>
              </dl>

              <p className="mt-4 flex items-start gap-2 text-body-sm text-on-surface-variant">
                <Icon name="info" className="mt-0.5 shrink-0 text-base text-primary" />
                <span>
                  Your driver waits 15 minutes at the pickup point. Quote reference{" "}
                  <span className="font-semibold text-primary">{reference}</span> when you
                  meet them.
                </span>
              </p>
            </div>
          </div>

          <aside className="min-w-0 space-y-4 lg:col-span-5">
            <TripSummary request={request} />
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/"
                className="group flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary-container px-5 text-label-md font-semibold text-on-primary transition-colors hover:bg-primary"
              >
                <span>Back to Meadowfall</span>
                <Icon
                  name="arrow_forward"
                  className="text-sm transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/cab"
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-outline-variant/60 px-5 text-label-md font-semibold text-primary transition-colors hover:bg-surface-container"
              >
                <Icon name="add" className="text-sm" />
                Book another transfer
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
