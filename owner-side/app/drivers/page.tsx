import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { DriversView } from "@/components/drivers/drivers-view";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "Add Drivers",
  description:
    "Manage the cab roster — add drivers, keep contact details current and send app invites by email.",
};

export default function DriversPage() {
  return (
    <AppShell
      active="drivers"
      brandIcon="directions_car"
      topNav={
        <TopNav propertyPill="Gumtree Valley" showAvatar />
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
      <DriversView />
    </AppShell>
  );
}
