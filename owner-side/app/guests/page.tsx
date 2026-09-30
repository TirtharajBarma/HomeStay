import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { GuestsView } from "@/components/guests/guests-view";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "Guest Data",
  description:
    "The full guest directory with an arrivals and departures timeline, plus a room-wise view of who is in each unit.",
};

export default function GuestsPage() {
  return (
    <AppShell
      active="guests"
      brandIcon="group"
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
      <GuestsView />
    </AppShell>
  );
}
