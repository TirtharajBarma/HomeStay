import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { BookView } from "@/components/book/book-view";
import { SideNavHostCard } from "@/components/side-nav";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "Book Rooms",
  description:
    "Select one room or several, walk date-wise availability and turn any open day into a booking.",
};

export default function BookPage() {
  return (
    <AppShell
      active="book"
      brandIcon="event_available"
      topNav={
        <TopNav
          propertyPill="Gumtree Valley"
          showDatePill={false}
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
      <BookView />
    </AppShell>
  );
}
