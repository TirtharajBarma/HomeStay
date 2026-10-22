export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

if (typeof window !== "undefined" && process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn("WARNING: NEXT_PUBLIC_API_URL is unset in production. Requests may fail if backend is remote.");
}

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
  rejectHostPayout: (id: string) => `${API_BASE_URL}/admin/host-payouts/${id}/reject`,
  drivers: (status?: string) => `${API_BASE_URL}/admin/stayride/drivers${status ? `?status=${status}` : ""}`,
  driverStatus: (id: string) => `${API_BASE_URL}/admin/stayride/drivers/${id}/status`,
  users: (role?: string) => `${API_BASE_URL}/admin/stayride/users${role ? `?role=${role}` : ""}`,
  userRole: (id: string) => `${API_BASE_URL}/admin/stayride/users/${id}/role`,
  userStatus: (id: string) => `${API_BASE_URL}/admin/stayride/users/${id}/status`,
  cabRequests: (status?: string) => `${API_BASE_URL}/admin/cab-requests${status ? `?status=${status}` : ""}`,
  settleDriverCabRequest: (id: string) => `${API_BASE_URL}/admin/cab-requests/${id}/driver-settled`,
};

export const TOKEN_STORAGE_KEY = "platform_admin_token";
export const USER_STORAGE_KEY = "platform_admin_data";
export const SESSION_EXPIRED_KEY = "session_expired"; // holds the sign-out reason

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * `fetch` with the admin bearer token attached. Any 401 (expired/invalid/revoked session), and any
 * 403 from the admin API (no longer an admin, blocked), clears the stored session, stores the reason
 * for the login page and redirects there.
 */
export async function apiFetch(
  url: string,
  options: RequestInit & { skipAuthRedirect?: boolean } = {}
): Promise<Response> {
  const { skipAuthRedirect, ...init } = options;
  const headers = new Headers(init.headers);
  const token = getAdminToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  const isAdminApi = url.startsWith(`${API_BASE_URL}/admin`);
  if (!skipAuthRedirect && (res.status === 401 || (res.status === 403 && isAdminApi))) {
    const body = await res.clone().json().catch(() => ({}));
    const err = body?.error;
    const code = (typeof err === "object" && err?.code) || body?.code;
    const msg = typeof err === "string" ? err : err?.message;
    const reason =
      code === "SESSION_REVOKED"
        ? "Your session was revoked. Please sign in again."
        : res.status === 403
          ? `Admin access denied${msg ? `: ${msg}` : "."} You have been signed out.`
          : msg
            ? `Signed out: ${msg}`
            : "Session expired. Please sign in again.";
    clearAdminSession();
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_EXPIRED_KEY, reason);
      window.location.assign("/login");
    }
    throw new Error(reason);
  }
  return res;
}

// Server errors come as `{error: string}` or `{error: {message}}`
export async function readApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  const err = body?.error;
  return (typeof err === "string" ? err : err?.message) || fallback;
}

/**
 * StayRide admin API call: `path` is relative to `/admin`. Adds the bearer token, `?demo=true`
 * (and body.demo) for the demo dataset, and throws the server's error message on failure.
 */
export async function adminApi<T = any>(
  path: string,
  opts: { method?: string; body?: Record<string, unknown>; demo?: boolean; query?: Record<string, string | number | undefined> } = {}
): Promise<T> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query || {})) if (v !== undefined && v !== "") params.set(k, String(v));
  if (opts.demo) params.set("demo", "true");
  const qs = params.toString();
  const res = await apiFetch(`${API_BASE_URL}/admin${path}${qs ? `?${qs}` : ""}`, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.demo ? { ...opts.body, demo: true } : opts.body) : undefined,
  });
  if (!res.ok) throw new Error(await readApiError(res, `Request failed (${res.status}).`));
  return res.json();
}
