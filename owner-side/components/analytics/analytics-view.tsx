"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { PeriodNav } from "@/components/owner/period-nav";
import {
  PageHeader,
  PageShell,
  Panel,
  StatCard,
  ghostButton,
} from "@/components/owner/primitives";
import { useToast } from "@/components/ui/toast";
import {
  CAB_COMMISSION_RATE,
  guestMix,
  guestMixNote,
  rangeOptions,
  rangeStats,
  roomBreakdown,
  serviceBreakdown,
  totalsFor,
  type RangeKey,
} from "@/lib/analytics-data";
import { downloadCsv } from "@/lib/download";
import { addDays } from "@/lib/calendar-window";
import { baseToday, windowCaption } from "@/lib/timeline";
import { useMoney } from "@/components/currency-provider";
import { RevenueTimeline } from "./revenue-timeline";

/** The window ends today; shifting back moves whole periods into the past. */
function windowStart(days: number, offset: number): Date {
  return addDays(baseToday, offset * days - (days - 1));
}

const delta = (current: number, previous: number) =>
  previous ? Math.round(((current - previous) / previous) * 100) : 0;

export function AnalyticsView() {
  const { money, compact } = useMoney();

  const [range, setRange] = useState<RangeKey>("fortnight");
  const [offset, setOffset] = useState(0);
  const { notify } = useToast();

  const days = rangeOptions.find((option) => option.key === range)?.days ?? 14;
  const start = windowStart(days, offset);
  const stats = useMemo(() => rangeStats(start, days), [start, days]);
  const totals = useMemo(() => totalsFor(stats), [stats]);

  const previous = useMemo(
    () => totalsFor(rangeStats(windowStart(days, offset + 1), days)),
    [days, offset],
  );

  const services = useMemo(() => serviceBreakdown(totals), [totals]);
  const rooms = useMemo(() => roomBreakdown(stats), [stats]);
  const mix = useMemo(() => guestMix(totals), [totals]);

  const totalCost = services.reduce((sum, row) => sum + row.cost, 0);
  const totalNet = services.reduce((sum, row) => sum + row.net, 0);

  const options = rangeOptions.map((option) => ({
    key: option.key,
    label: option.label,
    days: option.days,
    hint: windowCaption(windowStart(option.days, 0), option.days),
  }));

  const caption = windowCaption(start, days);
  const commissionRate = `${Math.round(CAB_COMMISSION_RATE * 100)}%`;

  const exportReport = () => {
    downloadCsv(`gumtree-valley-analytics-${range}-${offset}`, [
      ["Metric", "Value"],
      ["Period", caption],
      ["Total revenue", money(totals.revenue)],
      ["Room revenue", money(totals.roomRevenue)],
      ["Cab revenue", money(totals.cabRevenue)],
      ["Cab commission", money(totals.cabCommission)],
      ["Driver payout", money(totals.driverPayout)],
      ["Total guests", String(totals.guests)],
      ["Room nights", String(totals.roomNights)],
      ["Occupancy %", String(totals.occupancy)],
      ["Average daily rate", money(totals.adr)],
      ["Cab trips", String(totals.cabTrips)],
      [],
      ["Service", "Gross", "Cost", "Net to estate"],
      ...services.map((row) => [row.label, money(row.gross), money(row.cost), money(row.net)]),
      [],
      ["Room", "Nights", "Occupancy", "Guests", "Revenue"],
      ...rooms.map((row) => [row.name, row.nights, `${row.occupancy}%`, row.guests, money(row.revenue)]),
    ]);
    notify("Exported the analytics summary.", { icon: "download_done", tone: "success" });
  };

  return (
    <PageShell>
      <PageHeader
        breadcrumb="Homestay Operations"
        title="Analytics"
        description="Everything the estate earned, hosted and drove — walk back and forward through any window to see how rooms and cabs performed."
        actions={
          <>
            <PeriodNav
              options={options}
              value={range}
              onChange={(key) => {
                setRange(key as RangeKey);
                setOffset(0);
              }}
              onShift={(step) => setOffset((current) => Math.min(0, current + step))}
              caption={caption}
              atLatest={offset === 0}
            />
            <button onClick={exportReport} className={ghostButton}>
              <Icon name="download" className="flex-shrink-0 text-[18px]" />
              Export
            </button>
          </>
        }
      />

      <div className="my-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Total revenue"
          value={money(totals.revenue)}
          icon="payments"
          trend={{ value: `${delta(totals.revenue, previous.revenue)}%`, icon: "trending_up" }}
          footnote="Rooms plus cab fares, gross"
        />
        <StatCard
          label="Total guests"
          value={totals.guests.toLocaleString("en-US")}
          icon="group"
          iconTone="bg-secondary-tint text-secondary-ink"
          trend={{ value: `${delta(totals.guests, previous.guests)}%`, icon: "trending_up" }}
          footnote={`${money(totals.revenuePerGuest)} revenue per guest`}
        />
        <StatCard
          label="Room revenue"
          value={money(totals.roomRevenue)}
          icon="king_bed"
          trend={{ value: `${delta(totals.roomRevenue, previous.roomRevenue)}%`, icon: "trending_up" }}
          footnote={`${totals.roomNights} nights · ${money(totals.adr)} average rate`}
        />
        <StatCard
          label="Cab revenue"
          value={money(totals.cabRevenue)}
          icon="local_taxi"
          iconTone="bg-secondary-tint text-secondary-ink"
          trend={{ value: `${delta(totals.cabRevenue, previous.cabRevenue)}%`, icon: "trending_up" }}
          footnote={`${totals.cabTrips} trips dispatched`}
        />
        <StatCard
          label="Cab commission"
          value={money(totals.cabCommission)}
          icon="percent"
          iconTone="bg-tertiary-fixed text-on-tertiary-fixed"
          trend={{ value: commissionRate }}
          footnote={`${money(totals.driverPayout)} paid to drivers`}
        />
        <StatCard
          label="Occupancy"
          value={`${totals.occupancy}%`}
          icon="meeting_room"
          trend={{ value: `${totals.occupancy >= 60 ? "Strong" : "Soft"}`, icon: "speed" }}
          footnote="Of 6 bookable units"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
        <div className="flex flex-col gap-space-lg lg:col-span-8">
          <RevenueTimeline days={stats} caption={caption} />

          <Panel
            title="Service-wise revenue"
            icon="receipt_long"
            caption="What each service brought in, and what it paid out"
            bodyClassName="-mx-1 min-w-0 overflow-x-auto"
          >
            <table className="w-full min-w-[42rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/30 text-label-sm text-label-sm uppercase text-outline">
                  <th scope="col" className="px-1 pb-2 font-semibold">Service</th>
                  <th scope="col" className="px-1 pb-2 text-right font-semibold">Gross</th>
                  <th scope="col" className="px-1 pb-2 text-right font-semibold">Costs</th>
                  <th scope="col" className="px-1 pb-2 text-right font-semibold">Net to estate</th>
                  <th scope="col" className="px-1 pb-2 text-right font-semibold">Share</th>
                </tr>
              </thead>
              <tbody>
                {services.map((row) => (
                  <tr key={row.key} className="border-b border-outline-variant/20 last:border-0">
                    <td className="px-1 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${row.tone}`}>
                          <Icon name={row.icon} className="text-[18px]" />
                        </span>
                        <div>
                          <p className="text-body-md text-body-md font-medium text-on-surface">
                            {row.label}
                          </p>
                          <p className="text-label-sm text-label-sm text-outline">
                            {row.detail} · {row.costLabel}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-3 text-right text-body-md text-body-md text-on-surface">
                      {money(row.gross)}
                    </td>
                    <td className="px-1 py-3 text-right text-body-md text-body-md text-outline">
                      −{money(row.cost)}
                    </td>
                    <td className="px-1 py-3 text-right text-body-md text-body-md font-semibold text-primary">
                      {money(row.net)}
                    </td>
                    <td className="px-1 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-label-sm text-label-sm text-outline">
                          {Math.round(row.share * 100)}%
                        </span>
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-container-high">
                          <span
                            className={`block h-full rounded-full ${row.bar}`}
                            style={{ width: `${Math.max(4, row.share * 100)}%` }}
                          />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="px-1 pt-3 text-body-md text-body-md font-semibold text-primary">
                    Total
                  </td>
                  <td className="px-1 pt-3 text-right text-body-md text-body-md font-semibold text-primary">
                    {money(totals.revenue)}
                  </td>
                  <td className="px-1 pt-3 text-right text-body-md text-body-md text-outline">
                    −{money(totalCost)}
                  </td>
                  <td className="px-1 pt-3 text-right text-body-md text-body-md font-semibold text-primary">
                    {money(totalNet)}
                  </td>
                  <td className="px-1 pt-3 text-right text-label-sm text-label-sm text-outline">
                    100%
                  </td>
                </tr>
              </tbody>
            </table>
          </Panel>

          <Panel
            title="Room-wise performance"
            icon="meeting_room"
            caption="Revenue by unit, highest first"
            bodyClassName="-mx-1 min-w-0 overflow-x-auto"
          >
            <table className="w-full min-w-[38rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/30 text-label-sm text-label-sm uppercase text-outline">
                  <th scope="col" className="px-1 pb-2 font-semibold">Room</th>
                  <th scope="col" className="px-1 pb-2 text-right font-semibold">Nights</th>
                  <th scope="col" className="px-1 pb-2 text-right font-semibold">Occupancy</th>
                  <th scope="col" className="px-1 pb-2 text-right font-semibold">Guests</th>
                  <th scope="col" className="px-1 pb-2 text-right font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.code} className="border-b border-outline-variant/20 last:border-0">
                    <td className="px-1 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container text-label-sm text-label-sm font-semibold text-primary">
                          {room.code}
                        </span>
                        <div>
                          <p className="text-body-md text-body-md font-medium text-on-surface">
                            {room.name}
                          </p>
                          <p className="text-label-sm text-label-sm text-outline">
                            {room.category}
                            {room.maintenance ? " · on maintenance hold" : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-3 text-right text-body-md text-body-md text-on-surface">
                      {room.nights}
                    </td>
                    <td className="px-1 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-body-md text-body-md text-on-surface">
                          {room.occupancy}%
                        </span>
                        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-container-high">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(4, room.occupancy)}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="px-1 py-3 text-right text-body-md text-body-md text-on-surface">
                      {room.guests}
                    </td>
                    <td className="px-1 py-3 text-right text-body-md text-body-md font-semibold text-primary">
                      {money(room.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <div className="flex flex-col gap-space-lg lg:col-span-4">
          <Panel
            title="Cab commission"
            icon="account_balance_wallet"
            caption={`The estate keeps ${commissionRate} of every fare`}
          >
            <p className="text-headline-lg text-headline-lg font-semibold text-primary">
              {money(totals.cabCommission)}
            </p>
            <p className="mt-1 text-body-sm text-body-sm text-outline">
              From {money(totals.cabRevenue)} in fares across {totals.cabTrips} trips.
            </p>

            <dl className="mt-4 flex flex-col gap-2.5">
              {[
                ["Commission rate", commissionRate, "percent"],
                ["Kept by the estate", money(totals.cabCommission), "savings"],
                ["Paid to drivers", money(totals.driverPayout), "payments"],
                [
                  "Average fare",
                  money(totals.cabTrips ? Math.round(totals.cabRevenue / totals.cabTrips) : 0),
                  "local_taxi",
                ],
              ].map(([label, value, icon]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 border-b border-outline-variant/20 pb-2.5 last:border-0 last:pb-0"
                >
                  <dt className="flex items-center gap-2 text-body-sm text-body-sm text-on-surface-variant">
                    <Icon name={icon} className="text-[16px] text-outline" />
                    {label}
                  </dt>
                  <dd className="text-body-md text-body-md font-semibold text-primary">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Guest mix" icon="diversity_3" caption="First-timers versus returning">
            <div className="flex flex-col gap-3">
              {mix.map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between text-body-sm text-body-sm">
                    <span className="text-on-surface-variant">{row.label}</span>
                    <span className="font-semibold text-primary">
                      {row.count} · {Math.round(row.share * 100)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className={`h-full rounded-full ${row.tone}`}
                      style={{ width: `${Math.max(4, row.share * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 flex gap-2 rounded-lg bg-primary-tint p-3 text-label-sm text-label-sm text-on-primary-container">
              <Icon name="lightbulb" className="flex-shrink-0 text-[16px]" />
              {guestMixNote}
            </p>
          </Panel>

          <Panel title="Stay shape" icon="insights" caption="How the window adds up">
            <dl className="flex flex-col gap-2.5">
              {[
                ["Room nights sold", String(totals.roomNights), "king_bed"],
                ["Average daily rate", money(totals.adr), "sell"],
                ["Revenue per guest", money(totals.revenuePerGuest), "person"],
                ["Average party", `${totals.avgStay.toFixed(1)} guests`, "groups"],
              ].map(([label, value, icon]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 border-b border-outline-variant/20 pb-2.5 last:border-0 last:pb-0"
                >
                  <dt className="flex items-center gap-2 text-body-sm text-body-sm text-on-surface-variant">
                    <Icon name={icon} className="text-[16px] text-outline" />
                    {label}
                  </dt>
                  <dd className="text-body-md text-body-md font-semibold text-primary">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-label-sm text-label-sm text-outline">
              Peak single day in this window: {compact(
                Math.max(...stats.map((day) => day.roomRevenue + day.cabRevenue)),
              )}
            </p>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
