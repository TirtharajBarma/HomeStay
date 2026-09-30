import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";
import { BOOKINGS_BLURB, BookingsView } from "@/components/bookings/bookings-view";

export const metadata: Metadata = {
  title: "Bookings & Guests",
  description: BOOKINGS_BLURB,
};

export default function BookingsPage() {
  return (
    <AppShell
      active="bookings"
      brandIcon="nature_people"
      housekeepingBadge="2 pending"
      topNav={
        <TopNav
          title="Meadowfall Homestay"
          titleIcon="domain"
          showTitleDivider
          notifyDot
        />
      }
      footer={
        <SideNavHostCard
          name="Eleanor & Thomas"
          role="Estate Hosts"
          withPortrait
          chevron
        />
      }
    >
      <BookingsView />
    </AppShell>
  );
}
