import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CampaignView } from "@/components/campaign/campaign-view";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "Campaign",
  description:
    "Guest email campaigns are on the way — see what is planned and how to be notified first.",
};

export default function CampaignPage() {
  return (
    <AppShell
      active="campaign"
      brandIcon="campaign"
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
      <CampaignView />
    </AppShell>
  );
}
