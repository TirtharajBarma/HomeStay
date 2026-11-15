"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin Tower Error:", error);
    try {
      fetch("/api/v1/telemetry/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error?.message || "Admin Tower UI Error",
          screen: "AdminTower",
          platform: "web-admin",
          stack: error?.stack,
          extra: { digest: error?.digest },
        }),
      }).catch(() => {});
    } catch {
      // Ignored
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full bg-[#121820] rounded-xl border border-slate-800/80 p-6 shadow-xl text-center space-y-4">
        <div className="w-10 h-10 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center justify-center mx-auto text-base font-semibold">
          !
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">System alert</h2>
          <p className="text-xs text-slate-400 mt-1">
            {error?.message || "An unexpected error occurred while loading this view."}
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="w-full rounded-lg bg-[#1E7E4B] py-2 text-xs font-medium text-white hover:bg-[#259A5C] transition-colors cursor-pointer"
        >
          Reload view
        </button>
      </div>
    </div>
  );
}
