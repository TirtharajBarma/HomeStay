"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { hostPortraits } from "@/components/top-nav";
import { primaryNav, secondaryNav, type NavKey } from "@/lib/navigation";
import { Icon } from "./icon";
import { Popover } from "./ui/popover";
import { useToast } from "./ui/toast";

type SideNavProps = {
  active: NavKey;
  brandIcon?: string;
  footer?: ReactNode;
  /** Shows the "2 pending" housekeeping badge from the source designs. */
  housekeepingBadge?: string;
  /**
   * `fixed` is the desktop rail pinned to the viewport edge.
   * `drawer` is the off-canvas mobile panel, positioned by its container.
   */
  variant?: "fixed" | "drawer";
  onNavigate?: () => void;
  /** Opens the shared reservation dialog (desktop rail + drawer). */
  onNewBooking?: () => void;
};

export function SideNav({
  active,
  brandIcon = "nature",
  footer,
  housekeepingBadge,
  variant = "fixed",
  onNavigate,
  onNewBooking,
}: SideNavProps) {
  const positioning =
    variant === "fixed"
      ? "fixed top-0 left-0 z-40 h-screen w-[var(--rail-w)] transition-[width] duration-200 motion-reduce:transition-none"
      : "h-full w-full";

  return (
    <aside
      className={`${positioning} flex flex-col justify-between overflow-y-auto overscroll-contain border-r border-outline-variant/30 bg-surface-container-low p-space-md`}
    >
      <div className="flex flex-col gap-space-lg">
        <div className="flex items-center gap-3 overflow-hidden px-2 pt-1">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary shadow-sm">
            <Icon name={brandIcon} className="text-[22px]" />
          </div>
          <div className="flex min-w-0 flex-col overflow-hidden">
            <span className="truncate text-title-md text-title-md font-semibold tracking-tight text-primary">
              Meadowfall Homestay
            </span>
            <span className="truncate text-label-sm text-label-sm text-outline">
              Estate &amp; Retreat Operations
            </span>
          </div>
        </div>

        <div className="px-1">
          <button
            onClick={onNewBooking ?? onNavigate}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container active:scale-[0.99]"
          >
            <Icon name="add" className="text-[18px]" />
            <span>New Booking</span>
          </button>
        </div>

        <nav aria-label="Main Navigation" className="flex flex-col gap-1">
          {primaryNav.map((item) => {
            const isActive = item.key === active;
            return (
              <a
                key={item.key}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "flex items-center gap-3 rounded-lg bg-primary px-3.5 py-2.5 text-label-md text-label-md font-medium text-on-primary shadow-sm transition-all active:scale-[0.99]"
                    : "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-label-md text-label-md text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-[0.99]"
                }
              >
                <Icon
                  name={item.icon}
                  fill={isActive}
                  className="text-[20px]"
                />
                <span className="truncate">{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>

      <div className="mt-6 flex flex-col gap-2 border-t border-outline-variant/30 pt-4">
        {secondaryNav.map((item, index) => {
          const isActive = item.href === `/${active}`;
          const row =
            "flex items-center gap-3 rounded-lg px-3.5 py-2 text-label-md text-label-md transition-colors";

          return (
          <a
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? `${row} bg-primary text-on-primary`
                : housekeepingBadge && index === 0
                  ? `${row} justify-between text-on-surface-variant hover:bg-surface-container hover:text-on-surface`
                  : `${row} text-on-surface-variant hover:bg-surface-container hover:text-on-surface`
            }
          >
            {housekeepingBadge && index === 0 ? (
              <>
                <div className="flex items-center gap-3">
                  <Icon name={item.icon} className="text-[20px]" />
                  <span>{item.label}</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-label-sm text-label-sm font-semibold ${
                    isActive
                      ? "bg-on-primary/20 text-on-primary"
                      : "bg-secondary-fixed text-on-secondary-fixed"
                  }`}
                >
                  {housekeepingBadge}
                </span>
              </>
            ) : (
              <>
                <Icon name={item.icon} className="text-[20px]" />
                <span>{item.label}</span>
              </>
            )}
          </a>
          );
        })}
        {footer}
      </div>
    </aside>
  );
}

type HostCardProps = {
  name: string;
  role: string;
  /** Text-only card for caretaker/manager accounts without a portrait. */
  initials?: string;
  withPortrait?: boolean;
  chevron?: boolean;
};

export function SideNavHostCard({
  name,
  role,
  initials,
  withPortrait = false,
  chevron = false,
}: HostCardProps) {
  const { notify } = useToast();

  if (withPortrait) {
    const card = (
      <>
        <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
          <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-outline-variant/30">
            <Image
              src={hostPortraits.eleanorThomas}
              alt={`${name}, ${role}`}
              fill
              sizes="36px"
              className="object-cover"
            />
          </div>
          <div className="flex min-w-0 flex-col text-left">
            <span className="truncate text-body-sm text-body-sm font-semibold text-on-surface">
              {name}
            </span>
            <span className="truncate text-label-sm text-label-sm text-outline">
              {role}
            </span>
          </div>
        </div>
        {chevron ? (
          <Icon name="unfold_more" className="flex-shrink-0 text-[18px] text-outline" />
        ) : null}
      </>
    );

    if (!chevron) {
      return (
        <div className="mt-2 flex items-center justify-between gap-2 overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container p-2">
          {card}
        </div>
      );
    }

    return (
      <div className="mt-2">
        <Popover
          label="Account menu"
          panelClassName="w-[min(15rem,calc(100vw-2rem))]"
          trigger={({ toggle, open, ...aria }) => (
            <button
              {...aria}
              onClick={toggle}
              className={`flex w-full items-center justify-between gap-2 overflow-hidden rounded-xl border p-2 transition-colors ${
                open
                  ? "border-primary/40 bg-primary-tint"
                  : "border-outline-variant/20 bg-surface-container hover:border-primary/30"
              }`}
            >
              {card}
            </button>
          )}
        >
          {(close) => (
            <div className="py-1">
              <div className="border-b border-outline-variant/30 px-3 py-2.5">
                <p className="text-body-md text-body-md font-semibold text-primary">
                  {name}
                </p>
                <p className="text-label-sm text-label-sm text-outline">{role}</p>
              </div>
              <AccountLink
                icon="person"
                label="Host profile"
                onSelect={() => {
                  notify("Host profile is up to date.");
                  close();
                }}
              />
              <AccountLink
                icon="switch_account"
                label="Switch role"
                onSelect={() => {
                  notify("Role switcher is limited to estate owners.", { tone: "warning" });
                  close();
                }}
              />
              <AccountLink
                icon="logout"
                label="Sign out"
                onSelect={() => {
                  notify("Signed out of the demo session.");
                  close();
                }}
              />
            </div>
          )}
        </Popover>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-lg bg-surface-container p-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-tertiary-container text-xs font-bold text-tertiary-fixed uppercase">
        {initials}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-label-md text-label-md font-medium text-on-surface">
          {name}
        </span>
        <span className="truncate text-label-sm text-label-sm text-outline">
          {role}
        </span>
      </div>
    </div>
  );
}

function AccountLink({
  icon,
  label,
  onSelect,
}: {
  icon: string;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-body-md text-body-md text-on-surface transition-colors hover:bg-surface-container"
    >
      <Icon name={icon} className="flex-shrink-0 text-[18px] text-primary" />
      {label}
    </button>
  );
}
