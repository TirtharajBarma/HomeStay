"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { API_ENDPOINTS } from "@/lib/api-config";
import { Icon } from "@/components/icon";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [homestayName, setHomestayName] = useState("");
  const [address, setAddress] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.auth.register(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          role: "owner",
          homestayName: homestayName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create host account.");
      }

      // If homestay address was provided, update property profile in background
      const token = data.data.token;
      if (address && token) {
        fetch(API_ENDPOINTS.properties.profile(), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ address, name: homestayName }),
        }).catch((e) => console.warn("Property profile update notice:", e));
      }

      login(token, data.data.user);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please check details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-8 shadow-xl">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-md">
            <Icon name="add_business" className="text-3xl" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-bold tracking-tight text-primary">
            Register Homestay
          </h1>
          <p className="mt-1 text-sm text-outline">
            Free Property Management &amp; Hill Cab Transit Dispatch
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3 text-xs text-error">
            <Icon name="error" className="text-base flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-on-surface">
              Host / Owner Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pema Dorjee"
              className="mt-1 w-full rounded-xl border border-outline-variant/50 bg-surface px-3.5 py-2 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface">
              Homestay or Estate Name *
            </label>
            <input
              type="text"
              required
              value={homestayName}
              onChange={(e) => setHomestayName(e.target.value)}
              placeholder="e.g. Misty Pine Retreat"
              className="mt-1 w-full rounded-xl border border-outline-variant/50 bg-surface px-3.5 py-2 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-on-surface">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="host@retreat.com"
                className="mt-1 w-full rounded-xl border border-outline-variant/50 bg-surface px-3.5 py-2 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-on-surface">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98320 00000"
                className="mt-1 w-full rounded-xl border border-outline-variant/50 bg-surface px-3.5 py-2 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface">
              Password (min. 8 characters) *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="mt-1 w-full rounded-xl border border-outline-variant/50 bg-surface px-3.5 py-2 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface">
              Homestay Location / Street Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Upper Lebong Road, Darjeeling, West Bengal 734101"
              className="mt-1 w-full rounded-xl border border-outline-variant/50 bg-surface px-3.5 py-2 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-on-primary shadow transition hover:opacity-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Icon name="sync" className="animate-spin text-lg" />
                <span>Creating Host Account...</span>
              </>
            ) : (
              <>
                <Icon name="check_circle" className="text-lg" />
                <span>Create Free Host Account</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-outline">
          Already registered?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary hover:underline"
          >
            Sign in to your portal →
          </Link>
        </div>
      </div>
    </div>
  );
}
