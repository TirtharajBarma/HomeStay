import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icon";
import { Stars } from "@/components/stars";
import { StayGallery } from "@/components/stay-gallery";
import { getLiveStay, getStaySlugs } from "@/lib/stays";

export function generateStaticParams() {
  return getStaySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/h/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const stay = await getLiveStay(slug);

  if (!stay) return { title: "Homestay Portal" };

  return {
    title: `${stay.name} | Guest Portal & Hill Cab Transfer`,
    description: `Welcome to ${stay.name}. View your accommodation details, host contact, and book door-to-door hill transfers to NJP / Bagdogra Airport.`,
  };
}

export default async function DedicatedHomestayPage({
  params,
  searchParams,
}: PageProps<"/h/[slug]">) {
  const { slug } = await params;
  const stay = await getLiveStay(slug);

  if (!stay) notFound();

  const query = await searchParams;
  const ref = typeof query.ref === "string" ? query.ref : null;
  const checkIn = typeof query.checkIn === "string" ? query.checkIn : "";
  const checkOut = typeof query.checkOut === "string" ? query.checkOut : "";
  const guestName = typeof query.guest === "string" ? query.guest : "";

  // Pre-configured transfer destinations
  const transferCards = [
    {
      title: "Return Transfer: Homestay ➔ NJP Railway Station",
      badge: "High Demand · No Hill Surcharges",
      desc: "Guaranteed door-to-door hill descent from the estate gate to New Jalpaiguri (NJP) Platform 1.",
      eta: "Approx. 3.5 hrs",
      fare: "₹3,400",
      icon: "train",
      link: `/cab?pickup=${encodeURIComponent(stay.name)}&dropoff=${encodeURIComponent("NJP Railway Station")}&date=${checkOut || checkIn}${guestName ? `&guest=${encodeURIComponent(guestName)}` : ""}`,
    },
    {
      title: "Return Transfer: Homestay ➔ Bagdogra Airport (IXB)",
      badge: "Flight Guaranteed · Local Drivers",
      desc: "Direct private cab from homestay to Bagdogra departures terminal. Zero mountain syndication hassle.",
      eta: "Approx. 3 hrs 15 mins",
      fare: "₹3,200",
      icon: "flight",
      link: `/cab?pickup=${encodeURIComponent(stay.name)}&dropoff=${encodeURIComponent("Bagdogra Airport")}&date=${checkOut || checkIn}${guestName ? `&guest=${encodeURIComponent(guestName)}` : ""}`,
    },
    {
      title: "Tiger Hill Sunrise Tour (03:30 AM Pickup)",
      badge: "Kanchenjunga First Light",
      desc: "Early morning private excursion to Tiger Hill summit, returning via Ghoom Monastery & Batasia Loop.",
      eta: "4 hrs tour",
      fare: "₹2,200",
      icon: "wb_twilight",
      link: `/cab?pickup=${encodeURIComponent(stay.name)}&dropoff=${encodeURIComponent("Tiger Hill")}&date=${checkIn}${guestName ? `&guest=${encodeURIComponent(guestName)}` : ""}`,
    },
    {
      title: "Darjeeling 7-Points Sightseeing Charter",
      badge: "Full Day Local Tour",
      desc: "Zoo, HMI, Ropeway, Tea Gardens, Tibetan Refugee Centre, Japanese Temple & Peace Pagoda.",
      eta: "Full Day",
      fare: "₹2,800",
      icon: "explore",
      link: `/cab?pickup=${encodeURIComponent(stay.name)}&dropoff=${encodeURIComponent("Darjeeling Station")}&date=${checkIn}${guestName ? `&guest=${encodeURIComponent(guestName)}` : ""}`,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* 1. OTA Guest Confirmation Banner */}
      {ref ? (
        <div className="mb-8 overflow-hidden rounded-2xl border border-primary/30 bg-primary/10 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
                <Icon name="verified" className="text-2xl" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary/20 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                    Ref #{ref}
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    Verified Reservation
                  </span>
                </div>
                <h2 className="mt-1 font-serif text-xl font-bold text-primary sm:text-2xl">
                  {guestName ? `Welcome to ${stay.name}, ${guestName}!` : `Welcome to ${stay.name}!`}
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {checkIn && checkOut
                    ? `Dates: ${checkIn} to ${checkOut} • Check-in time: 3:00 PM`
                    : "Your stay is locked in. Need a door-to-door hill cab from NJP or Bagdogra, or your return transfer?"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#cab-transfers"
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow transition hover:opacity-95"
              >
                <Icon name="directions_car" className="text-lg" />
                <span>Book Cab Transfer</span>
              </a>
              <a
                href="https://wa.me/919830041000?text=Hello!%20I%20have%20a%20confirmed%20booking%20at%20your%20homestay."
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-outline-variant/60 bg-surface px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                <Icon name="chat" className="text-lg text-secondary" />
                <span>Message Host</span>
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {/* 2. Homestay Profile Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-outline-variant/30 pb-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1">
            <Icon name="cottage" className="text-sm text-secondary" />
            <span className="text-label-sm font-medium text-tertiary">
              {stay.kindLabel} • Dedicated Homestay Portal
            </span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            {stay.name}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-on-surface-variant">
            {stay.intro}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container px-3.5 py-1.5 text-label-md text-on-surface">
            <Icon name="verified_user" className="text-base text-secondary" />
            <span>Verified Local Estate</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-label-md text-primary">
            <Stars rating={stay.rating} count={stay.reviewCount} />
          </div>
        </div>
      </div>

      {/* 3. High-Quality Photo Gallery */}
      <StayGallery stay={stay} />

      {/* 4. HIGH-MARGIN CAB TRANSFER SECTION */}
      <section id="cab-transfers" className="my-12 scroll-mt-20">
        <div className="rounded-3xl border border-outline-variant/50 bg-surface-container-lowest p-6 sm:p-8 shadow-md">
          <div className="flex flex-col justify-between gap-4 border-b border-outline-variant/30 pb-6 sm:flex-row sm:items-end">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-secondary">
                <Icon name="local_taxi" className="text-base" />
                Guaranteed Hill Transit &amp; Return Transfers
              </span>
              <h2 className="mt-1 font-serif text-2xl font-bold text-primary sm:text-3xl">
                Door-to-Door Private Hill Cabs
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                Mountain syndicate taxi counters in the hills often charge sudden surge pricing or leave travelers stranded.
                Book directly with homestay-affiliated local drivers with upfront fixed fares in rupees.
              </p>
            </div>

            <Link
              href={`/cab?pickup=${encodeURIComponent(stay.name)}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow hover:opacity-95"
            >
              <Icon name="search" className="text-lg" />
              <span>Custom Hill Route →</span>
            </Link>
          </div>

          {/* Transfer Route Cards Grid */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {transferCards.map((card) => (
              <div
                key={card.title}
                className="flex flex-col justify-between rounded-2xl border border-outline-variant/40 bg-surface p-5 transition hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-tint text-primary">
                      <Icon name={card.icon} className="text-xl" />
                    </span>
                    <span className="font-mono text-base font-bold text-primary">
                      {card.fare}
                    </span>
                  </div>

                  <h3 className="mt-4 font-serif text-base font-bold leading-snug text-primary">
                    {card.title}
                  </h3>
                  <span className="mt-1 inline-block text-[11px] font-semibold uppercase tracking-wide text-secondary">
                    {card.badge}
                  </span>
                  <p className="mt-2 text-xs leading-relaxed text-outline">
                    {card.desc}
                  </p>
                </div>

                <div className="mt-5 border-t border-outline-variant/20 pt-4">
                  <div className="mb-3 flex items-center justify-between text-xs text-outline">
                    <span>Duration</span>
                    <span className="font-medium text-on-surface">{card.eta}</span>
                  </div>

                  <Link
                    href={card.link}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-semibold text-on-primary transition hover:opacity-95"
                  >
                    <span>Reserve Cab</span>
                    <Icon name="arrow_forward" className="text-sm" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-xs text-outline">
            <span className="flex items-center gap-2">
              <Icon name="payments" className="text-base text-primary" />
              Pay driver directly via Cash or UPI at dropoff • No prepayment required
            </span>
            <span className="flex items-center gap-2">
              <Icon name="cancel" className="text-base text-primary" />
              Free cancellation up to 12 hours before pickup
            </span>
          </div>
        </div>
      </section>

      {/* 5. Stay Facts & Experience */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          {/* Quick facts */}
          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5">
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
                    <p className="text-xs text-on-surface-variant">{fact.label}</p>
                    <p className="text-sm font-semibold text-on-surface">{fact.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stay story */}
          <section className="space-y-4">
            <h2 className="font-serif text-2xl font-bold text-primary">
              About This Homestay
            </h2>
            <div className="space-y-3 text-sm leading-relaxed text-on-surface-variant">
              {stay.story.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
          </section>

          {/* Amenities */}
          <section className="space-y-4">
            <h2 className="font-serif text-2xl font-bold text-primary">
              Included Amenities &amp; Services
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stay.amenities.map((amenity) => (
                <div
                  key={amenity}
                  className="flex items-center gap-2.5 rounded-xl border border-outline-variant/30 bg-surface p-3 text-xs font-medium text-on-surface"
                >
                  <Icon name="check" className="text-base text-primary" />
                  <span>{amenity}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar: Host Support & Assistance */}
        <aside className="space-y-6 lg:col-span-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm">
            <h3 className="font-serif text-lg font-bold text-primary">
              Host Assistance Desk
            </h3>
            <p className="mt-1 text-xs text-outline">
              Direct communication with the homestay host for arrival coordination, baggage assistance, or custom meal requests.
            </p>

            <div className="mt-4 space-y-3">
              <a
                href="https://wa.me/919830041000?text=Hello%20Host,%20I%20have%20questions%20regarding%20my%20stay."
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-semibold text-on-primary shadow transition hover:opacity-95"
              >
                <Icon name="chat" className="text-base" />
                <span>WhatsApp the Host</span>
              </a>

              <a
                href="tel:+919830041000"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/50 bg-surface py-3 text-xs font-semibold text-on-surface hover:bg-surface-container"
              >
                <Icon name="call" className="text-base text-primary" />
                <span>Call Host Desk</span>
              </a>
            </div>

            <div className="mt-6 border-t border-outline-variant/30 pt-4 text-xs text-outline space-y-2">
              <div className="flex items-center justify-between">
                <span>Check-in:</span>
                <span className="font-medium text-on-surface">3:00 PM</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Check-out:</span>
                <span className="font-medium text-on-surface">11:00 AM</span>
              </div>
              <div className="flex items-center justify-between">
                <span>WiFi:</span>
                <span className="font-medium text-on-surface">High-Speed Hill Fiber</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
