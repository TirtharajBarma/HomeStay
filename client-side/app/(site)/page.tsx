import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import {
  DashboardMockup,
  FaqAccordion,
  QuickRegisterForm,
  FloatingWhatsApp,
} from "@/components/landing-components";

export const metadata: Metadata = {
  title: "StayCabs | Run your homestay. Manage guests. Arrange rides.",
  description:
    "A free homestay management and local cab booking platform for the hills. Manage rooms, guest records and hill transfers without juggling multiple tools.",
};

export default function LandingPage() {
  return (
    <div className="relative w-full overflow-hidden bg-background">
      {/* Background ambient violet gradients */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[650px] w-full max-w-7xl -translate-x-1/2 opacity-30 blur-3xl">
        <div className="h-full w-full bg-gradient-to-br from-[#6D45C5] via-[#EDE7F9] to-transparent" />
      </div>

      {/* =====================================================================
          SECTION 1: HERO SECTION
          ===================================================================== */}
      <section className="relative px-4 pt-10 pb-16 sm:px-6 md:pt-20 md:pb-24">
        <div className="mx-auto max-w-5xl text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-fixed/80 px-4 py-1.5 text-xs font-semibold text-primary shadow-xs backdrop-blur-xs">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>StayCabs · A free homestay management &amp; cab platform for the hills</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-on-surface leading-[1.12]">
            Run your homestay. <br className="hidden sm:inline" />
            Manage your guests. <br className="hidden sm:inline" />
            <span className="text-primary">Arrange their rides.</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-on-surface-variant leading-relaxed">
            Everything your homestay needs in one place. Manage bookings, rooms, guest records and local cab requests without juggling multiple tools.
          </p>

          <div className="inline-block rounded-xl bg-primary-fixed px-4 py-2 text-xs sm:text-sm font-bold text-primary border border-primary/15">
            🎉 Completely free for homestay owners. No subscription fees.
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#register"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-7 text-sm font-bold text-on-primary shadow-lg shadow-primary/25 hover:bg-primary-container active:scale-95 transition-all"
            >
              Get Started for Free
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-6 text-sm font-semibold text-on-surface hover:border-primary/50 hover:bg-surface-container-low active:scale-95 transition-all"
            >
              See How It Works
            </a>
          </div>

          {/* Trust Indicators */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs sm:text-sm font-medium text-on-surface-variant">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <Icon name="verified" filled className="text-sm" />
              </span>
              <span><strong>15+</strong> Homestays Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <Icon name="local_taxi" className="text-sm" />
              </span>
              <span><strong>30+</strong> Local Drivers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <Icon name="currency_rupee" className="text-sm" />
              </span>
              <span><strong>Free</strong> for Homestay Owners</span>
            </div>
          </div>
        </div>

        {/* Real Product Dashboard Mockup */}
        <div className="mt-12 md:mt-16">
          <DashboardMockup />
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: THE PROBLEM
          ===================================================================== */}
      <section className="border-t border-outline-variant/60 bg-surface-container-low py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center space-y-3 mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-outline">
              The Reality of Hill Hospitality
            </span>
            <h2 className="font-display text-2xl sm:text-4xl font-bold text-on-surface">
              Running a homestay shouldn&apos;t mean managing everything manually.
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant">
              Most hosts in Darjeeling, Kalimpong and Sikkim juggle WhatsApp chats, phone calls, paper diaries, and taxi stand contacts every single day.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1 */}
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-3 shadow-ambient transition-all hover:border-primary/40 hover:-translate-y-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <Icon name="event_busy" className="text-2xl" />
              </div>
              <h3 className="font-display text-lg font-bold text-on-surface">Booking confusion</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Managing room availability through calls, messages, and notebooks leads to accidental double bookings or empty rooms.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-3 shadow-ambient transition-all hover:border-primary/40 hover:-translate-y-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Icon name="contact_phone" className="text-2xl" />
              </div>
              <h3 className="font-display text-lg font-bold text-on-surface">Guest records everywhere</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Losing track of guest IDs, check-in timings, dietary preferences, past stays, and contact history across multiple chat threads.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-3 shadow-ambient transition-all hover:border-primary/40 hover:-translate-y-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-primary">
                <Icon name="no_crash" className="text-2xl" />
              </div>
              <h3 className="font-display text-lg font-bold text-on-surface">Cab arrangement hassles</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Finding reliable local drivers for NJP pickups, sightseeing, and drops when guests ask at the last minute during peak season.
              </p>
            </div>

            {/* Card 4 */}
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-3 shadow-ambient transition-all hover:border-primary/40 hover:-translate-y-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Icon name="query_stats" className="text-2xl" />
              </div>
              <h3 className="font-display text-lg font-bold text-on-surface">No business overview</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Not knowing monthly revenue, seasonal occupancy patterns, or booking trends without spending hours calculating manually.
              </p>
            </div>
          </div>

          {/* Transition banner */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary-fixed px-6 py-3.5 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary">
                <Icon name="check" className="text-base" />
              </span>
              <span className="text-sm sm:text-base font-bold text-primary">
                That&apos;s exactly why we built StayCabs.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: FEATURES
          ===================================================================== */}
      <section id="features" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 scroll-mt-20">
        <div className="mx-auto max-w-3xl text-center space-y-3 mb-14">
          <span className="inline-block rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary">
            Built for Homestay Owners
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-on-surface">
            Everything your homestay needs. One simple platform.
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant">
            Built in consultation with authentic homestay operators across Kalimpong, Darjeeling, and Sikkim.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Feature 1 */}
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-4 shadow-ambient transition-all hover:border-primary/40 hover:shadow-elevated">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
              <Icon name="bedroom_parent" className="text-2xl" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-on-surface">
                1. Room &amp; Booking Management
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Manage rooms, bookings and availability from one dashboard. Keep track of upcoming stays and avoid booking conflicts effortlessly.
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3 text-xs text-outline space-y-1">
              <div className="flex justify-between font-medium text-on-surface">
                <span>Direct calendar tracking</span>
                <span className="text-primary font-bold">100% Free</span>
              </div>
              <p>Supports multi-room inventory, nightly rates &amp; instant check-in tags.</p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-4 shadow-ambient transition-all hover:border-primary/40 hover:shadow-elevated">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
              <Icon name="badge" className="text-2xl" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-on-surface">
                2. Guest Management (CRM)
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Store guest details, ID proofs, booking history and stay information. Keep all your guest records organized in one secure place.
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3 text-xs text-outline space-y-1">
              <div className="flex justify-between font-medium text-on-surface">
                <span>Organized contact logs</span>
                <span className="text-primary font-bold">Secure</span>
              </div>
              <p>Quick lookup for repeat guests, family sizes, and special mountain requests.</p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-4 shadow-ambient transition-all hover:border-primary/40 hover:shadow-elevated">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
              <Icon name="trending_up" className="text-2xl" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-on-surface">
                3. Business Analytics
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Track bookings, revenue, occupancy and customer activity to understand how your homestay is performing across seasons.
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3 text-xs text-outline space-y-1">
              <div className="flex justify-between font-medium text-on-surface">
                <span>Clear financial visibility</span>
                <span className="text-emerald-700 font-bold">Real-time</span>
              </div>
              <p>Monthly revenue summaries and occupancy rate charts at a glance.</p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-4 shadow-ambient transition-all hover:border-primary/40 hover:shadow-elevated">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
              <Icon name="local_taxi" className="text-2xl" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-on-surface">
                4. Cab Booking for Guests
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Arrange NJP and Bagdogra pickups, sightseeing, local rides and return drops through a connected driver network with zero stress.
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3 text-xs text-outline space-y-1">
              <div className="flex justify-between font-medium text-on-surface">
                <span>Own fleet + hill network</span>
                <span className="text-primary font-bold">100% Cash</span>
              </div>
              <p>Transparent driver bidding and direct cash settlement without deductions.</p>
            </div>
          </div>

          {/* Feature 5 */}
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-4 shadow-ambient transition-all hover:border-primary/40 hover:shadow-elevated">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
              <Icon name="chat" className="text-2xl" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-on-surface">
                5. Guest WhatsApp Communication
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Keep guests informed with booking-related and trip-related updates through automated and templated WhatsApp messages.
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3 text-xs text-outline space-y-1">
              <div className="flex justify-between font-medium text-on-surface">
                <span>No app install needed for guest</span>
                <span className="text-emerald-700 font-bold">WhatsApp</span>
              </div>
              <p>Driver phone numbers, boarding details, and route notes delivered instantly.</p>
            </div>
          </div>

          {/* Feature 6 */}
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-4 shadow-ambient transition-all hover:border-primary/40 hover:shadow-elevated">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
              <Icon name="devices" className="text-2xl" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-on-surface">
                6. Manage From Anywhere
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Access your homestay information and manage daily operations through a fast, convenient online dashboard on mobile or desktop.
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3 text-xs text-outline space-y-1">
              <div className="flex justify-between font-medium text-on-surface">
                <span>Fast &amp; responsive</span>
                <span className="text-primary font-bold">Cloud-synced</span>
              </div>
              <p>Works smoothly even on mountain mobile data networks (4G/5G).</p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 4: HOW STAYCABS WORKS
          ===================================================================== */}
      <section id="how-it-works" className="border-t border-outline-variant/60 bg-surface-container-low py-16 sm:py-24 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center space-y-3 mb-14">
            <span className="inline-block rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary">
              Simple 3-Step Process
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-on-surface">
              Get started in three simple steps.
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant">
              No complicated onboarding, credit cards, or tech setup required.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 relative">
            {/* Step 1 */}
            <div className="relative rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-6 sm:p-8 space-y-4 shadow-ambient">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-on-primary shadow-sm">
                  1
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Step One</span>
              </div>
              <h3 className="font-display text-xl font-bold text-on-surface">
                Register your homestay
              </h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Share your homestay details, name, phone number and location. Your online host profile is created in less than a minute.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-6 sm:p-8 space-y-4 shadow-ambient">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-on-primary shadow-sm">
                  2
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Step Two</span>
              </div>
              <h3 className="font-display text-xl font-bold text-on-surface">
                Manage your property
              </h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Add your rooms, track bookings on a clean visual calendar, manage guest records, and monitor your monthly occupancy.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-6 sm:p-8 space-y-4 shadow-ambient">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-on-primary shadow-sm">
                  3
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Step Three</span>
              </div>
              <h3 className="font-display text-xl font-bold text-on-surface">
                Arrange cabs for your guests
              </h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Connect guests with local drivers for NJP/Bagdogra airport transfers, local sightseeing tours, and return journeys.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <a
              href="#register"
              className="inline-flex h-12 items-center rounded-xl bg-primary px-8 text-sm font-bold text-on-primary shadow-md shadow-primary/20 hover:bg-primary-container active:scale-95 transition-all"
            >
              Start Managing for Free
            </a>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 5: BUILT FOR THE HILLS
          ===================================================================== */}
      <section id="hills" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 scroll-mt-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary">
              <Icon name="landscape" className="text-sm" />
              <span>Eastern Himalayas Mobility</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-on-surface leading-tight">
              Made for the way homestays actually work in the hills.
            </h2>
            <p className="text-base text-on-surface-variant leading-relaxed">
              From NJP railway station and Bagdogra Airport pickups to local sightseeing and return journeys, StayCabs connects homestays and verified local drivers to make mountain travel effortless.
            </p>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-outline">
                Key Regions Actively Served:
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm font-semibold text-on-surface">
                <div className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3 border border-outline-variant/60">
                  <Icon name="location_on" className="text-primary text-base" />
                  <span>Darjeeling &amp; Ghum</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3 border border-outline-variant/60">
                  <Icon name="location_on" className="text-primary text-base" />
                  <span>Kalimpong &amp; Lava/Rishyap</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3 border border-outline-variant/60">
                  <Icon name="location_on" className="text-primary text-base" />
                  <span>Gangtok &amp; Sikkim</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3 border border-outline-variant/60">
                  <Icon name="flight_land" className="text-primary text-base" />
                  <span>Bagdogra (IXB) &amp; NJP</span>
                </div>
              </div>
            </div>
          </div>

          {/* Regional Mountain Visual Card */}
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary-fixed via-surface-container-lowest to-surface-container-low p-6 sm:p-8 space-y-6 shadow-drawer">
            <div className="space-y-2">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                Hill Logistics Invariants
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-on-surface">
                No middlemen. No hidden deductions.
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Mountain journeys aren&apos;t regular city taxi rides. They require 4WD vehicles (Innova, Scorpio, Bolero, Sumo), experienced ghat road drivers, and weather-aware route planning.
              </p>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex items-start gap-3 rounded-xl bg-surface-container-lowest p-3 border border-outline-variant/60">
                <Icon name="check_circle" filled className="text-primary mt-0.5" />
                <div>
                  <strong className="text-on-surface">Direct Driver Quotes:</strong> Drivers quote actual hill fares based on weather, vehicle category, and terrain.
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-surface-container-lowest p-3 border border-outline-variant/60">
                <Icon name="check_circle" filled className="text-primary mt-0.5" />
                <div>
                  <strong className="text-on-surface">100% Cash Direct:</strong> Guest pays cash directly to the driver upon trip completion.
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-surface-container-lowest p-3 border border-outline-variant/60">
                <Icon name="check_circle" filled className="text-primary mt-0.5" />
                <div>
                  <strong className="text-on-surface">Homestay Fleet Priority:</strong> Your own favorite drivers get assigned first before broadcast.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 6: DRIVER NETWORK
          ===================================================================== */}
      <section id="driver-network" className="border-t border-outline-variant/60 bg-surface-container-low py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center space-y-3 mb-12">
            <span className="inline-block rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary">
              Verified Hill Cab Network
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-on-surface">
              Your guests need a ride. We&apos;ve got the local connections.
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant">
              Homestays can add their own preferred drivers and also tap into the wider StayCabs verified driver network across North Bengal and Sikkim.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-3 shadow-ambient">
              <Icon name="flight_takeoff" className="text-3xl text-primary" />
              <h3 className="font-display text-lg font-bold text-on-surface">NJP &amp; Bagdogra Pickups</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant">
                Reliable railway station and airport transfers with luggage assistance, flight delay tracking, and verified mountain drivers.
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-3 shadow-ambient">
              <Icon name="explore" className="text-3xl text-primary" />
              <h3 className="font-display text-lg font-bold text-on-surface">Local Sightseeing Tours</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant">
                Half-day and full-day custom itineraries: Tiger Hill sunrise, Batasia Loop, tea garden trails, Lava monasteries, and viewpoints.
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-3 shadow-ambient">
              <Icon name="sync_alt" className="text-3xl text-primary" />
              <h3 className="font-display text-lg font-bold text-on-surface">Return &amp; Point-to-Point Journeys</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant">
                Inter-homestay transfers between Darjeeling, Kalimpong, Gangtok, and Pelling without negotiating at crowded local taxi stands.
              </p>
            </div>
          </div>

          {/* Driver CTA Banner */}
          <div className="mt-12 rounded-3xl border border-primary/20 bg-primary p-8 sm:p-10 text-center text-on-primary shadow-elevated space-y-5">
            <div className="max-w-2xl mx-auto space-y-2">
              <span className="rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary-container">
                For Local Hill Drivers
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-bold">
                Drive with StayCabs. Keep 100% of your trip cash.
              </h3>
              <p className="text-sm sm:text-base opacity-90 leading-relaxed">
                Connect directly with premium homestay guests in Darjeeling, Kalimpong and Sikkim. No commissions taken from your pocket.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/join-driver"
                className="inline-flex h-12 items-center rounded-xl bg-white px-7 text-sm font-bold text-primary shadow-md hover:bg-slate-100 active:scale-95 transition-all"
              >
                Join as a Driver
              </Link>
              <Link
                href="/driver-quote"
                className="inline-flex h-12 items-center rounded-xl border border-white/40 bg-primary/20 px-6 text-sm font-semibold text-white hover:bg-primary-container active:scale-95 transition-all"
              >
                Open Driver Bidding Desk
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 7: PRICING — ₹0 FOREVER
          ===================================================================== */}
      <section id="pricing" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 scroll-mt-20">
        <div className="mx-auto max-w-3xl text-center space-y-3 mb-14">
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            Transparent Pricing
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-on-surface">
            Your homestay management platform. At ₹0.
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant">
            No trial periods. No credit card required. No monthly subscription.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="mx-auto max-w-xl rounded-3xl border-2 border-primary bg-surface-container-lowest p-8 sm:p-10 shadow-drawer relative space-y-6">
          <div className="absolute -top-3.5 right-8 rounded-full bg-primary px-3.5 py-1 text-xs font-bold text-on-primary uppercase tracking-wider">
            Free Forever
          </div>

          <div className="border-b border-outline-variant/60 pb-6 space-y-2">
            <p className="text-sm font-semibold text-primary">For Homestay Owners</p>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-5xl sm:text-6xl font-black text-on-surface">₹0</span>
              <span className="text-sm text-outline font-medium">/ forever</span>
            </div>
            <p className="text-xs text-on-surface-variant">No subscription fee. No setup fee. Zero homestay booking commissions.</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface">What&apos;s Included:</p>
            <ul className="space-y-2.5 text-xs sm:text-sm text-on-surface">
              <li className="flex items-center gap-2.5">
                <Icon name="check" className="text-primary font-bold text-base" />
                <span>Room and booking calendar management</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Icon name="check" className="text-primary font-bold text-base" />
                <span>Guest records and booking history (CRM)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Icon name="check" className="text-primary font-bold text-base" />
                <span>Business analytics &amp; monthly revenue tracking</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Icon name="check" className="text-primary font-bold text-base" />
                <span>Direct cab booking access for guests</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Icon name="check" className="text-primary font-bold text-base" />
                <span>Own driver fleet configuration + verified network access</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Icon name="check" className="text-primary font-bold text-base" />
                <span>Online homestay profile with direct guest share links</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Icon name="check" className="text-primary font-bold text-base" />
                <span>WhatsApp trip notifications &amp; guest updates</span>
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <a
              href="#register"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-on-primary shadow-lg shadow-primary/25 hover:bg-primary-container active:scale-95 transition-all"
            >
              Get Started for Free
            </a>
          </div>

          <p className="text-center text-[11px] text-outline leading-relaxed">
            💡 <strong>Complete Transparency:</strong> Guest cab fares are quoted directly by local drivers. Homestays do not pay for software access, and drivers receive 100% of their cash fares.
          </p>
        </div>
      </section>

      {/* =====================================================================
          SECTION 8: TESTIMONIALS & SOCIAL PROOF
          ===================================================================== */}
      <section className="border-t border-outline-variant/60 bg-surface-container-low py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center space-y-3 mb-14">
            <span className="inline-block rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary">
              Real Hill Community
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-on-surface">
              Homestays are joining the StayCabs network.
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant">
              Trusted by 15+ homestays and 30+ local mountain drivers across the Eastern Himalayas.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Review 1 */}
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-4 shadow-ambient">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Icon key={i} name="star" filled className="text-sm" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                &ldquo;Before StayCabs, we kept room bookings on paper notebooks and scrambled to call taxi drivers whenever guests landed at Bagdogra. Now everything is in one screen, and our guests get driver details on WhatsApp before they even board.&rdquo;
              </p>
              <div className="pt-2 border-t border-outline-variant/50">
                <p className="text-xs font-bold text-on-surface">Norbu Lepcha</p>
                <p className="text-[11px] text-outline">Pine View Retreat · Kalimpong (4 Rooms)</p>
              </div>
            </div>

            {/* Review 2 */}
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-4 shadow-ambient">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Icon key={i} name="star" filled className="text-sm" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                &ldquo;The best part is that it is truly free for homestay owners. We don&apos;t have to pay any monthly commission or software subscription. Our local drivers are registered, so they get regular trips without taxi union disputes.&rdquo;
              </p>
              <div className="pt-2 border-t border-outline-variant/50">
                <p className="text-xs font-bold text-on-surface">Pema Sherpa</p>
                <p className="text-[11px] text-outline">Kanchenjunga Mist Homestay · Darjeeling</p>
              </div>
            </div>

            {/* Review 3 */}
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 space-y-4 shadow-ambient">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Icon key={i} name="star" filled className="text-sm" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                &ldquo;As a mountain driver, StayCabs gives me genuine homestay trips to NJP and Nathu La. I quote my fare directly, get passenger WhatsApp contacts, and collect 100% of my cash fare right after the trip.&rdquo;
              </p>
              <div className="pt-2 border-t border-outline-variant/50">
                <p className="text-xs font-bold text-on-surface">Bikash Pradhan</p>
                <p className="text-[11px] text-outline">Innova Commercial Driver · Sikkim &amp; Siliguri</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 9: FAQ
          ===================================================================== */}
      <section id="faq" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 scroll-mt-20">
        <div className="mx-auto max-w-3xl text-center space-y-3 mb-14">
          <span className="inline-block rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary">
            Got Questions?
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-on-surface">
            Frequently Asked Questions
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant">
            Everything you need to know about running your homestay with StayCabs.
          </p>
        </div>

        <FaqAccordion />
      </section>

      {/* =====================================================================
          SECTION 10: FINAL CTA & REGISTRATION
          ===================================================================== */}
      <section className="border-t border-outline-variant/60 bg-gradient-to-b from-surface-container-low to-surface py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-10">
          <div className="text-center space-y-3">
            <span className="rounded-full bg-primary-fixed px-3.5 py-1 text-xs font-bold text-primary">
              Ready to Upgrade Your Homestay?
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-black text-on-surface">
              Give your homestay a smarter way to operate.
            </h2>
            <p className="mx-auto max-w-xl text-sm sm:text-base text-on-surface-variant">
              Manage your property, organise your guests and arrange local rides — all in one place.
            </p>
            <p className="text-xs font-bold text-primary uppercase tracking-wider">
              Made for the hills. Built for homestays.
            </p>
          </div>

          {/* Quick Onboarding Form Card */}
          <div className="max-w-2xl mx-auto">
            <QuickRegisterForm />
          </div>
        </div>
      </section>

      {/* Persistent WhatsApp floating help button */}
      <FloatingWhatsApp />
    </div>
  );
}
