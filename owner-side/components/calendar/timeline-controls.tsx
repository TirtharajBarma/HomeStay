"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { NewBookingDialog } from "@/components/new-booking-dialog";
import { useToast } from "@/components/ui/toast";
import { useCalendar, type CalendarView } from "./calendar-provider";

const views: { id: CalendarView; label: string }[] = [
  { id: "timeline", label: "Timeline Grid (14 Days)" },
  { id: "month", label: "Monthly Grid" },
  { id: "list", label: "List View" },
];

function View({
  id,
  label,
  active,
  onSelect,
}: {
  id: CalendarView;
  label: string;
  active: boolean;
  onSelect: (id: CalendarView) => void;
}) {
  return (
    <button
      onClick={() => onSelect(id)}
      aria-pressed={active}
      className={
        active
          ? "rounded-md bg-surface-container-lowest px-3.5 py-1.5 text-label-md text-label-md font-semibold text-primary shadow-sm transition-all"
          : "rounded-md px-3.5 py-1.5 text-label-md text-label-md text-on-surface-variant transition-all hover:text-on-surface"
      }
    >
      {label}
    </button>
  );
}

export function TimelineControls() {
  const { view, setView, label, caption, shift, goToToday, isToday, addWalkIn, groups } =
    useCalendar();
  const { notify } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [walkIn, setWalkIn] = useState(false);

  const sync = () => {
    if (syncing) return;
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      notify("All channels are in sync — 14 reservations verified.", {
        icon: "cloud_done",
        tone: "success",
      });
    }, 900);
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 shadow-[0_1px_3px_rgba(45,48,46,0.04)] md:p-space-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto sm:gap-3">
          <div className="flex items-center rounded-lg border border-outline-variant/30 bg-surface-container-low p-1">
            <button
              onClick={() => shift(-1)}
              title="Previous Range"
              aria-label="Previous range"
              className="rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <Icon name="chevron_left" className="text-[20px]" />
            </button>
            <h2 className="px-2 text-headline-sm text-headline-sm font-semibold tracking-tight text-on-surface sm:px-4">
              {label}
            </h2>
            <button
              onClick={() => shift(1)}
              title="Next Range"
              aria-label="Next range"
              className="rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <Icon name="chevron_right" className="text-[20px]" />
            </button>
          </div>
          <button
            onClick={goToToday}
            disabled={isToday}
            className="rounded-lg border border-outline-variant/30 bg-surface-container px-3.5 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Today
          </button>
          <span className="hidden text-body-sm text-body-sm text-outline md:inline">
            Autumn Peak Foliage Season • 88% Total Occupancy
          </span>
        </div>

        <div className="custom-scrollbar -mx-1 w-full overflow-x-auto px-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
        <div className="inline-flex rounded-lg border border-outline-variant/30 bg-surface-container-low p-1">
          {views.map((entry) => (
            <View
              key={entry.id}
              id={entry.id}
              label={entry.label}
              active={view === entry.id}
              onSelect={setView}
            />
          ))}
        </div>
        </div>

        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <button
            onClick={sync}
            disabled={syncing}
            className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/50 bg-surface px-3.5 py-2 text-label-md text-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container disabled:opacity-70"
          >
            <Icon
              name={syncing ? "progress_activity" : "sync"}
              className={`text-[18px] text-tertiary ${syncing ? "animate-spin" : ""}`}
            />
            <span>{syncing ? "Syncing…" : "Sync Calendars (iCal)"}</span>
          </button>
          <button
            onClick={() => setWalkIn(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-label-md text-label-md text-on-secondary shadow-sm transition-transform hover:bg-secondary/90 active:scale-[0.98]"
          >
            <Icon name="bolt" className="text-[18px]" />
            <span>+ Quick Walk-in Reservation</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 pt-3">
        <ChannelLegend />
        <div className="flex items-center gap-2 text-label-sm text-label-sm text-outline">
          <Icon name="info" className="flex-shrink-0 text-[16px] text-secondary" />
          <span className="min-w-0">
            {caption} • Click any reservation bar to inspect guest details &amp; lock
            codes
          </span>
        </div>
      </div>

      <NewBookingDialog
        open={walkIn}
        onClose={() => setWalkIn(false)}
        title="Quick walk-in reservation"
        description={`Adds the reservation to ${caption} on the timeline.`}
        rooms={groups.flatMap((group) => group.rooms.map((room) => room.name))}
        onCreated={addWalkIn}
      />
    </section>
  );
}

function ChannelLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-label-sm text-label-sm">
      <span className="font-medium text-outline">Channel Indicators:</span>
      {[
        { label: "Direct Booking", tone: "bg-channel-direct" },
        { label: "Airbnb Synced", tone: "bg-channel-airbnb" },
        { label: "Booking.com", tone: "bg-channel-ota" },
        { label: "Maintenance/Blocked", tone: "bg-channel-blocked" },
      ].map((entry) => (
        <div key={entry.label} className="flex items-center gap-2">
          <span className={`h-3.5 w-3.5 rounded-full shadow-xs ${entry.tone}`} />
          <span className="text-on-surface">{entry.label}</span>
        </div>
      ))}
    </div>
  );
}
