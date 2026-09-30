export type NavKey =
  | "analytics"
  | "book"
  | "guests"
  | "drivers"
  | "campaign"
  | "profile";

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  icon: string;
  /** Rendered as a small pill on the rail. */
  badge?: string;
};

export const primaryNav: NavItem[] = [
  {
    key: "analytics",
    label: "Analytics",
    href: "/analytics",
    icon: "query_stats",
  },
  {
    key: "book",
    label: "Book Rooms",
    href: "/book",
    icon: "event_available",
  },
  { key: "guests", label: "Guest Data", href: "/guests", icon: "group" },
  {
    key: "drivers",
    label: "Add Drivers",
    href: "/drivers",
    icon: "directions_car",
  },
  { key: "campaign", label: "Campaign", href: "/campaign", icon: "campaign" },
  {
    key: "profile",
    label: "Edit Profile",
    href: "/profile",
    icon: "person",
  },
];

export const estates = ["Ging Lodge", "Chiyabari Lofts", "Garden Cottages"];

export const todayLabel = "October 24, 2024";
