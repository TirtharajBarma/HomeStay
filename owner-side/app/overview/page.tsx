import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AvailabilityGlance } from "@/components/overview/availability-glance";
import { DirectInquiries } from "@/components/overview/direct-inquiries";
import { FarmsteadNotes } from "@/components/overview/farmstead-notes";
import { GuestSchedule } from "@/components/overview/guest-schedule";
import { MetricCards } from "@/components/overview/metric-cards";
import { RoomReadiness } from "@/components/overview/room-readiness";
import { WelcomeHeader } from "@/components/overview/welcome-header";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "Overview",
  description: "Estate & retreat operations overview for Meadowfall Homestay.",
};

export default function OverviewPage() {
  return (
    <AppShell
      active="overview"
      brandIcon="cabin"
      topNav={
        <TopNav actionIcon="add_circle" datePillTone="container-low" />
      }
      footer={
        <SideNavHostCard
          initials="ET"
          name="Eleanor & Thomas"
          role="Lead Estate Hosts"
        />
      }
    >
      <main className="mt-14 min-h-screen lg:mt-16 lg:ml-[var(--rail-w)]">
        <div className="mx-auto max-w-[1400px] p-4 md:p-space-lg">
          <WelcomeHeader />
          <MetricCards />

          <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
            <div className="flex flex-col gap-space-lg lg:col-span-7">
              <GuestSchedule />
              <AvailabilityGlance />
            </div>

            <div className="flex flex-col gap-space-lg lg:col-span-5">
              <RoomReadiness />
              <DirectInquiries />
              <FarmsteadNotes />
            </div>
          </div>

          <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-outline-variant/25 pt-5 pb-8 text-xs text-outline sm:flex-row">
            <p className="text-center sm:text-left">
              © 2024 Meadowfall Homestay &amp; Retreat • West Meadows Valley
              Operations
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <span>Handcrafted Hospitality System</span>
              <span aria-hidden>•</span>
              <span className="font-semibold text-primary">
                All Systems Operational
              </span>
            </div>
          </footer>
        </div>
      </main>
    </AppShell>
  );
}
