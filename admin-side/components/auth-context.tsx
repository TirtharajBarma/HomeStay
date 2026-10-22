"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  API_ENDPOINTS,
  apiFetch,
  clearAdminSession,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
} from "@/lib/api-config";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "admin";
};

export type AdminAuthContextType = {
  admin: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, admin: AdminUser) => void;
  logout: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

const TOKEN_KEY = TOKEN_STORAGE_KEY;
const USER_KEY = USER_STORAGE_KEY;

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    async function initAdminAuth() {
      try {
        const storedToken = window.localStorage.getItem(TOKEN_KEY);
        const storedUser = window.localStorage.getItem(USER_KEY);
        if (!storedToken || !storedUser) return;

        const parsed = JSON.parse(storedUser);
        if (parsed.role !== "admin") {
          clearAdminSession();
          return;
        }

        // Do not trust localStorage: confirm the token with the server. A 401 makes
        // apiFetch clear the session and redirect to /login.
        const res = await apiFetch(API_ENDPOINTS.me());
        if (!res.ok) throw new Error(`Session check failed (${res.status}).`);
        const json = await res.json();
        const me = json?.data;
        if (!json?.success || !me || me.role !== "admin") {
          throw new Error("Stored session is no longer a valid admin.");
        }

        const user: AdminUser = {
          id: String(me.id || me._id || parsed.id || ""),
          name: me.name || parsed.name || "",
          email: me.email || parsed.email || "",
          role: "admin",
        };
        window.localStorage.setItem(USER_KEY, JSON.stringify(user));
        document.cookie = `${TOKEN_KEY}=${storedToken}; path=/; SameSite=Lax; max-age=86400`;
        if (cancelled) return;
        setToken(storedToken);
        setAdmin(user);
      } catch {
        if (!cancelled) {
          clearAdminSession();
          document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
          setToken(null);
          setAdmin(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    initAdminAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    (newToken: string, newAdmin: AdminUser) => {
      setToken(newToken);
      setAdmin(newAdmin);
      window.localStorage.setItem(TOKEN_KEY, newToken);
      window.localStorage.setItem(USER_KEY, JSON.stringify(newAdmin));
      document.cookie = `${TOKEN_KEY}=${newToken}; path=/; SameSite=Lax; max-age=86400`;
      router.push("/");
    },
    [router]
  );

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
    clearAdminSession();
    document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
    router.push("/login");
  }, [router]);

  useEffect(() => {
    if (isLoading) return;
    const isLoginPage = pathname === "/login";
    if (!token && !isLoginPage) {
      router.replace("/login");
    } else if (token && isLoginPage) {
      router.replace("/");
    }
  }, [token, isLoading, pathname, router]);

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
      }}
    >
      {isLoading ? (
        <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-900 text-slate-400">
          <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
          <span className="text-sm font-semibold">Checking session…</span>
        </div>
      ) : (
        children
      )}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  }
  return ctx;
}
