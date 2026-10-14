import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSession } from '../types';

// Default development URL (Android Emulator: 10.0.2.2, iOS / Web: localhost)
// For physical devices or production, set EXPO_PUBLIC_API_URL or change in More Settings
export const DEFAULT_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.111:5050/v1';

class ApiService {
  private baseUrl: string = DEFAULT_BASE_URL;
  private session: UserSession | null = null;

  async init() {
    try {
      const stored = await AsyncStorage.getItem('stayride_session');
      if (stored) {
        this.session = JSON.parse(stored);
      }
      const savedUrl = await AsyncStorage.getItem('stayride_base_url');
      if (savedUrl && !savedUrl.includes('10.0.2.2')) {
        this.baseUrl = savedUrl;
      } else if (process.env.EXPO_PUBLIC_API_URL) {
        this.baseUrl = process.env.EXPO_PUBLIC_API_URL;
      }
    } catch {
      // Ignored
    }
  }

  async checkHealth(): Promise<boolean> {
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
  }

  async clearSession() {
    this.session = null;
    await AsyncStorage.removeItem('stayride_session');
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.session?.accessToken) {
      headers['Authorization'] = `Bearer ${this.session.accessToken}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && this.session?.refreshToken) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.session.accessToken}`;
        const retryRes = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        return retryRes.json();
      }
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const message = errorData?.error?.message || errorData?.message || `Request failed (${res.status})`;
      throw new Error(message);
    }

    if (res.status === 204) return {};
    return res.json();
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.session?.refreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        await this.saveSession(data);
        return true;
      }
    } catch {
      // ignore
    }
    await this.clearSession();
    return false;
  }

  get(path: string) {
    return this.request('GET', path);
  }

  post(path: string, body?: any) {
    return this.request('POST', path, body);
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
