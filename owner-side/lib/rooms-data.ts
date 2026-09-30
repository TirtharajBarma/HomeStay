export type RoomUnit = {
  code: string;
  name: string;
  location: string;
  category: "Ging Lodge" | "Chiyabari Lofts" | "Garden Cottages";
  status: "Active" | "Maintenance";
  maxGuests: number;
  nightly: number;
  weekend?: number;
  bedLabel: string;
  badge?: string;
  features: string[];
  image: string;
  /** Maintenance hold window, rendered as an amber alert strip. */
  hold?: { label: string; range: string };
};

export const roomUnits: RoomUnit[] = [
  {
    code: "101",
    name: "Tiger Hill View Suite",
    location: "Ground Floor • Ging Lodge",
    category: "Ging Lodge",
    status: "Active",
    maxGuests: 2,
    nightly: 5200,
    weekend: 6400,
    bedLabel: "King Bed • Kanchenjunga View",
    badge: "Active & Bookable",
    features: ["Mountain View", "King Bed", "Ensuite Bath", "Verandah"],
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCcRNkqjVEON-Urm0sUxA-OsKDtdqBGIiOtue4Z0eMRpBwoRsDQFORqeBaFxhXfUzMqQoBc2aU1L1ylbb-5kk_uJxSkhi5UyVk1S3FOVxDyfDzT_VRv9p1YVCItQF8CRmNfHKn8hqDBS4aBGCMEmuIJH0E8vawmZIMaZhB4rZcSmsAS9aB9_ryF-1LfPebObXrTzvwOAKq5FYPR0BzJjXX70vloJJQUlUwa4gli-o0yfpmtJM4wOKFh",
  },
  {
    code: "102",
    name: "Gumtree Garden Suite",
    location: "First Floor • Ging Lodge",
    category: "Ging Lodge",
    status: "Active",
    maxGuests: 3,
    nightly: 4400,
    bedLabel: "Queen Bed + Tea Lounge Sofa",
    features: ["Tea Garden View", "Private Balcony", "Attached Kitchenette"],
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDH_AwpiBivXuQb54TRC8Yr4jIsP4yzQXl84OB08ZqmS4VwTw6tYblyF1QES0NIEZj9oD4HaSpjjazaGsc5aGoaTqzq4EV7C36Ttm-kZzbxOfZ3WIOGSSMRtzxzBhKUYmPN-HFy0fU242h5EOuhtBVqgAKiH2h_V9vVYkzxboC7Y6tknwnBXhrPlkdkY2SxtH_cb8GMaL34BHDTBa3DJqTu-jmKZGXczCEfr0Vc6fP7-ffcsP1Dh0-U",
  },
  {
    code: "201",
    name: "Chiyabari Timber Loft",
    location: "Upper Level • Chiyabari Lofts",
    category: "Chiyabari Lofts",
    status: "Active",
    maxGuests: 4,
    nightly: 6100,
    bedLabel: "Twin Beds • Plush Kitchenette",
    features: ["Himalaya Panorama", "Bathtub", "Full Kitchenette"],
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA30vzV_fdDZmGMzZrtqvDWB_m9rVmghlgTkUbE_BZcslplxnk55u-LhbShUCWT0ORf6-rJRX2w6chJGkRQ2KFLe5YfKIZoI329IkVuH3BiUyHirwP-nFZMdwge9b-wCa0O5G8NBEp3V3URvA_p9CYCELH9-Iwuf77z1aJ_7ghHLOwAQI4keY2Mxy3vDJWX-nw0qg5AEr9ES-iWMVUzd7Lt0CF4digLFv31DyS7Uu6prqsGeBm3VXeD",
  },
  {
    code: "202",
    name: "Second Flush Studio",
    location: "Attic Wing • Chiyabari Lofts",
    category: "Chiyabari Lofts",
    status: "Active",
    maxGuests: 2,
    nightly: 3900,
    bedLabel: "Queen Bed & Skylight Window",
    features: ["Stargazing Skylight", "Queen Bed", "Espresso Bar"],
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAFJ0jcMZG7f2fFUEkyATM-jCIsIoZ3jj9Oqu58H796hUQ_rVdGd0z-jJBWURA5ukh3283M2c3Loz1LNlepdP7HPi21aI4hyKN-hxhMaAAesf9wIsaxqeRb8aedtpMec1X5Hcr-zBMWIjcbPR-0YlSw1uE0eutma4r-cYmPpqsUBtRL0x57Gh_PcQTizb1S_RHwC5VEm471wMdZRFPvbK6hbEacmqwOVfFFsbZ-7p-TeGtkLQ3Y6LA_",
  },
  {
    code: "301",
    name: "Silver Oak Cottage",
    location: "Orchard Side • Garden Cottages",
    category: "Garden Cottages",
    status: "Active",
    maxGuests: 2,
    nightly: 7400,
    bedLabel: "Signature Cottage Suite",
    features: ["Outdoor Cedar Tub", "Wraparound Porch", "Firepit"],
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCGwQ5fy_jcfScXBxeh82pXkS8DCS9yfTsXW42rxmTXTN9viZPlWxgaBUroaQxM9217T_QruXU85kkzxdH3MMtVxyZhlbMWClSpLKDnWl8-x-z5camN5BRpwqlWiSdIbJ2VCSX7JPgPTS8_dvYBdIXOXDkKa_7tjlQRKK8CHA3qbptZdcmCLCm6dJ-QTXrlfl4miIErri1njS9GnqRSRe4LIPOqEasrw0Sj_Z_BNgje91zXLjes_mw4",
  },
  {
    code: "302",
    name: "Cardamom Hills Hideaway",
    location: "Ridge Side • Garden Cottages",
    category: "Garden Cottages",
    status: "Maintenance",
    maxGuests: 2,
    nightly: 5600,
    bedLabel: "Queen Bed • Valley View",
    badge: "Monsoon Proofing Scheduled",
    features: ["Creek Balcony", "Wood Stove"],
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBFaHW7vj2n4Y8OAlucottQ-Av_Z7eNZmNcbZKDxwVnPlHb3tR8i5D8-jvyN1aag2ZMzwfIIAyDS27gPuWINYUf2-86ysmhlWkOQOqnniE6PLU1yHdXbZNzNx6OD96mMiJ-eVrntLYLSZkOGRZvVS1rgLD0Ayl6sNtImMxW4posDrDEriqGKEzzEXZozZPgEPSylzo8lNDfJ6hbA5295RBwFVMk4JdXy1KnGC79zADIt7eaOBY8nzqf",
    hold: { label: "Maintenance Hold", range: "Oct 28 – 30" },
  },
];

export const filterTabs: { label: string; count?: number }[] = [
  { label: "All Units", count: 6 },
  { label: "Ging Lodge", count: 2 },
  { label: "Chiyabari Lofts", count: 2 },
  { label: "Garden Cottages", count: 2 },
];

export const roomNames: string[] = roomUnits.map((room) => room.name);

export const pricingRules: {
  title: string;
  detail: string;
  scope: string;
  icon: string;
  tone: string;
}[] = [
  {
    title: "Autumn Foliage Peak",
    detail: "+20% nightly premium through Nov 15",
    scope: "All 6 units",
    icon: "local_florist",
    tone: "bg-secondary-tint text-secondary-ink",
  },
  {
    title: "Minimum 2-Night Stay",
    detail: "Required on Friday & Saturday arrivals",
    scope: "Fri – Sun check-ins",
    icon: "event_repeat",
    tone: "bg-primary-tint text-on-primary-container",
  },
  {
    title: "Direct Booking Discount",
    detail: "10% off for repeat direct guests",
    scope: "Portal & walk-in",
    icon: "volunteer_activism",
    tone: "bg-tertiary-fixed text-on-tertiary-fixed",
  },
];
