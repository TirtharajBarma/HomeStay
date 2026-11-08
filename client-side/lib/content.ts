import { siteConfig } from "./site-config";

export const hosts = {
  names: `${siteConfig.appName} Valley Network`,
  since: "Darjeeling & Sikkim Himalayas",
  email: siteConfig.supportEmail || "",
  bookingEmail: siteConfig.bookingEmail || siteConfig.supportEmail || "",
  phone: siteConfig.supportPhone || `${siteConfig.appName} Support Desk`,
  phoneHref: siteConfig.supportPhone
    ? `tel:${siteConfig.supportPhone.replace(/\s+/g, "")}`
    : siteConfig.supportEmail
    ? `mailto:${siteConfig.supportEmail}`
    : "#",
  location: "Darjeeling & Sikkim Hills",
  region: "Eastern Himalayas",
  replyTime: "≤ 1 hr reply",
};

export const breakfast = {
  title: "Authentic Hill Breakfast",
  badge: "Included Daily",
  body: "Wake up to freshly prepared mountain breakfasts made with fresh local ingredients: hot parathas off the tawa, steamed momos, farm-fresh eggs, handmade pickles, and hot cups of authentic Darjeeling tea prepared with care by your host family.",
};

export const amenityGroups = [
  {
    icon: "shower",
    title: "Bed & Bath",
    items: [
      "Fresh cotton linen bedding & warm blankets",
      "Running hot water & geysers in all rooms",
      "Clean private attached bathrooms",
      "Warm Himalayan wool throws for cool evenings",
    ],
  },
  {
    icon: "fireplace",
    title: "Hearth & Comfort",
    items: [
      "Comfortable room heating / warm mountain bedding",
      "Traditional kettle & authentic local teas",
      "Cozy seating areas for peaceful evenings",
      "Quiet mountain surroundings for restful sleep",
    ],
  },
  {
    icon: "coffee",
    title: "Dining & Refreshment",
    items: [
      "Fresh mountain spring drinking water",
      "Freshly brewed Darjeeling & Sikkim teas",
      "Home-cooked local meals on request",
      "Evening snacks & masala chai",
    ],
  },
];

export const grounds = [
  {
    icon: "forest",
    title: "Tea Gardens & Pine Trails",
    body: "Step out onto serene walking paths, tea estate trails, and fragrant pine ridge loops right outside your homestay.",
  },
  {
    icon: "water",
    title: "Panoramic Valley Views",
    body: "Unobstructed views of the Kanchenjunga peaks, rolling green valleys, and misty Himalayan horizons.",
  },
  {
    icon: "local_fire_department",
    title: "Evening Bonfire & Chai",
    body: "Gather around an evening wood fire on the outdoor terrace with freshly brewed masala chai and cool mountain breezes.",
  },
  {
    icon: "menu_book",
    title: "Verified Local Hospitality",
    body: "Stay with verified local families who take pride in sharing authentic Gorkha and Himalayan culture and home cooking.",
  },
];

export const houseRules = [
  {
    icon: "schedule",
    text: "Check-in: 12:00 PM – 8:00 PM • Check-out: 11:00 AM",
  },
  {
    icon: "volume_off",
    text: "Quiet Hours: 10:00 PM – 7:00 AM — preserve the peaceful mountain quiet",
  },
  {
    icon: "steps",
    text: "Footwear: Outdoor shoes off at entrance verandas where requested",
  },
  {
    icon: "smoke_free",
    text: "Smoke-free rooms: designated outdoor smoking areas available",
  },
];

export const experiences = [
  {
    icon: "restaurant",
    title: "Home-Cooked Mountain Meals",
    body: "Wholesome, hot home-cooked meals prepared by your host family using fresh local vegetables, authentic spices, and traditional recipes.",
    footnote: { icon: "schedule", label: "Breakfast & dinner available" },
  },
  {
    icon: "hiking",
    title: "Tiger Hill & Sunrise Sightseeing",
    body: "Door-to-door cab pickups arranged early morning for Kanchenjunga sunrise over Tiger Hill, Batasia Loop, and Ghoom Monastery.",
    footnote: { icon: "map", label: "Experienced hill drivers" },
  },
  {
    icon: "directions_car",
    title: "Door-to-Door Mountain Transfers",
    body: "Direct transfers between Bagdogra Airport (IXB), NJP Railway Station, Darjeeling, Kalimpong, Gangtok, and Pelling with zero hassle.",
    footnote: { icon: "local_taxi", label: "Fixed transparent fares" },
  },
];

export interface MountainStandard {
  id: string;
  num: string;
  category: string;
  tag: string;
  title: string;
  description: string;
  footnote: string;
}

export const mountainStandards: MountainStandard[] = [
  {
    id: "fixed-fares",
    num: "01",
    category: "Pricing Integrity",
    tag: "Bagdogra & NJP",
    title: "Upfront transparent pricing",
    description:
      "Every hill fare is fixed and agreed clearly before departure. No airport pickup haggling, no awkward cash negotiations, and zero surprise surcharges when mountain fog rolls in.",
    footnote: "Clear digital confirmation",
  },
  {
    id: "vetted-drivers",
    num: "02",
    category: "Road Safety",
    tag: "Terrain Certified",
    title: "Licensed mountain drivers",
    description:
      "Every driver on our network is a local hill professional with years of proven experience navigating steep Himalayan gradients, hairpin curves, and narrow mountain bypasses.",
    footnote: "Commercial hill permits verified",
  },
  {
    id: "direct-hosts",
    num: "03",
    category: "Community First",
    tag: "100% to Host Families",
    title: "Zero middleman deductions",
    description:
      "Your entire accommodation tariff goes directly to the local family hosting you. We bypass corporate middlemen to keep mountain tourism earnings within valley communities.",
    footnote: "Direct valley economy",
  },
  {
    id: "comfort-standard",
    num: "04",
    category: "Homestay Quality",
    tag: "Verified Amenities",
    title: "Running hot water & warm bedding",
    description:
      "Himalayan nights get chilly. Every homestay room listed across our valley network is verified to provide working water geysers, clean cotton linens, and heavy wool blankets.",
    footnote: "Inspected room comfort",
  },
  {
    id: "weather-assurance",
    num: "05",
    category: "Booking Flexibility",
    tag: "Weather Adaptive",
    title: "Zero-penalty weather rescheduling",
    description:
      "Mountain weather can shift unexpectedly. When regional administrations issue road closures or heavy landslide warnings, we reschedule your rides and stays without cancellation fees.",
    footnote: "Traveler safety first",
  },
  {
    id: "valley-desk",
    num: "06",
    category: "Trip Assistance",
    tag: "Daily 6 AM – 10 PM",
    title: "Active on-road coordination",
    description:
      "Reach our dedicated valley desk on WhatsApp throughout your journey for live road condition checks, departure timing guidance, and direct stay coordination.",
    footnote: "Direct WhatsApp desk",
  },
];

// Backwards-compatible alias for any residual consumers
export type Testimonial = MountainStandard;
export const testimonials = mountainStandards;

export const valueBadges = [
  { icon: "bakery_dining", label: "Hot hill breakfast included" },
  { icon: "verified", label: "Direct booking best rate" },
  { icon: "local_fire_department", label: "Firepit & bonfire evenings" },
];

export const estateStory = [
  `${siteConfig.appName} was founded directly in the Himalayan foothills of Darjeeling and Sikkim to solve two persistent travel challenges: unpredictable taxi haggling at Bagdogra and NJP, and authentic family homestays being overshadowed by commercial booking algorithms.`,
  "Instead of extracting high platform cuts, we connect travelers directly with licensed local mountain drivers and multigenerational hill families. Every trip has an upfront agreed fare, and every booking directly supports the people who call these hills home.",
];

export const hostQuote =
  "We connect you directly with verified local mountain families and professional drivers — fair pricing, warm hospitality, and no middlemen.";

export const arrivalWindows = [
  { value: "2-4", label: "2:00 PM – 4:00 PM", note: "Hot chai and a host at the gate" },
  { value: "4-6", label: "4:00 PM – 6:00 PM", note: "Lanterns lit on the veranda" },
  { value: "late", label: "Late (After 8 PM)", note: "Self check-in and a stove already lit" },
];

export const breakfastChoices = [
  {
    value: "full",
    label: "Full Hill Breakfast",
    note: "Churpi and potato parathas, steamed momos, local white cheese, pickle from the kitchen garden, Darjeeling tea.",
  },
  {
    value: "continental",
    label: "Continental & Tea",
    note: "Butter-egg toast, fruit from Kurseong, granola and yoghurt, pour-over second-flush and herbal tisane.",
  },
  {
    value: "plant-based",
    label: "Jain & Plant-based Breakfast",
    note: "No onion or garlic: millet roti, aloo-gobi, coconut chutney, seasonal fruit, and ginger tea.",
  },
];
