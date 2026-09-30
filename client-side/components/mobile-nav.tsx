"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "./icon";

export type NavLink = {
  href: string;
  label: string;
  hint: string;
  icon: string;
};

export function MobileNav({
  links,
  checkDatesHref = "/#search-bar",
}: {
  links: NavLink[];
  checkDatesHref?: string;
}) {
  const pathname = usePathname();
  // Remembering the route the panel was opened on keeps it closed after a
  // navigation without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  function toggle() {
    setOpenedOn(open ? null : pathname);
  }

  /**
   * Anchor links do not change the pathname, so closing is driven by the click
   * itself rather than by watching the route.
   */
  function closeFromPanelClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a")) setOpenedOn(null);
  }

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedOn(null);
    };
    const previousOverflow = document.body.style.overflow;

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-primary transition-colors hover:bg-surface-container active:bg-surface-container-high"
      >
        <Icon name={open ? "close" : "menu"} className="text-[26px]" />
      </button>

      {open && (
        <div
          id="mobile-nav"
          onClick={closeFromPanelClick}
          className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-outline-variant/40 bg-surface px-4 pt-2 pb-6 shadow-drawer"
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-14 items-center gap-3 border-b border-outline-variant/25 py-3 last:border-b-0"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary">
                  <Icon name={link.icon} className="text-[18px]" />
                </span>
                <span className="flex flex-col">
                  <span className="text-title-md font-semibold text-primary">{link.label}</span>
                  <span className="text-label-sm text-on-surface-variant">{link.hint}</span>
                </span>
                <Icon
                  name="chevron_right"
                  className={cn("ml-auto text-primary", open ? "rotate-90" : "")}
                />
              </Link>
            ))}
          </nav>

          <Link
            href={checkDatesHref}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-5 text-label-md text-on-primary"
          >
            <Icon name="calendar_month" className="text-[18px]" />
            Check Dates
          </Link>
        </div>
      )}
    </div>
  );
}
