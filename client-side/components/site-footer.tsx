import Link from "next/link";

import { hosts } from "@/lib/content";

import { Icon } from "./icon";
import { NewsletterForm } from "./newsletter-form";

const linkClass =
  "inline-flex min-h-9 items-center text-body-sm text-on-surface-variant transition-colors duration-150 hover:text-primary";

const columns = [
  {
    title: "Stay & Rest",
    links: [
      { href: "/#accommodations", label: "The Accommodations" },
      { href: "/#experiences", label: "Things To Do" },
      { href: "/#story", label: "The Hill Homestay Story" },
    ],
  },
  {
    title: "Homestay Guide",
    links: [
      { href: "/stays/takdah-heritage-bungalow#house-rules", label: "House Rules & Policies" },
      { href: "/#story", label: "Booking Through The Collective" },
      { href: "/#contact", label: "Directions & Arrival" },
    ],
  },
  {
    title: "Keep in Touch",
    links: [
      { href: hosts.phoneHref, label: hosts.phone },
      { href: `mailto:${hosts.email}`, label: hosts.email },
      { href: `mailto:${hosts.bookingEmail}`, label: hosts.bookingEmail },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-outline-variant/50 bg-surface-container">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 py-12 sm:px-6 md:flex-row">
        <div className="w-full max-w-md">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-surface-container-lowest">
              <Icon name="forest" className="text-[18px]" />
            </span>
            <span className="font-display text-headline-md font-semibold text-primary">
              Darjeeling HomeStay
            </span>
          </div>
          <p className="mb-4 text-body-sm text-on-surface-variant">
            Six hill homestays, heritage bungalows and working tea estates across Darjeeling —
            booked direct, at the rate each property publishes.
          </p>
          <NewsletterForm />
          <p className="mt-4 text-body-sm text-outline">
            © 2026 Darjeeling HomeStay. Prices in INR, exclusive of GST unless the property states
            otherwise.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-8 xs:grid-cols-2 md:w-auto md:gap-10 lg:grid-cols-3 lg:gap-12">
          {columns.map((column) => (
            <div key={column.title}>
              <span className="mb-1 block text-label-md font-bold uppercase tracking-wider text-primary">
                {column.title}
              </span>
              <ul className="space-y-0.5 text-body-sm">
                {column.links.map((link) =>
                  /^(mailto:|tel:)/.test(link.href) ? (
                    <li key={link.label}>
                      <a href={link.href} className={`${linkClass} break-all`}>
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
