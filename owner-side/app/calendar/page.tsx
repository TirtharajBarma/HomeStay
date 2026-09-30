import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CalendarFooter } from "@/components/calendar/calendar-footer";
import { CalendarProvider } from "@/components/calendar/calendar-provider";
import { ReservationInspector } from "@/components/calendar/reservation-inspector";
import { TimelineControls } from "@/components/calendar/timeline-controls";
import { TimelineGrid } from "@/components/calendar/timeline-grid";
import { Icon } from "@/components/icon";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "Multi-Room Calendar",
  description:
    "Fourteen-day timeline across all six Meadowfall accommodations with channel and occupancy indicators.",
};

export default function CalendarPage() {
  return (
    <AppShell
      active="calendar"
      brandIcon="nature_people"
      topNav={
        <TopNav
          status={
            <>
              <Icon name="cleaning_services" className="text-[16px] text-primary" />
              <span>Turnover rate: 92% on-time</span>
            </>
          }
          dateIcon="calendar_today"
          actionIcon="edit_calendar"
          actionLabel="New Booking"
          showAvatar
        />
      }
      footer={
        <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-primary-container/20 bg-primary-tint p-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-label-sm text-label-sm font-semibold text-primary">
              Live Sync Active
            </span>
            <span className="text-label-sm text-label-sm text-on-surface-variant">
              6/6 Rooms Synced
            </span>
          </div>
        </div>
      }
    >
      <main className="mt-14 flex min-h-screen flex-col gap-space-lg p-4 pb-space-xl lg:mt-16 lg:ml-[var(--rail-w)] md:p-space-lg">
        <CalendarProvider>
          <TimelineControls />
          <TimelineGrid />
          <ReservationInspector />
          <CalendarFooter />
        </CalendarProvider>
      </main>
    </AppShell>
  );
}
