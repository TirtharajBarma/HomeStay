import Link from "next/link";

import { hosts } from "@/lib/content";

import { Icon } from "./icon";
import { NewsletterForm } from "./newsletter-form";

const linkClass =
  "inline-flex min-h-11 items-center text-body-sm text-on-surface-variant transition-colors duration-150 hover:text-primary";

const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+91 98837 57307";

const columns = [
  {
    title: "Stay & Rest",
    links: [
      { href: "/#accommodations", label: "Browse Homestays" },
      { href: "/#experiences", label: "Local Experiences" },
      { href: "/#story", label: "About StayRide" },
    ],
  },
  {
    title: "Transit & Drivers",
    links: [
      { href: "/cab-request", label: "Hill Cabs & Transfers" },
      { href: "/join-driver", label: "Drive with Us (Driver Sign-Up)" },
      { href: "/#contact", label: "Local Pickup Locations" },
    ],
  },
  {
    title: "Support & Desk",
    links: [
      { href: `tel:${supportPhone.replace(/\s+/g, "")}`, label: supportPhone },
      { href: "mailto:support@stayride.in", label: "support@stayride.in" },
      { href: "https://wa.me/919883757307", label: "WhatsApp Support" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-outline-variant/50 bg-surface-container">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 py-12 sm:px-6 md:flex-row">
        <div className="w-full max-w-md">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
              <Icon name="local_taxi" className="text-[18px]" />
            </span>
            <span className="font-display text-headline-md font-semibold text-primary">
              StayRide
            </span>
          </div>
          <p className="mb-4 text-body-sm text-on-surface-variant">
            Authentic Himalayan homestays, local host hospitality, and verified door-to-door hill transfers across Darjeeling, Kalimpong, and Sikkim.
          </p>
          <NewsletterForm />
          <p className="mt-4 text-body-sm text-outline">
            © {new Date().getFullYear()} StayRide Network. Connecting travelers with authentic hosts and local drivers.
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
