import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";
import { RoomsView } from "@/components/rooms/rooms-view";

export const metadata: Metadata = {
  title: "Rooms & Categories",
  description:
    "Manage Meadowfall's six homestay units, seasonal nightly rates, amenities, and photos.",
};

export default function RoomsPage() {
  return (
    <AppShell
      active="rooms"
      brandIcon="nature"
      topNav={<TopNav title="Meadowfall Homestay" showTitleDivider showAvatar />}
      footer={
        <SideNavHostCard
          initials="CS"
          name="Clara Sterling"
          role="Estate Caretaker"
        />
      }
    >
      <main className="mt-14 min-h-screen lg:mt-16 lg:ml-[var(--rail-w)]">
        <RoomsView />
      </main>
    </AppShell>
  );
}
