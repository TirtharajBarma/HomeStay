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

/** A live stay by slug or code; undefined when it does not exist or the API is unavailable. */
export async function getLiveStay(slug: string): Promise<Stay | undefined> {
  if (!slug) return undefined;
  const { stays } = await getLiveStays();
  return stays.find(
    (s) => s.slug === slug || s.slug === slug.toLowerCase() || (s as any).code === slug || (s as any).code === slug.toUpperCase()
  );
}
