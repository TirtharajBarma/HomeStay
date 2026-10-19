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
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-800 bg-slate-950 p-8 shadow-2xl text-slate-100">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
            Control Tower Admin
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Restricted founder gateway for network operations &amp; driver payouts.
          </p>
        </div>

        {expiredNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/40 p-3 text-xs text-amber-400">
            <span className="material-symbols-outlined text-base">schedule</span>
            <span>{expiredNotice}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-400">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Admin Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@platform.com"
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Master Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">lock_open</span>
                <span>Access Control Tower</span>
              </>
            )}
          </button>
        </form>

        <div className="border-t border-slate-800/80 pt-4 text-center text-[11px] text-slate-500">
          Zero-tolerance security zone. All administrative sessions are cryptographically logged.
        </div>
      </div>
    </div>
  );
}
