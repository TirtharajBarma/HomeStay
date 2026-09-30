"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Widens the panel for form-heavy dialogs. */
  size?: "sm" | "md" | "lg";
};

/** False during SSR, true once hydrated, without an extra render. */
const neverChanges = () => () => {};
const useIsHydrated = () =>
  useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );

const focusable =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useIsHydrated();

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      // Keep Tab inside the dialog while it is modal.
      const nodes = Array.from(
        panel.current.querySelectorAll<HTMLElement>(focusable),
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
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey, true);

    const frame = requestAnimationFrame(() => {
      const target =
        panel.current?.querySelector<HTMLElement>("[data-autofocus]") ??
        panel.current?.querySelector<HTMLElement>(focusable) ??
        panel.current;
      target?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey, true);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open, handleKey]);

  if (!mounted || !open) return null;

  const width =
    size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6">
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 bg-on-surface/45 backdrop-blur-[2px]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`rounded-t-2xl relative z-10 flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-b-none bg-surface-container-lowest shadow-2xl outline-none sm:rounded-2xl`}
      >
        <div className="flex items-start gap-3 border-b border-outline-variant/30 px-5 py-4">
          {icon ? (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
              <Icon name={icon} className="text-[20px]" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-headline-sm text-headline-sm text-primary">
              {title}
            </h2>
            {description ? (
              <p className="text-body-sm text-body-sm mt-0.5 text-on-surface-variant">
                {description}
              </p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-1 flex-shrink-0 rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-outline-variant/30 bg-surface-container/50 px-5 py-3.5 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
