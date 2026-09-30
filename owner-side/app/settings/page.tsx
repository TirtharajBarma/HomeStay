import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Manage your property profile, check-in instructions, payout bank accounts, channel syncs, and guest communication.",
};

export default function SettingsPage() {
  return (
    <AppShell
      active="settings"
      brandIcon="nature_people"
      housekeepingBadge="2 pending"
      topNav={
        <TopNav
          title="Meadowfall Homestay"
          titleIcon="domain"
          showTitleDivider
          dateIcon="today"
          datePillTone="container"
          notifyDot
          showActionDivider={false}
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
      <main className="mt-14 min-h-screen bg-background lg:mt-16 lg:ml-[var(--rail-w)]">
        <div className="mx-auto max-w-[1360px] space-y-6 p-4 md:space-y-8 md:p-8">
          <SettingsWorkspace />
        </div>
      </main>
    </AppShell>
  );
}
