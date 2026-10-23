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
    console.error("StayRide Admin Tower Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Admin Tower System Alert</h2>
          <p className="text-xs text-slate-400 mt-1">
            {error?.message || "An unexpected error occurred while loading this administrative view."}
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors cursor-pointer"
        >
          Reload Dashboard View
        </button>
      </div>
    </div>
  );
}
