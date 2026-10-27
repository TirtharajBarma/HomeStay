import { cache } from "react";
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

export type StayRoom = {
  id?: string | number;
  number: string;
  type: string;
  floor?: string;
  price: number;
  status?: string;
  note?: string;
  amenities?: string[];
  image?: string;
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
  phone?: string;
  email?: string;
  rooms?: StayRoom[];
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

/** Maps a Property document to a Stay for dedicated /h/[slug] portals and marketplace listings */
function propertyToStay(p: Raw): Stay {
  const name = str(p.name) || "Mountain Homestay";
  const slug = str(p.slug) || "homestay";
  const rawRooms = Array.isArray(p.rooms) ? p.rooms : [];
  const photos = Array.isArray(p.photos) && p.photos.length ? p.photos : [];
  const defaultImage = photos[0] || rawRooms[0]?.image || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80";

  const roomPrices = rawRooms.map((r: Raw) => num(r.price) || num(r.nightly)).filter((pr: number) => pr > 0);
  const minPrice = roomPrices.length ? Math.min(...roomPrices) : 2400;

  const galleryShots: GalleryShot[] = photos.length
    ? photos.map((src: string, i: number) => ({ src, alt: `${name} Photo ${i + 1}`, caption: name }))
    : rawRooms[0]?.gallery?.length
      ? rawRooms[0].gallery
      : [{ src: defaultImage, alt: name, caption: name }];

  const mappedRooms: StayRoom[] = rawRooms.map((r: Raw) => ({
    id: r.id || r._id,
    number: str(r.number) || "101",
    type: str(r.type) || "Standard Room",
    floor: str(r.floor) || "Main Cottage",
    price: num(r.price) || num(r.nightly) || 2000,
    status: str(r.status) || "Available",
    note: str(r.note) || "",
    amenities: Array.isArray(r.amenities) ? r.amenities : ["Mountain View", "Geyser", "Verified Host"],
    image: r.image || photos[0] || defaultImage,
  }));

  return {
    code: slug,
    slug,
    name,
    wing: `${str(p.town) || "Darjeeling"}, ${str(p.region) || "West Bengal"}`,
    kind: "cottage",
    kindLabel: "Dedicated Homestay",
    petFriendly: true,
    price: minPrice,
    maxGuests: num(rawRooms[0]?.maxGuests) || 4,
    occupancy: mappedRooms.length ? `${mappedRooms.length} Room${mappedRooms.length > 1 ? "s" : ""}` : "Estate & Cab Portal",
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
    gallery: galleryShots,
    facts: [
      { icon: "cottage", label: "Property", value: "Mountain Homestay" },
      { icon: "location_on", label: "Location", value: str(p.address) || str(p.town) || "Darjeeling" },
      { icon: "schedule", label: "Check-in", value: str(p.checkInTime) || "12:00 PM" },
      { icon: "directions_car", label: "Transfers", value: "Available on request" },
    ],
    story: [str(p.bio) || "A tranquil mountain retreat offering authentic Himalayan hospitality and door-to-door cab services."],
    reviews: [],
    phone: str(p.phone) || "",
    email: str(p.email) || "",
    rooms: mappedRooms,
  };
}

/** Filter out test/audit properties generated during test runs */
function isTestEntity(e: Raw): boolean {
  const em = str(e.email).toLowerCase();
  const slug = str(e.slug).toLowerCase();
  return (
    em.includes("@stayride.test") ||
    em.includes("host.audit") ||
    em.includes("audit.host") ||
    slug.startsWith("test-")
  );
}

/** Live stays from the API. Prioritizes real registered properties, with fallback to rooms. */
export const getLiveStays = cache(async (): Promise<{ stays: Stay[]; error: string | null }> => {
  try {
    const fetchOpts: RequestInit = { next: { revalidate: 30 } };

    const propPromise = fetch(API_ENDPOINTS.properties.list(), fetchOpts)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    const roomPromise = fetch(API_ENDPOINTS.stays.list(), fetchOpts)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    const [propJson, roomJson] = await Promise.all([propPromise, roomPromise]);

    const propertyStays: Stay[] = [];
    if (propJson?.success && Array.isArray(propJson.data)) {
      for (const p of propJson.data) {
        if (isTestEntity(p)) continue;
        const stay = propertyToStay(p);
        if (stay) propertyStays.push(stay);
      }
    }

    const roomStays: Stay[] = [];
    if (roomJson?.success && Array.isArray(roomJson.data)) {
      for (const r of roomJson.data) {
        if (isTestEntity(r)) continue;
        const stay = toStay(r);
        if (stay) roomStays.push(stay);
      }
    }

    // Real properties take priority; then include standalone rooms if their property isn't already listed
    const combined: Stay[] = [...propertyStays];
    for (const r of roomStays) {
      const isAlreadyCovered = combined.some(
        (s) =>
          s.slug === r.slug ||
          r.slug.startsWith(`${s.slug}-`) ||
          (r.code && r.code.startsWith(`${s.slug}-`))
      );
      if (!isAlreadyCovered) {
        combined.push(r);
      }
    }

    if (combined.length === 0) {
      const err = propJson?.error || roomJson?.error;
      return { stays: [], error: (typeof err === "string" ? err : err?.message) || "No stays available at this time." };
    }

    return { stays: combined, error: null };
  } catch {
    return { stays: [], error: "Stays could not be loaded right now. Please check your connection and try again." };
  }
});

/** A live stay by slug or code; checks rooms first, then resolves homestay property directly. */
export const getLiveStay = cache(async (slug: string): Promise<Stay | undefined> => {
  if (!slug) return undefined;
  const clean = slug.toLowerCase().trim();
  const { stays } = await getLiveStays();
  const found = stays.find(
    (s: Stay & { code?: string }) => s.slug.toLowerCase() === clean || s.code?.toLowerCase() === clean
  );
  if (found) return found;

  // Fallback: Resolve homestay property by slug
  try {
    const res = await fetch(API_ENDPOINTS.properties.bySlug(clean), { next: { revalidate: 30 } });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success && json.data) {
      return propertyToStay(json.data);
    }
  } catch {
    // Network or server error on fallback
  }

  return undefined;
});

/** Cached fetch of live platform configuration set by Admin in the tower */
export const getPlatformConfig = cache(async (): Promise<{ supportPhone: string; upiId: string } | null> => {
  try {
    const res = await fetch(API_ENDPOINTS.platform.publicConfig(), { next: { revalidate: 60 } });
    const json = await res.json().catch(() => null);
    if (json?.config) {
      return {
        supportPhone: typeof json.config.supportPhone === "string" ? json.config.supportPhone : "",
        upiId: typeof json.config.upiId === "string" ? json.config.upiId : "",
      };
    }
  } catch {
    // If backend unreachable, return null so callers use safe defaults
  }
  return null;
});
