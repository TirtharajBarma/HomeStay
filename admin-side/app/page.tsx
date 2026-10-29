"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/auth-context";
import { API_ENDPOINTS, apiFetch, readApiError } from "@/lib/api-config";
import {
  AppealsTab, AuditTab, inr, CabRequestsTab, DashboardTab, DriversTab, HomestaysTab, PayoutsTab, SettingsTab, UsersTab,
} from "@/components/stayride-admin";

// The old Hill Hospitality portal: its data is not used by the StayRide app, so its "Suspend" and
// "Settle UPI" do nothing there. Hidden unless NEXT_PUBLIC_SHOW_LEGACY_PORTAL=true.
const SHOW_LEGACY = process.env.NEXT_PUBLIC_SHOW_LEGACY_PORTAL === "true";
type Tab = "dashboard" | "users" | "homestays" | "drivers" | "cab-requests" | "payouts" | "settings" | "appeals" | "audit" | "legacy";
const TABS: Array<[Tab, string, string]> = [
  ["dashboard", "monitoring", "Overview"],
  ["users", "group", "Users"],
  ["homestays", "villa", "Homestays"],
  ["drivers", "badge", "Drivers"],
  ["cab-requests", "local_taxi", "Cab requests"],
  ["payouts", "account_balance_wallet", "Payouts"],
  ["settings", "tune", "Platform settings"],
  ["appeals", "verified_user", "Appeals"],
  ["audit", "history", "Audit log"],
  ["legacy", "inventory_2", "Legacy portal"],
].filter(([key]) => key !== "legacy" || SHOW_LEGACY) as Array<[Tab, string, string]>;

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
  const [overviewError, setOverviewError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set(["dashboard"]));
  // Default is real production data; the demo dataset is opt-in.
  const [demo, setDemo] = useState(false);
  // Homestay key handed from the Homestays data viewer to the Cab requests desk.
  const [cabTenant, setCabTenant] = useState("");

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => new Set([...prev, tab]));
    if (tab === "cab-requests") setCabTenant("");
  };

  const handleDemoToggle = (isDemo: boolean) => {
    setDemo(isDemo);
    setVisitedTabs(new Set([activeTab]));
  };

  // Payout settlement modal state
  const [settlingTrip, setSettlingTrip] = useState<any | null>(null);
  const [upiRef, setUpiRef] = useState("");
  const [settleLoading, setSettleLoading] = useState(false);

  async function fetchOverview() {
    if (!token) return;
    try {
      setLoading(true);
      setOverviewError("");
      const res = await apiFetch(API_ENDPOINTS.overview());
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setOverviewError("Could not load admin overview.");
        }
      } else {
        setOverviewError(await readApiError(res, "Could not load admin overview."));
      }
    } catch (e: any) {
      setOverviewError(e.message || "Could not load admin overview.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "legacy") fetchOverview();
  }, [token, activeTab]);

  // Settle payout handler
  async function handleSettlePayout(e: React.FormEvent) {
    e.preventDefault();
    if (!settlingTrip || !token) return;
    if (!upiRef.trim()) {
      alert("A settlement reference is required.");
      return;
    }
    setSettleLoading(true);
    try {
      const res = await apiFetch(API_ENDPOINTS.settlePayout(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      } else {
        alert(await readApiError(res, "Failed to settle payout."));
      }
    } catch (e: any) {
      alert(e.message || "Failed to settle payout.");
    } finally {
      setSettleLoading(false);
    }
  }

  // Update property status
  async function handlePropertyStatus(id: string, newStatus: string, name?: string) {
    if (!token) return;
    if (newStatus === "suspended" && !window.confirm(`Suspend ${name || "this property"}? It will stop accepting new bookings.`)) return;
    try {
      const res = await apiFetch(API_ENDPOINTS.propertyStatus(id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchOverview();
      } else {
        alert(await readApiError(res, "Failed to update property status."));
      }
    } catch (e: any) {
      alert(e.message || "Failed to update property status.");
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
                Logged in as {admin?.email || "—"}{" "}
                {demo && activeTab !== "legacy" && (
                  <span className="ml-1 rounded-full border border-amber-600/50 bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-300">DEMO DATASET</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeTab !== "legacy" && (
              <label className="flex items-center gap-2 rounded-xl border border-amber-600/40 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-300 cursor-pointer hover:bg-amber-900/30 transition">
                <input
                  type="checkbox"
                  className="rounded border-amber-500 accent-amber-500 cursor-pointer"
                  checked={demo}
                  onChange={(e) => handleDemoToggle(e.target.checked)}
                />
                <span>Demo dataset</span>
              </label>
            )}
            {activeTab === "legacy" && <button
              onClick={fetchOverview}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>Refresh Legacy</span>
            </button>}
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
        {activeTab === "legacy" && overviewError && (
          <div className="rounded-xl border border-red-800/40 bg-red-950/40 px-4 py-3 text-xs font-semibold text-red-300">
            {overviewError}
          </div>
        )}

        {/* 3. DESK TABS SWITCHER */}
        <div className="flex items-center border-b border-slate-800 overflow-x-auto no-scrollbar">
          {TABS.map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
                activeTab === key
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {activeTab === "dashboard" && <DashboardTab demo={demo} />}
        {activeTab === "users" && <UsersTab demo={demo} />}
        {activeTab === "homestays" && (
          <HomestaysTab
            demo={demo}
            onOpenCabRequests={(tenantKey) => {
              setCabTenant(tenantKey);
              handleTabChange("cab-requests");
            }}
          />
        )}
        {activeTab === "drivers" && <DriversTab demo={demo} />}
        {activeTab === "cab-requests" && <CabRequestsTab key={cabTenant} demo={demo} initialTenantKey={cabTenant || undefined} />}
        {activeTab === "payouts" && <PayoutsTab demo={demo} />}
        {activeTab === "settings" && <SettingsTab demo={demo} />}
        {activeTab === "appeals" && <AppealsTab demo={demo} />}
        {activeTab === "audit" && <AuditTab demo={demo} />}

        {activeTab === "legacy" && (
          <>
        {/* LEGACY PORTAL KPIS */}
        {/* 2. GLOBAL PLATFORM KPIS */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Gross Volume
            </span>
            <p className="mt-1 font-mono text-xl font-black text-white">
              {inr(k?.totalGrossRevenue)}
            </p>
            <span className="text-[10px] text-slate-500">Total room &amp; cab spend</span>
          </div>

          <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/30 p-4 shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Platform Cut
            </span>
            <p className="mt-1 font-mono text-xl font-black text-emerald-300">
              {inr(k?.totalPlatformCommission)}
            </p>
            <span className="text-[10px] text-emerald-500">Net revenue earned</span>
          </div>

          <div className="rounded-2xl border border-amber-900/40 bg-amber-950/30 p-4 shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Pending Payouts
            </span>
            <p className="mt-1 font-mono text-xl font-black text-amber-300">
              {inr(k?.pendingPayouts)}
            </p>
            <span className="text-[10px] text-amber-500">Awaiting UPI settlement</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Registered Stays
            </span>
            <p className="mt-1 font-mono text-xl font-black text-white">
              {k?.totalProperties ?? "—"}
            </p>
            <span className="text-[10px] text-slate-500">Homestays in network</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Fleet Drivers
            </span>
            <p className="mt-1 font-mono text-xl font-black text-white">
              {k?.totalDrivers ?? "—"}
            </p>
            <span className="text-[10px] text-slate-500">Active hill partners</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Trips
            </span>
            <p className="mt-1 font-mono text-xl font-black text-white">
              {k?.totalTrips ?? "—"}
            </p>
            <span className="text-[10px] text-slate-500">Dispatched transfers</span>
          </div>
        </section>
        {/* 4. TAB 1: DRIVER PAYOUT SETTLEMENT DESK */}
        {(
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  Hill Cab Transfers &amp; Driver Settlement Ledger
                </h2>
                <p className="text-xs text-slate-400">
                  Drivers collect cash or UPI from passengers directly. Super admin reconciles driver take-home vs platform fee.
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
                    <th className="p-3">Platform Cut</th>
                    <th className="p-3">Driver Payout</th>
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
                          {inr(trip.fare)}
                        </td>
                        <td className="p-3 font-mono text-emerald-400 font-semibold">
                          {inr(trip.commission)}
                        </td>
                        <td className="p-3 font-mono text-blue-300 font-bold">
                          {inr(trip.payout)}
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
        {(
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
                        <td className="p-3 text-slate-400">{prop.town || "—"}</td>
                        <td className="p-3 font-mono text-slate-300">{prop.roomsCount} units</td>
                        <td className="p-3 font-mono text-emerald-400">
                          {typeof prop.commissionRate === "number" ? `${Math.round(prop.commissionRate * 100)}%` : "—"}
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
                              onClick={() => handlePropertyStatus(prop.id, "active", prop.name)}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500"
                            >
                              Approve
                            </button>
                          )}
                          {prop.status === "active" && (
                            <button
                              onClick={() => handlePropertyStatus(prop.id, "suspended", prop.name)}
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
          </>
        )}
      </main>

      {/* 9. UPI SETTLEMENT MODAL */}
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
                <span>Driver Payout:</span>
                <span className="font-mono font-bold text-blue-300">
                  {inr(settlingTrip.payout)}
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
