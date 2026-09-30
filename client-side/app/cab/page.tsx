import type { Metadata } from "next";
import Link from "next/link";

import { CabForm } from "@/components/cab/cab-form";
import { CabProgress } from "@/components/cab/cab-header";
import { Icon } from "@/components/icon";
import { readCabRequest } from "@/lib/cabs";

export const metadata: Metadata = {
  title: "Book a Cab",
  description:
    "Book a verified car anywhere in Darjeeling. Tap the map to drop your pin, get an upfront fare in rupees, and pay cash or UPI on arrival.",
};

const reassurance = [
  {
    icon: "verified_user",
    title: "Vetted estate drivers",
    detail: "Every driver is ID-checked and knows the hill roads from Phalut to Kalimpong.",
  },
  {
    icon: "payments",
    title: "Upfront fares in rupees",
    detail: "The fare you see is the fare you pay — no surge pricing.",
  },
  {
    icon: "event_available",
    title: "Free cancellation",
    detail: "Cancel up to 12 hours before pickup, no questions asked.",
  },
];

export default async function CabPage({ searchParams }: PageProps<"/cab">) {
  const query = await searchParams;
  const initial = readCabRequest(query);

  return (
    <>
      <CabProgress step={1} />
      <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-32 sm:px-6 sm:pt-8 lg:pb-16">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant"
        >
          <Link href="/" className="-mx-1 inline-flex min-h-11 items-center rounded px-1 hover:text-primary">
            Meadowfall Homestay
          </Link>
          <Icon name="chevron_right" className="text-xs" />
          <span className="font-medium text-primary">Cab Booking</span>
        </nav>

        <div className="max-w-2xl">
          <p className="text-label-md font-semibold uppercase tracking-wider text-primary">
            Car Transfers
          </p>
          <h1 className="mt-1 font-display text-headline-lg-mobile font-semibold text-primary md:text-headline-lg">
            Book Your Cab
          </h1>
          <p className="mt-2 text-body-lg text-on-surface-variant">
            Type a place or drop a pin on the map, exactly like an app cab. We price the
            distance and hand you a driver who knows the road.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-5 sm:p-6">
              <CabForm initial={initial} />
            </div>
          </div>

          <aside className="space-y-4 lg:col-span-5">
            {reassurance.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3.5"
              >
                <Icon name={item.icon} className="mt-0.5 text-lg text-primary" />
                <div className="min-w-0">
                  <p className="text-title-md font-semibold leading-tight text-primary">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-body-sm text-on-surface-variant">{item.detail}</p>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </main>
    </>
  );
}
