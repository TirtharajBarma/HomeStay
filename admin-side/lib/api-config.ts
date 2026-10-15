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
  commissionSettings: () => `${API_BASE_URL}/admin/commission/settings`,
  previewCommission: () => `${API_BASE_URL}/admin/commission/preview`,
  appeals: () => `${API_BASE_URL}/admin/appeals`,
  decideAppeal: (id: string) => `${API_BASE_URL}/admin/appeals/${id}/decide`,
  pendingCabRequests: () => `${API_BASE_URL}/admin/cab-requests/pending`,
  assignDriverToRequest: (id: string) => `${API_BASE_URL}/admin/cab-requests/${id}/assign-driver`,
  recordCabRequestPayment: (id: string) => `${API_BASE_URL}/admin/cab-requests/${id}/record-payment`,
  hostPayouts: () => `${API_BASE_URL}/admin/host-payouts`,
  settleHostPayout: (id: string) => `${API_BASE_URL}/admin/host-payouts/${id}/settle`,
};

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("platform_admin_token");
}

export function getAdminHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Server errors come as `{error: string}` or `{error: {message}}`
export async function readApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  const err = body?.error;
  return (typeof err === "string" ? err : err?.message) || fallback;
}
