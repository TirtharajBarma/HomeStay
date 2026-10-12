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
import { API_ENDPOINTS, apiFetch } from "@/lib/api-config";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "driver" | "guest";
  phone?: string;
  propertyId?: string;
  homestayName?: string;
};

export type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "platform_auth_token";
const USER_KEY = "platform_auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  // Load stored credentials on mount and verify token with backend
  useEffect(() => {
    async function initAuth() {
      try {
        const storedToken = window.localStorage.getItem(TOKEN_KEY);
        const storedUser = window.localStorage.getItem(USER_KEY);

        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);

          // Verify with live backend
          try {
            const res = await fetch(API_ENDPOINTS.auth.me(), {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.data?.user) {
                setUser(data.data.user);
                window.localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
              }
            } else if (res.status === 401) {
              // Token expired or invalid
              window.localStorage.removeItem(TOKEN_KEY);
              window.localStorage.removeItem(USER_KEY);
              setToken(null);
              setUser(null);
            }
          } catch (e) {
            // Network offline fallback - keep cached credentials
            console.warn("Could not verify auth with server, using cached session:", e);
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = useCallback(
    (newToken: string, newUser: AuthUser) => {
      setToken(newToken);
      setUser(newUser);
      window.localStorage.setItem(TOKEN_KEY, newToken);
      window.localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      router.push("/analytics");
    },
    [router]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    router.push("/login");
  }, [router]);

  const refreshUser = useCallback(async () => {
    const currentToken = token || window.localStorage.getItem(TOKEN_KEY);
    if (!currentToken) return;
    try {
      const res = await fetch(API_ENDPOINTS.auth.me(), {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.data?.user) {
          setUser(data.data.user);
          window.localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
        }
      }
    } catch (e) {
      console.warn("Could not refresh user:", e);
    }
  }, [token]);

  // Route protection gate
  useEffect(() => {
    if (isLoading) return;

    const isPublicPage = pathname === "/login" || pathname === "/register";

    if (!token && !isPublicPage) {
      router.replace("/login");
    } else if (token && isPublicPage) {
      router.replace("/analytics");
    }
  }, [token, isLoading, pathname, router]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
