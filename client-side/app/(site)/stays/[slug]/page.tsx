import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingCard } from "@/components/booking-card";
import { Icon } from "@/components/icon";
import { MobileReserveBar } from "@/components/mobile-reserve-bar";
import { StayGallery } from "@/components/stay-gallery";
import { Stars } from "@/components/stars";
import { homeHref, resolveBooking, stayHref } from "@/lib/booking";
import {
  amenityGroups,
  breakfast,
  grounds,
  houseRules,
  hosts,
} from "@/lib/content";
import { getStay, getStaySlugs, stays } from "@/lib/stays";

export function generateStaticParams() {
  return getStaySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/stays/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const stay = getStay(slug);

  if (!stay) return { title: "Sanctuary not found" };

  return {
    title: stay.name,
    description: stay.intro,
  };
}

const reviewTones = {
  clay: "bg-secondary-fixed text-on-secondary-container",
  sage: "bg-primary-fixed text-on-primary-fixed",
  sand: "bg-tertiary-fixed text-on-tertiary-fixed",
} as const;

export default async function StayPage({ params, searchParams }: PageProps<"/stays/[slug]">) {
  const { slug } = await params;
  const stay = getStay(slug);

  if (!stay) notFound();

  const query = await searchParams;
  const booking = resolveBooking(query, stay.maxGuests);
  const sectionClass = "border-b border-outline-variant/30 pb-3";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-4 sm:px-6 sm:py-8">
      {/* Breadcrumb & page header */}
      <div className="mb-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-on-surface-variant"
        >
          <Link
            href={homeHref(booking)}
            className="-mx-1 inline-flex min-h-9 items-center rounded px-1 hover:text-primary"
          >
            Accommodations
          </Link>
          <span className="text-outline-variant">/</span>
          <span className="text-outline-variant">{stay.kindLabel}</span>
          <span className="text-outline-variant">/</span>
          <span aria-current="page" className="font-medium text-primary">
            {stay.name}
          </span>
        </nav>

        <div className="flex flex-col justify-between gap-4 border-b border-outline-variant/30 pb-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1">
              <Icon name="spa" className="text-sm text-secondary" />
              <span className="text-label-sm text-tertiary">{stay.eyebrow}</span>
            </div>
            <h1 className="mb-2 font-display text-headline-lg-mobile font-semibold tracking-tight text-primary md:text-headline-lg">
              {stay.name}
            </h1>
            <p className="text-body-lg leading-relaxed text-on-surface-variant">{stay.intro}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center lg:text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container px-3.5 py-1.5 text-label-md text-on-surface">
              <Icon name="shield_person" className="text-base text-secondary" />
              Hosted with care by {hosts.names} • Superhost Estate
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-fixed/30 px-3 py-1.5 text-label-md text-primary">
              <Stars rating={stay.rating} count={stay.reviewCount} />
              <span className="mx-1 text-outline-variant">•</span>
              <span className="font-medium text-on-surface">{hosts.location}</span>
            </div>
          </div>
        </div>
      </div>

      <StayGallery stay={stay} />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          {/* Quick facts */}
          <div className="sunlit-card-shadow rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5">
            <div className="grid grid-cols-2 gap-4 divide-y divide-outline-variant/30 sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
              {stay.facts.map((fact, index) => (
                <div
                  key={fact.label}
                  className={`flex items-center gap-3 pt-2 sm:px-3 sm:pt-0 ${
                    index === 0 ? "sm:pl-0" : ""
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
                    <Icon name={fact.icon} className="text-xl" />
                  </div>
                  <div>
                    <p className="text-label-sm text-on-surface-variant">{fact.label}</p>
                    <p className="text-title-md text-on-surface">{fact.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* The homestay experience */}
          <section className="space-y-6">
            <div className={sectionClass}>
              <span className="text-label-md uppercase tracking-widest text-secondary">
                Slow Living &amp; Craft
              </span>
              <h2 className="mt-1 font-display text-headline-md text-primary">
                The Homestay Experience
              </h2>
            </div>
            <div className="max-w-none space-y-4 text-body-md leading-relaxed text-on-surface-variant">
              {stay.story.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
            <div className="relative overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-low p-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0 rounded-lg bg-surface-container p-3 text-primary">
                  <Icon name="bakery_dining" className="text-2xl" />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-title-md text-primary">{breakfast.title}</h3>
                    <span className="rounded-full bg-primary-fixed/40 px-2 py-0.5 text-label-sm font-medium text-primary">
                      {breakfast.badge}
                    </span>
                  </div>
                  <p className="text-body-md text-on-surface-variant">{breakfast.body}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Amenities */}
          <section className="space-y-6">
            <div className={sectionClass}>
              <span className="text-label-md uppercase tracking-widest text-secondary">
                Thoughtful Details
              </span>
              <h2 className="mt-1 font-display text-headline-md text-primary">
                Amenities for Mindful Living
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {amenityGroups.map((group) => (
                <div
                  key={group.title}
                  className="sunlit-card-shadow rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5"
                >
                  <div className="mb-3 flex items-center gap-2 text-primary">
                    <Icon name={group.icon} className="text-xl" />
                    <h3 className="text-title-md text-on-surface">{group.title}</h3>
                  </div>
                  <ul className="space-y-2.5 text-body-sm text-on-surface-variant">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Icon
                          name="check_circle"
                          className="mt-0.5 shrink-0 text-base text-primary"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Grounds */}
          <section className="space-y-6">
            <div className={sectionClass}>
              <span className="text-label-md uppercase tracking-widest text-secondary">
                The Grounds
              </span>
              <h2 className="mt-1 font-display text-headline-md text-primary">
                Estate Grounds &amp; Access
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {grounds.map((ground) => (
                <div
                  key={ground.title}
                  className="flex items-start gap-3.5 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4"
                >
                  <Icon name={ground.icon} className="shrink-0 text-2xl text-primary" />
                  <div>
                    <h3 className="mb-1 text-title-md text-on-surface">{ground.title}</h3>
                    <p className="text-body-sm text-on-surface-variant">{ground.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* House rules */}
          <section className="space-y-4" id="house-rules">
            <div className={sectionClass}>
              <span className="text-label-md uppercase tracking-widest text-secondary">
                Tranquil Living
              </span>
              <h2 className="mt-1 font-display text-headline-md text-primary">
                House Rules &amp; Good Neighbor Policy
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 text-body-sm text-on-surface-variant sm:grid-cols-2">
              {houseRules.map((rule) => (
                <div key={rule.text} className="flex items-center gap-3">
                  <Icon name={rule.icon} className="shrink-0 text-tertiary" />
                  <span>{rule.text}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Reviews */}
          <section className="space-y-6 border-t border-outline-variant/40 pt-4">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <span className="text-label-md uppercase tracking-widest text-secondary">
                  Guest Notes
                </span>
                <h2 className="mt-0.5 font-display text-headline-md text-primary">
                  Reflections From {stay.name.replace("The ", "")}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Stars rating={stay.rating} size="md" />
                <span className="text-body-sm text-on-surface-variant">
                  based on {stay.reviewCount} verified stays
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {stay.reviews.map((review) => (
                <article
                  key={review.name}
                  className="sunlit-card-shadow space-y-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-bold ${reviewTones[review.tone]}`}
                      >
                        {review.initials}
                      </div>
                      <div>
                        <h4 className="text-title-md text-on-surface">{review.name}</h4>
                        <p className="text-label-sm text-on-surface-variant">{review.stayed}</p>
                      </div>
                    </div>
                    <Stars rating={stay.rating} className="hidden sm:inline-flex" />
                  </div>
                  <p className="text-body-md italic text-on-surface-variant">“{review.quote}”</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <BookingCard stay={stay} booking={booking} />
      </div>

      {/* More sanctuaries */}
      <section className="mt-12 border-t border-outline-variant/30 pt-8 lg:mt-16">
        <h2 className="mb-6 font-display text-headline-md text-primary">
          More sanctuaries in the valley
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {stays
            .filter((other) => other.slug !== stay.slug)
            .slice(0, 3)
            .map((other) => (
              <Link
                key={other.slug}
                href={stayHref(other.slug, {
                  ...booking,
                  guests: Math.min(booking.guests, other.maxGuests),
                })}
                className="group flex min-h-16 items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 sunlit-card-shadow sunlit-card-hover"
              >
                <span>
                  <span className="block text-label-sm text-outline">{other.wing}</span>
                  <span className="font-display text-headline-sm text-primary group-hover:text-secondary">
                    {other.name}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">{other.occupancy}</span>
                </span>
                <span className="text-title-md font-bold text-primary">${other.price}</span>
              </Link>
            ))}
        </div>
      </section>

      <MobileReserveBar stay={stay} booking={booking} />
    </main>
  );
}
