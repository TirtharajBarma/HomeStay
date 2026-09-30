/**
 * Demo money layer. Amounts across the data files are stored in whole rupees;
 * everything the owner sees is rendered through the selected currency so the
 * pitch can be shown in INR or converted for an international guest.
 */

export type CurrencyKey = "INR" | "USD" | "EUR" | "GBP";

export type Currency = {
  key: CurrencyKey;
  label: string;
  symbol: string;
  locale: string;
  /** Material Symbols glyph for the header selector. */
  icon: string;
  /** Rupees → this currency. Fixed rates, clearly marked as demo values. */
  rate: number;
};

export const CURRENCIES: Currency[] = [
  { key: "INR", label: "Indian Rupee", symbol: "₹", locale: "en-IN", icon: "currency_rupee", rate: 1 },
  { key: "USD", label: "US Dollar", symbol: "$", locale: "en-US", icon: "attach_money", rate: 0.0119 },
  { key: "EUR", label: "Euro", symbol: "€", locale: "de-DE", icon: "euro", rate: 0.011 },
  { key: "GBP", label: "Pound Sterling", symbol: "£", locale: "en-GB", icon: "currency_pound", rate: 0.0094 },
];

export const DEFAULT_CURRENCY: CurrencyKey = "INR";

export const currencyFor = (key: CurrencyKey) =>
  CURRENCIES.find((currency) => currency.key === key) ?? CURRENCIES[0];

export const convert = (rupees: number, key: CurrencyKey) =>
  rupees * currencyFor(key).rate;

export const STORAGE_KEY = "estate-currency";

/* ------------------------------------------------------------------ store */

type Listener = () => void;

let current: CurrencyKey = DEFAULT_CURRENCY;
const listeners = new Set<Listener>();

export const currencyStore = {
  get: () => current,
  set: (next: CurrencyKey) => {
    if (next === current) return;
    current = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked — still applies for this session */
    }
    for (const listener of listeners) listener();
  },
  /** Re-read on mount so a previous session's choice sticks. */
  hydrate: () => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as CurrencyKey | null;
      if (stored && CURRENCIES.some((currency) => currency.key === stored)) current = stored;
    } catch {
      /* keep the default */
    }
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/* -------------------------------------------------------------- formatting */

/** `₹4,200` / `$50` — whole units unless `paise` is asked for. */
export function money(rupees: number, options?: { paise?: boolean }, key?: CurrencyKey) {
  const active = currencyFor(key ?? currencyStore.get());
  const value = convert(rupees, active.key);
  const digits = options?.paise && active.key === "INR" ? 2 : 0;
  return (
    active.symbol +
    value.toLocaleString(active.locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

/** Indian short scale: `₹1.7L`, `₹24.5K`, `₹2.4Cr`. Others use `k`/`M`. */
export function moneyCompact(rupees: number, key?: CurrencyKey) {
  const active = currencyFor(key ?? currencyStore.get());
  const value = convert(rupees, active.key);

  if (active.key === "INR") {
    if (Math.abs(value) >= 10_000_000) return `${active.symbol}${(value / 10_000_000).toFixed(1)}Cr`;
    if (Math.abs(value) >= 100_000) return `${active.symbol}${(value / 100_000).toFixed(1)}L`;
    if (Math.abs(value) >= 1_000) return `${active.symbol}${(value / 1_000).toFixed(1)}K`;
    return `${active.symbol}${Math.round(value)}`;
  }

  if (Math.abs(value) >= 1_000_000) return `${active.symbol}${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${active.symbol}${(value / 1_000).toFixed(1)}k`;
  return `${active.symbol}${Math.round(value)}`;
}

/** Bare number for CSV exports, no symbol so spreadsheets stay numeric. */
export function moneyPlain(rupees: number, key?: CurrencyKey) {
  const value = convert(rupees, key ?? currencyStore.get());
  return Math.round(value).toLocaleString(currencyFor(key ?? currencyStore.get()).locale);
}
