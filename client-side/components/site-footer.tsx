import Link from "next/link";

import { siteConfig } from "@/lib/site-config";
import { waNumber } from "@/lib/whatsapp";

import { Icon } from "./icon";
import { NewsletterForm } from "./newsletter-form";

const linkClass =
  "inline-flex py-1 text-xs sm:text-body-sm text-on-surface-variant transition-colors duration-150 hover:text-primary active:opacity-75";

const supportPhone = siteConfig.supportPhone || process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "";
const cleanPhone = waNumber(supportPhone);
const supportEmail = siteConfig.supportEmail || "support@staycabs.in";

const columns = [
  {
    title: "Homestay Platform",
    links: [
      { href: "/#story", label: "Product Features" },
      { href: "/#transit", label: "Built for the Hills" },
      { href: "/#launchpad", label: "Pricing (₹0 Forever)" },
      { href: "/#faq", label: "Frequently Asked Questions" },
      { href: "/#register", label: "Register Your Homestay" },
    ],
  },
  {
    title: "Drivers & Guests",
    links: [
      { href: "/join-driver", label: "Join as Driver Partner" },
      { href: "/cab-request", label: "Guest Cab Concierge" },
      { href: "/download", label: "Download Android App (APK)" },
      { href: "/#transit", label: "Verified Hill Routes" },
    ],
  },
  {
    title: "Hill Regions",
    links: [
      { href: "/#transit", label: "Darjeeling & Ghum" },
      { href: "/#transit", label: "Kalimpong & Lava" },
      { href: "/#transit", label: "Gangtok & North Sikkim" },
      { href: "/#transit", label: "NJP & Bagdogra Transfers" },
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
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-6 sm:px-6 sm:py-10 md:py-12 md:flex-row md:gap-10">
        <div className="w-full max-w-md space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
              <Icon name="cottage" className="text-base" />
            </span>
            <span className="font-display text-lg font-bold text-primary">
              {siteConfig.appName}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            The free operating system for Himalayan homestays and mountain drivers. Manage rooms, guest records, and Bagdogra/NJP cabs from one screen.
          </p>
          {/* <div className="inline-flex items-center gap-1.5 rounded-lg bg-primary-fixed px-2.5 py-1 text-[11px] font-semibold text-primary border border-primary/15">
            <Icon name="verified" filled className="text-xs text-primary" />
            <span>100% Free Forever for Homestay Hosts</span>
          </div> */}

          <div className="pt-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-outline mb-1.5">
              Stay in touch
            </div>
            <NewsletterForm />
          </div>
        </div>

        {/* Complete 4-column links for both Mobile (2x2) and Desktop (1x4) - nothing trimmed */}
        <div className="grid w-full grid-cols-2 gap-6 sm:grid-cols-4 md:max-w-2xl">
          {columns.map((col) => (
            <div key={col.title} className="flex flex-col">
              <div className="mb-2 text-xs font-semibold text-primary">
                {col.title}
              </div>
              <ul className="flex flex-col space-y-1">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="inline-flex py-0.5 text-xs text-on-surface-variant transition-colors hover:text-primary">
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
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] text-[11px] text-outline sm:flex-row sm:px-6 sm:pb-3">
          <p>© {new Date().getFullYear()} {siteConfig.appName}. All rights reserved. Made for the hills.</p>
          <p className="flex items-center gap-2">
            <span>Darjeeling · Kalimpong · Sikkim</span>
            <span>•</span>
            <span className="text-primary font-medium">Direct Driver Payouts · Fair Mountain Rates</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
