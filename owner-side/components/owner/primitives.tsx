import type { ReactNode } from "react";
import { Icon } from "@/components/icon";

/** Standard page frame: clears the fixed top bar and indents past the rail. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mt-14 min-h-screen lg:mt-16 lg:ml-[var(--rail-w)]">
      <div className="mx-auto max-w-[1440px] px-4 pt-5 pb-10 md:px-space-xl md:pt-4 md:pb-16">
        {children}
      </div>
    </main>
  );
}

type PageHeaderProps = {
  breadcrumb: string;
  title: string;
  description: string;
  /** Period control, export button, primary action — anything header-right. */
  actions?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({
  breadcrumb,
  title,
  description,
  actions,
  meta,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-outline-variant/30 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-label-sm text-label-sm text-outline">
          <span>{breadcrumb}</span>
          <Icon name="chevron_right" className="text-[14px]" />
          <span className="font-medium text-primary">{title}</span>
        </div>
        <h1 className="text-headline-lg-mobile text-headline-lg-mobile font-semibold tracking-tight text-primary md:text-headline-lg">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-body-md text-body-md text-on-surface-variant">
          {description}
        </p>
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>

      {actions ? (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

type PanelProps = {
  title: string;
  icon?: string;
  /** Short line under the title. */
  caption?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/** The clay surface every panel in the dashboard is built on. */
export function Panel({
  title,
  icon,
  caption,
  action,
  children,
  className = "",
  bodyClassName = "",
}: PanelProps) {
  return (
    <section className={`clay-card clay-lift rounded-xl p-5 ${className}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="flex flex-shrink-0 items-center justify-center rounded-lg bg-primary-tint p-1.5 text-primary">
              <Icon name={icon} className="text-[18px]" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-title-sm text-title-sm font-semibold text-primary">
              {title}
            </h2>
            {caption ? (
              <p className="mt-0.5 text-label-sm text-label-sm text-outline">{caption}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="flex flex-shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  icon: string;
  iconTone?: string;
  /** Small pill beside the value, e.g. `+12%`. */
  trend?: { value: string; icon?: string };
  suffix?: string;
  footnote?: string;
  footnoteIcon?: string;
  footnoteEmphasis?: string;
};

/**
 * Metric tile used across analytics, guests and drivers.
 *
 * On phones a stacked tile would stretch to the full column width and read as
 * mostly empty space, so below `sm` it becomes a compact row: the glyph leads,
 * then the label, value and footnote stack in the remaining width. From `sm`
 * up it is the original stacked tile with the glyph in the top-right corner.
 */
export function StatCard({
  label,
  value,
  icon,
  iconTone = "bg-primary-tint text-primary",
  trend,
  suffix,
  footnote,
  footnoteIcon,
  footnoteEmphasis,
}: StatCardProps) {
  return (
    <div className="clay-card clay-lift relative flex items-start gap-2.5 rounded-xl p-3.5 transition-all sm:block sm:gap-3 sm:p-5">
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl sm:absolute sm:right-5 sm:top-5 sm:h-auto sm:w-auto sm:p-1.5 ${iconTone}`}
      >
        <Icon name={icon} className="text-[19px] sm:text-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        {/* Phone: label left, value right — a scannable list row. sm+: stacked. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 sm:mt-3.5 sm:block">
          <span className="min-w-[7.5rem] flex-1 text-label-md text-label-md font-medium text-outline sm:min-w-0 sm:pr-12">
            {label}
          </span>
          <span className="flex shrink-0 items-baseline gap-2 sm:mt-1.5 sm:flex-wrap">
            <span className="text-headline-sm text-headline-sm font-semibold tabular-nums text-primary min-[360px]:text-headline-md min-[360px]:text-headline-md sm:text-headline-lg sm:text-headline-lg">
              {value}
            </span>
            {trend ? (
              <span
                className={
                  trend.icon
                    ? "flex items-center gap-1 rounded bg-primary-tint px-1.5 py-0.5 text-label-sm text-label-sm font-semibold text-primary"
                    : "text-label-sm text-label-sm font-medium text-primary"
                }
              >
                {trend.icon ? <Icon name={trend.icon} className="text-[12px]" /> : null}
                {trend.value}
              </span>
            ) : null}
            {suffix ? (
              <span className="text-body-sm text-body-sm text-outline">{suffix}</span>
            ) : null}
          </span>
        </div>

        {footnote ? (
          <p className="mt-1 flex items-center gap-1 text-body-sm text-body-sm text-outline sm:mt-2">
            {footnoteIcon ? (
              <Icon name={footnoteIcon} className="text-[14px] text-outline" />
            ) : null}
            {footnoteEmphasis ? (
              <>
                <strong className="font-semibold text-primary">{footnoteEmphasis}</strong>{" "}
                {footnote}
              </>
            ) : (
              footnote
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const fieldClass =
  "w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";

export const labelClass =
  "mb-1 block text-label-md text-label-md font-medium text-on-surface-variant";

export const ghostButton =
  "flex items-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-container px-3.5 py-2 text-label-md text-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container-high";

export const solidButton =
  "flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container active:scale-[0.98]";
