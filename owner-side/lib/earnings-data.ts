export type Metric = {
  label: string;
  value: string;
  suffix?: string;
  trend?: { value: string; label?: string; icon?: string };
  footnote: string;
  footnoteIcon?: string;
  icon: string;
  iconTone: string;
  /** Accent rail on the card's left edge. */
  rail?: string;
  footnoteEmphasis?: string;
  footnoteEmphasisTone?: string;
  dotTone?: string;
};

export const metrics: Metric[] = [
  {
    label: "Total Net Earnings",
    value: "$48,320",
    trend: { value: "+18%", icon: "trending_up" },
    footnote: "After OTA commissions & cleaning fees",
    footnoteIcon: "check_circle",
    icon: "payments",
    iconTone: "bg-primary-tint text-primary",
  },
  {
    label: "Direct Booking Savings",
    value: "$4,150",
    trend: { value: "saved" },
    footnote: "direct bookings avoided 15% platform commissions",
    footnoteEmphasis: "56%",
    footnoteEmphasisTone: "text-primary",
    icon: "savings",
    iconTone: "bg-primary-tint text-primary",
    rail: "border-l-4 border-l-primary",
  },
  {
    label: "Average Daily Rate (ADR)",
    value: "$215",
    suffix: "/ night",
    footnote: "Peak autumn surge: +$24 vs summer baseline",
    dotTone: "bg-secondary",
    footnoteEmphasis: "",
    footnoteEmphasisTone: "text-secondary font-medium",
    icon: "hotel",
    iconTone: "bg-surface-container text-on-surface-variant",
  },
  {
    label: "Average Length of Stay",
    value: "3.2",
    suffix: "Nights",
    footnote: "Weekend minimums successfully boosted autumn stays",
    icon: "date_range",
    iconTone: "bg-surface-container text-on-surface-variant",
  },
];

export type MonthBar = {
  month: string;
  total: string;
  /** Average occupancy for the month, used by the chart's second mode. */
  occupancy: number;
  height: string;
  direct: string;
  ota: string;
  offline: string;
  peak?: boolean;
};

export const monthBars: MonthBar[] = [
  { month: "Jan", total: "$2.8k", occupancy: 42, height: "h-20", direct: "40%", ota: "45%", offline: "15%" },
  { month: "Feb", total: "$3.2k", occupancy: 48, height: "h-24", direct: "45%", ota: "40%", offline: "15%" },
  { month: "Mar", total: "$3.9k", occupancy: 55, height: "h-28", direct: "50%", ota: "35%", offline: "15%" },
  { month: "Apr", total: "$4.4k", occupancy: 61, height: "h-32", direct: "52%", ota: "33%", offline: "15%" },
  { month: "May", total: "$5.1k", occupancy: 68, height: "h-36", direct: "55%", ota: "30%", offline: "15%" },
  { month: "Jun", total: "$6.4k", occupancy: 76, height: "h-44", direct: "58%", ota: "28%", offline: "14%" },
  { month: "Jul", total: "$7.2k", occupancy: 84, height: "h-48", direct: "60%", ota: "25%", offline: "15%" },
  { month: "Aug", total: "$6.8k", occupancy: 79, height: "h-44", direct: "55%", ota: "30%", offline: "15%" },
  { month: "Sep", total: "$7.9k", occupancy: 86, height: "h-52", direct: "57%", ota: "28%", offline: "15%" },
  {
    month: "Oct",
    total: "$11.4k",
    occupancy: 88,
    height: "h-60",
    direct: "62%",
    ota: "26%",
    offline: "12%",
    peak: true,
  },
];

export const channelLegend = [
  { tone: "bg-primary", label: "Direct Web Bookings (56%)" },
  { tone: "bg-secondary", label: "Airbnb & OTAs (30%)" },
  { tone: "bg-primary-fixed-dim", label: "Offline & Walk-ins (14%)" },
];

export type ChannelRow = {
  name: string;
  emphasis?: boolean;
  dot: string;
  share: string;
  gross: string;
  fee: string;
  feeTone?: string;
  fees: string;
  feesTone?: string;
  net: string;
  netTone: string;
};

export const channelRows: ChannelRow[] = [
  {
    name: "Direct Website (meadowfall.com)",
    emphasis: true,
    dot: "bg-primary",
    share: "56%",
    gross: "$27,050",
    fee: "0% (Card fee only)",
    feeTone: "text-primary font-medium",
    fees: "$0",
    feesTone: "text-outline",
    net: "$27,050",
    netTone: "font-bold text-primary",
  },
  {
    name: "Airbnb Platform",
    dot: "bg-secondary",
    share: "30%",
    gross: "$14,500",
    fee: "3% host split",
    fees: "-$435",
    feesTone: "text-secondary",
    net: "$14,065",
    netTone: "font-medium",
  },
  {
    name: "Booking.com",
    dot: "bg-tertiary",
    share: "14%",
    gross: "$6,770",
    fee: "15% channel commission",
    feeTone: "text-secondary font-medium",
    fees: "-$1,015",
    feesTone: "text-secondary",
    net: "$5,755",
    netTone: "font-medium",
  },
];

export type UnitEarnings = {
  name: string;
  meta: string;
  occupancy: string;
  net: string;
  maintenance?: boolean;
  note?: string;
};

export const unitEarnings: UnitEarnings[] = [
  {
    name: "The Timber Loft Barn",
    meta: "West Meadows • 2 Bed / 1 Hearth",
    occupancy: "86%",
    net: "$12,480",
  },
  {
    name: "Pine Meadow Cabin",
    meta: "Lower Orchard • Standalone Timber",
    occupancy: "78%",
    net: "$10,640",
  },
  {
    name: "Oak Hearth Suite",
    meta: "Main Lodge Floor 1 • Fireplace King",
    occupancy: "72%",
    net: "$8,920",
  },
  {
    name: "Garden Stone Suite",
    meta: "Cottage Wing • Private Terrace",
    occupancy: "68%",
    net: "$7,400",
  },
  {
    name: "Orchard Attic Studio",
    meta: "Main Lodge Floor 2 • Skylight Loft",
    occupancy: "61%",
    net: "$5,120",
  },
  {
    name: "Willow Brook Hideaway",
    meta: "Creek Pathway • Stone Basin",
    occupancy: "Maintenance",
    net: "$3,760",
    maintenance: true,
    note: "Hearth pipe restoration through Nov 4",
  },
];

export const expenses: {
  icon: string;
  label: string;
  detail?: string;
  value: string;
}[] = [
  { icon: "dry_cleaning", label: "Linens & Eco Toiletries", value: "$640" },
  {
    icon: "bakery_dining",
    label: "Farmstead Breakfast Ingredients",
    detail: "Local sourdough, eggs, honey",
    value: "$520",
  },
  { icon: "fireplace", label: "Firewood & Hearth Supplies", value: "$180" },
  {
    icon: "person_apron",
    label: "Housekeeping Turnover Wages",
    detail: "Clara S. (14 turnovers)",
    value: "$1,200",
  },
];

export const rangeOptions = ["This Year: 2024 (Jan - Oct)"];
