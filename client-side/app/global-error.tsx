"use client";

import { useEffect } from "react";
import { siteConfig } from "@/lib/site-config";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Unhandled Error:", error);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${siteConfig.appUrl}/api/v1`;
      fetch(`${apiUrl}/telemetry/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error?.message || "Guest Web Global Error",
          screen: "GlobalBoundary",
          platform: "web-guest",
          stack: error?.stack,
          extra: { digest: error?.digest },
        }),
      }).catch(() => {});
    } catch {
      // Ignored
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-6 font-sans text-[#1c1b18]">
        <div className="max-w-md w-full bg-white rounded-xl border border-[#ded8ce] p-8 text-center space-y-5 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-[#fce8dc] text-[#9c411e] flex items-center justify-center mx-auto text-2xl font-serif">
            !
          </div>
          <div>
            <h2 className="text-xl font-medium text-[#183f2a]">Application temporarily unavailable</h2>
            <p className="text-xs text-[#57534e] mt-2 leading-relaxed">
              An unexpected system interruption occurred. Please reload to resume your reservation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => reset()}
            className="w-full rounded-lg bg-[#183f2a] py-2.5 px-4 text-xs font-medium text-white hover:bg-[#24563b] transition-colors cursor-pointer"
          >
            Reload page
          </button>
        </div>
      </body>
    </html>
  );
}
