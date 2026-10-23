"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("StayRide Global Unhandled Error:", error);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://home-stay-ten.vercel.app/api/v1";
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
      <body className="min-h-screen bg-[#F6F8FA] flex items-center justify-center p-6 font-sans text-[#1F2328]">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#D0D7DE] p-6 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1F2328]">Application Error</h2>
            <p className="text-xs text-[#57606A] mt-1">
              StayRide encountered an unexpected issue. Please reload the app.
            </p>
          </div>
          <button
            onClick={() => reset()}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      </body>
    </html>
  );
}
