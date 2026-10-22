/**
 * Centralized API configuration for client-side.
 * Change base URL in .env.local via NEXT_PUBLIC_API_URL.
 * All route sub-endpoints are maintained here so that individual
 * components never hardcode URL strings.
 */

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

export const API_ENDPOINTS = {
  health: () => `${API_BASE_URL.replace("/api/v1", "")}/health`,
  stays: {
    list: (category?: string, petFriendly?: boolean) => {
      const params = new URLSearchParams();
      if (category && category !== "all") params.set("category", category);
      if (typeof petFriendly === "boolean") params.set("petFriendly", String(petFriendly));
      const qs = params.toString();
      return `${API_BASE_URL}/stays${qs ? `?${qs}` : ""}`;
    },
    detail: (slug: string) => `${API_BASE_URL}/stays/${slug}`,
    quote: (slug: string) => `${API_BASE_URL}/stays/${slug}/quote`,
    availabilityGrid: (days = 14) => `${API_BASE_URL}/rooms/availability/grid?days=${days}`,
  },
  properties: {
    bySlug: (slug: string) => `${API_BASE_URL}/properties/${encodeURIComponent(slug)}`,
  },
  driverSignup: () => `${API_BASE_URL}/stayride/public/driver-signup`,
  reservations: {
    create: () => `${API_BASE_URL}/reservations`,
    detail: (reference: string) => `${API_BASE_URL}/reservations/${reference}`,
    cancel: (reference: string) => `${API_BASE_URL}/reservations/${reference}/cancel`,
  },
  cabs: {
    places: () => `${API_BASE_URL}/cabs/places`,
    drivers: (seats?: number) =>
      `${API_BASE_URL}/drivers${seats ? `?seats=${seats}` : ""}`,
    quote: () => `${API_BASE_URL}/cabs/quote`,
    book: () => `${API_BASE_URL}/cabs/bookings`,
  },
  cabRequests: {
    guestLink: (token: string) =>
      `${API_BASE_URL}/stayride/public/guest-links/${encodeURIComponent(token)}`,
    submit: (token: string) =>
      `${API_BASE_URL}/stayride/public/guest-links/${encodeURIComponent(token)}/cab-requests`,
    bySlugSubmit: (slug: string) =>
      `${API_BASE_URL}/stayride/public/properties/${encodeURIComponent(slug)}/cab-requests`,
    status: (reference: string, token?: string) =>
      `${API_BASE_URL}/stayride/public/cab-requests/${encodeURIComponent(reference)}${token ? `?t=${encodeURIComponent(token)}` : ""}`,
    rate: (reference: string, token?: string) =>
      `${API_BASE_URL}/stayride/public/cab-requests/${encodeURIComponent(reference)}/rate${token ? `?t=${encodeURIComponent(token)}` : ""}`,
  },
  platform: {
    publicConfig: () => `${API_BASE_URL}/stayride/public/config`,
  },
  // Driver quote page (signed link from the WhatsApp message)
  driverQuote: {
    view: (token: string) => `${API_BASE_URL}/stayride/public/driver-quote?t=${encodeURIComponent(token)}`,
    quote: () => `${API_BASE_URL}/stayride/public/driver-quote/quote`,
    acceptCounter: () => `${API_BASE_URL}/stayride/public/driver-quote/accept-counter`,
    start: () => `${API_BASE_URL}/stayride/public/driver-quote/start`,
    complete: () => `${API_BASE_URL}/stayride/public/driver-quote/complete`,
  },
  legal: (doc: string) => `${API_BASE_URL}/stayride/public/legal/${encodeURIComponent(doc)}`,
  newsletter: {
    subscribe: () => `${API_BASE_URL}/newsletter/subscribe`,
  },
  auth: {
    register: () => `${API_BASE_URL}/auth/register`,
    login: () => `${API_BASE_URL}/auth/login`,
    me: () => `${API_BASE_URL}/auth/me`,
  },
} as const;

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: options.cache ?? "no-store",
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const err = errorBody.error;
    throw new Error(
      (typeof err === "string" ? err : err?.message) ||
        `API request failed with status ${res.status}`
    );
  }

  const json = await res.json();
  return json.data ?? json;
}
