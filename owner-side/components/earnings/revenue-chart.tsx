"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { channelLegend, monthBars } from "@/lib/earnings-data";

type Mode = "revenue" | "occupancy";

export function RevenueChart() {
  const [mode, setMode] = useState<Mode>("revenue");
  const maxOccupancy = Math.max(...monthBars.map((bar) => bar.occupancy));

  return (
    <section className="clay-card rounded-xl p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-rule-warm pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-headline-sm text-headline-sm text-primary">
            Monthly Revenue &amp; Occupancy Trends
          </h2>
          <p className="text-body-sm text-body-sm text-outline">
            {mode === "revenue"
              ? "Ten-month seasonal trajectory showing peak foliage earnings"
              : "Ten-month average occupancy across all six units"}
          </p>
        </div>
        <div
          role="group"
          aria-label="Chart metric"
          className="flex flex-shrink-0 items-center self-start rounded-lg border border-outline-variant/30 bg-surface-container p-1 text-label-sm text-label-sm sm:self-auto"
        >
          {(["revenue", "occupancy"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setMode(option)}
              aria-pressed={mode === option}
              className={
                mode === option
                  ? "rounded bg-surface-container-lowest px-3 py-1.5 font-semibold text-primary shadow-xs"
                  : "px-3 py-1.5 text-on-surface-variant transition-colors hover:text-on-surface"
              }
            >
              {option === "revenue" ? "Revenue ($)" : "Occupancy (%)"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-label-sm text-label-sm text-on-surface-variant">
        {channelLegend.map((entry) => (
          <div key={entry.label} className="flex items-center gap-2">
            <span className={`h-3 w-3 flex-shrink-0 rounded-sm ${entry.tone}`} />
            <span>{entry.label}</span>
          </div>
        ))}
      </div>

      <div className="custom-scrollbar mt-4 overflow-x-auto overscroll-x-contain pt-6 pb-2 md:pt-2">
        <div className="flex h-64 min-w-[620px] items-end justify-between gap-2.5 border-b border-outline-variant/40 px-2 sm:gap-3.5">
          {monthBars.map((bar) => (
            <div
              key={bar.month}
              className="group relative flex flex-1 flex-col items-center gap-1"
            >
              <span className="absolute -top-7 text-label-sm text-label-sm text-outline opacity-0 transition-opacity group-hover:opacity-100">
                {mode === "revenue" ? bar.total : `${bar.occupancy}%`}
              </span>

              {bar.peak ? (
                <div className="absolute -top-10 flex items-center gap-0.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-on-secondary shadow-sm">
                  <Icon name="local_fire_department" className="text-[10px]" />
                  {mode === "revenue" ? bar.total : `${bar.occupancy}%`}
                </div>
              ) : null}

              {mode === "revenue" ? (
                <div
                  className={`flex w-full flex-col gap-0.5 overflow-hidden rounded-t-sm bg-surface-container transition-all hover:opacity-90 ${bar.height} ${
                    bar.peak ? "ring-2 ring-secondary/30" : ""
                  }`}
                >
                  <div className={`bg-primary ${bar.direct}`} title={`Direct: ${bar.total}`} />
                  <div className={`bg-secondary ${bar.ota}`} title={`OTA: ${bar.total}`} />
                  <div
                    className={`bg-primary-fixed-dim ${bar.offline}`}
                    title={`Offline: ${bar.total}`}
                  />
                </div>
              ) : (
                <div
                  className={`flex w-full flex-col overflow-hidden rounded-t-sm bg-surface-container transition-all hover:opacity-90 ${bar.height} ${
                    bar.peak ? "ring-2 ring-secondary/30" : ""
                  }`}
                >
                  <div
                    className="w-full bg-primary/85"
                    style={{ height: `${(bar.occupancy / maxOccupancy) * 100}%` }}
                    title={`${bar.occupancy}% occupancy`}
                  />
                </div>
              )}

              <span
                className={
                  bar.peak
                    ? "mt-2 text-label-sm text-label-sm font-bold text-secondary"
                    : "mt-2 text-label-sm text-label-sm text-outline"
                }
              >
                {bar.month}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col justify-between gap-2 pt-2 text-body-sm text-body-sm text-outline sm:flex-row">
        <span>Historical average monthly net: $4,832</span>
        <span className="flex items-center gap-1 font-medium text-primary">
          <Icon name="spa" className="text-[16px]" />
          Peak Foliage season generated 2.4x regular summer monthly revenue
        </span>
      </div>
    </section>
  );
}
