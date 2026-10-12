"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { API_ENDPOINTS } from "@/lib/api-config";
import { Icon } from "@/components/icon";

type LoginTab = "password" | "google" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [activeTab, setActiveTab] = useState<LoginTab>("password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Email / Password Form State
  const [email, setEmail] = useState("owner@estate.com");
  const [password, setPassword] = useState("estatePassword123!");

  // OTP Form State
  const [phone, setPhone] = useState("+91 98300 41000");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // 1. Email & Password Handler
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.auth.login(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid email or password credentials.");
      }

      login(data.data.token, data.data.user);
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  // 2. Google OAuth Handler
  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);

    try {
      // In production with Google Client ID: window.google.accounts.id.prompt() or @react-oauth/google
      // Our backend accepts { googleToken, email, name }
      const res = await fetch(API_ENDPOINTS.auth.google(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleToken: "demo_google_oauth_token",
          email: "owner@estate.com",
          name: "Demo Estate Owner",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Google authentication failed.");
      }

      login(data.data.token, data.data.user);
    } catch (err: any) {
      setError(err.message || "Could not complete Google Sign-In.");
    } finally {
      setLoading(false);
    }
  }

  // 3. Send OTP Handler
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.auth.sendOtp(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send verification OTP.");
      }

      setOtpSent(true);
      setSuccessMsg(`Verification OTP sent to ${phone}. (Dev test code: 123456)`);
    } catch (err: any) {
      setError(err.message || "Could not dispatch verification SMS.");
    } finally {
      setLoading(false);
    }
  }

  // 4. Verify OTP Handler
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.auth.verifyOtp(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid or expired OTP code.");
      }

      login(data.data.token, data.data.user);
    } catch (err: any) {
      setError(err.message || "Verification code check failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-8 shadow-xl">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-md">
            <Icon name="cottage" className="text-3xl" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-bold tracking-tight text-primary">
            Homestay Host Portal
          </h1>
          <p className="mt-2 text-sm text-outline">
            Estate operations, room bookings, fleet transit & analytics.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-container p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setActiveTab("password");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
              activeTab === "password"
                ? "bg-surface text-primary shadow-sm font-semibold"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <Icon name="key" className="text-[16px]" />
            <span>Password</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("google");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
              activeTab === "google"
                ? "bg-surface text-primary shadow-sm font-semibold"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <Icon name="verified_user" className="text-[16px]" />
            <span>Google</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("otp");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
              activeTab === "otp"
                ? "bg-surface text-primary shadow-sm font-semibold"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <Icon name="sms" className="text-[16px]" />
            <span>Phone OTP</span>
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3 text-xs text-error">
            <Icon name="error" className="text-base flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-primary">
            <Icon name="check_circle" className="text-base flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: Email & Password Form */}
        {activeTab === "password" && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-on-surface">
                Host Email Address
              </label>
              <div className="relative mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@estate.com"
                  className="w-full rounded-xl border border-outline-variant/50 bg-surface px-3.5 py-2.5 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-on-surface">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-outline-variant/50 bg-surface px-3.5 py-2.5 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-on-primary shadow transition hover:opacity-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Icon name="sync" className="animate-spin text-lg" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <Icon name="login" className="text-lg" />
                  <span>Sign In with Password</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Tab 2: Google Sign In */}
        {activeTab === "google" && (
          <div className="space-y-4 text-center">
            <p className="text-xs text-outline">
              Sign in securely using your registered Google Workspace or Gmail account.
            </p>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-outline-variant/60 bg-surface py-3 text-sm font-semibold text-on-surface shadow-sm transition hover:bg-surface-container hover:shadow disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27a7.22 7.22 0 0 1 0-4.54V6.58H1.25a11.96 11.96 0 0 0 0 10.84l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{loading ? "Authenticating..." : "Continue with Google"}</span>
            </button>
          </div>
        )}

        {/* Tab 3: Phone + OTP Form */}
        {activeTab === "otp" && (
          <div className="space-y-4">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface">
                    Registered Mobile Number
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98300 41000"
                      className="w-full rounded-xl border border-outline-variant/50 bg-surface px-3.5 py-2.5 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-on-primary shadow transition hover:opacity-95 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Icon name="sync" className="animate-spin text-lg" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="send" className="text-lg" />
                      <span>Request 6-Digit OTP</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-on-surface">
                      Enter 6-Digit Verification Code
                    </label>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-xs text-primary hover:underline"
                    >
                      Change phone
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="123456"
                      className="w-full tracking-widest text-center font-mono text-lg rounded-xl border border-outline-variant/50 bg-surface px-3.5 py-2.5 text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-on-primary shadow transition hover:opacity-95 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Icon name="sync" className="animate-spin text-lg" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="check" className="text-lg" />
                      <span>Verify OTP &amp; Sign In</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer Navigation */}
        <div className="pt-2 text-center text-xs text-outline">
          New homestay owner?{" "}
          <Link
            href="/register"
            className="font-semibold text-primary hover:underline"
          >
            Register your estate free →
          </Link>
        </div>
      </div>
    </div>
  );
}
