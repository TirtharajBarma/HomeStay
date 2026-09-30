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
import { estateImages, kindFilters, stays } from "@/lib/stays";

export const metadata: Metadata = {
  description:
    "Handcrafted hillside cottages, tea terraces and hearth retreats above Darjeeling, West Bengal — hosted by Anuradha & Tenzin.",
};

const MAX_GUESTS = 4;

function filterStays(filters: Filters) {
  return stays.filter((stay) => {
    if (filters.kind !== "all" && stay.kind !== filters.kind) return false;
    if (filters.petFriendly && !stay.petFriendly) return false;
    return true;
  });
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const booking = resolveBooking(params, MAX_GUESTS);
  const filters = readFilters(params);
  const visible = filterStays(filters);

  return (
    <div className="w-full">
      {/* Hero with integrated availability search */}
      <section className="border-b border-outline-variant/40 bg-gradient-to-b from-surface via-surface-container-low to-surface pt-12 pb-16 md:pt-16 md:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto mb-10 max-w-3xl text-center md:mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-high px-3 py-1 text-label-sm uppercase tracking-wider text-primary">
              <Icon name="cottage" className="text-[14px]" />
              <span>Darjeeling, West Bengal</span>
            </div>
            <h1 className="mb-4 font-display text-display-mobile font-semibold tracking-tight text-primary md:text-display">
              Restful Stays in Darjeeling
            </h1>
            <p className="mx-auto max-w-2xl text-body-lg text-on-surface-variant">
              Handcrafted hillside cottages, working tea terraces &amp; hearth retreats hosted by
              Eleanor &amp; Thomas.
            </p>
          </div>

          <div className="mx-auto max-w-5xl" id="search-bar">
            <StaySearch booking={booking} filters={filters} maxGuests={MAX_GUESTS} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-label-md text-on-surface-variant sm:gap-6">
            {valueBadges.map((badge) => (
              <span
                key={badge.label}
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-high/60 px-3.5 py-1.5"
              >
                <Icon
                  name={badge.icon}
                  className={
                    badge.icon === "fireplace" ? "text-[16px] text-secondary" : "text-[16px] text-primary"
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
        className="mx-auto w-full max-w-7xl flex-1 scroll-mt-24 px-4 sm:px-6 py-12"
        id="accommodations"
      >
        <div className="mb-10 flex flex-col justify-between gap-6 border-b border-outline-variant/30 pb-6 md:flex-row md:items-end">
          <div>
            <div className="mb-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
              Valley Accommodations
            </div>
            <h2 className="font-display text-headline-lg-mobile font-semibold text-primary md:text-headline-lg">
              Distinctive Homestay Rooms
            </h2>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Each room thoughtfully styled with raw timber, natural linen sheets, and artisan
              pottery.
            </p>
          </div>
          <StayFilters booking={booking} filters={filters} matching={visible.length} />
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
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
      className="border-y border-outline-variant/40 bg-surface-container-low py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12 max-w-3xl">
          <span className="text-label-sm font-semibold uppercase tracking-wider text-secondary">
            The Homestay Difference
          </span>
          <h2 className="mt-1 font-display text-headline-lg-mobile font-semibold text-primary md:text-headline-lg">
            What makes a stay at Meadowfall special
          </h2>
          <p className="mt-2 text-body-lg text-on-surface-variant">
            We operate intentionally with only six spaces, allowing Eleanor &amp; Thomas to nurture
            an atmosphere of unhurried luxury and genuine countryside warmth.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {experiences.map((experience) => (
            <div
              key={experience.title}
              className="flex flex-col justify-between rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-8 sunlit-card-shadow"
            >
              <div>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                  <Icon name={experience.icon} className="text-[26px]" />
                </div>
                <h3 className="mb-3 font-display text-headline-sm font-semibold text-primary">
                  {experience.title}
                </h3>
                <p className="text-body-md text-on-surface-variant">{experience.body}</p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 border-t border-outline-variant/30 pt-6 text-label-sm text-outline">
                <Icon
                  name={experience.footnote.icon}
                  className={
                    experience.footnote.icon === "fireplace"
                      ? "text-[15px] text-secondary"
                      : "text-[15px] text-primary"
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
  return (
    <section className="border-b border-outline-variant/40 bg-surface py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="mb-2 inline-flex items-center gap-1 text-secondary">
            {Array.from({ length: 5 }, (_, index) => (
              <Icon key={index} name="star" filled className="text-[18px]" />
            ))}
          </div>
          <h2 className="font-display text-headline-md font-semibold text-primary">
            Voices from the Valley
          </h2>
          <p className="text-body-sm text-on-surface-variant">
            Reflections from travellers who found respite at Meadowfall.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <figure
              key={testimonial.name}
              className="flex flex-col justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 sunlit-card-shadow"
            >
              <blockquote className="mb-4 text-body-md italic leading-relaxed text-on-surface">
                “{testimonial.quote}”
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-title-md font-bold text-primary">
                  {testimonial.initials}
                </span>
                <span>
                  <span className="block text-title-md text-body-md font-semibold text-primary">
                    {testimonial.name}
                  </span>
                  <span className="block text-label-sm text-outline">{testimonial.stay}</span>
                </span>
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
