/** Cab drivers on the estate roster, plus the invite flow copy. */

import { addDays } from "./calendar-window";
import { baseToday, shortDate } from "./timeline";

export type DriverStatus = "Active" | "On a trip" | "Invited" | "Paused";

export type Driver = {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  plate: string;
  rating: number;
  trips: number;
  commission: number;
  status: DriverStatus;
  joined: Date;
  coverage: string;
};

const statusTone: Record<DriverStatus, string> = {
  Active: "bg-emerald-100 text-emerald-900",
  "On a trip": "bg-primary-tint text-on-primary-container",
  Invited: "bg-amber-100 text-amber-900",
  Paused: "bg-stone-200 text-stone-700",
};

export function driverStatusTone(status: DriverStatus): string {
  return statusTone[status];
}

export const driverStatuses: DriverStatus[] = ["Active", "On a trip", "Invited", "Paused"];

const roster: Omit<Driver, "commission" | "joined">[] = [
  {
    id: "DRV-101",
    name: "Dipu Tamang",
    phone: "+91 98300 41042",
    email: "dipu.tamang@gumtreevalley.in",
    vehicle: "Toyota Innova Crysta",
    plate: "WB 06 AB 4432",
    rating: 4.9,
    trips: 214,
    status: "On a trip",
    coverage: "Baggage • Family • Outstation",
  },
  {
    id: "DRV-102",
    name: "Saraswati Rai",
    phone: "+91 98300 41197",
    email: "saraswati.rai@gumtreevalley.in",
    vehicle: "Maruti Suzuki Dzire",
    plate: "WB 06 CD 2210",
    rating: 4.8,
    trips: 168,
    status: "Active",
    coverage: "City • Mall • Airport",
  },
  {
    id: "DRV-103",
    name: "Bikash Gurung",
    phone: "+91 98300 41163",
    email: "bikash.gurung@gumtreevalley.in",
    vehicle: "Mahindra Bolero",
    plate: "WB 06 EF 7781",
    rating: 4.7,
    trips: 132,
    status: "Active",
    coverage: "Hill roads • Gangtok • Kalimpong",
  },
  {
    id: "DRV-104",
    name: "Sunita Pradhan",
    phone: "+91 98300 41118",
    email: "sunita.pradhan@gumtreevalley.in",
    vehicle: "Toyota Fortuner",
    plate: "WB 06 GH 5540",
    rating: 5.0,
    trips: 96,
    status: "On a trip",
    coverage: "Luxury • Honeymoon • 4x4",
  },
  {
    id: "DRV-105",
    name: "Tobias Lund",
    phone: "+91 98300 41176",
    email: "puspendu.rai@gumtreevalley.in",
    vehicle: "Tata Winger",
    plate: "WB 06 JK 9071",
    rating: 4.6,
    trips: 54,
    status: "Invited",
    coverage: "Group • School trips • 12 seater",
  },
];

const commissionByStatus: Record<DriverStatus, number> = {
  Active: 4_120,
  "On a trip": 6_480,
  Invited: 0,
  Paused: 1_940,
};

export const drivers: Driver[] = roster.map((driver, index) => ({
  ...driver,
  commission: commissionByStatus[driver.status],
  joined: addDays(baseToday, -(40 + index * 63)),
}));

export const driverSummary = {
  total: drivers.length,
  onRoad: drivers.filter((driver) => driver.status === "On a trip").length,
  active: drivers.filter((driver) => driver.status === "Active").length,
  invited: drivers.filter((driver) => driver.status === "Invited").length,
  trips: drivers.reduce((sum, driver) => sum + driver.trips, 0),
  averageRating:
    Math.round(
      (drivers.reduce((sum, driver) => sum + driver.rating, 0) / drivers.length) * 10,
    ) / 10,
  commission: drivers.reduce((sum, driver) => sum + driver.commission, 0),
};

export const driverInsights: {
  title: string;
  detail: string;
  icon: string;
  tone: string;
}[] = [
  {
    title: "Outstation runs pay best",
    detail: "Baggage runs average ₹3,200 per trip vs ₹1,900 for valley hops.",
    icon: "flight_takeoff",
    tone: "bg-primary-tint text-on-primary-container",
  },
  {
    title: "Cover the 5am Gangtok window",
    detail: "Two drivers already cover pre-dawn departures to Gangtok — keep one slot free.",
    icon: "schedule",
    tone: "bg-secondary-tint text-secondary-ink",
  },
  {
    title: "Invite follow-ups",
    detail: "Invited drivers have not confirmed — resend the app link after 3 days.",
    icon: "mark_email_unread",
    tone: "bg-tertiary-fixed text-on-tertiary-fixed",
  },
];

/** `mailto:` body for a driver invitation, with a plain-text fallback. */
export function invitationLink(driver: Pick<Driver, "name" | "email">): string {
  const subject = encodeURIComponent("You're invited to drive for Gumtree Valley Estate");
  const body = encodeURIComponent(
    [
      `Hi ${driver.name.split(" ")[0]},`,
      "",
      "You have been added to the Gumtree Valley Estate driver roster.",
      "Accept the invite from the driver app to start receiving airport and valley trips.",
      "",
      `Roster ID: ${driver.email}`,
      "",
      "Thanks,",
      "Gumtree Valley Estate",
    ].join("\n"),
  );
  return `mailto:${driver.email}?subject=${subject}&body=${body}`;
}

export function rosterLink(email: string): string {
  const subject = encodeURIComponent("Gumtree Valley driver roster");
  const body = encodeURIComponent(
    "Please confirm your availability for airport and valley transfers this week.",
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

export const vehicles = [
  "Toyota Land Cruiser",
  "Subaru Outback",
  "Jeep Wrangler",
  "Volvo XC90",
  "Ford Transit",
  "Nissan Rogue",
  "Chevy Suburban",
  "Honda Pilot",
];

export const coverageAreas = [
  "BTV airport",
  "Burlington",
  "Darjeeling",
  "Waterbury",
  "Smugglers' Notch",
  "Middlebury",
  "Hinesburg",
  "Jay Peak",
];

export const driverIntake: { label: string; name: string; type: string; hint: string }[] = [
  { label: "Full name", name: "name", type: "text", hint: "e.g. Ruben Castillo" },
  { label: "Mobile number", name: "phone", type: "tel", hint: "+1 (802) 555 0100" },
  { label: "Email address", name: "email", type: "email", hint: "name@example.com" },
  { label: "Vehicle", name: "vehicle", type: "text", hint: "e.g. Subaru Outback" },
  { label: "Plate", name: "plate", type: "text", hint: "VT 1234" },
  { label: "Coverage", name: "coverage", type: "text", hint: "Baggage • Family • Outstation" },
];

export const driverDetail = (driver: Driver) =>
  `${driver.name} · ${shortDate(driver.joined)} join · ${driver.trips} trips · ₹${driver.commission.toLocaleString("en-IN")} paid out`;
