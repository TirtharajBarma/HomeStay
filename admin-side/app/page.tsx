"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/auth-context";
import { API_ENDPOINTS } from "@/lib/api-config";

type OverviewData = {
  kpis: {
    totalProperties: number;
    totalDrivers: number;
    totalTrips: number;
    totalGrossRevenue: number;
    totalPlatformCommission: number;
    pendingPayouts: number;
  };
  properties: Array<{
    id: string;
    name: string;
    ownerName: string;
    email: string;
    phone: string;
    address: string;
    town: string;
    status: string;
    commissionRate: number;
    roomsCount: number;
  }>;
  recentTrips: Array<{
    id: string;
    reference: string;
    driverName: string;
    passengerName: string;
    pickup: string;
    dropoff: string;
    fare: number;
    commission: number;
    payout: number;
    payoutStatus: "pending" | "settled";
    settlementReference?: string;
    createdAt: string;
  }>;
};

export default function AdminDashboardPage() {
  const { admin, token, logout } = useAdminAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"payouts" | "properties">("payouts");

  // Payout settlement modal state
  const [settlingTrip, setSettlingTrip] = useState<any | null>(null);
  const [upiRef, setUpiRef] = useState("");
  const [settleLoading, setSettleLoading] = useState(false);

  async function fetchOverview() {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(API_ENDPOINTS.overview(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      }
    } catch (e) {
      console.warn("Could not load admin overview:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOverview();
  }, [token]);

  // Settle payout handler
  async function handleSettlePayout(e: React.FormEvent) {
    e.preventDefault();
    if (!settlingTrip || !upiRef.trim() || !token) return;
    setSettleLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.settlePayout(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tripId: settlingTrip.id,
          settlementReference: upiRef.trim(),
        }),
      });

      if (res.ok) {
        setSettlingTrip(null);
        setUpiRef("");
        fetchOverview();
      }
    } catch (e) {
      console.error("Payout settlement error:", e);
    } finally {
      setSettleLoading(false);
    }
  }

  // Update property status
  async function handlePropertyStatus(id: string, newStatus: string) {
    if (!token) return;
    try {
      const res = await fetch(API_ENDPOINTS.propertyStatus(id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchOverview();
      }
    } catch (e) {
      console.error("Property status update error:", e);
    }
  }

  const k = data?.kpis;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30">
              <span className="material-symbols-outlined text-2xl">shield</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                Super Admin Control Tower
              </h1>
              <p className="text-xs text-slate-400">
                Logged in as {admin?.email || "admin@platform.com"} (Founder)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchOverview}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>Refresh Live</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-900/40"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span>Exit Tower</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6 space-y-6">
        {/* 2. GLOBAL PLATFORM KPIS */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Gross Volume
            </span>
            <p className="mt-1 font-mono text-xl font-black text-white">
              ₹{(k?.totalGrossRevenue || 0).toLocaleString()}
            </p>
            <span className="text-[10px] text-slate-500">Total room &amp; cab spend</span>
          </div>

          <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/30 p-4 shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Platform Cut (18%)
            </span>
            <p className="mt-1 font-mono text-xl font-black text-emerald-300">
              ₹{(k?.totalPlatformCommission || 0).toLocaleString()}
            </p>
            <span className="text-[10px] text-emerald-500">Net revenue earned</span>
          </div>

          <div className="rounded-2xl border border-amber-900/40 bg-amber-950/30 p-4 shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Pending Payouts
            </span>
            <p className="mt-1 font-mono text-xl font-black text-amber-300">
              ₹{(k?.pendingPayouts || 0).toLocaleString()}
            </p>
            <span className="text-[10px] text-amber-500">Awaiting UPI settlement</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Registered Stays
            </span>
            <p className="mt-1 font-mono text-xl font-black text-white">
              {k?.totalProperties || 0}
            </p>
            <span className="text-[10px] text-slate-500">Homestays in network</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Fleet Drivers
            </span>
            <p className="mt-1 font-mono text-xl font-black text-white">
              {k?.totalDrivers || 0}
            </p>
            <span className="text-[10px] text-slate-500">Active hill partners</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Trips
            </span>
            <p className="mt-1 font-mono text-xl font-black text-white">
              {k?.totalTrips || 0}
            </p>
            <span className="text-[10px] text-slate-500">Dispatched transfers</span>
          </div>
        </section>

        {/* 3. DESK TABS SWITCHER */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab("payouts")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
              activeTab === "payouts"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-lg">payments</span>
            <span>Driver Payouts Settlement Desk</span>
          </button>

          <button
            onClick={() => setActiveTab("properties")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
              activeTab === "properties"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-lg">villa</span>
            <span>Homestay Property Verification Desk</span>
          </button>
        </div>

        {/* 4. TAB 1: DRIVER PAYOUT SETTLEMENT DESK */}
        {activeTab === "payouts" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  Hill Cab Transfers &amp; Driver Settlement Ledger
                </h2>
                <p className="text-xs text-slate-400">
                  Drivers collect cash or UPI from passengers directly. Super admin reconciles the 82% take-home vs 18% platform fee.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Ref</th>
                    <th className="p-3">Driver</th>
                    <th className="p-3">Passenger</th>
                    <th className="p-3">Route</th>
                    <th className="p-3">Total Fare</th>
                    <th className="p-3">Platform Cut (18%)</th>
                    <th className="p-3">Driver Payout (82%)</th>
                    <th className="p-3">Settlement</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data?.recentTrips?.length ? (
                    data.recentTrips.map((trip) => (
                      <tr key={trip.id} className="hover:bg-slate-900/40">
                        <td className="p-3 font-mono font-bold text-slate-300">
                          #{trip.reference}
                        </td>
                        <td className="p-3 font-medium text-white">{trip.driverName}</td>
                        <td className="p-3 text-slate-300">{trip.passengerName}</td>
                        <td className="p-3 text-slate-400 max-w-xs truncate">
                          {trip.pickup} ➔ {trip.dropoff}
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-200">
                          ₹{trip.fare?.toLocaleString()}
                        </td>
                        <td className="p-3 font-mono text-emerald-400 font-semibold">
                          ₹{trip.commission?.toLocaleString()}
                        </td>
                        <td className="p-3 font-mono text-blue-300 font-bold">
                          ₹{trip.payout?.toLocaleString()}
                        </td>
                        <td className="p-3">
                          {trip.payoutStatus === "settled" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/40">
                              <span className="material-symbols-outlined text-xs">check</span>
                              {trip.settlementReference || "Settled"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-800/40">
                              <span className="material-symbols-outlined text-xs">schedule</span>
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {trip.payoutStatus === "pending" ? (
                            <button
                              onClick={() => setSettlingTrip(trip)}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white shadow hover:bg-blue-500"
                            >
                              Settle UPI
                            </button>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Reconciled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        No recent cab trips dispatched yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 5. TAB 2: HOMESTAY PROPERTY VERIFICATION DESK */}
        {activeTab === "properties" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow">
            <div className="mb-4">
              <h2 className="text-base font-bold text-white">
                Network Properties &amp; Host Moderation
              </h2>
              <p className="text-xs text-slate-400">
                Homestays listed on the platform. Approve new applications or suspend inactive properties.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Property Name</th>
                    <th className="p-3">Host / Owner</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Rooms</th>
                    <th className="p-3">Platform Rate</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data?.properties?.length ? (
                    data.properties.map((prop) => (
                      <tr key={prop.id} className="hover:bg-slate-900/40">
                        <td className="p-3 font-semibold text-white">{prop.name}</td>
                        <td className="p-3">
                          <p className="font-medium text-slate-200">{prop.ownerName}</p>
                          <p className="text-slate-500">{prop.email} • {prop.phone}</p>
                        </td>
                        <td className="p-3 text-slate-400">{prop.town || "Darjeeling"}</td>
                        <td className="p-3 font-mono text-slate-300">{prop.roomsCount} units</td>
                        <td className="p-3 font-mono text-emerald-400">
                          {Math.round((prop.commissionRate || 0.18) * 100)}%
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              prop.status === "active"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                                : prop.status === "suspended"
                                  ? "bg-red-950 text-red-400 border border-red-800/40"
                                  : "bg-amber-950 text-amber-400 border border-amber-800/40"
                            }`}
                          >
                            {prop.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {prop.status !== "active" && (
                            <button
                              onClick={() => handlePropertyStatus(prop.id, "active")}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500"
                            >
                              Approve
                            </button>
                          )}
                          {prop.status === "active" && (
                            <button
                              onClick={() => handlePropertyStatus(prop.id, "suspended")}
                              className="rounded-lg border border-red-500/40 bg-red-950/40 px-2.5 py-1 text-[11px] font-bold text-red-400 hover:bg-red-900/60"
                            >
                              Suspend
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No properties found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* 6. UPI SETTLEMENT MODAL */}
      {settlingTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              Settle Driver Payout via UPI
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Trip #{settlingTrip.reference} • Driver: {settlingTrip.driverName}
            </p>

            <div className="my-4 rounded-xl border border-blue-900/40 bg-blue-950/30 p-3 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Driver Payout (82%):</span>
                <span className="font-mono font-bold text-blue-300">
                  ₹{settlingTrip.payout?.toLocaleString()}
                </span>
              </div>
            </div>

            <form onSubmit={handleSettlePayout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Bank / UPI Transaction Reference ID *
                </label>
                <input
                  type="text"
                  required
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  placeholder="e.g. UPI-202610-849204"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white shadow-inner focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSettlingTrip(null)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleLoading || !upiRef.trim()}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-500 disabled:opacity-50"
                >
                  {settleLoading ? "Recording..." : "Confirm Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
