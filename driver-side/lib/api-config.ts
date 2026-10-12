export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

export const API_ENDPOINTS = {
  driverLogin: () => `${API_BASE_URL}/auth/driver/login`,
  driverProfile: (id: string) => `${API_BASE_URL}/drivers`,
  updateStatus: (id: string) => `${API_BASE_URL}/drivers/${id}/status`,
  payouts: () => `${API_BASE_URL}/cabs/payouts`,
  driverTrips: (id: string) => `${API_BASE_URL}/drivers/${id}/trips`,
  updateTripStatus: (tripId: string) => `${API_BASE_URL}/drivers/trips/${tripId}/status`,
};

export function getDriverToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("platform_driver_token");
}

export function getDriverHeaders(): Record<string, string> {
  const token = getDriverToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
