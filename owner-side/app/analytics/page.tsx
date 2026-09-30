import type { Metadata } from "next";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { AppShell } from "@/components/app-shell";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "Analytics",
  description:
    "Revenue, guests, room and cab performance for the estate, with a walkable reporting timeline.",
};

export default function AnalyticsPage() {
  return (
    <AppShell
      active="analytics"
      brandIcon="query_stats"
      topNav={
        <TopNav
          propertyPill="Gumtree Valley"
          showDatePill={false}
          notifyDot
          showAvatar
        />
      }
      footer={
        <SideNavHostCard
          name="Ananya & Arjun Rai"
          role="Estate Owners"
          withPortrait
          chevron
        />
      }
    >
      <AnalyticsView />
    </AppShell>
  );
}
