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

export type DriverUser = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  colour?: string;
  status: "Active" | "On a trip" | "Inactive";
};

export type DriverAuthContextType = {
  driver: DriverUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, driver: DriverUser) => void;
  logout: () => void;
  updateStatus: (newStatus: "Active" | "On a trip" | "Inactive") => void;
};

const DriverAuthContext = createContext<DriverAuthContextType | null>(null);

const TOKEN_KEY = "platform_driver_token";
const DRIVER_KEY = "platform_driver_data";

export function DriverAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [driver, setDriver] = useState<DriverUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const storedToken = window.localStorage.getItem(TOKEN_KEY);
      const storedDriver = window.localStorage.getItem(DRIVER_KEY);
      if (storedToken && storedDriver) {
        setToken(storedToken);
        setDriver(JSON.parse(storedDriver));
      }
    } catch (e) {
      console.warn("Driver session parse notice:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    (newToken: string, newDriver: DriverUser) => {
      setToken(newToken);
      setDriver(newDriver);
      window.localStorage.setItem(TOKEN_KEY, newToken);
      window.localStorage.setItem(DRIVER_KEY, JSON.stringify(newDriver));
      router.push("/");
    },
    [router]
  );

  const logout = useCallback(() => {
    setToken(null);
    setDriver(null);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(DRIVER_KEY);
    router.push("/login");
  }, [router]);

  const updateStatus = useCallback(
    (newStatus: "Active" | "On a trip" | "Inactive") => {
      if (!driver) return;
      const updated = { ...driver, status: newStatus };
      setDriver(updated);
      window.localStorage.setItem(DRIVER_KEY, JSON.stringify(updated));
    },
    [driver]
  );

  useEffect(() => {
    if (isLoading) return;
    const isLogin = pathname === "/login";
    if (!token && !isLogin) {
      router.replace("/login");
    } else if (token && isLogin) {
      router.replace("/");
    }
  }, [token, isLoading, pathname, router]);

  return (
    <DriverAuthContext.Provider
      value={{
        driver,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        updateStatus,
      }}
    >
      {children}
    </DriverAuthContext.Provider>
  );
}

export function useDriverAuth() {
  const ctx = useContext(DriverAuthContext);
  if (!ctx) {
    throw new Error("useDriverAuth must be used inside DriverAuthProvider");
  }
  return ctx;
}
