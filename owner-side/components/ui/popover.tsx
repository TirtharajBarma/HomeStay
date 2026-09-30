"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/icon";

type PopoverProps = {
  /** Trigger contents. The popover supplies the button semantics. */
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    id: string;
    "aria-expanded": boolean;
    "aria-haspopup": "dialog";
  }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  label: string;
  panelClassName?: string;
};

export function Popover({
  trigger,
  children,
  align = "end",
  label,
  panelClassName = "w-72",
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const nodes = Array.from(
        panel.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    const frame = requestAnimationFrame(() => {
      panel.current
        ?.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
        )
        ?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      {trigger({
        open,
        toggle,
        id,
        "aria-expanded": open,
        "aria-haspopup": "dialog",
      })}
      {open ? (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={label}
          className={`panel-shadow absolute top-[calc(100%+8px)] z-50 max-w-[calc(100vw-2rem)] rounded-xl border border-outline-variant/30 bg-surface-container-lowest ${
            align === "end" ? "right-0" : "left-0"
          } ${panelClassName}`}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      ) : null}
    </div>
  );
}

type MenuRowProps = {
  icon?: string;
  label: string;
  hint?: string;
  selected?: boolean;
  onSelect: () => void;
};

export function MenuRow({ icon, label, hint, selected, onSelect }: MenuRowProps) {
  return (
    <button
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
        selected ? "bg-primary-tint" : "hover:bg-surface-container"
      }`}
    >
      {icon ? (
        <Icon name={icon} className="flex-shrink-0 text-[18px] text-primary" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-body-md text-body-md ${
            selected ? "font-semibold text-primary" : "text-on-surface"
          }`}
        >
          {label}
        </span>
        {hint ? (
          <span className="block truncate text-label-sm text-label-sm text-outline">
            {hint}
          </span>
        ) : null}
      </span>
      {selected ? <Icon name="check" className="flex-shrink-0 text-[18px] text-primary" /> : null}
    </button>
  );
}
