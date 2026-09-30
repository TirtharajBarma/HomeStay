export type Channel = "direct" | "airbnb" | "ota" | "blocked";

export type Day = {
  dow: string;
  date: number;
  occupancy: string;
  today?: boolean;
  weekend?: boolean;
};

export type Reservation = {
  guest: string;
  start: number;
  nights: number;
  channel: Channel;
  /** Small uppercase tag shown in the top-right of the bar. */
  tag?: string;
  detail: string;
  /** Renders a highlighted "checked in" bar. */
  emphasis?: boolean;
  /** Trailing icon in the second line. */
  trailing?: { icon: string; tone: string };
  /** Maintenance bars are hatched and bold. */
  blocked?: boolean;
};

export type RoomGroup = {
  title: string;
  icon: string;
  meta: string;
  rooms: Room[];
};

export type Room = {
  code: string;
  name: string;
  note: string;
  reservations: Reservation[];
  /** Dashed "+ Book" affordance. */
  openSlots?: { start: number; nights: number }[];
};

/** Oct 18 – Oct 31 inclusive. `todayIndex` is 6 (Oct 24). */
export const todayIndex = 6;

export const days: Day[] = [
  { dow: "FRI", date: 18, occupancy: "83%" },
  { dow: "SAT", date: 19, occupancy: "100%", weekend: true },
  { dow: "SUN", date: 20, occupancy: "100%", weekend: true },
  { dow: "MON", date: 21, occupancy: "67%" },
  { dow: "TUE", date: 22, occupancy: "83%" },
  { dow: "WED", date: 23, occupancy: "83%" },
  { dow: "TODAY", date: 24, occupancy: "83%", today: true },
  { dow: "FRI", date: 25, occupancy: "100%" },
  { dow: "SAT", date: 26, occupancy: "100%", weekend: true },
  { dow: "SUN", date: 27, occupancy: "83%", weekend: true },
  { dow: "MON", date: 28, occupancy: "67%" },
  { dow: "TUE", date: 29, occupancy: "50%" },
  { dow: "WED", date: 30, occupancy: "67%" },
  { dow: "THU", date: 31, occupancy: "83%" },
];

export const channels: { label: string; channel: Channel }[] = [
  { label: "Direct Booking", channel: "direct" },
  { label: "Airbnb Synced", channel: "airbnb" },
  { label: "Booking.com", channel: "ota" },
  { label: "Maintenance/Blocked", channel: "blocked" },
];

export const roomGroups: RoomGroup[] = [
  {
    title: "GROUND FLOOR COTTAGES",
    icon: "cottage",
    meta: "2 Accommodations • King & Queen Suites",
    rooms: [
      {
        code: "Room 101",
        name: "Oak Hearth Suite",
        note: "King Bed • Fireplace",
        reservations: [
          {
            guest: "Lucas & Mia Vance",
            start: 0,
            nights: 3,
            channel: "airbnb",
            tag: "Airbnb",
            detail: "3 nts • Paid $490",
          },
          {
            guest: "David & Claire Miller",
            start: 4,
            nights: 3,
            channel: "direct",
            tag: "Direct",
            detail: "3 nights • Paid $540",
            emphasis: true,
            trailing: { icon: "check_circle", tone: "text-amber-200" },
          },
          {
            guest: "Klaus Weber",
            start: 8,
            nights: 4,
            channel: "ota",
            tag: "Booking",
            detail: "4 nts • $720 • Late Arrival",
          },
        ],
      },
      {
        code: "Room 102",
        name: "Garden Stone Suite",
        note: "Queen Bed • Patio",
        reservations: [
          {
            guest: "Simon & Nora Chen",
            start: 0,
            nights: 4,
            channel: "direct",
            tag: "Direct",
            detail: "4 nts • Paid $620",
          },
          {
            guest: "Elena Rostova",
            start: 6,
            nights: 4,
            channel: "airbnb",
            tag: "Airbnb",
            detail: "4 nights • Balance $0",
            emphasis: true,
            trailing: { icon: "key", tone: "text-emerald-200" },
          },
          {
            guest: "Arthur Pendelton",
            start: 10,
            nights: 3,
            channel: "ota",
            tag: "Booking",
            detail: "3 nts • $510",
          },
        ],
        openSlots: [{ start: 4, nights: 2 }],
      },
    ],
  },
  {
    title: "UPPER LOFT & BARN",
    icon: "roofing",
    meta: "2 Accommodations • High Vaulted Ceilings",
    rooms: [
      {
        code: "Room 201",
        name: "The Timber Loft",
        note: "King + Trundle • Mountain View",
        reservations: [
          {
            guest: "Dr. Julian Scott & Party",
            start: 1,
            nights: 5,
            channel: "direct",
            tag: "Direct",
            detail: "5 nts • Family Trundle Set",
          },
          {
            guest: "Maintenance",
            start: 8,
            nights: 2,
            channel: "blocked",
            detail: "Chimney Sweeping",
            blocked: true,
            trailing: { icon: "construction", tone: "text-amber-200" },
          },
          {
            guest: "Hannah & Greg Holt",
            start: 10,
            nights: 3,
            channel: "airbnb",
            tag: "Airbnb",
            detail: "3 nts • Self check-in",
          },
        ],
      },
      {
        code: "Room 202",
        name: "Orchard Attic Studio",
        note: "Queen Bed • Skylight",
        reservations: [
          {
            guest: "Rebecca Thorne",
            start: 0,
            nights: 3,
            channel: "ota",
            tag: "Booking",
            detail: "3 nts • $435",
          },
          {
            guest: "Marcus O'Connor",
            start: 5,
            nights: 5,
            channel: "direct",
            tag: "Direct",
            detail: "5 nts • Writing Retreat • Vegan",
          },
        ],
      },
    ],
  },
  {
    title: "GARDEN OUTPOSTS",
    icon: "forest",
    meta: "2 Standalone Cabins • Secluded Woods",
    rooms: [
      {
        code: "Room 301",
        name: "Pine Meadow Cabin",
        note: "King Bed • Private Hot Tub",
        reservations: [
          {
            guest: "The Harrison Family",
            start: 2,
            nights: 5,
            channel: "direct",
            tag: "Direct",
            detail: "5 nights • Breakfast incl",
            emphasis: true,
            trailing: { icon: "restaurant", tone: "text-amber-200" },
          },
          {
            guest: "Siddharth & Priya Patel",
            start: 8,
            nights: 5,
            channel: "airbnb",
            tag: "Airbnb",
            detail: "5 nts • Anniversary Setup Req.",
          },
        ],
      },
      {
        code: "Room 302",
        name: "Willow Brook Hideaway",
        note: "Queen Bed • Creek View",
        reservations: [
          {
            guest: "Isla Sterling",
            start: 0,
            nights: 5,
            channel: "direct",
            tag: "Direct",
            detail: "5 nts • Creek View Suite",
          },
          {
            guest: "Garrett Ross",
            start: 7,
            nights: 5,
            channel: "airbnb",
            tag: "Airbnb",
            detail: "5 nts • Late Checkout",
          },
        ],
        openSlots: [{ start: 5, nights: 2 }],
      },
    ],
  },
];

/** The reservation rendered in the inspector panel below the grid. */
export const selectedReservation = {
  guest: "David & Claire Miller",
  reservationId: "#MF-2024-8841",
  source: "Booked via Direct Guest Portal",
  room: "Room 101 - Oak Hearth Suite",
  bed: "King Bed • Stone Fireplace",
  checkIn: "Tue, Oct 22 (3:00 PM)",
  checkOut: "Fri, Oct 25 (11:00 AM)",
  duration: "3 Nights",
  phone: "+1 (555) 732-9014",
  email: "david.c.miller@vermontcraft.net",
  keycode: "#4819*",
  notes: [
    {
      icon: "eco",
      tone: "text-secondary",
      title: "Gluten-Free & Oat Milk:",
      body: "Claire requested breakfast basket with GF pastries.",
    },
    {
      icon: "local_fire_department",
      tone: "text-primary",
      title: "Seasoned Birch Logs:",
      body: "Extra bundle provided by hearth on arrival.",
    },
  ],
  charges: [
    { label: "Nightly Rate ($160 × 3)", value: "$480.00" },
    { label: "Estate Cleaning Fee", value: "$40.00" },
    { label: "Lodging Tax (4%)", value: "$20.00" },
  ],
  total: "$540.00",
};
