import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";
import { HelpView } from "@/components/help/help-view";


export const metadata: Metadata = {
  title: "Help & Guide",
  description: "Short answers and shortcuts for running the estate dashboard.",
};

export default function HelpPage() {
  return (
    <AppShell
      active="help"
      brandIcon="nature_people"
      housekeepingBadge="2 pending"
      topNav={<TopNav title="Meadowfall Homestay" titleIcon="domain" showTitleDivider notifyDot />}
      footer={
        <SideNavHostCard name="Eleanor & Thomas" role="Estate Hosts" withPortrait chevron />
      }
    >
      <HelpView />
    </AppShell>
  );
}
