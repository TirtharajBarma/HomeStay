import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";
import { HousekeepingView } from "@/components/housekeeping/housekeeping-view";


export const metadata: Metadata = {
  title: "Housekeeping",
  description: "Turnover checklists, room readiness, and linen logistics for every unit.",
};

export default function HousekeepingPage() {
  return (
    <AppShell
      active="housekeeping"
      brandIcon="nature_people"
      housekeepingBadge="2 pending"
      topNav={<TopNav title="Meadowfall Homestay" titleIcon="domain" showTitleDivider notifyDot />}
      footer={
        <SideNavHostCard name="Eleanor & Thomas" role="Estate Hosts" withPortrait chevron />
      }
    >
      <HousekeepingView />
    </AppShell>
  );
}
