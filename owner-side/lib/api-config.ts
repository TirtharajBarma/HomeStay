/**
 * Centralized API configuration for owner-side.
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
  properties: {
    profile: () => `${API_BASE_URL}/properties/profile`,
    locations: () => `${API_BASE_URL}/properties/locations`,
    location: (id: string) => `${API_BASE_URL}/properties/locations/${id}`,
  },
  rooms: {
    list: (category?: string, status?: string) => {
      const params = new URLSearchParams();
      if (category && category !== "all") params.set("category", category);
      if (status && status !== "all") params.set("status", status);
      const qs = params.toString();
      return `${API_BASE_URL}/rooms${qs ? `?${qs}` : ""}`;
    },
    detail: (codeOrSlug: string) => `${API_BASE_URL}/rooms/${codeOrSlug}`,
    create: () => `${API_BASE_URL}/rooms`,
    update: (codeOrSlug: string) => `${API_BASE_URL}/rooms/${codeOrSlug}`,
    delete: (codeOrSlug: string) => `${API_BASE_URL}/rooms/${codeOrSlug}`,
    holds: (codeOrSlug: string) => `${API_BASE_URL}/rooms/${codeOrSlug}/holds`,
    grid: (startDate?: string, days = 14) =>
      `${API_BASE_URL}/rooms/availability/grid?startDate=${startDate || ""}&days=${days}`,
  },
  bookings: {
    list: (channel?: string, status?: string, search?: string) => {
      const params = new URLSearchParams();
      if (channel && channel !== "all") params.set("channel", channel);
      if (status && status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      const qs = params.toString();
      return `${API_BASE_URL}/bookings${qs ? `?${qs}` : ""}`;
    },
    detail: (reference: string) => `${API_BASE_URL}/bookings/${reference}`,
    create: () => `${API_BASE_URL}/bookings`,
    cancel: (reference: string) => `${API_BASE_URL}/bookings/${reference}/cancel`,
  },
  guests: {
    list: (query?: string, status?: string, room?: string) => {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (status && status !== "Everyone" && status !== "all") params.set("status", status);
      if (room && room !== "All units") params.set("room", room);
      const qs = params.toString();
      return `${API_BASE_URL}/guests${qs ? `?${qs}` : ""}`;
    },
    detail: (id: string) => `${API_BASE_URL}/guests/${id}`,
    update: (id: string) => `${API_BASE_URL}/guests/${id}`,
    timeline: (startDate?: string, days = 14) =>
      `${API_BASE_URL}/guests/timeline?startDate=${startDate || ""}&days=${days}`,
  },
  drivers: {
    list: (status?: string, seats?: number) => {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (seats) params.set("seats", String(seats));
      const qs = params.toString();
      return `${API_BASE_URL}/drivers${qs ? `?${qs}` : ""}`;
    },
    create: () => `${API_BASE_URL}/drivers`,
    updateStatus: (id: string) => `${API_BASE_URL}/drivers/${id}/status`,
    payouts: () => `${API_BASE_URL}/cabs/payouts`,
  },
  analytics: {
    get: (range = "month", offset = 0) =>
      `${API_BASE_URL}/analytics?range=${range}&offset=${offset}`,
    exportCsv: (range = "month") => `${API_BASE_URL}/analytics/export?range=${range}`,
  },
  auth: {
    register: () => `${API_BASE_URL}/auth/register`,
    login: () => `${API_BASE_URL}/auth/login`,
    me: () => `${API_BASE_URL}/auth/me`,
    google: () => `${API_BASE_URL}/auth/google`,
    sendOtp: () => `${API_BASE_URL}/auth/otp/send`,
    verifyOtp: () => `${API_BASE_URL}/auth/otp/verify`,
  },
  ical: {
    exportFeed: (codeOrSlug: string) => `${API_BASE_URL}/rooms/${codeOrSlug}/calendar.ics`,
    syncInbound: (codeOrSlug: string) => `${API_BASE_URL}/rooms/${codeOrSlug}/sync-ical`,
  },
} as const;

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("platform_auth_token");
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeaders = getAuthHeaders();
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
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
