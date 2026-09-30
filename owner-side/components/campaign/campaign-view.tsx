"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import {
  PageHeader,
  PageShell,
  Panel,
  fieldClass,
  solidButton,
} from "@/components/owner/primitives";
import { useToast } from "@/components/ui/toast";
import { driverSummary } from "@/lib/drivers-data";
import { guestStats } from "@/lib/guests-data";

const planned: { title: string; body: string; icon: string; tone: string }[] = [
  {
    title: "Blast your past guests",
    body: "Pick a segment — anniversary stays, dog owners, the ones who tipped the local cafe — and send it in one go.",
    icon: "outgoing_mail",
    tone: "bg-primary-tint text-on-primary-container",
  },
  {
    title: "Seasonal offers",
    body: "Autumn foliage, ski weeks, leaf-peeping weekends: schedule a rate with a message attached.",
    icon: "local_florist",
    tone: "bg-secondary-tint text-secondary-ink",
  },
  {
    title: "Automated follow-ups",
    body: "A thank-you note two days after checkout, a review request a week later, a return-visit nudge before the season turns.",
    icon: "auto_awesome",
    tone: "bg-tertiary-fixed text-on-tertiary-fixed",
  },
  {
    title: "Rebook before they search",
    body: "Point out the dates they loved last time while the memory is still warm.",
    icon: "event_repeat",
    tone: "bg-primary-tint text-on-primary-container",
  },
];

export function CampaignView() {
  const { notify } = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  const subscribe = () => {
    if (!valid) {
      notify("Enter a valid email so we know where to reach you.", { tone: "warning" });
      return;
    }
    setSent(true);
    notify("You are on the list — we will tell you first.", {
      icon: "mark_email_read",
      tone: "success",
    });
  };

  return (
    <PageShell>
      <PageHeader
        breadcrumb="Homestay Operations"
        title="Campaign"
        description="Email campaigns for past and future guests are on the way. Here is what we are building and how to be first in line."
      />

      <div className="my-space-lg grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
        <div className="flex flex-col gap-space-lg lg:col-span-7">
          <section className="clay-card clay-lift relative overflow-hidden rounded-xl p-8">
            <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary-tint" />
            <div className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-secondary-tint" />

            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-label-sm text-label-sm font-semibold text-on-primary shadow-sm">
                <Icon name="schedule" className="text-[15px]" />
                Coming soon
              </span>

              <h2 className="mt-4 max-w-md text-headline-lg text-headline-lg font-semibold tracking-tight text-primary">
                Campaigns that sound like you wrote them
              </h2>
              <p className="mt-2 max-w-md text-body-md text-body-md text-on-surface-variant">
                We are building a campaign desk for the guest list you already have — segments,
                seasonal rates and follow-ups that go out on their own.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href="/guests"
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container"
                >
                  <Icon name="group" className="text-[18px]" />
                  Meet your guests first
                </a>
                <a
                  href="/analytics"
                  className="flex items-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-container px-4 py-2.5 text-label-md text-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container-high"
                >
                  <Icon name="query_stats" className="text-[18px]" />
                  Check the numbers
                </a>
              </div>
            </div>
          </section>

          <Panel
            title="What we are building"
            icon="construction"
            caption="Four things you should expect on day one"
          >
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {planned.map((item) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4"
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.tone}`}
                  >
                    <Icon name={item.icon} className="text-[19px]" />
                  </span>
                  <p className="mt-3 text-body-md text-body-md font-semibold text-on-surface">
                    {item.title}
                  </p>
                  <p className="mt-1 text-label-md text-label-md text-on-surface-variant">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex flex-col gap-space-lg lg:col-span-5">
          <Panel
            title="Be first to know"
            icon="notifications_active"
            caption="One email when campaigns go live — nothing else"
          >
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
                  <Icon name="mark_email_read" className="text-[24px]" />
                </span>
                <p className="text-body-md text-body-md font-semibold text-on-surface">
                  You are on the list
                </p>
                <p className="text-label-md text-label-md text-outline">
                  We will write to {email.trim()} the day campaigns open up.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label htmlFor="campaign-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="campaign-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  aria-invalid={email.length > 0 && !valid}
                  className={fieldClass}
                />
                <button onClick={subscribe} className={`${solidButton} justify-center`}>
                  <Icon name="send" className="flex-shrink-0 text-[18px]" />
                  Notify me
                </button>
                <p className="text-label-sm text-label-sm text-outline">
                  No newsletters, no upsells — just the launch note.
                </p>
              </div>
            )}
          </Panel>

          <Panel
            title="Who it will target"
            icon="groups_2"
            caption="The segments we already hold"
          >
            <ul className="flex flex-col gap-2.5">
              {[
                [guestStats.total, "guests in the directory"],
                [guestStats.returning, "worth a return-visit nudge"],
                [guestStats.vip, "VIP stays to thank by name"],
                [driverSummary.total, "drivers in the roster circle"],
              ].map(([value, label]) => (
                <li
                  key={label}
                  className="flex items-center justify-between gap-3 border-b border-outline-variant/20 pb-2.5 last:border-0 last:pb-0"
                >
                  <span className="text-body-sm text-body-sm text-on-surface-variant">{label}</span>
                  <span className="text-body-md text-body-md font-semibold text-primary">{value}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
