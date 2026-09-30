"use client";

import { useState } from "react";
import { EarningsMetrics } from "@/components/earnings/earnings-metrics";
import { RevenueChart } from "@/components/earnings/revenue-chart";
import { HostInsights, OperatingCosts, PayoutCard } from "@/components/earnings/panels";
import { ChannelTable } from "@/components/earnings/channel-table";
import { UnitEarningsGrid } from "@/components/earnings/unit-earnings";
import { Icon } from "@/components/icon";
import { MenuRow, Popover } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";
import { downloadCsv } from "@/lib/download";
import { monthBars } from "@/lib/earnings-data";

export function EarningsView() {
  const [year, setYear] = useState("This Year: 2024 (Jan - Oct)");
  const [period, setPeriod] = useState("Year-to-date");
  const { notify } = useToast();

  const exportReport = () => {
    downloadCsv(`meadowfall-earnings-${period.toLowerCase().replace(/\s+/g, "-")}`, [
      ["Month", "Total revenue", "Direct", "OTA", "Offline", "Occupancy"],
      ...monthBars.map((bar) => [
        bar.month,
        bar.total,
        bar.direct,
        bar.ota,
        bar.offline,
        `${bar.occupancy}%`,
      ]),
    ]);
    notify(`Exported the ${period} financial report.`, {
      icon: "download_done",
      tone: "success",
    });
  };

  return (
      <main className="mt-14 min-h-screen lg:mt-16 lg:ml-[var(--rail-w)]">
        <div className="mx-auto max-w-[1440px] px-4 pt-5 pb-10 md:px-space-xl md:pt-4 md:pb-16">
          <div className="flex flex-col gap-4 border-b border-outline-variant/30 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-label-sm text-label-sm text-outline">
                <span>Homestay Operations</span>
                <Icon name="chevron_right" className="text-[14px]" />
                <span className="font-medium text-primary">
                  Revenue &amp; Performance
                </span>
              </div>
              <h1 className="text-headline-lg-mobile text-headline-lg-mobile font-semibold tracking-tight text-primary md:text-headline-lg">
                Earnings &amp; Homestay Analytics
              </h1>
              <p className="mt-1 text-body-md text-body-md text-on-surface-variant">
                Track your seasonal income, direct booking savings, payouts, and
                accommodation trends.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
              <Popover
                label="Reporting year"
                panelClassName="w-[min(20rem,calc(100vw-2rem))]"
                trigger={({ toggle, open, ...aria }) => (
                  <button
                    {...aria}
                    onClick={toggle}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3.5 py-2 text-label-md text-label-md text-on-surface shadow-sm transition-colors sm:w-auto ${
                      open
                        ? "border-primary bg-primary-tint text-primary"
                        : "border-outline-variant/60 bg-surface-container-lowest hover:border-primary"
                    }`}
                  >
                    <Icon
                      name="calendar_today"
                      className="flex-shrink-0 text-[18px] text-outline"
                    />
                    <span className="truncate">{year}</span>
                    <Icon
                      name="keyboard_arrow_down"
                      className="ml-auto flex-shrink-0 text-[16px] text-outline"
                    />
                  </button>
                )}
              >
                {(close) => (
                  <div className="py-1">
                    {[
                      ["This Year: 2024 (Jan - Oct)", "10 months of data"],
                      ["This Year: 2023", "Closed financial year"],
                      ["Last 12 months", "Nov 2023 – Oct 2024"],
                    ].map(([label, hint]) => (
                      <MenuRow
                        key={label}
                        icon="event"
                        label={label}
                        hint={hint}
                        selected={label === year}
                        onSelect={() => {
                          setYear(label);
                          notify(`Reporting period set to ${label}.`);
                          close();
                        }}
                      />
                    ))}
                  </div>
                )}
              </Popover>

              <div
                role="group"
                aria-label="Reporting period"
                className="custom-scrollbar flex overflow-x-auto rounded-lg border border-outline-variant/30 bg-surface-container p-1 text-label-sm text-label-sm sm:overflow-visible"
              >
                {["Year-to-date", "Last 30 Days", "Quarterly"].map((option) => (
                  <button
                    key={option}
                    onClick={() => setPeriod(option)}
                    aria-pressed={period === option}
                    className={
                      period === option
                        ? "flex-shrink-0 rounded bg-surface-container-lowest px-2.5 py-1 font-semibold text-primary shadow-xs"
                        : "flex-shrink-0 px-2.5 py-1 whitespace-nowrap text-on-surface-variant transition-colors hover:text-on-surface"
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>

              <button
                onClick={exportReport}
                className="flex items-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-container px-3.5 py-2 text-left text-label-md text-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container-high"
              >
                <Icon name="download" className="flex-shrink-0 text-[18px]" />
                <span className="text-[12px] leading-4 sm:text-label-md">
                  <span className="sm:hidden">Export Report</span>
                  <span className="hidden sm:inline">
                    Export Financial Report (CSV/PDF)
                  </span>
                </span>
              </button>
            </div>
          </div>

          <EarningsMetrics />

          <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
            <div className="flex flex-col gap-space-lg lg:col-span-8">
              <RevenueChart />
              <ChannelTable />
              <UnitEarningsGrid />
            </div>

            <div className="flex flex-col gap-space-lg lg:col-span-4">
              <PayoutCard />
              <OperatingCosts />
              <HostInsights />
            </div>
          </div>
        </div>
      </main>
  );
}
