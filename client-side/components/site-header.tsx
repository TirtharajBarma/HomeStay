import Link from "next/link";

import { hosts } from "@/lib/content";
import { siteConfig } from "@/lib/site-config";

import { Icon } from "./icon";
import { MobileNav, type NavLink } from "./mobile-nav";

const navLinks = [
  {
    href: "/",
    label: "Home",
    hint: "Overview & homestay platform",
    icon: "home",
    active: true,
  },
  {
    href: "/#features",
    label: "Features",
    hint: "Rooms, guests & cabs in one place",
    icon: "dashboard_customize",
    active: false,
  },
  {
    href: "/#how-it-works",
    label: "How It Works",
    hint: "3 simple steps to get started",
    icon: "alt_route",
    active: false,
  },
  {
    href: "/#hills",
    label: "Built for Hills",
    hint: "Darjeeling, Kalimpong & Sikkim",
    icon: "landscape",
    active: false,
  },
  {
    href: "/join-driver",
    label: "For Drivers",
    hint: `Join the ${siteConfig.appName} driver network`,
    icon: "directions_car",
    active: false,
  },
  {
    href: "/#pricing",
    label: "Pricing",
    hint: "Completely free for homestay owners",
    icon: "currency_rupee",
    active: false,
  },
  {
    href: "/#faq",
    label: "FAQ",
    hint: "Frequently asked questions",
    icon: "help_outline",
    active: false,
  },
] satisfies (NavLink & { active: boolean })[];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-outline-variant/60 bg-surface/95 backdrop-blur-md shadow-navbar">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm shadow-primary/20 transition-transform group-hover:scale-105">
            <Icon name="cottage" className="text-[20px]" />
          </span>
          <span className="flex flex-col">
            <span className="truncate font-display text-headline-sm font-semibold tracking-tight text-primary">
              {siteConfig.appName}
            </span>
            <span className="-mt-0.5 hidden text-label-sm text-outline xs:block font-medium">
              Your homestay. Your cabs. One platform.
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative inline-flex h-9 items-center text-body-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
            >
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          <Link
            href="/cab-request"
            className="hidden sm:inline-flex h-9 items-center rounded-lg border border-primary/20 bg-primary-fixed px-3 text-label-md font-semibold text-primary transition-colors hover:bg-primary-fixed-dim"
          >
            Guest Cabs
          </Link>
          <a
            href="#register"
            className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-label-md font-semibold text-on-primary shadow-sm shadow-primary/25 transition-all hover:bg-primary-container active:scale-95"
          >
            Get Started Free
          </a>
          <MobileNav links={navLinks} />
        </div>
      </div>
    </header>
  );
}

/** Shared estate lockup, used by the checkout and cab headers. */
export function BrandLockup() {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm shadow-primary/20">
        <Icon name="cottage" className="text-[18px]" />
      </span>
      <span className="flex flex-col">
        <span className="truncate font-display text-headline-sm font-semibold leading-tight tracking-tight text-primary">
          {siteConfig.appName}
        </span>
        <span className="hidden text-label-sm text-outline sm:block font-medium">
          Your homestay. Your cabs. One platform.
        </span>
      </span>
    </Link>
  );
}

export function CheckoutHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-surface/90 backdrop-blur-md shadow-navbar">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <BrandLockup />

        <div className="flex shrink-0 items-center gap-2 sm:gap-6">
          <div className="hidden items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container px-3 py-1.5 text-label-md text-primary md:flex">
            <Icon name="lock" filled className="text-base" />
            <span>Secure direct booking</span>
          </div>
          <a
            href={hosts.phoneHref}
            className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-on-surface-variant transition-colors duration-200 hover:bg-surface-container hover:text-primary sm:px-0"
          >
            <Icon name="phone_in_talk" className="text-xl text-primary" />
            <span className="hidden text-left md:block">
              <span className="block text-label-sm text-outline">
                Host assistance
              </span>
              <span className="block text-title-md font-semibold leading-tight text-primary">
                {hosts.phone}
              </span>
            </span>
            <span className="text-label-md font-semibold text-primary md:hidden">Call</span>
          </a>
        </div>
      </div>
    </header>
  );
}

const progressSteps = [
  { label: "Accommodations", short: "Stay", href: "/#accommodations" },
  { label: "Dates & details", short: "Details", href: "#stay-summary" },
];

export function CheckoutProgress() {
  return (
    <div className="border-b border-outline-variant/30 bg-surface-container-low">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5 text-body-sm sm:px-6">
        <nav aria-label="Checkout progress" className="flex min-w-0 items-center gap-1">
          {progressSteps.map((step, index) => (
            <span key={step.label} className="flex min-w-0 items-center gap-1">
              {index > 0 && <Icon name="chevron_right" className="text-xs text-outline" />}
              <Link
                href={step.href}
                className="flex min-h-11 items-center rounded px-1 text-on-surface-variant/70 transition-colors hover:text-primary"
              >
                <span className="sm:hidden">
                  {index + 1}. {step.short}
                </span>
                <span className="hidden sm:inline">
                  {index + 1}. {step.label}
                </span>
              </Link>
            </span>
          ))}
          <span className="flex min-w-0 items-center gap-1">
            <Icon name="chevron_right" className="text-xs text-outline" />
            <span className="flex min-h-11 items-center gap-1 px-1 font-semibold text-primary">
              <span className="sm:hidden">3. Confirm</span>
              <span className="hidden sm:inline">3. Finalize reservation</span>
            </span>
          </span>
        </nav>
        <div className="hidden shrink-0 items-center gap-2 text-label-sm text-primary md:flex">
          <Icon name="verified" filled className="text-sm text-secondary" />
          <span>Guaranteed direct price · No booking fees</span>
        </div>
      </div>
    </div>
  );
}
