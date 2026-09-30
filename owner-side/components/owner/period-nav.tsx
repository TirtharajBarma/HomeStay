"use client";

import { Icon } from "@/components/icon";
import { MenuRow, Popover } from "@/components/ui/popover";

export type PeriodOption = {
  key: string;
  label: string;
  hint: string;
  days: number;
};

type PeriodNavProps = {
  options: PeriodOption[];
  value: string;
  onChange: (key: string) => void;
  /** Steps the window one full period back (-1) or forward (+1). */
  onShift: (delta: number) => void;
  /** `Oct 18 – Oct 31, 2024` — the window the current numbers describe. */
  caption: string;
  /** Forward stepping stops at the current period. */
  atLatest?: boolean;
  icon?: string;
};

/**
 * Back / forward through reporting windows plus a dropdown of presets. Every
 * page that shows a time-scoped view reuses this so the control feels identical.
 */
export function PeriodNav({
  options,
  value,
  onChange,
  onShift,
  caption,
  atLatest = true,
  icon = "date_range",
}: PeriodNavProps) {
  const stepButton =
    "flex h-9 w-9 items-center justify-center text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex w-full min-w-0 max-w-full items-center rounded-lg border border-outline-variant/60 bg-surface-container-lowest shadow-sm sm:w-auto">
        <button
          onClick={() => onShift(-1)}
          aria-label="Previous period"
          title="Previous period"
          className={`${stepButton} rounded-l-lg`}
        >
          <Icon name="chevron_left" className="text-[20px]" />
        </button>

        <span
          aria-live="polite"
          className="min-w-0 flex-1 border-x border-outline-variant/30 px-2 py-1 text-center text-label-sm text-label-sm font-medium text-on-surface sm:truncate sm:px-3 sm:py-0 sm:text-label-md sm:text-label-md sm:whitespace-nowrap"
        >
          {caption}
        </span>

        <button
          onClick={() => onShift(1)}
          disabled={atLatest}
          aria-label="Next period"
          title={atLatest ? "Already at the current period" : "Next period"}
          className={`${stepButton} rounded-r-lg`}
        >
          <Icon name="chevron_right" className="text-[20px]" />
        </button>
      </div>

      <Popover
        label="Choose reporting period"
        align="end"
        panelClassName="w-[min(19rem,calc(100vw-2rem))]"
        trigger={({ toggle, open, ...aria }) => (
          <button
            {...aria}
            onClick={toggle}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-label-md text-label-md shadow-sm transition-colors sm:w-auto sm:justify-start sm:py-2 ${
              open
                ? "border-primary bg-primary-tint text-primary"
                : "border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:border-primary"
            }`}
          >
            <Icon name={icon} className="flex-shrink-0 text-[18px] text-outline" />
            <span className="truncate">
              {options.find((option) => option.key === value)?.label ?? "Period"}
            </span>
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
            {options.map((option) => (
              <MenuRow
                key={option.key}
                icon="event"
                label={option.label}
                hint={option.hint}
                selected={option.key === value}
                onSelect={() => {
                  onChange(option.key);
                  close();
                }}
              />
            ))}
          </div>
        )}
      </Popover>
    </div>
  );
}
