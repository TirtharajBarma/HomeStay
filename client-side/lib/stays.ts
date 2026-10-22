import type { StayKind } from "./booking";
import { API_ENDPOINTS } from "./api-config";
import { estate } from "./stay-images";

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
  code?: string;
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
  highlight: { icon: string; label: string } | null;
  /** null until the stay has real reviews. */
  rating: number | null;
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

export const kindFilters = [
  { kind: "all", label: "All Stays" },
  { kind: "cottage", label: "Garden Cottages" },
  { kind: "loft", label: "Attic Lofts" },
  { kind: "cabin", label: "Valley Cabins" },
] as const;

export const estateImages = estate;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Maps an API room to a Stay. Rooms without a real nightly price or capacity are skipped
 *  (they cannot be booked); nothing is invented. */
function toStay(r: Raw): Stay | null {
  const price = num(r.nightly) || num(r.price);
  const maxGuests = num(r.maxGuests);
  const slug = str(r.slug) || str(r.code);
  const image = str(r.image);
  if (!slug || !image || price <= 0 || maxGuests <= 0) return null;
  const name = str(r.name) || slug;
  const reviewCount = num(r.reviewCount);
  return {
    code: str(r.code),
    slug,
    name,
    wing: str(r.wing) || str(r.location),
    kind: (["cottage", "loft", "cabin"].includes(r.kind) ? r.kind : "cottage") as StayKind,
    kindLabel: str(r.kindLabel) || str(r.category),
    petFriendly: !!r.petFriendly,
    price,
    maxGuests,
    occupancy: str(r.occupancy) || `${maxGuests} Guests`,
    bedIcon: str(r.bedIcon) || "bed",
    blurb: str(r.blurb) || str(r.tagline),
    amenities: Array.isArray(r.amenities) ? r.amenities : [],
    highlight: r.highlight?.label ? r.highlight : null,
    rating: reviewCount > 0 && num(r.rating) > 0 ? num(r.rating) : null,
    reviewCount,
    eyebrow: str(r.eyebrow) || str(r.category),
    intro: str(r.intro) || str(r.blurb),
    image,
    imageAlt: str(r.imageAlt) || name,
    gallery: Array.isArray(r.gallery) && r.gallery.length ? r.gallery : image ? [{ src: image, alt: name, caption: name }] : [],
    facts: Array.isArray(r.facts) ? r.facts : [],
    story: Array.isArray(r.story) ? r.story : [],
    reviews: Array.isArray(r.reviews) ? r.reviews : [],
  } as Stay;
}

/** Maps a Property document to a Stay for dedicated /h/[slug] portals */
function propertyToStay(p: Raw): Stay {
  const name = str(p.name) || "Mountain Homestay";
  const slug = str(p.slug) || "homestay";
  const defaultImage = p.rooms?.[0]?.image || "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1200&q=80";
  return {
    code: slug,
    slug,
    name,
    wing: `${str(p.town) || "Darjeeling"}, ${str(p.region) || "West Bengal"}`,
    kind: "cottage",
    kindLabel: "Dedicated Homestay",
    petFriendly: true,
    price: num(p.rooms?.[0]?.nightly) || num(p.rooms?.[0]?.price) || 2400,
    maxGuests: num(p.rooms?.[0]?.maxGuests) || 4,
    occupancy: p.rooms?.length ? `${p.rooms.length} Room${p.rooms.length > 1 ? "s" : ""}` : "Estate & Cab Portal",
    bedIcon: "cottage",
    blurb: str(p.bio) || `Welcome to ${name}. Peaceful mountain stay in ${str(p.town) || "Darjeeling"}.`,
    amenities: ["Verified Local Host", "Mountain Transfers", "Door-to-door Cab", "Home Cooked Meals"],
    highlight: { icon: "verified", label: "Verified Estate" },
    rating: 4.9,
    reviewCount: 14,
    eyebrow: `${str(p.town) || "Darjeeling"} Hills`,
    intro: str(p.bio) || `Welcome to ${name}. View accommodation details, contact your host directly, or book your door-to-door hill cab transfer.`,
    image: defaultImage,
    imageAlt: name,
    gallery: p.rooms?.[0]?.gallery?.length ? p.rooms[0].gallery : [{ src: defaultImage, alt: name, caption: name }],
    facts: [
      { icon: "cottage", label: "Property", value: "Mountain Homestay" },
      { icon: "location_on", label: "Location", value: str(p.address) || str(p.town) || "Darjeeling" },
      { icon: "schedule", label: "Check-in", value: str(p.checkInTime) || "12:00 PM" },
      { icon: "directions_car", label: "Transfers", value: "Available on request" },
    ],
    story: [str(p.bio) || "A tranquil mountain retreat offering authentic Himalayan hospitality and door-to-door cab services."],
    reviews: [],
  };
}

/** Live stays from the API. On failure returns an error message and no stays (never a static fallback). */
export async function getLiveStays(): Promise<{ stays: Stay[]; error: string | null }> {
  try {
    const res = await fetch(API_ENDPOINTS.stays.list(), { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !Array.isArray(json.data)) {
      const err = json?.error;
      return { stays: [], error: (typeof err === "string" ? err : err?.message) || "Stays could not be loaded right now." };
    }
    return { stays: json.data.map(toStay).filter((s: Stay | null): s is Stay => s !== null), error: null };
  } catch {
    return { stays: [], error: "Stays could not be loaded right now. Please check your connection and try again." };
  }
}

/** A live stay by slug or code; checks rooms first, then resolves homestay property directly. */
export async function getLiveStay(slug: string): Promise<Stay | undefined> {
  if (!slug) return undefined;
  const clean = slug.toLowerCase().trim();
  const { stays } = await getLiveStays();
  const found = stays.find(
    (s: Stay & { code?: string }) => s.slug.toLowerCase() === clean || s.code?.toLowerCase() === clean
  );
  if (found) return found;

  // Fallback: Resolve homestay property by slug
  try {
    const res = await fetch(API_ENDPOINTS.properties.bySlug(clean), { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success && json.data) {
      return propertyToStay(json.data);
    }
  } catch {
    // Network or server error on fallback
  }

  return undefined;
}
