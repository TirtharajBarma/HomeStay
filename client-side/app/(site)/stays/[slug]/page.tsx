import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingCard } from "@/components/booking-card";
import { Icon } from "@/components/icon";
import { MobileReserveBar } from "@/components/mobile-reserve-bar";
import { StayGallery } from "@/components/stay-gallery";
import { Stars } from "@/components/stars";
import { formatNightly, homeHref, resolveBooking, stayHref } from "@/lib/booking";
import {
  breakfast,
  houseRules,
} from "@/lib/content";
import { getLiveStay, getLiveStays } from "@/lib/stays";

export async function generateMetadata({
  params,
}: PageProps<"/stays/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const stay = await getLiveStay(slug);

  if (!stay) return { title: "Stay not found" };

  return {
    title: stay.name,
    description: stay.intro,
  };
}

export default async function StayPage({ params, searchParams }: PageProps<"/stays/[slug]">) {
  const { slug } = await params;
  const stay = await getLiveStay(slug);

  if (!stay) notFound();

  const others = (await getLiveStays()).stays.filter((other) => other.slug !== stay.slug).slice(0, 3);
  const query = await searchParams;
  const booking = resolveBooking(query, stay.maxGuests);
  const sectionClass = "border-b border-outline-variant/30 pb-3";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 pb-28 lg:pb-8">
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

        <div className="flex flex-col justify-between gap-4 border-b border-outline-variant/40 pb-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-2 text-label-sm font-medium text-outline">
              {stay.eyebrow}
            </div>
            <h1 className="mb-2 font-display text-headline-lg-mobile font-medium tracking-tight text-primary md:text-headline-lg">
              {stay.name}
            </h1>
            <p className="text-body-md text-on-surface-variant leading-relaxed">{stay.intro}</p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-1 text-label-sm text-on-surface">
              <Icon name="shield_person" className="text-sm text-outline" />
              <span>Verified local host</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-md bg-surface-container-low px-3 py-1 text-label-sm text-primary">
              <Stars rating={stay.rating} count={stay.reviewCount} />
              <span className="text-outline-variant">·</span>
              <span className="text-on-surface">{stay.wing}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <StayGallery stay={stay} />

          {/* Quick facts */}
          <div className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-5 shadow-ambient">
            <div className="grid grid-cols-2 gap-4 divide-y divide-outline-variant/30 sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
              {stay.facts.map((fact, index) => (
                <div
                  key={fact.label}
                  className={`flex items-center gap-3 pt-2 sm:px-3 sm:pt-0 ${
                    index === 0 ? "sm:pl-0" : ""
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-container text-primary">
                    <Icon name={fact.icon} className="text-lg" />
                  </div>
                  <div>
                    <p className="text-label-sm text-outline">{fact.label}</p>
                    <p className="text-body-md font-medium text-on-surface tabular-nums">{fact.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* The homestay experience */}
          <section className="space-y-4">
            <div className={sectionClass}>
              <span className="text-label-sm font-medium text-outline">
                Homestay life
              </span>
              <h2 className="mt-0.5 font-display text-headline-sm font-medium text-primary">
                The homestay experience
              </h2>
            </div>
            <div className="max-w-none space-y-4 text-body-md leading-relaxed text-on-surface-variant">
              {stay.story.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
            <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-5">
              <div className="flex items-start gap-3.5">
                <div className="shrink-0 rounded-md bg-surface-container p-2 text-primary">
                  <Icon name="bakery_dining" className="text-xl" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-body-md font-medium text-primary">{breakfast.title}</h3>
                    <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-label-sm text-primary">
                      {breakfast.badge}
                    </span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant leading-relaxed">{breakfast.body}</p>
                </div>
              </div>
            </div>
          </section>

          {/* House rules */}
          <section className="space-y-3" id="house-rules">
            <div className={sectionClass}>
              <span className="text-label-sm font-medium text-outline">
                Quiet hours &amp; etiquette
              </span>
              <h2 className="mt-0.5 font-display text-headline-sm font-medium text-primary">
                House rules
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3 text-body-sm text-on-surface-variant sm:grid-cols-2">
              {houseRules.map((rule) => (
                <div key={rule.text} className="flex items-center gap-2.5">
                  <Icon name={rule.icon} className="shrink-0 text-outline text-base" />
                  <span>{rule.text}</span>
                </div>
              ))}
            </div>
          </section>

        </div>

        <BookingCard stay={stay} booking={booking} />
      </div>

      {/* More stays on the estate */}
      {others.length > 0 && (
        <section className="mt-12 border-t border-outline-variant/40 pt-8 lg:mt-16">
          <h2 className="mb-6 font-display text-headline-sm font-medium text-primary">
            More stays on the estate
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {others.map((other) => (
              <Link
                key={other.slug}
                href={stayHref(other.slug, {
                  ...booking,
                  guests: Math.min(booking.guests, other.maxGuests),
                })}
                className="group flex items-center justify-between gap-4 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-ambient transition-colors hover:border-primary"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-label-sm text-outline mb-0.5 truncate">{other.wing}</span>
                  <span className="font-display text-body-md font-medium text-primary group-hover:text-primary-container truncate transition-colors">
                    {other.name}
                  </span>
                  <span className="mt-1 text-label-sm text-on-surface-variant tabular-nums">
                    {other.occupancy}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block font-display text-body-md font-medium text-primary tabular-nums">
                    {formatNightly(other.price)}
                  </span>
                  {other.price > 0 && (
                    <span className="block text-label-sm text-outline">/ night</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <MobileReserveBar stay={stay} booking={booking} />
    </main>
  );
}
