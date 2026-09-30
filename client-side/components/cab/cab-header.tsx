import Link from "next/link";

import { BrandLockup } from "@/components/site-header";
import { Icon } from "@/components/icon";
import { hosts } from "@/lib/content";
import { cn } from "@/lib/cn";

const cabSteps = [
  { label: "Your Trip", short: "Trip", href: "/cab" },
  { label: "Choose a Driver", short: "Drivers", href: "/cab/drivers" },
];

export function CabHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-surface/90 backdrop-blur-md shadow-navbar">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <BrandLockup />

        <div className="flex shrink-0 items-center gap-2 sm:gap-6">
          <span className="hidden items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-label-md text-primary md:flex">
            <Icon name="local_taxi" filled className="text-base" />
            <span>Estate Transfer</span>
          </span>
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

export function CabProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="border-b border-outline-variant/30 bg-surface-container-low">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5 text-body-sm sm:px-6">
        <nav aria-label="Cab booking progress" className="flex min-w-0 flex-1 items-center justify-between gap-0.5 sm:justify-start sm:gap-1">
          {cabSteps.map((cabStep, index) => (
            <span key={cabStep.label} className="flex min-w-0 items-center gap-0.5 sm:gap-1">
              {index > 0 && (
                <Icon name="chevron_right" className="hidden shrink-0 text-xs text-outline sm:block" />
              )}
              <Link
                href={cabStep.href}
                aria-current={step === index + 1 ? "step" : undefined}
                className={cn(
                  "flex min-h-11 min-w-0 items-center truncate rounded px-1 transition-colors hover:text-primary",
                  step === index + 1
                    ? "font-semibold text-primary"
                    : "text-on-surface-variant/70",
                )}
              >
                <span className="sm:hidden">
                  {index + 1}. {cabStep.short}
                </span>
                <span className="hidden sm:inline">
                  {index + 1}. {cabStep.label}
                </span>
              </Link>
            </span>
          ))}
          <span className="flex min-w-0 items-center gap-0.5 sm:gap-1">
            <Icon name="chevron_right" className="hidden shrink-0 text-xs text-outline sm:block" />
            <span
              aria-current={step === 3 ? "step" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 items-center truncate px-1",
                step === 3 ? "font-semibold text-primary" : "text-on-surface-variant/70",
              )}
            >
              <span className="sm:hidden">3. Booked</span>
              <span className="hidden sm:inline">3. Booking Confirmed</span>
            </span>
          </span>
        </nav>
        <div className="hidden shrink-0 items-center gap-2 text-label-sm text-primary md:flex">
          <Icon name="verified" filled className="text-sm" />
          <span>Estate Drivers • Fixed Rates</span>
        </div>
      </div>
    </div>
  );
}
