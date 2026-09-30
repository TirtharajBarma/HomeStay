export type NavKey =
  | "overview"
  | "calendar"
  | "rooms"
  | "bookings"
  | "earnings"
  | "settings"
  | "housekeeping"
  | "help";

export const primaryNav: { key: NavKey; label: string; href: string; icon: string }[] = [
  { key: "overview", label: "Overview", href: "/overview", icon: "dashboard" },
  {
    key: "calendar",
    label: "Multi-Room Calendar",
    href: "/calendar",
    icon: "calendar_month",
  },
  {
    key: "rooms",
    label: "Rooms & Categories",
    href: "/rooms",
    icon: "bed",
  },
  { key: "bookings", label: "Bookings & Guests", href: "/bookings", icon: "group" },
  {
    key: "earnings",
    label: "Earnings & Analytics",
    href: "/earnings",
    icon: "analytics",
  },
  { key: "settings", label: "Settings", href: "/settings", icon: "settings" },
];

export const secondaryNav: { label: string; href: string; icon: string }[] = [
  { label: "Housekeeping", href: "/housekeeping", icon: "cleaning_services" },
  { label: "Help & Guide", href: "/help", icon: "help_outline" },
];

export const estates = ["Main Lodge", "West Meadows Barn", "Cottage Suites"];

export const todayLabel = "October 24, 2024";
