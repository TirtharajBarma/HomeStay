type GrecaptchaV3 = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: GrecaptchaV3;
  }
}

let scriptLoad: Promise<void> | null = null;

async function loadRecaptcha(siteKey: string): Promise<void> {
  if (window.grecaptcha) return;
  if (!scriptLoad) {
    scriptLoad = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-platform-recaptcha]");
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Could not load security verification.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.dataset.platformRecaptcha = "true";
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load security verification."));
      document.head.appendChild(script);
    }).catch((error) => {
      scriptLoad = null;
      throw error;
    });
  }
  await scriptLoad;
  if (!window.grecaptcha) throw new Error("Security verification is unavailable. Please try again.");
}

export async function getRecaptchaToken(action: string): Promise<string> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  const missingKey = !siteKey || /^(replace-with-|your[-_]|none|disabled)/i.test(siteKey);
  if (missingKey && process.env.NODE_ENV !== "production") return "";
  if (missingKey) throw new Error("Security verification is not configured. Please try again later.");
  await loadRecaptcha(siteKey);
  const api = window.grecaptcha;
  if (!api) throw new Error("Security verification is unavailable. Please try again.");
  return new Promise((resolve, reject) => {
    api.ready(() => {
      api.execute(siteKey, { action }).then(resolve, reject);
    });
  });
}
