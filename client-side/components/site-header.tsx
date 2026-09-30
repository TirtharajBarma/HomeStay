import Link from "next/link";

import { hosts } from "@/lib/content";

import { Icon } from "./icon";
import { MobileNav, type NavLink } from "./mobile-nav";

const navLinks = [
  {
    href: "/#accommodations",
    label: "Our Accommodations",
    hint: "Six handcrafted hillside stays",
    icon: "cottage",
    active: true,
  },
  {
    href: "/#experiences",
    label: "Experiences",
    hint: "Breakfast, trails & hearth quiet",
    icon: "spa",
    active: false,
  },
  {
    href: "/#story",
    label: "Our Story",
    hint: "Twelve years on the hillside",
    icon: "menu_book",
    active: false,
  },
  {
    href: "/#contact",
    label: "Host Contact",
    hint: hosts.phone,
    icon: "phone_in_talk",
    active: false,
  },
] satisfies (NavLink & { active: boolean })[];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-outline-variant/40 bg-surface/90 backdrop-blur-md shadow-navbar">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="group flex min-h-11 min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-surface-container-lowest transition-transform duration-200 group-hover:scale-105">
            <Icon name="forest" className="text-[20px]" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-display text-headline-sm font-semibold tracking-tight text-primary sm:text-headline-md">
              Meadowfall Homestay
            </span>
            <span className="-mt-0.5 hidden text-label-sm tracking-wider text-outline xs:block sm:block">
              ESTATE &amp; RETREAT
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                link.active
                  ? "inline-flex min-h-11 items-center text-title-md font-semibold text-primary"
                  : "inline-flex min-h-11 items-center text-body-md text-on-surface-variant transition-colors duration-200 hover:text-primary"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link
            href="/#search-bar"
            className="hidden min-h-11 items-center rounded-lg border border-outline-variant/60 px-4 text-label-md text-on-surface transition-all duration-200 hover:bg-surface-container-high md:inline-flex"
          >
            Check Dates
          </Link>
          <Link
            href="/#accommodations"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-3 text-label-md text-on-primary shadow-sm transition-all duration-200 hover:bg-primary-container active:scale-[0.98] sm:gap-2 sm:px-4"
          >
            <span>Book Your Stay</span>
            <Icon name="north_east" className="hidden text-[16px] xs:block sm:block" />
          </Link>
          <MobileNav links={navLinks} />
        </div>
      </div>
    </header>
  );
}

/** Shared estate lockup, used by the checkout and cab headers. */
export function BrandLockup() {
  return (
    <Link href="/" className="group flex min-h-11 min-w-0 items-center gap-2.5 sm:gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container transition-transform duration-200 group-hover:scale-95">
        <Icon name="nature" className="text-lg" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-display text-headline-sm font-semibold leading-tight tracking-tight text-primary sm:text-headline-md">
          Meadowfall Homestay
        </span>
        <span className="hidden text-label-sm font-medium tracking-wider text-on-surface-variant sm:block">
          RETREAT &amp; TEA ESTATE
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
          <div className="hidden items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-label-md text-primary md:flex">
            <Icon name="lock" filled className="text-base" />
            <span>Secure Direct Booking</span>
          </div>
          <a
            href={hosts.phoneHref}
            className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-on-surface-variant transition-colors duration-200 hover:bg-surface-container hover:text-primary sm:px-0"
          >
            <Icon name="phone_in_talk" className="text-xl text-primary" />
            <span className="hidden text-left md:block">
              <span className="block text-label-sm uppercase tracking-wider text-outline">
                Host Assistance
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
  { label: "Dates & Details", short: "Details", href: "#stay-summary" },
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
              <span className="hidden sm:inline">3. Finalize Reservation</span>
            </span>
          </span>
        </nav>
        <div className="hidden shrink-0 items-center gap-2 text-label-sm text-primary md:flex">
          <Icon name="verified" filled className="text-sm text-secondary" />
          <span>Guaranteed Direct Price • No Booking Fees</span>
        </div>
      </div>
    </div>
  );
}
