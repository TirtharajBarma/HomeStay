import Link from "next/link";

import { Icon } from "@/components/icon";
import {
  CAB_PLACES,
  ESTATE,
  cabHref,
  distanceKm,
  formatDistance,
  placeById,
} from "@/lib/cabs";

/** The four transfers guests actually book from the estate. */
const ROUTES = [
  { id: "bagdogra-airport", icon: "flight", time: "09:00" },
  { id: "darjeeling-station", icon: "train", time: "15:00" },
  { id: "kalimpong", icon: "landscape", time: "10:00" },
  { id: "tiger-hill", icon: "wb_twilight", time: "04:00" },
] as const;

const STEPS = [
  {
    icon: "pin_drop",
    title: "Say where you need to go",
    body: "Type a place, or open the map and drag the pin to your door. We price the real road distance.",
  },
  {
    icon: "groups",
    title: "We match you with a driver",
    body: "Only rated drivers who know the hill roads. One upfront fare in rupees, quoted before you confirm.",
  },
  {
    icon: "key",
    title: "Ride out from the gate",
    body: "Pay cash or UPI on arrival. Cancel free up to 12 hours before pickup, no questions.",
  },
] as const;

/**
 * Replaces the amenities, grounds and reviews blocks with the estate's own cab
 * step, so the page keeps one clear path: read the stay, then book the transfer.
 */
export function StayTransferSection({ checkIn }: { checkIn: string }) {
  return (
    <section className="space-y-6">
      <div className="border-b border-outline-variant/30 pb-3">
        <span className="text-label-md uppercase tracking-widest text-secondary">
          Estate Transfers
        </span>
        <h2 className="mt-1 font-display text-headline-md text-primary">
          A Car for Every Kind of Trip
        </h2>
        <p className="mt-2 max-w-prose text-body-md text-on-surface-variant">
          The road down from Darjeeling is not something to plan in advance. Book a cab in three
          steps, or set it up now and let the car wait at the gate on your arrival day.
        </p>
      </div>

      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="sunlit-card-shadow relative rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-fixed/50 font-display text-title-md font-semibold text-primary">
              {index + 1}
            </span>
            <h3 className="mt-3 flex items-center gap-2 text-title-md text-on-surface">
              <Icon name={step.icon} className="text-lg text-primary" />
              {step.title}
            </h3>
            <p className="mt-1.5 text-body-sm text-on-surface-variant">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="space-y-3">
        <p className="text-label-md uppercase tracking-widest text-outline">
          Common transfers · from {ESTATE.name.replace("Meadowfall ", "")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROUTES.map((route) => {
            const place = placeById(route.id);
            if (!place) return null;

            return (
              <Link
                key={route.id}
                href={cabHref({
                  source: { label: ESTATE.name, lat: ESTATE.lat, lng: ESTATE.lng },
                  destination: { label: place.name, lat: place.lat, lng: place.lng },
                  date: checkIn,
                  time: route.time,
                  seats: "4",
                })}
                className="group flex items-center gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 transition-colors duration-200 hover:border-primary/40 hover:bg-primary-fixed/20"
              >
                <Icon
                  name={route.icon}
                  className="shrink-0 text-xl text-primary transition-transform group-hover:-translate-y-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-md font-medium text-on-surface">
                    {place.name}
                  </span>
                  <span className="block truncate text-label-sm text-on-surface-variant/80">
                    {formatDistance(distanceKm(ESTATE, place))} · about{" "}
                    {Math.max(10, Math.round((distanceKm(ESTATE, place) / 25) * 60))} min
                  </span>
                </span>
                <Icon
                  name="arrow_forward"
                  className="shrink-0 text-base text-outline transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </Link>
            );
          })}
        </div>
        <p className="text-label-sm text-on-surface-variant/80">
          {CAB_PLACES.length - 1} places across Darjeeling, Kalimpong, Kurseong and the plains —
          or drop your own pin.
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 rounded-xl border border-primary/25 bg-primary-fixed/15 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-md text-on-surface">
          <span className="font-semibold text-primary">Cab booked separately.</span> Your
          stay and your car are two different reservations — change one without touching the
          other.
        </p>
        <Link
          href={cabHref({
            source: { label: ESTATE.name, lat: ESTATE.lat, lng: ESTATE.lng },
            destination: { label: "", lat: ESTATE.lat, lng: ESTATE.lng },
            date: checkIn,
            time: "09:00",
            seats: "4",
          })}
          className="group inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-primary-container px-6 text-label-md font-semibold text-on-primary transition-all duration-200 hover:bg-primary active:scale-[0.99]"
        >
          Book a cab from the estate
          <Icon
            name="arrow_forward"
            className="text-base transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </section>
  );
}
