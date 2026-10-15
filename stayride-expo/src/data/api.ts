import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSession } from '../types';

// Release builds must get the API URL from EXPO_PUBLIC_API_URL; the LAN fallback is dev-only.
// For physical devices in development, set EXPO_PUBLIC_API_URL or change it in More Settings.
export const DEFAULT_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://192.168.0.111:5050/v1' : '');

export const API_CONFIG_ERROR = DEFAULT_BASE_URL
  ? null
  : 'Server address is not configured in this build (EXPO_PUBLIC_API_URL is missing). Please install an updated version of the app.';

class ApiService {
  private baseUrl: string = DEFAULT_BASE_URL;
  private session: UserSession | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private sessionExpiredListener: (() => void) | null = null;
  private sessionUpdatedListener: ((session: UserSession | null) => void) | null = null;

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

  async checkHealth(): Promise<boolean> {
    if (!this.baseUrl) return false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${this.baseUrl.replace(/\/v1\/?$/, '')}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
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
  onSessionExpired(listener: () => void) {
    this.sessionExpiredListener = listener;
    return () => {
      if (this.sessionExpiredListener === listener) this.sessionExpiredListener = null;
    };
  }

  // authToken: send this bearer token instead of the StayRide session (no refresh on 401).
  private async request(method: string, path: string, body?: any, authToken?: string): Promise<any> {
    if (!this.baseUrl) throw new Error(API_CONFIG_ERROR || 'Server address is not configured.');
    const url = `${this.baseUrl}${path}`;
    const send = (token?: string) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    };

    const usedToken = authToken ?? this.session?.accessToken;
    let res = await send(usedToken);

    if (res.status === 401 && !authToken && this.session?.refreshToken) {
      // Another request may have refreshed already; otherwise share one in-flight refresh.
      const refreshed = this.session.accessToken !== usedToken || (await this.refreshToken());
      if (refreshed && this.session?.accessToken) {
        res = await send(this.session.accessToken);
      }
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const message =
        errorData?.error?.message ||
        (typeof errorData?.error === 'string' ? errorData.error : undefined) ||
        errorData?.message ||
        `Request failed (${res.status})`;
      throw new Error(message);
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
      await this.clearSession();
      this.sessionExpiredListener?.();
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

  delete(path: string) {
    return this.request('DELETE', path);
  }
}

export const api = new ApiService();
