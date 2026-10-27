/**
 * Configuration dynamically resolved from environment variables or runtime browser location.
 * ZERO hardcoded domains, brand names, or URLs.
 */

const getOrigin = (): string => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");
  }
  return "";
};

const getHost = (): string => {
  if (typeof window !== "undefined" && window.location?.host) {
    return window.location.host;
  }
  if (process.env.NEXT_PUBLIC_APP_DOMAIN) {
    return process.env.NEXT_PUBLIC_APP_DOMAIN;
  }
  try {
    const origin = getOrigin();
    if (origin) return new URL(origin).host;
  } catch {}
  return "";
};

export const siteConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Homestay & Cab Network",
  appUrl: getOrigin(),
  domain: getHost(),
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "",
  bookingEmail: process.env.NEXT_PUBLIC_BOOKING_EMAIL?.trim() || "",
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "",
  upiId: process.env.NEXT_PUBLIC_UPI_ID?.trim() || "",

  homestayUrl: (slug: string): string => {
    const base = getOrigin();
    return base ? `${base}/h/${slug}` : `/h/${slug}`;
  },
  cabRequestUrl: (reference?: string, token?: string): string => {
    const base = getOrigin();
    const query = new URLSearchParams();
    if (reference) query.set("ref", reference);
    if (token) query.set("t", token);
    const qs = query.toString();
    const path = qs ? `/cab-request?${qs}` : "/cab-request";
    return base ? `${base}${path}` : path;
  },
};
