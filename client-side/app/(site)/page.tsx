import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { GuestNotes } from "@/components/guest-notes";
import { Icon } from "@/components/icon";
import { StayCard } from "@/components/stay-card";
import { StayFilters } from "@/components/stay-filters";
import { StaySearch } from "@/components/stay-search";
import {
  formatDateRange,
  homeHref,
  readFilters,
  resolveBooking,
  type Booking,
  type Filters,
} from "@/lib/booking";
import {
  estateStory,
  experiences,
  hosts,
  valueBadges,
} from "@/lib/content";
import { estateImages, kindFilters, getLiveStays, type Stay } from "@/lib/stays";

export const metadata: Metadata = {
  description:
    "Handcrafted hillside cottages, tea terraces and verified door-to-door hill transfers across Darjeeling & Sikkim.",
};

const MAX_GUESTS = 4;

function filterStays(list: Stay[], filters: Filters) {
  return list.filter((stay) => {
    if (filters.kind !== "all" && stay.kind !== filters.kind) return false;
    if (filters.petFriendly && !stay.petFriendly) return false;
    return true;
  });
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const booking = resolveBooking(params, MAX_GUESTS);
  const filters = readFilters(params);
  const { stays: allStays, error: staysError } = await getLiveStays();
  const visible = filterStays(allStays, filters);

  return (
    <div className="w-full">
      {/* Hero with integrated availability search */}
      <section className="border-b border-outline-variant/60 bg-surface pt-8 pb-10 md:pt-16 md:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto mb-8 max-w-3xl text-center md:mb-12">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-outline-variant/70 bg-surface-container-low px-2.5 py-1 text-label-sm text-on-surface-variant">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>2,042m · Darjeeling &amp; Sikkim Himalayas</span>
            </div>
            <h1 className="mb-3 font-display text-2xl sm:text-3xl md:text-display font-medium tracking-tight text-primary">
              Himalayan homestays &amp; mountain transfers
            </h1>
            <p className="mx-auto max-w-2xl text-body-sm sm:text-body-md text-on-surface-variant leading-relaxed">
              Verified hillside cottages, working tea retreats, and door-to-door 4WD mountain cabs hosted by local Himalayan families.
            </p>
          </div>

          <div className="mx-auto max-w-5xl" id="search-bar">
            <StaySearch booking={booking} filters={filters} maxGuests={MAX_GUESTS} />

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-label-sm text-outline">
              {valueBadges.map((badge) => (
                <div key={badge.label} className="inline-flex items-center gap-1.5">
                  <Icon name={badge.icon} className="text-base text-primary shrink-0" />
                  <span>{badge.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stay catalogue */}
      <main
        className="mx-auto w-full max-w-7xl flex-1 scroll-mt-20 px-4 sm:px-6 py-8 md:py-14"
        id="accommodations"
      >
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-outline-variant/50 pb-5 md:mb-10 md:gap-6 md:pb-6 md:flex-row md:items-end">
          <div>
            <div className="mb-1 text-label-sm font-medium text-outline">
              Valley accommodations
            </div>
            <h2 className="font-display text-xl sm:text-2xl md:text-headline-lg font-medium text-primary">
              Homestay rooms &amp; tea retreats
            </h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Each room styled with raw timber, natural linen, and views across the valley.
            </p>
          </div>
          <StayFilters booking={booking} filters={filters} matching={visible.length} stays={allStays} />
        </div>

        {staysError ? (
          <div
            role="alert"
            className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-8 md:p-12 text-center"
          >
            <Icon name="cloud_off" className="mb-3 text-[32px] text-outline" />
            <h3 className="mb-1 font-display text-headline-sm text-primary">Stays are unavailable right now</h3>
            <p className="text-body-md text-on-surface-variant">{staysError}</p>
          </div>
        ) : allStays.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-8 md:p-12 text-center">
            <Icon name="cottage" className="mb-3 text-[32px] text-outline" />
            <h3 className="mb-1 font-display text-headline-sm text-primary">No stays are listed yet</h3>
            <p className="text-body-md text-on-surface-variant">Please check back soon.</p>
          </div>
        ) : visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((stay) => (
              <StayCard key={stay.slug} stay={stay} booking={booking} />
            ))}
          </div>
        ) : (
          <EmptyResults booking={booking} filters={filters} />
        )}
      </main>

      <Experiences />
      <GuestNotes />
      <EstateStory booking={booking} />
    </div>
  );
}

function EmptyResults({ booking, filters }: { booking: Booking; filters: Filters }) {
  const active = [
    kindFilters.find((filter) => filter.kind === filters.kind)?.label,
    filters.petFriendly ? "Pet-friendly" : null,
  ].filter((label): label is string => Boolean(label && label !== "All Stays"));

  return (
    <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-12 text-center">
      <Icon name="search_off" className="mb-3 text-[28px] text-outline" />
      <h3 className="mb-1 font-display text-headline-sm font-medium text-primary">
        No stays match those filters
      </h3>
      <p className="mb-5 text-body-sm text-on-surface-variant">
        {active.length > 0 ? (
          <>
            Nothing matches {active.join(" + ")} for {formatDateRange(booking)} — try another accommodation type or clear filters.
          </>
        ) : (
          <>Nothing is available for {formatDateRange(booking)} right now — widen your dates to see all options.</>
        )}
      </p>
      <Link
        href={homeHref(booking)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-container"
      >
        <span>Show all stays</span>
        <Icon name="arrow_forward" className="text-[14px]" />
      </Link>
    </div>
  );
}

function Experiences() {
  return (
    <section
      id="experiences"
      className="border-y border-outline-variant/50 bg-surface-container-low py-12 md:py-18"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 max-w-3xl md:mb-12">
          <span className="text-label-sm font-medium text-outline">
            The homestay difference
          </span>
          <h2 className="mt-1 font-display text-xl sm:text-2xl md:text-headline-lg font-medium text-primary">
            What makes a mountain journey special
          </h2>
          <p className="mt-1.5 text-body-sm text-on-surface-variant">
            Connect directly with verified local homestay owners and regional hill drivers for an authentic Himalayan experience.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {experiences.map((experience) => (
            <div
              key={experience.title}
              className="flex flex-col justify-between rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-ambient"
            >
              <div>
                <div className="mb-3 text-outline">
                  <Icon name={experience.icon} className="text-2xl text-primary" />
                </div>
                <h3 className="mb-2 font-display text-base sm:text-headline-sm font-medium text-primary">
                  {experience.title}
                </h3>
                <p className="text-body-sm text-on-surface-variant leading-relaxed">
                  {experience.body}
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1.5 border-t border-outline-variant/40 pt-3 text-label-sm text-outline">
                <span>{experience.footnote.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EstateStory({ booking }: { booking: Booking }) {
  return (
    <section
      id="story"
      className="border-b border-outline-variant/50 bg-surface-container-lowest py-14 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-outline-variant/60 shadow-ambient">
              <Image
                src={estateImages.hostsInOrchard}
                alt="Scenic Himalayan mountain ranges and tea valleys of Darjeeling and Sikkim where StayCabs operates."
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
              <div className="absolute right-3 bottom-3 left-3 rounded-lg border border-outline-variant/60 bg-surface/95 p-3 text-center backdrop-blur-xs">
                <span className="font-display text-body-md font-medium text-primary">
                  {hosts.names}
                </span>
                <p className="text-label-sm text-outline">{hosts.since}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <span className="text-label-sm font-medium text-outline">
              Our valley mission
            </span>
            <h2 className="mt-1 mb-5 font-display text-headline-lg-mobile font-medium text-primary md:text-headline-lg">
              A quiet hill network built with patience and honest craft
            </h2>
            <div className="space-y-4 text-body-md leading-relaxed text-on-surface-variant">
              {estateStory.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
            <div
              className="mt-8 flex flex-wrap items-center gap-8 border-t border-outline-variant/40 pt-6"
              id="contact"
            >
              <div>
                <div className="text-label-sm text-outline">Valley inquiries</div>
                <a
                  href={`mailto:${hosts.email}`}
                  className="inline-flex min-h-9 items-center text-body-md font-medium text-primary hover:underline"
                >
                  {hosts.email}
                </a>
              </div>
              <div>
                <div className="text-label-sm text-outline">Valley location</div>
                <div className="text-body-md font-medium text-primary">{hosts.location}</div>
              </div>
              <Link
                href={`${homeHref(booking)}#search-bar`}
                className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-container"
              >
                <span>Check dates</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
