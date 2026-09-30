"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  currencyFor,
  currencyStore,
  money,
  moneyCompact,
  type CurrencyKey,
} from "@/lib/currency";

type Money = {
  key: CurrencyKey;
  symbol: string;
  setKey: (next: CurrencyKey) => void;
  /** `₹4,200` — pass `{ paise: true }` for exact rupee amounts. */
  money: (rupees: number, options?: { paise?: boolean }) => string;
  /** `₹1.7L` — for axis labels and dense stat rows. */
  compact: (rupees: number) => string;
  options: typeof CURRENCIES;
};

const CurrencyContext = createContext<Money | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const key = useSyncExternalStore(
    currencyStore.subscribe,
    currencyStore.get,
    () => DEFAULT_CURRENCY,
  );

  // The choice lives in localStorage, so read it once on mount.
  useEffect(() => currencyStore.hydrate(), []);

  const setKey = useCallback((next: CurrencyKey) => currencyStore.set(next), []);

  const value = useMemo<Money>(
    () => ({
      key,
      symbol: currencyFor(key).symbol,
      setKey,
      money: (rupees, options) => money(rupees, options, key),
      compact: (rupees) => moneyCompact(rupees, key),
      options: CURRENCIES,
    }),
    [key, setKey],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useMoney(): Money {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useMoney must be used inside <CurrencyProvider>");
  return context;
}
