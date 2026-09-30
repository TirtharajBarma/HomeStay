"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/download";
import {
  channelFeeds,
  houseRules,
  identityFields,
  settingsTabs,
  welcomeTemplate,
} from "@/lib/settings-data";

const icalFeed = "https://meadowfallretreat.com/api/v1/ical/feeds/estate-all.ics";

function SectionHeader({
  icon,
  title,
  subtitle,
  aside,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-outline-variant/20 pb-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary">
          <Icon name={icon} className="text-[20px]" />
        </div>
        <div>
          <h3 className="text-headline-sm text-headline-sm text-primary">
            {title}
          </h3>
          {subtitle ? (
            <p className="text-body-sm text-body-sm text-outline">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {aside}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        on ? "bg-primary" : "bg-surface-container-high"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

const inputClass =
  "w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3.5 py-2.5 text-body-md text-body-md text-on-surface transition-all focus:border-primary focus:ring-2 focus:ring-primary/20";
const iconInputClass = `${inputClass} pl-10`;

export function SettingsWorkspace() {
  const [tab, setTab] = useState(0);
  const [rules, setRules] = useState(houseRules);
  const [preArrival, setPreArrival] = useState(true);
  const [pinGen, setPinGen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [welcome, setWelcome] = useState(welcomeTemplate);
  const [syncing, setSyncing] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState("Direct Deposit (Bank of New England ••4819)");
  const [payoutThreshold, setPayoutThreshold] = useState("$500.00");
  const { notify } = useToast();

  const toggleRule = (index: number) =>
    setRules((current) =>
      current.map((rule, i) => (i === index ? { ...rule, on: !rule.on } : rule)),
    );

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 border-b border-outline-variant/30 pb-6 md:flex-row md:items-end">
        <div>
          <nav className="mb-2 flex items-center gap-2 text-label-sm text-label-sm text-outline">
            <span>Homestay Operations</span>
            <Icon name="chevron_right" className="text-[14px]" />
            <span className="font-medium text-primary">
              System &amp; Estate Settings
            </span>
          </nav>
          <h1 className="text-headline-lg text-headline-lg tracking-tight text-primary">
            Homestay &amp; Operations Settings
          </h1>
          <p className="mt-1 max-w-2xl text-body-md text-body-md text-on-surface-variant">
            Manage your property profile, check-in instructions, payout bank
            accounts, channel syncs, and guest communication.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setRules(houseRules);
              setPreArrival(true);
              setPinGen(true);
              setWelcome(welcomeTemplate);
              setSaved(false);
              setTab(0);
              notify("Unsaved changes discarded.", { icon: "undo" });
            }}
            className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-4 py-2.5 text-label-md text-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container active:scale-[0.98]"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 2400);
            }}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-label-md text-label-md text-on-primary shadow-sm transition-all active:scale-[0.98] ${
              saved ? "bg-primary-container" : "bg-primary hover:bg-primary-container"
            }`}
          >
            <Icon name={saved ? "done_all" : "check"} className="text-[18px]" />
            <span>{saved ? "Saved Successfully" : "Save Changes"}</span>
          </button>
        </div>
      </section>

      <div className="custom-scrollbar -mx-1 overflow-x-auto border-b border-outline-variant/30 px-1 pb-px">
        <div className="flex min-w-max gap-6 whitespace-nowrap md:gap-8">
          {settingsTabs.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setTab(index)}
              aria-current={index === tab ? "page" : undefined}
              className={
                index === tab
                  ? "flex items-center gap-2 border-b-2 border-primary pb-3.5 text-label-md text-label-md text-primary"
                  : "flex items-center gap-2 border-b-2 border-transparent pb-3.5 text-label-md text-label-md text-outline transition-colors hover:text-on-surface"
              }
            >
              <Icon name={item.icon} className="text-[18px]" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 items-start lg:gap-8">
        <div className="col-span-12 min-w-0 space-y-8 lg:col-span-8">
          <section className="clay-lift space-y-6 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 md:p-space-lg">
            <SectionHeader
              icon="villa"
              title="Estate Identity & Contact Information"
              subtitle="Public retreat profile shown in itineraries and booking confirmations"
              aside={
                <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 text-label-sm text-label-sm font-medium text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Verified Retreat
                </span>
              }
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              {identityFields.map((field) => (
                <div
                  key={field.name}
                  className={field.span ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}
                >
                  <label
                    htmlFor={field.name}
                    className="block text-label-md text-label-md text-on-surface-variant"
                  >
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      id={field.name}
                      name={field.name}
                      type={field.type ?? "text"}
                      defaultValue={field.value}
                      className={field.icon ? iconInputClass : inputClass}
                    />
                    {field.icon ? (
                      <Icon
                        name={field.icon}
                        className="absolute top-3 left-3 text-[18px] text-outline"
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="clay-lift space-y-6 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 md:p-space-lg">
            <SectionHeader
              icon="schedule"
              title="Guest Hospitality & Check-In Rules"
              subtitle="Turnover logistics, guest arrival boundaries, and home regulations"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              {[
                {
                  icon: "login",
                  label: "Standard Check-In Window",
                  value: "3:00 PM – 8:00 PM",
                  detail:
                    "Late arrival self-check-in keypad code enabled automatically.",
                },
                {
                  icon: "logout",
                  label: "Standard Check-Out Time",
                  value: "11:00 AM",
                  detail:
                    "Turnover buffer: 4 hours (Housekeeping prep until 3:00 PM).",
                },
              ].map((slot) => (
                <div
                  key={slot.label}
                  className="flex items-start gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-primary shadow-sm">
                    <Icon name={slot.icon} className="text-[18px]" />
                  </div>
                  <div className="space-y-1">
                    <span className="tracking-wider text-label-sm text-label-sm uppercase text-outline">
                      {slot.label}
                    </span>
                    <div className="text-title-md text-title-md text-on-surface">
                      {slot.value}
                    </div>
                    <p className="text-body-sm text-body-sm text-on-surface-variant">
                      {slot.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="tracking-wider text-label-md text-label-md uppercase text-outline">
                Active Estate Rules &amp; Policies
              </h4>
              {rules.map((rule, index) => (
                <div
                  key={rule.title}
                  className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant/30 p-3.5 transition-colors hover:border-outline-variant/60 sm:items-center"
                >
                  <div className="flex items-center gap-3">
                    <Icon name={rule.icon} className="text-[20px] text-primary" />
                    <div>
                      <p className="text-body-md text-body-md font-medium text-on-surface">
                        {rule.title}
                      </p>
                      <p className="text-body-sm text-body-sm text-outline">
                        {rule.detail}
                      </p>
                    </div>
                  </div>
                  <Toggle
                    on={rule.on}
                    onChange={() => toggleRule(index)}
                    label={rule.title}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="clay-lift space-y-6 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 md:p-space-lg">
            <SectionHeader
              icon="mark_email_read"
              title="Automated Guest Messaging & Welcome Note"
              subtitle="Curate the welcoming cadence before guests arrive at the estate"
            />

            <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary-tint/60 p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <Icon
                  name="forward_to_inbox"
                  className="text-[22px] text-primary"
                />
                <div>
                  <p className="text-body-md text-body-md font-semibold text-primary">
                    Send automated Pre-Arrival Guide 48 hours before check-in
                  </p>
                  <p className="text-body-sm text-body-sm text-on-surface-variant">
                    Includes driving directions, gate access, and custom keypad
                    pin
                  </p>
                </div>
              </div>
              <Toggle
                on={preArrival}
                onChange={() => setPreArrival((value) => !value)}
                label="Send automated pre-arrival guide"
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="welcomeTemplate"
                  className="block text-label-md text-label-md text-on-surface-variant"
                >
                  Welcome Letter Editorial Template
                </label>
                <div className="flex flex-wrap gap-2">
                  {["{Guest_First_Name}", "{Room_Name}", "{Keypad_PIN}"].map(
                    (token) => (
                      <span
                        key={token}
                        className="rounded bg-surface-container px-2 py-0.5 font-mono text-label-sm text-label-sm text-on-surface-variant"
                      >
                        {token}
                      </span>
                    ),
                  )}
                </div>
              </div>
              <textarea
                id="welcomeTemplate"
                value={welcome}
                onChange={(event) => setWelcome(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 font-serif text-body-md text-body-md leading-relaxed text-on-surface transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3.5">
              <input
                id="pin-gen"
                type="checkbox"
                checked={pinGen}
                onChange={(event) => setPinGen(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
              />
              <label
                htmlFor="pin-gen"
                className="cursor-pointer text-body-sm text-body-sm text-on-surface"
              >
                <span className="font-semibold">
                  Auto-generate 4-digit keypad pin from guest phone number
                </span>{" "}
                (last 4 digits). Syncs directly with smart locks at Main Lodge,
                Stone Barn, and Cottage suites.
              </label>
            </div>
          </section>
        </div>

        <div className="col-span-12 min-w-0 space-y-8 lg:col-span-4">
          <section className="clay-lift space-y-5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 md:p-space-lg">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2.5">
                <Icon name="sync" className="text-[20px] text-primary" />
                <h3 className="text-headline-sm text-headline-sm text-primary">
                  Channel Sync (iCal)
                </h3>
              </div>
              <span className="rounded-full bg-primary-tint px-2 py-0.5 text-label-sm text-label-sm font-medium text-primary">
                All active
              </span>
            </div>

            <p className="text-body-sm text-body-sm text-outline">
              Synchronize direct bookings with external boutique booking
              platforms to avoid calendar collisions.
            </p>

            <div className="space-y-3">
              {channelFeeds.map((feed) => (
                <div
                  key={feed.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface p-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${feed.tint}`}
                    >
                      {feed.initials}
                    </div>
                    <div className="min-w-0">
                      <h5 className="truncate text-body-md text-body-md font-semibold text-on-surface">
                        {feed.name}
                      </h5>
                      <p className="truncate text-label-sm text-label-sm text-outline">
                        {feed.lastSync}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1 text-primary">
                    <Icon name="check_circle" className="text-[18px]" />
                    <span className="text-label-sm text-label-sm font-medium">
                      Healthy
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 pt-2">
              <label
                htmlFor="icalFeed"
                className="block text-label-sm text-label-sm font-medium text-on-surface-variant"
              >
                Direct Estate iCal Feed URL
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="icalFeed"
                  readOnly
                  value={icalFeed}
                  className="w-full truncate rounded-lg border border-outline-variant/40 bg-surface-container-low px-2.5 py-1.5 font-mono text-label-sm text-label-sm text-outline"
                />
                <button
                  type="button"
                  title="Copy Link"
                  aria-label="Copy iCal feed link"
                  onClick={async () => {
                    const ok = await copyText(icalFeed);
                    notify(
                      ok ? "iCal feed link copied to clipboard." : "Copy failed — select the link and copy manually.",
                      { icon: ok ? "check_circle" : "error", tone: ok ? "success" : "default" },
                    );
                  }}
                  className="flex items-center justify-center rounded-lg border border-outline-variant/50 px-2.5 py-1.5 text-on-surface-variant transition-colors hover:bg-surface-container"
                >
                  <Icon name="content_copy" className="text-[16px]" />
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setSyncing(true);
                window.setTimeout(() => {
                  setSyncing(false);
                  notify("All channel feeds synced. 14 reservations updated.", {
                    icon: "check_circle",
                    tone: "success",
                  });
                }, 700);
              }}
              disabled={syncing}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary py-2.5 text-label-md text-label-md text-primary transition-colors hover:bg-primary hover:text-on-primary disabled:opacity-70"
            >
              <Icon
                name={syncing ? "progress_activity" : "refresh"}
                className={`text-[18px] ${syncing ? "animate-spin" : ""}`}
              />
              <span>{syncing ? "Syncing feeds..." : "Sync All Feeds Now"}</span>
            </button>
          </section>

          <section className="clay-lift space-y-5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 md:p-space-lg">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2.5">
                <Icon name="account_balance" className="text-[20px] text-primary" />
                <h3 className="text-headline-sm text-headline-sm text-primary">
                  Payouts &amp; Banking
                </h3>
              </div>
              <Icon name="more_horiz" className="text-[18px] text-outline" />
            </div>

            <div className="space-y-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
              <div className="flex items-center justify-between">
                <span className="tracking-wider text-label-sm text-label-sm uppercase text-outline">
                  Connected Account
                </span>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-label-sm text-label-sm font-medium text-primary">
                  Primary
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-primary shadow-sm">
                  <Icon name="savings" className="text-[20px]" />
                </div>
                <div>
                  <h4 className="text-body-md text-body-md font-semibold text-on-surface">
                    Vermont Community Bank
                  </h4>
                  <p className="text-body-sm text-body-sm text-outline">
                    Business Checking •••• 4819
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 text-body-sm text-body-sm">
              {[
                { label: "Payout Schedule:", value: "Weekly on Mondays", mono: false },
                { label: "Transfer Mode:", value: "Automatic ACH", mono: false },
                { label: "Tax ID / VAT:", value: "W-9 Verified (2024)", mono: true },
              ].map((row, index) => (
                <div
                  key={row.label}
                  className={
                    index < 2
                      ? "flex items-center justify-between border-b border-outline-variant/20 py-1.5"
                      : "flex items-center justify-between py-1.5"
                  }
                >
                  <span className="text-outline">{row.label}</span>
                  {row.mono ? (
                    <span className="rounded bg-primary-tint px-2 py-0.5 font-mono text-label-md text-label-md text-primary">
                      {row.value}
                    </span>
                  ) : (
                    <span
                      className={
                        index === 0 ? "font-semibold text-on-surface" : "text-on-surface"
                      }
                    >
                      {row.value}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setPayoutOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface-container py-2 text-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              <Icon name="edit" className="text-[16px]" />
              <span>Manage Payout Settings</span>
            </button>

            <Modal
              open={payoutOpen}
              onClose={() => setPayoutOpen(false)}
              title="Payout settings"
              description="Where and when earnings are transferred."
              icon="account_balance"
              size="sm"
              footer={
                <>
                  <button
                    onClick={() => setPayoutOpen(false)}
                    className="rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setPayoutOpen(false);
                      notify("Payout settings updated.", { icon: "check_circle", tone: "success" });
                    }}
                    className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
                  >
                    Save settings
                  </button>
                </>
              }
            >
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="payout-method"
                    className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
                  >
                    Method
                  </label>
                  <select
                    id="payout-method"
                    data-autofocus
                    value={payoutMethod}
                    onChange={(event) => setPayoutMethod(event.target.value)}
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
                  >
                    {[
                      "Direct Deposit (Bank of New England •4819)",
                      "Instant Payout (•4819)",
                      "Paper Check (PO Box 214, Keene NH)",
                    ].map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="payout-threshold"
                    className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
                  >
                    Minimum balance for automatic payout
                  </label>
                  <input
                    id="payout-threshold"
                    value={payoutThreshold}
                    onChange={(event) => setPayoutThreshold(event.target.value)}
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
                  />
                </div>
              </div>
            </Modal>
          </section>

          <div className="flex items-start gap-3 rounded-xl border border-secondary/20 bg-secondary-tint/40 p-4">
            <Icon
              name="support_agent"
              className="mt-0.5 text-[20px] text-secondary"
            />
            <div className="space-y-1">
              <p className="text-body-sm text-body-sm font-semibold text-secondary">
                Local Support Concierge
              </p>
              <p className="leading-relaxed text-label-sm text-label-sm text-on-surface-variant">
                Need on-site assistance with door lock hardware or seasonal tax
                filings? Contact your estate advisor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
