"use client";

import { useState } from "react";
import { useDriverAuth } from "@/components/auth-context";
import { API_ENDPOINTS } from "@/lib/api-config";

export default function DriverLoginPage() {
  const { login } = useDriverAuth();

  const [phone, setPhone] = useState("+91 98300 41042");
  const [pin, setPin] = useState("1234");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.driverLogin(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid phone number or 4-digit driver PIN.");
      }

      login(data.data.token, data.data.driver);
    } catch (err: any) {
      setError(err.message || "Could not sign in. Check driver credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl">
        {/* Terminal Header */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1e3a2b] text-white shadow-md">
            <span className="material-symbols-outlined text-3xl">local_taxi</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#1e3a2b]">
            Driver Terminal
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            Hill Transit Dispatch &amp; Passenger Transfers
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700">
              Driver Mobile Number
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98320 11001"
              className="mt-1 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-base font-medium text-neutral-900 shadow-inner focus:border-[#1e3a2b] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a2b]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700">
              4-Digit Terminal PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="mt-1 w-full text-center tracking-[0.5em] rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-xl font-bold font-mono text-neutral-900 shadow-inner focus:border-[#1e3a2b] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a2b]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1e3a2b] py-3.5 text-base font-bold text-white shadow-lg shadow-[#1e3a2b]/20 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-xl">
                  sync
                </span>
                <span>Connecting Terminal...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">login</span>
                <span>Access Terminal</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-neutral-100 pt-4 text-center">
          <p className="text-[11px] text-neutral-400">
            Registered fleet drivers only. For route assignment or PIN reset, contact your estate host.
          </p>
        </div>
      </div>
    </div>
  );
}
