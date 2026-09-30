export type SettingsTab = {
  label: string;
  icon: string;
};

export const settingsTabs: SettingsTab[] = [
  { label: "General & Estate Profile", icon: "cottage" },
  { label: "Check-in & Guest Welcome", icon: "key" },
  { label: "iCal & Channel Sync (OTA)", icon: "sync_alt" },
  { label: "Payments & Bank Payouts", icon: "payments" },
  { label: "Housekeeping & Staff", icon: "badge" },
  { label: "Notifications & SMS", icon: "sms" },
];

export const identityFields: {
  label: string;
  name: string;
  value: string;
  type?: string;
  span?: boolean;
  icon?: string;
}[] = [
  { label: "Property Name", name: "propertyName", value: "Meadowfall Homestay & Retreat", span: true },
  { label: "Host Display Name", name: "hostName", value: "Eleanor Gray & Thomas Vance", icon: "person" },
  { label: "Official Host Email", name: "hostEmail", value: "eleanor@meadowfallretreat.com", type: "email", icon: "mail" },
  { label: "Direct Emergency Phone", name: "hostPhone", value: "+1 (555) 732-9014", type: "tel", icon: "call" },
  { label: "Physical Estate Address", name: "estateAddress", value: "842 Whispering Pines Rd, West Meadows Valley, VT 05672", icon: "pin_drop" },
  { label: "Estate Tagline & Atmosphere", name: "tagline", value: "Handcrafted hillside cottages, cider orchard & hearth retreats.", span: true },
];

export const houseRules: {
  icon: string;
  title: string;
  detail: string;
  on: boolean;
}[] = [
  {
    icon: "pets",
    title: "Pet Friendly Policy",
    detail: "Select accommodations only (Garden Stone Suite & Pine Cabin)",
    on: true,
  },
  {
    icon: "bedtime",
    title: "Quiet Hours (10:00 PM – 7:00 AM)",
    detail: "Restful sanctuary guidance for patio, verandah, and common gardens",
    on: true,
  },
  {
    icon: "local_fire_department",
    title: "Indoor Wood-burning Fireplaces Allowed",
    detail: "Firewood & kindling replenished daily in private porch shed",
    on: true,
  },
  {
    icon: "photo_camera",
    title: "Commercial Photography Policy",
    detail: "Requires advance written host approval & estate site permit",
    on: true,
  },
];

export const channelFeeds: {
  initials: string;
  brand: string;
  tint: string;
  name: string;
  lastSync: string;
}[] = [
  {
    initials: "Ab",
    brand: "#FF5A5F",
    tint: "bg-[#FF5A5F]/10 text-[#FF5A5F]",
    name: "Airbnb Sync",
    lastSync: "Last synced 4 mins ago",
  },
  {
    initials: "Bk",
    brand: "#003580",
    tint: "bg-[#003580]/10 text-[#003580]",
    name: "Booking.com Sync",
    lastSync: "Last synced 12 mins ago",
  },
];

export const welcomeTemplate =
  "Dear {Guest_First_Name}, we are preparing your room at Meadowfall. Fresh sourdough bread from Jacques and honey from our orchard hives will be waiting in the North Solarium upon your arrival. Your private suite keycode is set to {Keypad_PIN}. Safe travels up the valley pass!";
