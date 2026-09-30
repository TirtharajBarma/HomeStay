"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { NewBookingDialog } from "@/components/new-booking-dialog";
import { NotificationsBell } from "@/components/notifications";
import { MenuRow, Popover } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { estates, todayLabel } from "@/lib/navigation";

export const hostPortraits = {
  eleanorThomas:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDGFBU8MV8vsk4iJ6V2FMdHXlfVhBIKfw-QO3omtcppx3ELJ3WFLYdyFuPEO0hahn9HOlK-WIH1nrKLDPjCC-P0ZONQS1E0vWjRaNk2IK8cPWLClzF2p8K4RqpbbYVICHdEjvTUHaguYXzpsw7lw-xJaCv-RfxMiC6OdSg6OMpTD0cL5YWchbs3XbvBhsJSBwlEi0LghlBzjosxAEoDwncgeWiLxqyperFcP1U2hJSxeq949gfMTA2C",
};

const dateRanges = [
  { label: todayLabel, hint: "Today · 83% occupancy" },
  { label: "Next 14 days", hint: "Oct 25 – Nov 7" },
  { label: "Autumn peak", hint: "Oct 18 – Nov 15" },
  { label: "Full year 2024", hint: "Jan 1 – Dec 31" },
];

type TopNavProps = {
  /** Plain title, used by Rooms & Settings. */
  title?: string;
  titleIcon?: string;
  showTitleDivider?: boolean;
  /** Pill-style whole-estate selector, used by Earnings. */
  propertyPill?: string;
  status?: ReactNode;
  estateLinks?: string[];
  estateActiveIndex?: number;
  /** `xl` shows the links; smaller widths collapse them like the source. */
  estateLinksClass?: string;
  dateIcon?: string;
  datePillTone?: "container" | "container-low" | "plain";
  notifyDot?: boolean;
  showActionDivider?: boolean;
  actionIcon?: string;
  actionLabel?: string;
  showAvatar?: boolean;
};

export function TopNav({
  title,
  titleIcon,
  showTitleDivider = false,
  propertyPill,
  status,
  estateLinks = estates,
  estateActiveIndex,
  estateLinksClass = "",
  dateIcon = "today",
  datePillTone = "container-low",
  notifyDot = false,
  showActionDivider = true,
  actionIcon = "add",
  actionLabel = "New Booking",
  showAvatar = false,
}: TopNavProps) {
  const [activeEstate, setActiveEstate] = useState(estateActiveIndex ?? 0);
  // null keeps the caller's own pill wording until a property is picked.
  const [activeProperty, setActiveProperty] = useState<number | null>(null);
  const propertyOptions = ["All Retreats", ...estates];
  const propertyLabel =
    activeProperty === null ? propertyPill : propertyOptions[activeProperty];
  const [range, setRange] = useState(todayLabel);
  const [booking, setBooking] = useState(false);
  const [params, setParams] = useState(false);
  const [compact, setCompact] = useState(true);
  const { notify } = useToast();

  // Capped so the header never pushes past the viewport once the rail appears at lg.
  const datePillWidth = "min-w-0 max-w-[7.5rem] sm:max-w-[11rem] 2xl:max-w-none";
  const datePill =
    datePillTone === "container"
      ? `flex items-center gap-2 rounded-lg bg-surface-container px-3 py-1.5 text-label-md text-label-md text-on-surface-variant ${datePillWidth}`
      : datePillTone === "container-low"
        ? `flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-label-md text-label-md text-on-surface-variant ${datePillWidth}`
        : `flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-1.5 text-body-sm text-body-sm text-on-surface-variant ${datePillWidth}`;

  const pickEstate = (index: number) => {
    setActiveEstate(index);
    // Estate tabs and the property switcher describe the same scope, so keep them in step.
    if (propertyPill) setActiveProperty(index);
    notify(`Viewing ${estateLinks[index]}.`);
  };

  return (
    <>
      <header className="fixed top-0 right-0 z-30 flex h-16 w-[calc(100%-var(--rail-w))] items-center justify-between gap-3 border-b border-outline-variant/30 bg-surface/90 px-3 shadow-[0_1px_3px_rgba(45,48,46,0.04)] backdrop-blur-md sm:px-4 2xl:px-space-lg">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
          {propertyPill ? (
            <Popover
              label="Property switcher"
              panelClassName="w-[min(17rem,calc(100vw-2rem))]"
              align="start"
              trigger={({ toggle, open, ...aria }) => (
                <button
                  {...aria}
                  onClick={toggle}
                  className={`flex items-center gap-2 rounded-lg border border-outline-variant/40 px-3 py-1.5 transition-colors ${
                    open ? "bg-primary-tint" : "bg-surface-container-low hover:bg-surface-container"
                  }`}
                >
                  <Icon name="villa" className="flex-shrink-0 text-[18px] text-primary" />
                  <span className="text-label-md text-label-md font-semibold text-primary">
                    {propertyLabel}
                  </span>
                  <Icon name="unfold_more" className="flex-shrink-0 text-[16px] text-outline" />
                </button>
              )}
            >
              {(close) => (
                <div className="py-1">
                  <p className="px-3 py-2 text-label-sm text-label-sm font-semibold uppercase text-outline">
                    Switch property
                  </p>
                  {propertyOptions.map((name, index) => (
                    <MenuRow
                      key={name}
                      icon="villa"
                      label={name}
                      hint={index === 0 ? "Combined portfolio" : `${2 + index} bookable units`}
                      selected={index === (activeProperty ?? 0)}
                      onSelect={() => {
                        setActiveProperty(index);
                        notify(`Scope switched to ${name}.`, { icon: "villa" });
                        close();
                      }}
                    />
                  ))}
                </div>
              )}
            </Popover>
          ) : title ? (
            <div className="flex items-center gap-2 text-on-surface-variant text-body-sm text-body-sm">
              {titleIcon ? (
                <Icon name={titleIcon} className="text-[18px] text-primary" />
              ) : null}
              <span className="truncate text-body-sm text-body-sm font-semibold text-on-surface">
                {title}
              </span>
            </div>
          ) : null}

          {showTitleDivider ? (
            <div className="h-4 w-px bg-outline-variant/40" />
          ) : null}

          <div className="flex items-center gap-5">
            <nav
              className={`${estateLinksClass || "flex"} items-center gap-5 text-label-md text-label-md`}
            >
              {estateLinks.map((estate, index) => (
                <button
                  key={estate}
                  onClick={() => pickEstate(index)}
                  aria-current={index === activeEstate ? "page" : undefined}
                  className={
                    index === activeEstate
                      ? "border-b-2 border-primary pb-0.5 font-semibold text-primary"
                      : "pb-0.5 text-on-surface-variant transition-colors hover:text-on-surface"
                  }
                >
                  {estate}
                </button>
              ))}
            </nav>
            {status ? (
              <>
                <div className="hidden items-center text-label-sm text-label-sm text-outline-variant xl:flex">
                  |
                </div>
                <div className="hidden items-center gap-2 text-body-sm text-body-sm text-outline xl:flex">
                  {status}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 sm:gap-4">
          <Popover
            label="Date range"
            align="end"
            panelClassName="w-[min(18rem,calc(100vw-2rem))]"
            trigger={({ toggle, open, ...aria }) => (
              <button
                {...aria}
                onClick={toggle}
                className={`${datePill} ${
                  open ? "border-primary/40 bg-primary-tint" : "hover:bg-surface-container-high"
                }`}
              >
                <Icon name={dateIcon} className="flex-shrink-0 text-[16px] text-outline" />
                <span className="truncate">{range}</span>
                <Icon
                  name="keyboard_arrow_down"
                  className="flex-shrink-0 text-[16px] text-outline"
                />
              </button>
            )}
          >
            {(close) => (
              <div className="py-1">
                <p className="px-3 py-2 text-label-sm text-label-sm font-semibold uppercase text-outline">
                  Reporting period
                </p>
                {dateRanges.map((entry) => (
                  <MenuRow
                    key={entry.label}
                    icon="event"
                    label={entry.label}
                    hint={entry.hint}
                    selected={entry.label === range}
                    onSelect={() => {
                      setRange(entry.label);
                      notify(`Reporting period set to ${entry.label}.`);
                      close();
                    }}
                  />
                ))}
              </div>
            )}
          </Popover>

          <div className="flex items-center gap-1 text-on-surface-variant">
            <NotificationsBell
              label="Notifications"
              forceDot={notifyDot}
              className="relative rounded-lg p-2 transition-colors hover:bg-surface-container"
              iconClassName="text-[20px]"
              dotClassName="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-secondary"
            />
            <button
              title="Adjust Parameters"
              aria-label="Adjust parameters"
              onClick={() => setParams(true)}
              className="rounded-lg p-2 transition-colors hover:bg-surface-container"
            >
              <Icon name="tune" className="text-[20px]" />
            </button>
          </div>

          {showActionDivider ? (
            <div className="mx-1 h-6 w-px bg-outline-variant/40" />
          ) : null}

          <button
            onClick={() => setBooking(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary shadow-sm transition-all hover:bg-primary-container active:scale-[0.98]"
          >
            <Icon name={actionIcon} className="text-[18px]" />
            <span>{actionLabel}</span>
          </button>

          {showAvatar ? (
            <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-primary/20">
              <Image
                src={hostPortraits.eleanorThomas}
                alt="Eleanor and Thomas, estate hosts"
                fill
                sizes="36px"
                className="object-cover"
              />
            </div>
          ) : null}
        </div>
      </header>

      <NewBookingDialog open={booking} onClose={() => setBooking(false)} />

      <Modal
        open={params}
        onClose={() => setParams(false)}
        title="Adjust parameters"
        description="Tune how the dashboard surfaces occupancy and density."
        icon="tune"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setParams(false)}
              className="rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
            >
              Reset
            </button>
            <button
              onClick={() => {
                setParams(false);
                notify("Dashboard parameters updated.", { icon: "tune", tone: "success" });
              }}
              className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
            >
              Apply
            </button>
          </>
        }
      >
        <label className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/30 p-3.5">
          <span className="min-w-0">
            <span className="block text-body-md text-body-md font-medium text-on-surface">
              Compact density
            </span>
            <span className="block text-label-sm text-label-sm text-outline">
              Tighter rows in dense tables and timelines
            </span>
          </span>
          <input
            type="checkbox"
            checked={compact}
            onChange={(event) => setCompact(event.target.checked)}
            className="h-5 w-5 flex-shrink-0 accent-[var(--color-primary)]"
          />
        </label>
      </Modal>
    </>
  );
}
