"use client";

import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import { downloadCsv } from "@/lib/download";
import { addDays } from "@/lib/calendar-window";
import { useCalendar } from "./calendar-provider";

export function CalendarFooter() {
  const { start, caption, reservations } = useCalendar();
  const { notify } = useToast();

  const nights = reservations.reduce(
    (total, entry) => total + entry.reservation.nights,
    0,
  );

  const exportCsv = () => {
    // en-CA renders YYYY-MM-DD in local time, so the filename matches the window.
    const fmt = (date: Date) => date.toLocaleDateString("en-CA");
    downloadCsv(`meadowfall-schedule-${fmt(start)}`, [
      ["Unit", "Guest", "Check-in", "Check-out", "Nights", "Channel", "Detail"],
      ...reservations.map(({ room, reservation }) => [
        `${room.code} ${room.name}`,
        reservation.guest,
        fmt(addDays(start, reservation.start)),
        fmt(addDays(start, reservation.start + reservation.nights)),
        reservation.nights,
        reservation.tag ?? reservation.channel,
        reservation.detail,
      ]),
    ]);
    notify(`Exported ${reservations.length} reservations to CSV.`, {
      icon: "download_done",
      tone: "success",
    });
  };

  return (
    <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-space-md py-3.5 sm:flex-row">
      <span className="flex items-center gap-2 text-center text-label-sm text-label-sm text-outline sm:text-left">
        <Icon name="sync" className="flex-shrink-0 text-[16px] text-primary" />
        {reservations.length} reservations • {nights} booked nights • all channels
        operational
      </span>
      <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
        <span className="text-body-sm text-body-sm text-on-surface-variant">
          14-Day Revenue Forecast:{" "}
          <strong className="text-title-md text-title-md text-primary">
            ${(nights * 195).toLocaleString("en-US")}
          </strong>{" "}
          (94% collected)
        </span>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface px-3 py-1.5 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
        >
          <Icon name="download" className="text-[16px]" />
          <span>Export CSV</span>
          <span className="sr-only">for {caption}</span>
        </button>
      </div>
    </div>
  );
}
