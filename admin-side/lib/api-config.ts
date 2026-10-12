export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

export const API_ENDPOINTS = {
  login: () => `${API_BASE_URL}/auth/login`,
  me: () => `${API_BASE_URL}/auth/me`,
  overview: () => `${API_BASE_URL}/admin/overview`,
  settlePayout: () => `${API_BASE_URL}/admin/payouts/settle`,
  propertyStatus: (id: string) => `${API_BASE_URL}/admin/properties/${id}/status`,
};

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("platform_admin_token");
}

export function getAdminHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
