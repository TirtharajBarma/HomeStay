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
    throw new Error(
      errorBody.error || `API request failed with status ${res.status}`
    );
  }

  const json = await res.json();
  return json.data ?? json;
}
