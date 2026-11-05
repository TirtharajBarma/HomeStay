import { siteConfig } from "./site-config";

export const hosts = {
  names: "Verified Himalayan Hosts",
  since: `${siteConfig.appName} Network`,
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
    icon: "egg_alt",
    title: "Home-Cooked Mountain Meals",
    body: "Wholesome, hot home-cooked meals prepared by your host family using fresh local vegetables, authentic spices, and traditional recipes.",
    footnote: { icon: "schedule", label: "Breakfast & Dinner Available" },
  },
  {
    icon: "hiking",
    title: "Tiger Hill & Sunrise Sightseeing",
    body: "Door-to-door cab pickups arranged early morning for Kanchenjunga sunrise over Tiger Hill, Batasia Loop, and Ghoom Monastery.",
    footnote: { icon: "map", label: "Experienced Hill Drivers" },
  },
  {
    icon: "spa",
    title: "Door-to-Door Mountain Transfers",
    body: "Direct transfers between Bagdogra Airport (IXB), NJP Railway Station, Darjeeling, Kalimpong, Gangtok, and Pelling with zero hassle.",
    footnote: { icon: "local_taxi", label: "Fixed Transparent Fares" },
  },
];

export const testimonials = [
  {
    initials: "AS",
    name: "Amit & Priya Sen",
    stay: "Bagdogra Airport ➔ Darjeeling Homestay",
    quote:
      "Booked our airport transfer and homestay through StayCabs. Our driver was waiting right at the arrival gate and the homestay host welcomed us with hot tea. Seamless experience from start to finish.",
  },
  {
    initials: "RM",
    name: "Rahul Mukherjee",
    stay: "NJP Station ➔ Gangtok Transit",
    quote:
      "Finding a reliable hill cab without excessive bargaining used to be stressful. StayCabs gave an honest fare upfront and the driver navigated the mountain roads with absolute skill.",
  },
  {
    initials: "SS",
    name: "Sunita & Vikram Sharma",
    stay: "Darjeeling Sightseeing & Homestay Stay",
    quote:
      "A peaceful stay overlooking the tea gardens and a spotless vehicle for our Tiger Hill and Mirik day trips. Will definitely recommend StayCabs to anyone visiting North Bengal.",
  },
];

export const valueBadges = [
  { icon: "bakery_dining", label: "Hot Hill Breakfast Included" },
  { icon: "verified", label: "Direct Booking Best Rate" },
  { icon: "local_fire_department", label: "Firepit & Bonfire Nights" },
];

export const estateStory = [
  `${siteConfig.appName} was built directly in the Himalayan foothills of Darjeeling and Sikkim to connect travelers with authentic homestay hospitality and transparent, reliable door-to-door mountain transportation.`,
  "Every homestay on our network is owned and operated by local families. From warm cups of fresh-plucked garden tea to verified local drivers meeting you right at Bagdogra or NJP station, we connect you directly with the people who call these hills home.",
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
