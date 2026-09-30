import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";
import { EarningsView } from "@/components/earnings/earnings-view";

export const metadata: Metadata = {
  title: "Earnings & Analytics",
  description:
    "Track seasonal income, direct booking savings, payouts, and accommodation trends.",
};

export default function EarningsPage() {
  return (
    <AppShell
      active="earnings"
      brandIcon="cottage"
      housekeepingBadge="2 pending"
      topNav={
        <TopNav
          propertyPill="Meadowfall Homestay (Entire Estate)"
          estateLinks={[
            "All Retreats",
            "Main Lodge",
            "West Meadows Barn",
            "Cottage Suites",
          ]}
          estateLinksClass="hidden xl:flex"
          dateIcon="event"
          datePillTone="container"
          notifyDot
        />
      }
      footer={
        <SideNavHostCard
          name="Eleanor & Thomas"
          role="Estate Custodians"
          withPortrait
          chevron
        />
      }
    >
      <EarningsView />
    </AppShell>
  );
}
