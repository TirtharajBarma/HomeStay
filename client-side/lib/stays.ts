import type { StayKind } from "./booking";
import { card, estate, estateShot, oakHero } from "./stay-images";

export type GalleryShot = {
  src: string;
  alt: string;
  caption: string;
};

export type Review = {
  name: string;
  initials: string;
  stayed: string;
  quote: string;
  tone: "clay" | "sage" | "sand";
};

export type Stay = {
  slug: string;
  name: string;
  wing: string;
  kind: StayKind;
  kindLabel: string;
  petFriendly: boolean;
  price: number;
  maxGuests: number;
  occupancy: string;
  bedIcon: string;
  blurb: string;
  amenities: string[];
  highlight: { icon: string; label: string };
  rating: number;
  reviewCount: number;
  eyebrow: string;
  intro: string;
  image: string;
  imageAlt: string;
  gallery: GalleryShot[];
  facts: { icon: string; label: string; value: string }[];
  story: string[];
  reviews: Review[];
};

export const stays: Stay[] = [
  {
    slug: "ging-tea-cottage",
    name: "Ging Tea Cottage",
    wing: "Lower Garden Wing",
    kind: "cottage",
    kindLabel: "Garden Cottage",
    petFriendly: false,
    price: 2400,
    maxGuests: 2,
    occupancy: "1 Queen Bed • 2 Guests",
    bedIcon: "king_bed",
    blurb:
      "A ground-floor cottage at the mouth of the Ging valley, with a bukhari wood stove, a copper bathtub, and first-flush tea picked before you wake.",
    amenities: ["Bukhari Stove", "Copper Bathtub", "Tea Garden View"],
    highlight: { icon: "coffee", label: "Breakfast included" },
    rating: 4.94,
    reviewCount: 63,
    eyebrow: "Lower Garden Cottage",
    intro:
      "The warmest of our six. Bukhari stove, copper tub, and a window that opens straight onto the Ging tea terraces.",
    image: card.oakHearth,
    imageAlt: "Cosy cottage room with a wood stove, warm timber and a window onto green hills.",
    gallery: [
      {
        src: oakHero,
        alt: "A lit stove beside a queen bed dressed in white linen with tea hills beyond the window.",
        caption: "Bukhari stove & valley window",
      },
      estateShot(
        "A deep copper bathtub beside a bright window looking out over green hills.",
        "Copper Bathtub",
        estate.clawfootTub,
      ),
      estateShot(
        "Flagstone terrace with wooden chairs under fruit trees on a misty morning.",
        "Lower Garden Terrace",
        estate.orchardPatio,
      ),
      estateShot(
        "A basket of steamed buns, local cheese and a pot of Darjeeling tea on a wooden table.",
        "Ging Farm Breakfast",
        estate.farmsteadBreakfast,
      ),
      estateShot(
        "Rough-hewn timber ceiling beams with traditional pegged joinery.",
        "Handcrafted Cedar Joinery",
        estate.cedarJoinery,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "2 Guests" },
      { icon: "bed", label: "Bedding", value: "1 Queen Bed" },
      { icon: "bathtub", label: "Bath", value: "Copper Tub" },
      { icon: "door_front", label: "Access", value: "Garden Level" },
    ],
    story: [
      "Built in 1974 for the tea estate's superintendent, the Ging cottage sits at the lowest point of the property where the slope finally gives out and the air turns warm. We kept the original teak window frames, added a bukhari stove, and left the walls unpainted so the mountain weather can come through.",
      "You are a five-minute walk from the estate's own plucking rows, which means the second-flush leaves for your morning tea are cut after you have finished breakfast. Anuradha will hand you a mug of it on the terrace while the mist is still sitting in the valley.",
    ],
    reviews: [
      {
        name: "Rhea & Nikhil Barman",
        initials: "RB",
        stayed: "April 2025 • Stayed 4 nights",
        quote:
          "The estate has the milky Darjeeling everyone raves about, and Anuradha poured it for us before the fog lifted. We never wanted to leave the hill.",
        tone: "clay",
      },
      {
        name: "Marisol Ibáñez",
        initials: "MI",
        stayed: "November 2024 • Stayed 3 nights",
        quote:
          "Cold evenings, a hot stove, and the best hot shower of any hill stay. The garden terrace is where I finished my book.",
        tone: "sage",
      },
    ],
  },
  {
    slug: "chowrasta-studio",
    name: "Chowrasta Studio",
    wing: "Town Landing",
    kind: "cottage",
    kindLabel: "Garden Cottage",
    petFriendly: false,
    price: 2900,
    maxGuests: 3,
    occupancy: "1 Queen + 1 Single • 3 Guests",
    bedIcon: "bed",
    blurb:
      "A compact studio on the Chowrasta side of the property, ten minutes from the station, made for travellers who arrive late and leave early.",
    amenities: ["Station Pickup", "Reading Nook", "Rainfall View"],
    highlight: { icon: "local_taxi", label: "Station transfers" },
    rating: 4.88,
    reviewCount: 41,
    eyebrow: "Town Landing Studio",
    intro:
      "For the ones who care more about the toy train than the view. Compact, warm, and a short walk from Darjeeling's station side.",
    image: card.timberLoft,
    imageAlt: "Compact studio room with a queen bed, a reading chair and a window full of rain.",
    gallery: [
      estateShot(
        "Rain streaming down a large window with a reading chair and warm lamp beside it.",
        "Monsoon Reading Nook",
        card.timberLoft,
      ),
      estateShot(
        "A basket of steamed buns, local cheese and a pot of Darjeeling tea on a wooden table.",
        "Ging Farm Breakfast",
        estate.farmsteadBreakfast,
      ),
      estateShot(
        "Flagstone terrace with wooden chairs under fruit trees on a misty morning.",
        "Lower Garden Terrace",
        estate.orchardPatio,
      ),
      estateShot(
        "Anuradha and Tenzin on the timber veranda in the evening.",
        "Meet your hosts",
        estate.hostsPortrait,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "3 Guests" },
      { icon: "bed", label: "Bedding", value: "Queen + Single" },
      { icon: "bathtub", label: "Bath", value: "Shower Cubicle" },
      { icon: "train", label: "Access", value: "10 min to Station" },
    ],
    story: [
      "The Chowrasta side of the estate has always been the practical one — the road in, the staff path, the room you give a guest who is here for the railway. The studio used to be the estate office. We took out the filing cabinets and put in a queen bed.",
      "It suits people on a tight schedule: you are inside the station gates in ten minutes on foot, and there is a car waiting at the gate if you would rather not do the downhill walk in the rain.",
    ],
    reviews: [
      {
        name: "Hiroko Tanabe",
        initials: "HT",
        stayed: "February 2025 • Stayed 2 nights",
        quote:
          "We had forty minutes between trains. The car was at the gate, the room was warm, and there was tea waiting. Exactly what we needed.",
        tone: "sand",
      },
      {
        name: "Devika & Arjun Rao",
        initials: "DR",
        stayed: "December 2024 • Stayed 3 nights",
        quote:
          "Small, spotless, and the smartest place we have stayed near Chowrasta. Anurappa sorted our Pelling out in one phone call.",
        tone: "clay",
      },
    ],
  },
  {
    slug: "rangit-rose-loft",
    name: "Rangit Rose Loft",
    wing: "Main Lodge Upper",
    kind: "loft",
    kindLabel: "Attic Loft",
    petFriendly: false,
    price: 3600,
    maxGuests: 4,
    occupancy: "2 Queen Beds • 4 Guests",
    bedIcon: "bed",
    blurb:
      "Under the rafters of the main lodge, with dormer windows over the garden and the original hand-plastered roof line overhead.",
    amenities: ["Dormer Windows", "Writing Desk", "En-suite Bath"],
    highlight: { icon: "landscape", label: "Kanchenjunga view" },
    rating: 4.91,
    reviewCount: 52,
    eyebrow: "Attic Loft",
    intro:
      "Two dormer windows, two proper beds, and a roof line close enough to touch. The original hand-plastered ceiling is the reason for the loft.",
    image: card.gardenStone,
    imageAlt: "Attic loft room with sloped ceiling beams, two beds and dormer windows over a garden.",
    gallery: [
      estateShot(
        "Sloped ceiling with exposed timber beams above a bed and a dormer window.",
        "Hand-plastered Roof Line",
        card.gardenStone,
      ),
      estateShot(
        "A breakfast basket with steamed buns, local cheese and Darjeeling tea on a wooden table.",
        "Ging Farm Breakfast",
        estate.farmsteadBreakfast,
      ),
      estateShot(
        "Flagstone terrace with wooden chairs under fruit trees on a misty morning.",
        "Lower Garden Terrace",
        estate.orchardPatio,
      ),
      estateShot(
        "Morning light falling across a writing desk with a kettle and a stack of books.",
        "Writing Desk",
        estate.cedarJoinery,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "4 Guests" },
      { icon: "bed", label: "Bedding", value: "2 Queen Beds" },
      { icon: "bathtub", label: "Bath", value: "En-suite Shower" },
      { icon: "stairs", label: "Access", value: "Two Flights Up" },
    ],
    story: [
      "The main lodge's roof pitch is the reason this room exists. In winter the whole upper floor is cold, so the plaster was done by hand in layers and the dormers were cut last — small, but they catch the Kanchenjunga side of the sky in the early hours.",
      "It is the best room in the house for a family or two friends travelling together: two real beds, a desk, and enough space to spread out a week of maps without sitting on the floor.",
    ],
    reviews: [
      {
        name: "Aditi Malhotra",
        initials: "AM",
        stayed: "March 2025 • Stayed 5 nights",
        quote:
          "The loft is the whole reason to come back. At six in the morning the mountain is right there in the dormer window and nobody else is awake.",
        tone: "sage",
      },
      {
        name: "Thomas & Grete Huber",
        initials: "TH",
        stayed: "October 2024 • Stayed 6 nights",
        quote:
          "Our children had a bed each and we had ours. Six nights and we extended twice. The ceiling makes rain the best sound in the world.",
        tone: "clay",
      },
    ],
  },
  {
    slug: "kurseong-meadow-loft",
    name: "Kurseong Meadow Loft",
    wing: "East Attic",
    kind: "loft",
    kindLabel: "Attic Loft",
    petFriendly: false,
    price: 4200,
    maxGuests: 4,
    occupancy: "1 King + 2 Single • 4 Guests",
    bedIcon: "bed",
    blurb:
      "The east attic, a short walk down from the main lodge, looking over the meadow toward the Dzongri ridge and a faint line of the old road.",
    amenities: ["Meadow Outlook", "Wood Stove", "Reading Lamp"],
    highlight: { icon: "water", label: "Herbal Steam Room" },
    rating: 4.89,
    reviewCount: 37,
    eyebrow: "East Attic Loft",
    intro:
      "Built for four, on the quiet side of the property, with the meadow and the Dzongri ridge straight out of the window.",
    image: card.pineMeadow,
    imageAlt: "Loft room with a wood stove, warm lamp and a window looking over an open meadow.",
    gallery: [
      estateShot(
        "A wood stove glowing in a quiet loft with a lamp and a book on the sill.",
        "Wood Stove Corner",
        card.pineMeadow,
      ),
      estateShot(
        "An open green meadow below a forested ridge under a pale morning sky.",
        "Meadow & Dzongri Ridge",
        estate.cedarJoinery,
      ),
      estateShot(
        "A basket of steamed buns, local cheese and a pot of Darjeeling tea on a wooden table.",
        "Ging Farm Breakfast",
        estate.farmsteadBreakfast,
      ),
      estateShot(
        "Anuradha and Tenzin on the timber veranda in the evening.",
        "Meet your hosts",
        estate.hostsPortrait,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "4 Guests" },
      { icon: "bed", label: "Bedding", value: "King + 2 Singles" },
      { icon: "bathtub", label: "Bath", value: "En-suite Shower" },
      { icon: "spa", label: "Access", value: "Steam Room Path" },
    ],
    story: [
      "The east side of the estate was once a drying shed for the tea leaves. The roof was too low for the racks, so the family turned it into sleeping space in the eighties and left the floor. The meadow below it is a two-minute walk, and it is the best place on the property to watch the fog come up.",
      "The herbal steam room is next door and open to everyone on the estate. It is a small, hot, cedar-lined room that smells of juniper, and it is the answer to a wet day in Kurseong.",
    ],
    reviews: [
      {
        name: "Priya Venkatesh",
        initials: "PV",
        stayed: "September 2024 • Stayed 4 nights",
        quote:
          "The steam room is worth the trip on its own. We went in three nights out of four and slept like children.",
        tone: "sand",
      },
      {
        name: "Samuel Okonkwo",
        initials: "SO",
        stayed: "January 2025 • Stayed 3 nights",
        quote:
          "Quiet in a way the town never is. I read two books and watched the fog cross the meadow every single evening.",
        tone: "sage",
      },
    ],
  },
  {
    slug: "hatimanally-cabin",
    name: "Hati Manally Cabin",
    wing: "Forest Edge",
    kind: "cabin",
    kindLabel: "Valley Cabin",
    petFriendly: true,
    price: 5400,
    maxGuests: 4,
    occupancy: "2 Queen Beds • 4 Guests",
    bedIcon: "bed",
    blurb:
      "At the forest edge where the estate meets the reserve, with a stone fireplace, a covered veranda, and the Gorkha ridge across the valley.",
    amenities: ["Stone Fireplace", "Covered Veranda", "Forest Trailhead"],
    highlight: { icon: "forest", label: "Rhododendron trail" },
    rating: 4.96,
    reviewCount: 44,
    eyebrow: "Forest Edge Cabin",
    intro:
      "The last building on the estate before the reserve begins. Stone fireplace, covered veranda, and the Gorkha ridge filling the valley.",
    image: card.atticStudio,
    imageAlt: "Timber cabin room with a stone fireplace, deep armchairs and a covered veranda.",
    gallery: [
      estateShot(
        "A stone fireplace burning in a timber cabin room with deep armchairs facing it.",
        "Stone Fireplace",
        card.atticStudio,
      ),
      estateShot(
        "A covered timber veranda with a bench looking out over a deep green valley.",
        "Covered Veranda",
        estate.orchardPatio,
      ),
      estateShot(
        "A basket of steamed buns, local cheese and a pot of Darjeeling tea on a wooden table.",
        "Ging Farm Breakfast",
        estate.farmsteadBreakfast,
      ),
      estateShot(
        "Anuradha and Tenzin on the timber veranda in the evening.",
        "Meet your hosts",
        estate.hostsPortrait,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "4 Guests" },
      { icon: "bed", label: "Bedding", value: "2 Queen Beds" },
      { icon: "bathtub", label: "Bath", value: "Bath + Shower" },
      { icon: "forest", label: "Access", value: "Forest Edge" },
    ],
    story: [
      "Beyond this cabin the estate ends and the reserve begins. The rhododendron trail starts at the veranda step, so you can be in a forest of red blooms at seven in the morning and back for breakfast without a car.",
      "Evenings are for the fireplace. Tenzin cuts the wood, Anuradha sets out the dry-store, and the rain on the reserve roof is a decent argument for staying in.",
    ],
    reviews: [
      {
        name: "Ishan & Preeti Ghosh",
        initials: "IG",
        stayed: "May 2025 • Stayed 3 nights",
        quote:
          "We walked the rhododendron path at dawn. Fireplace, hot food, and that view. We are already planning the return trip.",
        tone: "clay",
      },
      {
        name: "Lena Fischer",
        initials: "LF",
        stayed: "August 2024 • Stayed 4 nights",
        quote:
          "The veranda in the evening is the best seat in West Bengal. Nothing on it. Just the ridge, the fog, and the tea.",
        tone: "sand",
      },
    ],
  },
  {
    slug: "namring-cabin",
    name: "Namring Cabin",
    wing: "Upper Namring",
    kind: "cabin",
    kindLabel: "Valley Cabin",
    petFriendly: false,
    price: 7800,
    maxGuests: 6,
    occupancy: "3 Queen Beds • 6 Guests",
    bedIcon: "bed",
    blurb:
      "Our largest and highest cabin, up on the Namring shoulder — the clearest sunrise view of Kanchenjunga on the property, and the closest to a private bonfire.",
    amenities: ["Bonfire Deck", "Bonfire Allowed", "Sunrise Deck"],
    highlight: { icon: "wb_sunny", label: "Kanchenjunga at sunrise" },
    rating: 4.97,
    reviewCount: 29,
    eyebrow: "Upper Namring Cabin",
    intro:
      "Six guests, the highest sleeping position on the estate, and the first sun on Kanchenjunga. Bonfire approved, host provided.",
    image: card.willowBrook,
    imageAlt: "Large timber cabin room with three beds, warm wood and a wide view of distant peaks.",
    gallery: [
      estateShot(
        "A wide timber cabin room with three beds and morning light across the floor.",
        "Three-Bed Cabin",
        card.willowBrook,
      ),
      estateShot(
        "A wide deck over a green valley with distant Himalayan peaks on the horizon.",
        "Sunrise Deck",
        estate.cedarJoinery,
      ),
      estateShot(
        "A basket of steamed buns, local cheese and a pot of Darjeeling tea on a wooden table.",
        "Ging Farm Breakfast",
        estate.farmsteadBreakfast,
      ),
      estateShot(
        "A covered terrace with wooden chairs looking out over a deep green valley.",
        "Covered Veranda",
        estate.orchardPatio,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "6 Guests" },
      { icon: "bed", label: "Bedding", value: "3 Queen Beds" },
      { icon: "bathtub", label: "Bath", value: "2 Bathrooms" },
      { icon: "local_fire_department", label: "Access", value: "Namring Road" },
    ],
    story: [
      "The Namring shoulder is a twenty-minute climb above the main lodge and the highest point we own. The cabin was rebuilt in 2019 for families who want the whole estate to themselves, and the deck faces the one gap in the ridge where the sun comes up.",
      "This is the cabin for a celebration. The bonfire deck is built for it, the hosts will lay the fire and bring the kettle, and you will have the sunrise to yourselves.",
    ],
    reviews: [
      {
        name: "The Nandi Family",
        initials: "NF",
        stayed: "December 2024 • Stayed 3 nights",
        quote:
          "Three generations, one cabin, no single rooms, no compromises. We watched the sun come up on the mountain and nobody reached for a phone.",
        tone: "clay",
      },
      {
        name: "Cameron Whitfield",
        initials: "CW",
        stayed: "June 2025 • Stayed 2 nights",
        quote:
          "The deck is the argument. If you only book one thing, book the sunrise, and the bonfire is a very close second.",
        tone: "sage",
      },
    ],
  },
];

export const kindFilters = [
  { kind: "all", label: "All Stays" },
  { kind: "cottage", label: "Garden Cottages" },
  { kind: "loft", label: "Attic Lofts" },
  { kind: "cabin", label: "Valley Cabins" },
] as const;

export const estateImages = estate;

export function getStay(slug: string): Stay | undefined {
  return stays.find((stay) => stay.slug === slug);
}

export function getStaySlugs(): string[] {
  return stays.map((stay) => stay.slug);
}

export function countByKind(kind: StayKind): number {
  return stays.filter((stay) => stay.kind === kind).length;
}

export function countPetFriendly(): number {
  return stays.filter((stay) => stay.petFriendly).length;
}
