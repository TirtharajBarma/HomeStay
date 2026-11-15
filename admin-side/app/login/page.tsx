"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/auth-context";
import { API_ENDPOINTS, apiFetch, SESSION_EXPIRED_KEY } from "@/lib/api-config";

export default function AdminLoginPage() {
  const { login } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiredNotice, setExpiredNotice] = useState<string | null>(null);

  useEffect(() => {
    const reason = window.sessionStorage.getItem(SESSION_EXPIRED_KEY);
    if (reason) {
      window.sessionStorage.removeItem(SESSION_EXPIRED_KEY);
      setExpiredNotice(reason === "1" ? "Session expired. Please sign in again." : reason);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let res: Response;
    try {
      res = await apiFetch(API_ENDPOINTS.login(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        skipAuthRedirect: true,
      });
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.status === 429 || res.status >= 500) {
      setError(`Sign-in is temporarily unavailable (${res.status}). Please try again.`);
      return;
    }
    // Generic message for every credential/role failure: never reveal whether the account exists.
    if (!res.ok || !data?.success || !data.data?.token || data.data?.user?.role !== "admin") {
      setError("Invalid email or password.");
      return;
    }
    login(data.data.token, data.data.user);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F14] px-4 py-12">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-800/80 bg-[#121820] p-7 shadow-sm text-slate-100">
        <div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#2EA043]/30 bg-[#2EA043]/10 text-[#3FB950]">
            <span className="material-symbols-outlined text-xl">terrain</span>
          </div>
          <h1 className="mt-4 text-lg font-semibold tracking-tight text-white">
            StayRide Operations
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Sign in to manage homestays, driver dispatch, and settlements.
          </p>
        </div>

        {expiredNotice && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
            <span className="material-symbols-outlined text-base">schedule</span>
            <span>{expiredNotice}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300">
              Admin email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@platform.com"
              className="mt-1.5 w-full rounded-lg border border-slate-800 bg-[#0D1117] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="mt-1.5 w-full rounded-lg border border-slate-800 bg-[#0D1117] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E7E4B] hover:bg-[#259A5C] py-2.5 text-xs font-semibold text-white transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-base">sync</span>
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>

        <div className="border-t border-slate-800/80 pt-4 text-center text-[11px] text-slate-500">
          StayRide Platform · North Bengal &amp; Sikkim Operations
        </div>
      </div>
    </div>
  );
}
