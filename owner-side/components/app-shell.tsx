"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { NotificationsBell } from "@/components/notifications";
import { SideNav } from "@/components/side-nav";
import { ToastProvider } from "@/components/ui/toast";
import type { NavKey } from "@/lib/navigation";

type AppShellProps = {
  active: NavKey;
  brandIcon?: string;
  footer?: ReactNode;
  /** Desktop top bar; hidden below `lg` in favour of the compact mobile bar. */
  topNav: ReactNode;
  /** Shown in the mobile bar and drawer header. */
  mobileTitle?: string;
  children: ReactNode;
};

// <html data-rail> is the single source of truth for the desktop rail, so the
// hamburger state is read from the DOM through a small external store.
const railListeners = new Set<() => void>();

function subscribeRail(listener: () => void) {
  railListeners.add(listener);
  return () => {
    railListeners.delete(listener);
  };
}

function readRail() {
  return document.documentElement.dataset.rail === "collapsed";
}

function readRailOnServer() {
  return false;
}

function writeRail(value: "open" | "collapsed") {
  document.documentElement.dataset.rail = value;
  window.localStorage.setItem("estate-rail", value);
  for (const listener of railListeners) listener();
}

export function AppShell({
  active,
  brandIcon,
  footer,
  topNav,
  mobileTitle = "Gumtree Valley Estate",
  children,
}: AppShellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // The desktop rail is toggled by a CSS variable so pages, the header and the
  // rail itself stay in sync without prop drilling. The dataset on <html> is
  // the source of truth, read through useSyncExternalStore so the first client
  // render matches the server.
  useEffect(() => {
    writeRail(window.localStorage.getItem("estate-rail") === "collapsed" ? "collapsed" : "open");
  }, []);

  const railCollapsed = useSyncExternalStore(subscribeRail, readRail, readRailOnServer);

  const toggleRail = useCallback(() => {
    writeRail(readRail() ? "open" : "collapsed");
  }, []);

  // Close on Escape, lock the page behind the drawer, and move focus in and out.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      // Trap Tab so the drawer behaves like a modal on small screens.
      const nodes = Array.from(
        panel.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => node.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const trigger = openButton.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => closeButton.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previous;
      // Return focus to the control that opened the drawer.
      trigger?.focus();
    };
  }, [open]);

  return (
    <ToastProvider>
      {/* Compact bar: phones and small tablets only. */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-outline-variant/30 bg-surface/90 px-3 backdrop-blur-md sm:gap-3 sm:px-4 lg:hidden">
        <button
          ref={openButton}
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="estate-drawer"
          className="-ml-1.5 flex-shrink-0 rounded-lg p-2 text-on-surface transition-colors hover:bg-surface-container active:scale-[0.98]"
        >
          <Icon name="menu" className="text-[22px]" />
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
            <Icon name={brandIcon ?? "nature"} className="text-[18px]" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-title-md text-title-md font-semibold text-primary">
              {mobileTitle}
            </span>
            <span className="hidden truncate text-label-sm text-label-sm text-outline sm:inline">
              Estate &amp; Retreat Operations
            </span>
          </div>
        </div>
        <div className="ml-auto flex flex-shrink-0 items-center text-on-surface-variant">
          <NotificationsBell
            className="rounded-lg p-2 transition-colors hover:bg-surface-container"
            iconClassName="text-[20px]"
            dotClassName="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-secondary"
          />
          <button
            onClick={() => router.push("/book")}
            aria-label="New booking"
            className="flex items-center rounded-lg bg-primary p-2 text-on-primary transition-colors hover:bg-primary-container active:scale-[0.98]"
          >
            <Icon name="add" className="text-[20px]" />
          </button>
        </div>
      </div>

      {/* Off-canvas drawer: phones and small tablets only. */}
      <div
        id="estate-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        inert={!open}
        className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
      >
        <div
          onClick={close}
          aria-hidden
          className={`absolute inset-0 bg-on-surface/40 transition-opacity duration-300 motion-reduce:transition-none ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          ref={panel}
          className={`absolute inset-y-0 left-0 w-[280px] max-w-[calc(100vw-3rem)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SideNav
            active={active}
            brandIcon={brandIcon}
            footer={footer}
            variant="drawer"
            onNavigate={close}
            onNewBooking={() => {
              close();
              router.push("/book");
            }}
          />
          <button
            ref={closeButton}
            onClick={close}
            aria-label="Close navigation"
            className="absolute top-3 -right-11 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-on-surface shadow-md"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
      </div>

      {/* Persistent rail: desktop only. */}
      <div
        id="estate-rail"
        className={railCollapsed ? "hidden" : "hidden lg:block"}
      >
        <SideNav
          active={active}
          brandIcon={brandIcon}
          footer={footer}
          variant="fixed"
          onNewBooking={() => router.push("/book")}
        />
      </div>

      {/* Desktop top bar. */}
      <div className="hidden lg:block">{topNav}</div>

      {/* Hamburger: collapses/expands the desktop rail on every page. */}
      <button
        onClick={toggleRail}
        aria-label={railCollapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!railCollapsed}
        aria-controls="estate-rail"
        style={{ left: "var(--rail-w)" }}
        className="fixed top-0 z-40 hidden h-16 items-center rounded-r-lg px-3 text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98] lg:flex"
      >
        <Icon
          name={railCollapsed ? "menu" : "menu_open"}
          className="text-[22px]"
        />
      </button>

      {children}

    </ToastProvider>
  );
}
