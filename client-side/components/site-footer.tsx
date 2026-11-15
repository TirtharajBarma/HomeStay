import Link from "next/link";

import { siteConfig } from "@/lib/site-config";
import { waNumber } from "@/lib/whatsapp";

import { Icon } from "./icon";
import { NewsletterForm } from "./newsletter-form";

const linkClass =
  "inline-flex py-1 text-xs sm:text-body-sm text-on-surface-variant transition-colors duration-150 hover:text-primary active:opacity-75";

const supportPhone = siteConfig.supportPhone || process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "";
const cleanPhone = waNumber(supportPhone);
const supportEmail = siteConfig.supportEmail;

const supportLinks = [
  ...(supportPhone ? [{ href: `tel:${supportPhone.replace(/\s+/g, "")}`, label: supportPhone }] : []),
  ...(supportEmail ? [{ href: `mailto:${supportEmail}`, label: supportEmail }] : []),
  ...(cleanPhone ? [{ href: `https://wa.me/${cleanPhone}`, label: "WhatsApp desk" }] : []),
];

const columns = [
  {
    title: "Stay & rest",
    links: [
      { href: "/#accommodations", label: "Browse homestays" },
      { href: "/#experiences", label: "Local experiences" },
      { href: "/#story", label: `About ${siteConfig.appName}` },
    ],
  },
  {
    title: "Transit & drivers",
    links: [
      { href: "/cab-request", label: "Hill cabs & transfers" },
      { href: "/join-driver", label: "Drive with us (driver sign-up)" },
    ],
  },
  {
    title: "Support & legal",
    links: [
      ...supportLinks,
      { href: "/legal/privacy", label: "Privacy policy" },
      { href: "/legal/terms", label: "Terms of service" },
      { href: "/legal/refunds", label: "Refund & cancellation policy" },
      { href: "/delete-account", label: "Account deletion" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-outline-variant/60 bg-surface-container-low">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 pt-8 pb-16 sm:px-6 sm:py-10 md:py-12 md:flex-row">
        <div className="w-full max-w-md">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
              <Icon name="cottage" className="text-[16px]" />
            </span>
            <span className="font-display text-headline-sm font-medium text-primary">
              {siteConfig.appName}
            </span>
          </div>
          <p className="mb-4 text-body-sm text-on-surface-variant leading-relaxed">
            Authentic Himalayan homestays, local host hospitality, and verified door-to-door hill transfers across Darjeeling, Kalimpong, and Sikkim.
          </p>
          <NewsletterForm />
          <p className="mt-4 text-label-sm text-outline">
            © {new Date().getFullYear()} {siteConfig.appName} Network. Local hosts and mountain drivers.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 sm:gap-8 md:w-auto md:gap-12">
          {columns.map((column, index) => (
            <div key={column.title} className={index === 2 ? "col-span-2 sm:col-span-1" : "col-span-1"}>
              <span className="mb-2 block text-label-md font-medium text-primary">
                {column.title}
              </span>
              <ul className="space-y-1.5 text-body-sm">
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
