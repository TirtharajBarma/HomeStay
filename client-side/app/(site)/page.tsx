import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

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
  testimonials,
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
      <section className="border-b border-outline-variant/40 bg-gradient-to-b from-surface via-surface-container-low to-surface pt-6 pb-8 md:pt-16 md:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto mb-6 max-w-3xl text-center md:mb-12">
            <div className="mb-4 sm:mb-6 inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-high px-3.5 py-1.5 text-[11px] md:text-label-sm uppercase tracking-wider text-primary shadow-2xs">
              <Icon name="cottage" className="text-[13px] md:text-[14px]" />
              <span>Darjeeling, West Bengal</span>
            </div>
            <h1 className="mb-3 sm:mb-5 font-display text-2xl sm:text-3xl md:text-display font-semibold tracking-tight text-primary">
              Restful Stays &amp; Transit in the Hills
            </h1>
            <p className="mx-auto max-w-2xl text-xs sm:text-body-md md:text-body-lg text-on-surface-variant leading-relaxed">
              Handcrafted mountain cottages, working tea retreats &amp; verified door-to-door cab transfers hosted by local Himalayan families.
            </p>
          </div>

          <div className="mx-auto max-w-5xl" id="search-bar">
            <StaySearch booking={booking} filters={filters} maxGuests={MAX_GUESTS} />
          </div>

          <div className="mt-4 md:mt-6 flex flex-wrap items-center justify-center gap-2 text-xs md:text-label-md text-on-surface-variant sm:gap-6">
            {valueBadges.map((badge) => (
              <span
                key={badge.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-high/60 px-2.5 py-1 md:px-3.5 md:py-1.5"
              >
                <Icon
                  name={badge.icon}
                  className={
                    badge.icon === "fireplace" ? "text-[14px] md:text-[16px] text-secondary" : "text-[14px] md:text-[16px] text-primary"
                  }
                />
                <span>{badge.label}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Stay catalogue */}
      <main
        className="mx-auto w-full max-w-7xl flex-1 scroll-mt-24 px-4 sm:px-6 py-6 md:py-12"
        id="accommodations"
      >
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-outline-variant/30 pb-4 md:mb-10 md:gap-6 md:pb-6 md:flex-row md:items-end">
          <div>
            <div className="mb-0.5 text-[11px] md:text-label-sm font-semibold uppercase tracking-wider text-secondary">
              Valley Accommodations
            </div>
            <h2 className="font-display text-xl sm:text-2xl md:text-headline-lg font-semibold text-primary">
              Distinctive Homestay Rooms
            </h2>
            <p className="mt-0.5 text-xs sm:text-body-md text-on-surface-variant">
              Each room thoughtfully styled with raw timber, natural linen sheets, and artisan pottery.
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
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((stay) => (
              <StayCard key={stay.slug} stay={stay} booking={booking} />
            ))}
          </div>
        ) : (
          <EmptyResults booking={booking} filters={filters} />
        )}
      </main>

      <Experiences />
      <Testimonials />
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
      <Icon name="search_off" className="mb-3 text-[32px] text-outline" />
      <h3 className="mb-1 font-display text-headline-sm text-primary">
        No stays match those filters
      </h3>
      <p className="mb-5 text-body-sm text-on-surface-variant">
        {active.length > 0 ? (
          <>
            Nothing matches {active.join(" + ")} for {formatDateRange(booking)} — try another
            shelter type, or clear the pet-friendly filter to see all six spaces.
          </>
        ) : (
          <>Nothing is available for {formatDateRange(booking)} right now — widen your dates to see all six spaces.</>
        )}
      </p>
      <Link
        href={homeHref(booking)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-label-md text-on-primary transition-colors hover:bg-primary-container"
      >
        Show all stays
        <Icon name="arrow_forward" className="text-[16px]" />
      </Link>
    </div>
  );
}

function Experiences() {
  return (
    <section
      id="experiences"
      className="border-y border-outline-variant/40 bg-surface-container-low py-10 md:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-6 md:mb-12 max-w-3xl">
          <span className="text-[11px] md:text-label-sm font-semibold uppercase tracking-wider text-secondary">
            The Homestay Difference
          </span>
          <h2 className="mt-1 font-display text-xl sm:text-2xl md:text-headline-lg font-semibold text-primary">
            What makes a mountain journey special
          </h2>
          <p className="mt-1.5 text-xs sm:text-body-md text-on-surface-variant">
            Connect directly with verified local homestay owners and regional hill drivers for an authentic, unhurried Himalayan experience.
          </p>
        </div>

        {/* Mobile Horizontal Snap Carousel / Desktop 3-Column Grid */}
        <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 flex flex-nowrap overflow-x-auto gap-4 no-scrollbar snap-x snap-mandatory md:grid md:grid-cols-3 md:gap-8 pb-2">
          {experiences.map((experience) => (
            <div
              key={experience.title}
              className="min-w-[82vw] xs:min-w-[72vw] sm:min-w-[320px] md:min-w-0 snap-center flex flex-col justify-between rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-5 sm:p-7 sunlit-card-shadow"
            >
              <div>
                <div className="mb-4 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
                  <Icon name={experience.icon} className="text-xl sm:text-[26px]" />
                </div>
                <h3 className="mb-2 font-display text-base sm:text-headline-sm font-semibold text-primary">
                  {experience.title}
                </h3>
                <p className="text-xs sm:text-body-md text-on-surface-variant leading-relaxed">{experience.body}</p>
              </div>
              <div className="mt-4 flex items-center gap-1.5 border-t border-outline-variant/30 pt-3 text-[11px] sm:text-label-sm text-outline">
                <Icon
                  name={experience.footnote.icon}
                  className={
                    experience.footnote.icon === "fireplace"
                      ? "text-[14px] text-secondary"
                      : "text-[14px] text-primary"
                  }
                />
                {experience.footnote.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const loop = [...testimonials, ...testimonials, ...testimonials, ...testimonials];
  return (
    <section className="border-b border-outline-variant/40 bg-surface py-10 md:py-16 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 mb-6 md:mb-10 text-center">
        <div className="mb-2 inline-flex items-center gap-1 text-secondary">
          {Array.from({ length: 5 }, (_, index) => (
            <Icon key={index} name="star" filled className="text-[16px] md:text-[18px]" />
          ))}
        </div>
        <h2 className="font-display text-xl sm:text-2xl md:text-headline-md font-semibold text-primary">
          Voices from the Valley
        </h2>
        <p className="mt-1 text-xs sm:text-body-sm text-on-surface-variant">
          Reflections from travellers exploring the Himalayan foothills.
        </p>
      </div>

      {/* Continuous Water-Like Marquee Banner with Edge Fade */}
      <div className="relative w-full overflow-hidden">
        {/* Soft edge blur fades */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-10 sm:w-24 bg-gradient-to-r from-surface to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-10 sm:w-24 bg-gradient-to-l from-surface to-transparent" />

        <div className="animate-marquee-water flex gap-4 sm:gap-6 py-2 px-4 cursor-grab">
          {loop.map((testimonial, idx) => (
            <figure
              key={`${testimonial.name}-${idx}`}
              className="w-[280px] sm:w-[350px] shrink-0 flex flex-col justify-between rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 sm:p-6 sunlit-card-shadow transition-transform hover:scale-[1.02]"
            >
              <blockquote className="mb-4 text-xs sm:text-body-md italic leading-relaxed text-on-surface">
                “{testimonial.quote}”
              </blockquote>
              <figcaption className="flex items-center gap-3 border-t border-outline-variant/30 pt-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs sm:text-title-md font-bold text-primary">
                  {testimonial.initials}
                </span>
                <div>
                  <span className="block text-xs sm:text-body-md font-semibold text-primary">
                    {testimonial.name}
                  </span>
                  <span className="block text-[11px] sm:text-label-sm text-outline">{testimonial.stay}</span>
                </div>
              </figcaption>
            </figure>
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
      className="border-b border-outline-variant/40 bg-surface-container-lowest py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-outline-variant/50 sunlit-card-shadow">
              <Image
                src={estateImages.hostsInOrchard}
                alt={`${hosts.names} on the terrace above the Ging tea terraces.`}
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
              <div className="absolute right-4 bottom-4 left-4 rounded-xl border border-outline-variant/40 bg-surface/95 p-4 text-center backdrop-blur-md">
                <span className="font-display text-headline-sm font-semibold text-primary">
                  {hosts.names}
                </span>
                <p className="mt-0.5 text-label-sm text-outline">{hosts.since}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <span className="text-label-sm font-semibold uppercase tracking-wider text-secondary">
              Estate Story
            </span>
            <h2 className="mt-2 mb-6 font-display text-headline-lg-mobile font-semibold text-primary md:text-headline-lg">
              A quiet hill station built with patience and honest craft.
            </h2>
            <div className="space-y-4 text-body-md leading-relaxed text-on-surface-variant">
              {estateStory.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
            <div
              className="mt-8 flex flex-wrap items-center gap-8 border-t border-outline-variant/30 pt-8"
              id="contact"
            >
              <div>
                <div className="text-label-sm uppercase text-outline">Estate Inquiries</div>
                <a
                  href={`mailto:${hosts.email}`}
                  className="inline-flex min-h-11 items-center text-title-md font-semibold text-primary hover:underline"
                >
                  {hosts.email}
                </a>
              </div>
              <div>
                <div className="text-label-sm uppercase text-outline">Valley Location</div>
                <div className="text-title-md font-semibold text-primary">{hosts.location}</div>
              </div>
              <Link
                href={`${homeHref(booking)}#search-bar`}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-label-md text-on-primary transition-colors hover:bg-primary-container"
              >
                <span>Check Autumn Dates</span>
                <Icon name="arrow_forward" className="text-[16px]" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
