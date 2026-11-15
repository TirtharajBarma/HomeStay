import Link from "next/link";

import { siteConfig } from "@/lib/site-config";
import { waNumber } from "@/lib/whatsapp";

import { Icon } from "./icon";
import { NewsletterForm } from "./newsletter-form";

const linkClass =
  "inline-flex py-1 text-xs sm:text-body-sm text-on-surface-variant transition-colors duration-150 hover:text-primary active:opacity-75";

const supportPhone = siteConfig.supportPhone || process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "+91 98320 12345";
const cleanPhone = waNumber(supportPhone);
const supportEmail = siteConfig.supportEmail || "support@staycabs.in";

const columns = [
  {
    title: "Homestay Platform",
    links: [
      { href: "/#features", label: "Product Features" },
      { href: "/#how-it-works", label: "How It Works" },
      { href: "/#hills", label: "Built for the Hills" },
      { href: "/#pricing", label: "Pricing (₹0 Forever)" },
      { href: "/#faq", label: "Frequently Asked Questions" },
      { href: "#register", label: "Register Your Homestay" },
    ],
  },
  {
    title: "Drivers & Guests",
    links: [
      { href: "/join-driver", label: "Join as a Driver" },
      { href: "/driver-quote", label: "Driver Bidding Desk" },
      { href: "/cab-request", label: "Guest Cab Request" },
      { href: "/#driver-network", label: "Our Mountain Fleet" },
    ],
  },
  {
    title: "Hill Regions",
    links: [
      { href: "/#hills", label: "Darjeeling & Ghum" },
      { href: "/#hills", label: "Kalimpong & Lava" },
      { href: "/#hills", label: "Gangtok & North Sikkim" },
      { href: "/#hills", label: "NJP & Bagdogra Transfers" },
    ],
  },
  {
    title: "Support & Legal",
    links: [
      ...(supportPhone ? [{ href: `tel:${supportPhone.replace(/\s+/g, "")}`, label: supportPhone }] : []),
      ...(supportEmail ? [{ href: `mailto:${supportEmail}`, label: supportEmail }] : []),
      ...(cleanPhone ? [{ href: `https://wa.me/${cleanPhone}`, label: "WhatsApp Support" }] : []),
      { href: "/legal/privacy", label: "Privacy Policy" },
      { href: "/legal/terms", label: "Terms of Service" },
      { href: "/legal/refunds", label: "Refund & Cancellation Policy" },
      { href: "/delete-account", label: "Account Deletion" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-outline-variant/60 bg-surface-container-low">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 px-4 pt-10 pb-16 sm:px-6 sm:py-12 md:py-14 md:flex-row">
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm shadow-primary/20">
              <Icon name="cottage" className="text-[18px]" />
            </span>
            <span className="font-display text-headline-sm font-semibold text-primary">
              {siteConfig.appName}
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant leading-relaxed">
            A free homestay management and local cab booking platform built specifically for the hills.
            Manage rooms, track guests, and arrange verified hill transfers in one modern dashboard.
          </p>
          <div className="inline-flex items-center gap-2 rounded-lg bg-primary-fixed px-3 py-1.5 text-label-sm font-semibold text-primary border border-primary/15">
            <Icon name="verified" filled className="text-base text-primary" />
            <span>Completely Free for Homestay Owners · No Subscriptions</span>
          </div>

          <div className="pt-2">
            <div className="text-label-sm font-semibold uppercase tracking-wider text-outline mb-2">
              Stay in touch
            </div>
            <NewsletterForm />
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-8 sm:grid-cols-4 md:max-w-2xl">
          {columns.map((col) => (
            <div key={col.title} className="flex flex-col">
              <div className="mb-3 text-label-md font-semibold text-primary">
                {col.title}
              </div>
              <ul className="flex flex-col space-y-1">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-outline-variant/40 bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-label-sm text-outline sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} {siteConfig.appName}. All rights reserved. Made for the hills.</p>
          <p className="flex items-center gap-2">
            <span>Darjeeling · Kalimpong · Sikkim</span>
            <span>•</span>
            <span className="text-primary font-medium">100% Cash Direct to Drivers &amp; Hosts</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
