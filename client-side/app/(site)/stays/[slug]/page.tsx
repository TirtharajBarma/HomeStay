import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingCard } from "@/components/booking-card";
import { StayTransferSection } from "@/components/cab/stay-transfer-section";
import { Icon } from "@/components/icon";
import { MobileReserveBar } from "@/components/mobile-reserve-bar";
import { StayGallery } from "@/components/stay-gallery";
import { Stars } from "@/components/stars";
import { formatMoney, homeHref, resolveBooking, stayHref } from "@/lib/booking";
import {
  breakfast,
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

  if (!stay) return { title: "Stay not found" };

  return {
    title: stay.name,
    description: stay.intro,
  };
}

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
            className="-mx-1 inline-flex min-h-11 items-center rounded px-1 hover:text-primary"
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
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:text-right">
            <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container px-3.5 py-1.5 text-label-md text-on-surface">
              <Icon name="shield_person" className="text-base text-secondary" />
              Hosted by {hosts.names}
            </div>
            <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full bg-primary-fixed/30 px-3 py-1.5 text-label-md text-primary">
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

          {/* Estate transfers */}
          <StayTransferSection checkIn={booking.checkIn} />

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

        </div>

        <BookingCard stay={stay} booking={booking} />
      </div>

      {/* More stays on the estate */}
      <section className="mt-12 border-t border-outline-variant/30 pt-8 lg:mt-16">
        <h2 className="mb-6 font-display text-headline-md text-primary">
          More stays on the estate
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
                <span className="text-title-md font-bold text-primary">{formatMoney(other.price)}</span>
              </Link>
            ))}
        </div>
      </section>

      <MobileReserveBar stay={stay} booking={booking} />
    </main>
  );
}
