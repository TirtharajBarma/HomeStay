import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ProfileView } from "@/components/profile/profile-view";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "Edit Profile",
  description:
    "Personal details, room inventory and estate locations — everything the booking portal shows guests.",
};

export default function ProfilePage() {
  return (
    <AppShell
      active="profile"
      brandIcon="person"
      topNav={<TopNav propertyPill="Gumtree Valley" showAvatar />}
      footer={
        <SideNavHostCard
          name="Ananya & Arjun Rai"
          role="Estate Owners"
          withPortrait
          chevron
        />
      }
    >
      <ProfileView />
    </AppShell>
  );
}
