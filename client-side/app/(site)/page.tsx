import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import {
  ShieldCheck,
  Car,
  Sparkles,
} from "lucide-react";
import {
  DashboardMockup,
  MountainTransitShowcase,
  FaqAccordion,
  QuickRegisterForm,
  FloatingWhatsApp,
  ReviewsMarquee,
} from "@/components/landing-components";
import {
  TopographicPattern,
  HimalayanElevationSimulator,
  HostSavingsCalculator,
  QuickActionLauncher,
  FloatingChapterNavigator,
  HimalayanOSStoryStage,
} from "@/components/interactive-showcase";

export const metadata: Metadata = {
  title: "StayCabs | Run your homestay. Manage guests. Arrange rides.",
  description:
    "A free homestay management and local cab booking platform for the hills. Manage rooms, guest records and hill transfers without juggling multiple tools.",
};

export default function LandingPage() {
  return (
    <div className="relative w-full overflow-hidden bg-background pb-12 sm:pb-0">
      {/* -------------------------------------------------------------------
          ATMOSPHERIC CHROMATIC ORBS & TOPOGRAPHIC CONTOUR OVERLAYS
          ------------------------------------------------------------------- */}
      {/* 1. Top Hero Orb: Alpine Violet & Dawn Mist */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[650px] w-full max-w-7xl -translate-x-1/2 opacity-40 blur-3xl animate-mist">
        <div className="h-full w-full bg-gradient-to-b from-primary-fixed/80 via-primary-fixed-dim/40 to-transparent" />
      </div>

      {/* 2. Mid Transit Orb: Mountain Ice Cyan */}
      <div className="pointer-events-none absolute top-[44%] -left-36 -z-10 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[130px]" />

      {/* 3. Bottom Launchpad Orb: Emerald Zero-Fee Glow */}
      <div className="pointer-events-none absolute bottom-[18%] -right-36 -z-10 h-[550px] w-[550px] rounded-full bg-emerald-500/12 blur-[130px]" />

      {/* Topographic Contour Overlay in Hero */}
      <TopographicPattern className="absolute top-0 left-0 right-0 h-[680px] -z-10 pointer-events-none" />

      {/* Apple-Style Minimal Floating Chapter Navigator (Desktop) */}
      <FloatingChapterNavigator />

      {/* =====================================================================
          CHAPTER 01: HERO & LIVE MAC OS CONSOLE
          ===================================================================== */}
      <section id="hero" className="relative px-4 pt-10 pb-16 sm:px-6 md:pt-16 md:pb-24 scroll-mt-20">
        <div className="mx-auto max-w-4xl text-center space-y-5">
          {/* Elevation & Status Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-surface-container-lowest/90 px-3.5 py-1.5 text-xs font-medium text-primary shadow-sm backdrop-blur-xs">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>2,042m · Himalayas</span>
            <span className="text-outline">·</span>
            <span className="text-emerald-700 font-semibold">100% Free for Hosts</span>
          </div>

          {/* Strong, Balanced Typographic Headline */}
          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-on-surface leading-[1.14]">
            Run your homestay.<br />
            Manage your guests.<br className="hidden sm:inline" />
            <span className="text-primary">Arrange their rides.</span>
          </h1>

          {/* Value Proposition */}
          <p className="mx-auto max-w-2xl text-sm sm:text-base font-normal text-on-surface-variant leading-relaxed">
            The free operating system for Himalayan homestays. Manage room inventory, guest records, and verified mountain cabs from one screen.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <a
              href="#launchpad"
              className="liquid-btn inline-flex h-11 sm:h-12 items-center justify-center rounded-xl bg-primary px-6 sm:px-8 text-sm font-semibold text-on-primary shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:bg-primary-container"
            >
              Get Started for Free
            </a>
            <Link
              href="/cab-request"
              className="liquid-btn inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-5 sm:px-7 text-sm font-medium text-on-surface hover:border-primary/50 hover:bg-surface-container-low shadow-sm hover:shadow-md"
            >
              <Icon name="local_taxi" className="text-base text-primary" />
              <span>Book a Cab</span>
            </Link>
          </div>

          {/* Unified 3-Column Trust Bar (Guaranteed single line on mobile & desktop, zero awkward wrapping!) */}
          <div className="mx-auto max-w-md rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/90 px-3 py-2 shadow-xs backdrop-blur-xs">
            <div className="grid grid-cols-3 divide-x divide-outline-variant/60 text-center">
              <div className="flex items-center justify-center gap-1.5 px-1 sm:px-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-3 w-3" />
                </span>
                <span className="text-[11px] sm:text-xs font-medium text-on-surface">
                  <strong className="font-bold text-primary">Verified</strong> <span className="hidden sm:inline">Homestays</span><span className="sm:hidden">Hosts</span>
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5 px-1 sm:px-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Car className="h-3 w-3" />
                </span>
                <span className="text-[11px] sm:text-xs font-medium text-on-surface">
                  <strong className="font-bold text-primary">Hill</strong> Drivers
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5 px-1 sm:px-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
                  <Sparkles className="h-3 w-3" />
                </span>
                <span className="text-[11px] sm:text-xs font-bold text-emerald-700">
                  ₹0 Free
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Real Product Dashboard Mockup */}
        <div className="mt-10 sm:mt-14">
          <DashboardMockup />
        </div>
      </section>

      {/* =====================================================================
          CHAPTER 02: STICKY STORYTELLING STAGE (THE HIMALAYAN HOMESTAY OS)
          Fuses previous Section 2 (Problems) + Section 3 (Features) + Section 4 (Steps)
          into a single Apple-grade dynamic stage, cutting ~1,800px of scrolling!
          ===================================================================== */}
      <section id="story" className="border-t border-outline-variant/60 bg-surface-container-low/60 py-16 sm:py-24 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-10 sm:space-y-14">
          <div className="mx-auto max-w-3xl text-center space-y-3">
            <span className="inline-block rounded-full bg-primary-fixed px-3.5 py-1 text-xs font-medium text-primary shadow-2xs">
              The Himalayan Homestay OS
            </span>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-on-surface tracking-tight leading-snug">
              Everything your homestay needs. Pinned into one calm console.
            </h2>
            <p className="text-sm sm:text-base font-normal text-on-surface-variant leading-relaxed">
              No paper diaries, no lost WhatsApp check-ins, and no taxi stand scrambling. Three core operational pillars seamlessly connected.
            </p>
          </div>

          {/* Interactive Story Stage */}
          <HimalayanOSStoryStage />
        </div>
      </section>

      {/* =====================================================================
          CHAPTER 03: VERIFIED HILL CAB NETWORK & 4WD ELEVATION SIMULATOR
          ===================================================================== */}
      <section id="transit" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 scroll-mt-20 space-y-10 sm:space-y-14">
        <div className="mx-auto max-w-3xl text-center space-y-3">
          <span className="inline-block rounded-full bg-primary-fixed px-3.5 py-1 text-xs font-medium text-primary shadow-2xs">
            Verified Hill Cab Network
          </span>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-on-surface tracking-tight leading-snug">
            Your guests need a ride. We&apos;ve got the local connections.
          </h2>
          <p className="text-sm sm:text-base font-normal text-on-surface-variant leading-relaxed">
            Homestays can add their own preferred drivers and also tap into the wider StayCabs verified driver network across North Bengal and Sikkim.
          </p>
        </div>

        {/* 2-Pillar Overview */}
        <MountainTransitShowcase />

        {/* Interactive Playable Toy: Himalayan Mountain Elevation & Ghat Profile Simulator */}
        <div className="pt-2 sm:pt-4">
          <HimalayanElevationSimulator />
        </div>
      </section>

      {/* =====================================================================
          CHAPTER 04: THE HOST LAUNCHPAD (PRICING + CALCULATOR + 30S REGISTRATION)
          Fuses Section 6 (Pricing & Calculator) and Section 7 (Registration Form)
          into a cohesive high-converting launchpad.
          ===================================================================== */}
      <section id="launchpad" className="border-t border-outline-variant/60 bg-surface-container-low/70 py-16 sm:py-24 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-12 sm:space-y-16">
          <div className="mx-auto max-w-3xl text-center space-y-3">
            <span className="inline-block rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
              Transparent Pricing · ₹0 Forever
            </span>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-on-surface tracking-tight leading-snug">
              Register your homestay. In 30 seconds.
            </h2>
            <p className="text-sm sm:text-base font-normal text-on-surface-variant leading-relaxed">
              No credit cards, no monthly subscription fees, and no tech setup. See your exact savings on the left and start managing on the right.
            </p>
          </div>

          {/* Consolidated 2-Column Host Launchpad */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start max-w-6xl mx-auto">
            {/* Left Column: Interactive Host Savings & Sanity Calculator (7 cols) */}
            <div className="lg:col-span-7">
              <HostSavingsCalculator />
            </div>

            {/* Right Column: 30-Second Registration Form in Apple Glass Card (5 cols) */}
            <div id="register" className="lg:col-span-5 apple-glass rounded-3xl p-6 sm:p-7 shadow-xl space-y-4 border border-white/80 scroll-mt-24">
              <div className="border-b border-outline-variant/60 pb-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Instant Host Activation
                </span>
                <h3 className="font-display text-lg font-bold text-on-surface">
                  Register Your Homestay
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Join the verified hill network. Free forever for homestay hosts.
                </p>
              </div>

              {/* Registration Form Component */}
              <QuickRegisterForm />
            </div>
          </div>

          {/* Social Proof Heading & Marquee */}
          <div className="text-center space-y-2 pt-6">
            <span className="text-xs font-medium text-outline uppercase tracking-wider">
              Trusted by the Hill Community
            </span>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-on-surface">
              Real words from Himalayan hosts and drivers
            </h3>
          </div>

          <ReviewsMarquee />
        </div>
      </section>

      {/* =====================================================================
          SECTION 5: FAQ ACCORDION
          ===================================================================== */}
      <section id="faq" className="py-16 sm:py-24 max-w-4xl mx-auto px-4 sm:px-6 scroll-mt-20 space-y-10 sm:space-y-12">
        <div className="space-y-2 text-center">
          <span className="inline-block rounded-full bg-primary-fixed px-3 py-1 text-xs font-medium text-primary shadow-2xs">
            Got Questions?
          </span>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-on-surface">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm font-normal text-on-surface-variant">
            Everything you need to know about operating your homestay with StayCabs.
          </p>
        </div>

        <FaqAccordion />
      </section>

      {/* Persistent WhatsApp Floating Help Button */}
      <FloatingWhatsApp />

      {/* Floating Quick Action Launcher & Cmd+K Spotlight */}
      <QuickActionLauncher />
    </div>
  );
}
