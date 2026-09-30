"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

const guides = [
  {
    icon: "calendar_month",
    title: "Managing the calendar",
    body: "Move between ranges, switch between timeline, month, and list views, and open any reservation bar to inspect the folio.",
    href: "/calendar",
    cta: "Open calendar",
  },
  {
    icon: "bed",
    title: "Rooms, rates & rules",
    body: "Set base rates, seasonal pricing rules, block dates, and maintenance holds for any unit.",
    href: "/rooms",
    cta: "Open rooms",
  },
  {
    icon: "group",
    title: "Bookings & guests",
    body: "Search the reservation ledger, review guest profiles, and track outstanding balances.",
    href: "/bookings",
    cta: "Open bookings",
  },
  {
    icon: "cleaning_services",
    title: "Housekeeping turnovers",
    body: "Work through turnover checklists and see which units are ready for the next arrival.",
    href: "/housekeeping",
    cta: "Open housekeeping",
  },
];

const faqs = [
  {
    q: "How do I add a dynamic pricing rule?",
    a: "Open Rooms & Categories, scroll to Dynamic Pricing Rules, and choose Add Dynamic Rule. Rules evaluate by date range and can be toggled on or off at any time.",
  },
  {
    q: "Why does a reservation show as blocked?",
    a: "Blocked bars come from maintenance holds or owner stays. They occupy the room so it cannot be booked, but they are excluded from revenue and occupancy totals.",
  },
  {
    q: "How do I export data?",
    a: "Calendar exports the visible range to CSV, Earnings exports the financial report, and Bookings exports the filtered reservation ledger.",
  },
];

export function HelpView() {
  const [open, setOpen] = useState<string | null>(faqs[0].q);

  return (
    <main className="mt-14 min-h-screen lg:mt-16 lg:ml-[var(--rail-w)]">
      <div className="mx-auto max-w-[1360px] p-4 pb-space-xl md:p-space-lg">
        <div className="mb-6 flex flex-col gap-1.5 border-b border-outline-variant/30 pb-6">
          <nav className="flex items-center gap-2 text-label-sm text-label-sm text-outline">
            <span>Meadowfall Homestay</span>
            <Icon name="chevron_right" className="text-[14px]" />
            <span className="font-medium text-primary">Help &amp; Guide</span>
          </nav>
          <h1 className="text-headline-lg-mobile text-headline-lg-mobile font-semibold tracking-tight text-primary md:text-headline-lg">
            Help &amp; Guide
          </h1>
          <p className="max-w-2xl text-body-md text-body-md text-on-surface-variant">
            Short answers and shortcuts for running the estate dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <section className="clay-card rounded-xl p-4 md:p-space-lg">
            <h2 className="text-headline-sm text-headline-sm font-semibold text-primary">
              Where to start
            </h2>
            <ul className="mt-4 space-y-3">
              {guides.map((guide) => (
                <li
                  key={guide.title}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-4"
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
                    <Icon name={guide.icon} className="text-[20px]" />
                  </span>
                  <div className="min-w-[10rem] flex-1">
                    <h3 className="text-title-md text-title-md font-semibold text-on-surface">
                      {guide.title}
                    </h3>
                    <p className="mt-0.5 text-body-sm text-body-sm text-on-surface-variant">
                      {guide.body}
                    </p>
                  </div>
                  <a
                    href={guide.href}
                    className="ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-outline-variant/50 px-3 py-2 text-label-md text-label-md font-semibold text-primary transition-colors hover:bg-primary-tint"
                  >
                    {guide.cta}
                    <Icon name="arrow_forward" className="text-[16px]" />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="clay-card rounded-xl p-4 md:p-space-lg">
            <h2 className="text-headline-sm text-headline-sm font-semibold text-primary">
              Frequently asked
            </h2>
            <ul className="mt-4 divide-y divide-outline-variant/20 border-y border-outline-variant/20">
              {faqs.map((faq) => {
                const expanded = open === faq.q;
                return (
                  <li key={faq.q}>
                    <h3>
                      <button
                        onClick={() => setOpen(expanded ? null : faq.q)}
                        aria-expanded={expanded}
                        className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-body-md text-body-md font-semibold text-on-surface transition-colors hover:text-primary"
                      >
                        {faq.q}
                        <Icon
                          name={expanded ? "expand_less" : "expand_more"}
                          className="flex-shrink-0 text-[20px] text-outline"
                        />
                      </button>
                    </h3>
                    {expanded ? (
                      <p className="pb-4 pr-6 text-body-sm text-body-sm text-on-surface-variant">
                        {faq.a}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
