"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import type { DayStat } from "@/lib/analytics-data";
import { useMoney } from "@/components/currency-provider";

type Bucket = {
  label: string;
  rooms: number;
  cabs: number;
  guests: number;
  days: number;
};

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Daily is unreadable past a month, so wide windows roll up to weeks then months. */
function bucketize(days: DayStat[]): Bucket[] {
  if (days.length <= 32) {
    return days.map((day) => ({
      label: day.label,
      rooms: day.roomRevenue,
      cabs: day.cabRevenue,
      guests: day.guests,
      days: 1,
    }));
  }

  const size = days.length <= 92 ? 7 : 30;
  const buckets: Bucket[] = [];
  for (let index = 0; index < days.length; index += size) {
    const slice = days.slice(index, index + size);
    const first = slice[0];
    const last = slice[slice.length - 1];
    const roomTotal = slice.reduce((sum, day) => sum + day.roomRevenue, 0);
    const cabTotal = slice.reduce((sum, day) => sum + day.cabRevenue, 0);
    const guestTotal = slice.reduce((sum, day) => sum + day.guests, 0);
    buckets.push({
      label:
        size === 30 && first.date.getMonth() !== last.date.getMonth()
          ? MONTHS_SHORT[first.date.getMonth()]
          : `${first.date.getDate()} ${MONTHS_SHORT[first.date.getMonth()]}`,
      rooms: roomTotal,
      cabs: cabTotal,
      guests: guestTotal,
      days: slice.length,
    });
  }
  return buckets;
}

type RevenueTimelineProps = {
  days: DayStat[];
  /** Reveals the same shape but scaled per day, for very long windows. */
  caption: string;
};

export function RevenueTimeline({ days, caption }: RevenueTimelineProps) {
  const { money, compact } = useMoney();
  const [mode, setMode] = useState<"revenue" | "guests">("revenue");
  const [hover, setHover] = useState<number | null>(null);

  const buckets = bucketize(days);
  const peak = Math.max(
    1,
    ...buckets.map((bucket) =>
      mode === "revenue"
        ? Math.max(bucket.rooms, bucket.cabs) === 0
          ? 0
          : bucket.rooms + bucket.cabs
        : bucket.guests,
    ),
  );
  const active = hover === null ? null : buckets[hover];

  const toggle =
    "px-2.5 py-2.5 text-label-sm text-label-sm transition-colors sm:py-1";
  const toggleOn = "rounded bg-surface-container-lowest font-semibold text-primary shadow-xs";
  const toggleOff = "text-on-surface-variant hover:text-on-surface";

  return (
    <section className="clay-card clay-lift rounded-xl p-5">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-title-sm text-title-sm font-semibold text-primary">
            Revenue timeline
          </h2>
          <p className="mt-0.5 text-label-sm text-label-sm text-outline">{caption}</p>
        </div>

        <div
          role="group"
          aria-label="Timeline measure"
          className="flex rounded-lg border border-outline-variant/30 bg-surface-container p-1 text-label-sm text-label-sm"
        >
          <button
            onClick={() => setMode("revenue")}
            aria-pressed={mode === "revenue"}
            className={`${toggle} ${mode === "revenue" ? toggleOn : toggleOff}`}
          >
            Revenue
          </button>
          <button
            onClick={() => setMode("guests")}
            aria-pressed={mode === "guests"}
            className={`${toggle} ${mode === "guests" ? toggleOn : toggleOff}`}
          >
            Guests
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-label-sm text-label-sm text-on-surface-variant">
        {mode === "revenue" ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
              Rooms &amp; stay
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-secondary" />
              Cabs &amp; transfers
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary-container" />
            Guests on site
          </span>
        )}

        {active ? (
          <span className="ms-auto text-outline">
            {active.label} ·{" "}
            {mode === "revenue"
              ? `${money(active.rooms)} rooms + ${money(active.cabs)} cabs`
              : `${active.guests} guests`}
          </span>
        ) : null}
      </div>

      <div
        className="flex h-56 items-end gap-[3px] sm:gap-1.5"
        onMouseLeave={() => setHover(null)}
      >
        {buckets.map((bucket, index) => {
          const total = mode === "revenue" ? bucket.rooms + bucket.cabs : bucket.guests;
          const height = Math.max(2, (total / peak) * 100);
          const roomsShare = total ? (bucket.rooms / (bucket.rooms + bucket.cabs)) * 100 : 0;
          return (
            <div
              key={`${bucket.label}-${index}`}
              onMouseEnter={() => setHover(index)}
              className="group flex h-full min-w-0 flex-1 cursor-default flex-col justify-end"
            >
              <div
                className={`w-full overflow-hidden rounded-t-sm transition-all ${
                  hover === index ? "opacity-100" : "opacity-85 group-hover:opacity-100"
                }`}
                style={{ height: `${height}%` }}
              >
                {mode === "revenue" ? (
                  <div className="flex h-full flex-col-reverse">
                    <div
                      className="w-full bg-secondary"
                      style={{ height: `${100 - roomsShare}%` }}
                    />
                    <div className="w-full bg-primary" style={{ height: `${roomsShare}%` }} />
                  </div>
                ) : (
                  <div className="h-full w-full bg-primary-container" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-outline-variant/30 pt-2 text-label-sm text-label-sm text-outline">
        <span>{buckets[0]?.label}</span>
        <span className="flex items-center gap-1.5">
          <Icon name="swap_vert" className="text-[14px]" />
          Peak {mode === "revenue" ? compact(peak) : peak}
        </span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </section>
  );
}
