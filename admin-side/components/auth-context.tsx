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
import { API_ENDPOINTS } from "@/lib/api-config";

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

const TOKEN_KEY = "platform_admin_token";
const USER_KEY = "platform_admin_data";

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function initAdminAuth() {
      try {
        const storedToken = window.localStorage.getItem(TOKEN_KEY);
        const storedUser = window.localStorage.getItem(USER_KEY);
        if (storedToken && storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed.role === "admin") {
            setToken(storedToken);
            setAdmin(parsed);
          } else {
            window.localStorage.removeItem(TOKEN_KEY);
            window.localStorage.removeItem(USER_KEY);
          }
        }
      } catch (e) {
        console.warn("Admin session error:", e);
      } finally {
        setIsLoading(false);
      }
    }
    initAdminAuth();
  }, []);

  const login = useCallback(
    (newToken: string, newAdmin: AdminUser) => {
      setToken(newToken);
      setAdmin(newAdmin);
      window.localStorage.setItem(TOKEN_KEY, newToken);
      window.localStorage.setItem(USER_KEY, JSON.stringify(newAdmin));
      router.push("/");
    },
    [router]
  );

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
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
      {children}
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
