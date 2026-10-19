import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSession } from '../types';

// Release builds must get the API URL from EXPO_PUBLIC_API_URL; the LAN fallback is dev-only.
// For physical devices in development, set EXPO_PUBLIC_API_URL or change it in More Settings.
export const DEFAULT_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://192.168.0.111:5050/v1' : '');

export const API_CONFIG_ERROR = DEFAULT_BASE_URL
  ? null
  : 'Server address is not configured in this build (EXPO_PUBLIC_API_URL is missing). Please install an updated version of the app.';

// Server errors are `{error:{message, code?, feature?}}`; keep code/status so the UI can react.
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public feature?: string) {
    super(message);
  }
}

// Demo accounts / one-tap demo login are for development builds or builds that opt in explicitly
export const DEMO_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEMO === 'true';

// Fabricated offline demo sessions (created only when the server is unreachable) hold no real
// credentials, so refreshing them would force a logout. Never attempt a token refresh for these.
export const isOfflineDemoToken = (token?: string) =>
  !!token && (token.startsWith('demo-token-') || token.startsWith('demo-driver-token-') || token.startsWith('demo-'));

// O1: owner creates carry an Idempotency-Key so a retry after a lost response never creates twice.
const IDEMPOTENT_POSTS = [
  /^\/(bookings|rooms|guests|drivers|trips|guest-links|guest-links\/send|appeals)$/,
  /^\/payouts\/request$/,
  /^\/trips\/[^/]+\/rate$/,
  /^\/bookings\/[^/]+\/payments$/,
];
const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000;
const newIdempotencyKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

class ApiService {
  // One key per submission (path + body). Kept while the outcome is unknown (network error / 5xx)
  // so re-submitting the same form reuses it; dropped once the server answered or the form closes.
  private idempotencyKeys = new Map<string, { key: string; path: string; at: number }>();
  private baseUrl: string = DEFAULT_BASE_URL;
  private session: UserSession | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private sessionExpiredListener: ((code?: string) => void) | null = null;
  private sessionUpdatedListener: ((session: UserSession | null) => void) | null = null;
  private accountErrorListener: ((code: string, message: string) => void) | null = null;

  async init() {
    try {
      const stored = await AsyncStorage.getItem('stayride_session');
      if (stored) {
        this.session = JSON.parse(stored);
      }
      // A saved override is a dev convenience only; release builds always use the env URL.
      const savedUrl = __DEV__ ? await AsyncStorage.getItem('stayride_base_url') : null;
      if (savedUrl && !savedUrl.includes('10.0.2.2')) {
        this.baseUrl = savedUrl;
      }
    } catch {
      // Ignored
    }
  }

  // One slow reply on phone Wi-Fi must not read as "server down": two tries, 4s each.
  async checkHealth(): Promise<boolean> {
    if (!this.baseUrl) return false;
    const url = `${this.baseUrl.replace(/\/v1\/?$/, '')}/health`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) return true;
      } catch {
        // try again
      } finally {
        clearTimeout(timeoutId);
      }
    }
    return false;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
    AsyncStorage.setItem('stayride_base_url', url);
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  isLoggedIn(): boolean {
    return !!this.session?.accessToken;
  }

  getSession(): UserSession | null {
    return this.session;
  }

  async saveSession(session: UserSession) {
    this.session = session;
    await AsyncStorage.setItem('stayride_session', JSON.stringify(session));
    this.sessionUpdatedListener?.(session);
  }

  async clearSession() {
    this.session = null;
    await AsyncStorage.removeItem('stayride_session');
    this.sessionUpdatedListener?.(null);
  }

  onSessionUpdated(listener: (session: UserSession | null) => void) {
    this.sessionUpdatedListener = listener;
    return () => {
      this.sessionUpdatedListener = null;
    };
  }

  // Called when the server rejects the refresh token (session is already cleared).
  onSessionExpired(listener: (code?: string) => void) {
    this.sessionExpiredListener = listener;
    return () => {
      if (this.sessionExpiredListener === listener) this.sessionExpiredListener = null;
    };
  }

  // ACCOUNT_BLOCKED / DRIVER_NOT_APPROVED from any request
  onAccountError(listener: (code: string, message: string) => void) {
    this.accountErrorListener = listener;
    return () => {
      if (this.accountErrorListener === listener) this.accountErrorListener = null;
    };
  }

  // authToken: send this bearer token instead of the StayRide session (no refresh on 401).
  private async request(method: string, path: string, body?: any, authToken?: string): Promise<any> {
    if (!this.baseUrl) throw new Error(API_CONFIG_ERROR || 'Server address is not configured.');
    const url = `${this.baseUrl}${path}`;
    const fingerprint =
      method === 'POST' && !authToken && IDEMPOTENT_POSTS.some((re) => re.test(path))
        ? `${path}\n${JSON.stringify(body ?? null)}`
        : null;
    let idempotencyKey: string | undefined;
    if (fingerprint) {
      const kept = this.idempotencyKeys.get(fingerprint);
      idempotencyKey = kept && Date.now() - kept.at < IDEMPOTENCY_TTL_MS ? kept.key : newIdempotencyKey();
      this.idempotencyKeys.set(fingerprint, { key: idempotencyKey, path, at: kept?.key === idempotencyKey ? kept.at : Date.now() });
    }
    const send = (token?: string) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      // 20s cap so a dead mountain connection fails fast instead of hanging the screen
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      return fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal }).finally(() =>
        clearTimeout(timer)
      );
    };

    const usedToken = authToken ?? this.session?.accessToken;
    let res = await send(usedToken);

    if (res.status === 401 && !authToken && this.session?.refreshToken && !isOfflineDemoToken(usedToken)) {
      // Another request may have refreshed already; otherwise share one in-flight refresh.
      const refreshed = this.session.accessToken !== usedToken || (await this.refreshToken());
      if (refreshed && this.session?.accessToken) {
        res = await send(this.session.accessToken);
      }
    }

    // The server answered definitively (2xx/4xx): the next submission is a new one
    // (except 409 IDEMPOTENCY_IN_PROGRESS: the first attempt is still running, so a retry must reuse the key)
    if (fingerprint && res.status < 500 && res.status !== 409) this.idempotencyKeys.delete(fingerprint);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const message =
        errorData?.error?.message ||
        (typeof errorData?.error === 'string' ? errorData.error : undefined) ||
        errorData?.message ||
        `Request failed (${res.status})`;
      const code: string | undefined = errorData?.error?.code;
      if (fingerprint && res.status === 409 && code !== 'IDEMPOTENCY_IN_PROGRESS') this.idempotencyKeys.delete(fingerprint);
      if (!authToken && (code === 'ACCOUNT_BLOCKED' || code === 'DRIVER_NOT_APPROVED') && this.session) {
        this.accountErrorListener?.(code, message);
      }
      throw new ApiError(message, res.status, code, errorData?.error?.feature);
    }

    if (res.status === 204) return {};
    return res.json();
  }

  private refreshToken(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<boolean> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.session?.refreshToken }),
      });
    } catch {
      return false; // Network failure: keep the session and let the caller surface the error
    }
    if (res.ok) {
      try {
        const data = await res.json();
        await this.saveSession({ ...(this.session as UserSession), ...data });
        return true;
      } catch {
        return false;
      }
    }
    if (res.status === 401 || res.status === 403) {
      const code: string | undefined = await res
        .json()
        .then((d: any) => d?.error?.code)
        .catch(() => undefined);
      if (code === 'ACCOUNT_BLOCKED') {
        // Blocked, not signed out: keep the session so "Try again" works once the admin unblocks
        this.accountErrorListener?.(code, 'This account is blocked. Contact StayRide support.');
        return false;
      }
      await this.clearSession();
      this.sessionExpiredListener?.(code);
    }
    return false;
  }

  get(path: string) {
    return this.request('GET', path);
  }

  post(path: string, body?: any, authToken?: string) {
    return this.request('POST', path, body, authToken);
  }

  put(path: string, body?: any) {
    return this.request('PUT', path, body);
  }

  patch(path: string, body?: any) {
    return this.request('PATCH', path, body);
  }

  delete(path: string, body?: any) {
    return this.request('DELETE', path, body);
  }

  /** Forget retained idempotency keys (form closed / sign out). With a prefix, only those paths. */
  clearIdempotencyKeys(pathPrefix = '') {
    for (const [fp, v] of this.idempotencyKeys) if (v.path.startsWith(pathPrefix)) this.idempotencyKeys.delete(fp);
  }
}

export const api = new ApiService();
