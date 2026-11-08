"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/auth-context";
import { API_ENDPOINTS, apiFetch, readApiError } from "@/lib/api-config";
import {
  AppealsTab, AuditTab, inr, CabRequestsTab, DashboardTab, DriversTab, GuestsTab, HomestaysTab, NotificationBell, PayoutsTab, SettingsTab, UsersTab,
} from "@/components/stayride-admin";

// The old Hill Hospitality portal: its data is not used by the StayRide app, so its "Suspend" and
// "Settle UPI" do nothing there. Hidden unless NEXT_PUBLIC_SHOW_LEGACY_PORTAL=true.
const SHOW_LEGACY = process.env.NEXT_PUBLIC_SHOW_LEGACY_PORTAL === "true";
type Tab = "dashboard" | "users" | "homestays" | "guests" | "drivers" | "cab-requests" | "payouts" | "settings" | "appeals" | "audit" | "legacy";
const TABS: Array<[Tab, string, string]> = [
  ["dashboard", "monitoring", "Overview"],
  ["users", "group", "Users"],
  ["homestays", "villa", "Homestays"],
  ["guests", "hotel", "Guests staying"],
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
  // Filter handed from the notification bell ("claims" for a guest-says-paid item).
  const [cabFilter, setCabFilter] = useState("");
  // Guest name handed from the notification bell to the Guests staying desk.
  const [guestSearch, setGuestSearch] = useState("");
  // ...and the homestay, for a calendar import or a guest's WhatsApp reply
  const [guestTenant, setGuestTenant] = useState("");

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => new Set([...prev, tab]));
    if (tab === "cab-requests") {
      setCabTenant("");
      setCabFilter("");
    }
    if (tab === "guests") {
      setGuestSearch("");
      setGuestTenant("");
    }
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
    <div className="min-h-screen bg-[#0B0F14] text-[#E6EDF3]">
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#0B0F14]/90 px-6 py-3.5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2EA043]/30 bg-[#2EA043]/10 text-[#3FB950]">
              <span className="material-symbols-outlined text-xl">terrain</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white leading-tight">
                StayRide Operations
              </h1>
              <p className="text-xs text-slate-400">
                {admin?.email || "—"}{" "}
                {demo && activeTab !== "legacy" && (
                  <span className="ml-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                    Demo data
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab !== "legacy" && (
              <label className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-300 cursor-pointer hover:bg-amber-500/10 transition">
                <input
                  type="checkbox"
                  className="rounded border-amber-500/40 accent-[#2EA043] cursor-pointer"
                  checked={demo}
                  onChange={(e) => handleDemoToggle(e.target.checked)}
                />
                <span>Demo data</span>
              </label>
            )}
            {activeTab !== "legacy" && (
              <NotificationBell
                key={String(demo)}
                demo={demo}
                onOpen={(n) => {
                  // tab change first: it clears the hand-off values
                  if (n.kind === "cab" || n.kind === "claim") {
                    handleTabChange("cab-requests");
                    setCabTenant(n.tenantKey || "");
                    if (n.kind === "claim") setCabFilter("claims");
                  } else {
                    handleTabChange("guests");
                    setGuestSearch(n.guestName || "");
                    if (n.kind === "import" || n.kind === "reply") setGuestTenant(n.tenantKey || "");
                  }
                }}
              />
            )}
            {activeTab === "legacy" && (
              <button
                onClick={fetchOverview}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Refresh legacy</span>
              </button>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 transition"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6 space-y-6">
        {activeTab === "legacy" && overviewError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {overviewError}
          </div>
        )}

        {/* 3. DESK TABS SWITCHER */}
        <div className="flex items-center border-b border-slate-800 overflow-x-auto no-scrollbar">
          {TABS.map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium transition whitespace-nowrap ${
                activeTab === key
                  ? "border-[#2EA043] text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-base">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className={activeTab === "dashboard" ? "block" : "hidden"}>
          {visitedTabs.has("dashboard") && <DashboardTab demo={demo} />}
        </div>
        <div className={activeTab === "users" ? "block" : "hidden"}>
          {visitedTabs.has("users") && <UsersTab demo={demo} />}
        </div>
        <div className={activeTab === "homestays" ? "block" : "hidden"}>
          {visitedTabs.has("homestays") && (
            <HomestaysTab
              demo={demo}
              onOpenCabRequests={(tenantKey) => {
                handleTabChange("cab-requests"); // first: it clears the filter
                setCabTenant(tenantKey);
              }}
            />
          )}
        </div>
        <div className={activeTab === "guests" ? "block" : "hidden"}>
          {visitedTabs.has("guests") && (
            <GuestsTab
              key={`${guestTenant}|${guestSearch}`}
              demo={demo}
              initialSearch={guestSearch || undefined}
              initialTenant={guestTenant || undefined}
            />
          )}
        </div>
        <div className={activeTab === "drivers" ? "block" : "hidden"}>
          {visitedTabs.has("drivers") && <DriversTab demo={demo} />}
        </div>
        <div className={activeTab === "cab-requests" ? "block" : "hidden"}>
          {visitedTabs.has("cab-requests") && (
            <CabRequestsTab
              key={`${cabTenant}|${cabFilter}`}
              demo={demo}
              initialTenantKey={cabTenant || undefined}
              initialFilter={cabFilter || undefined}
            />
          )}
        </div>
        <div className={activeTab === "payouts" ? "block" : "hidden"}>
          {visitedTabs.has("payouts") && <PayoutsTab demo={demo} />}
        </div>
        <div className={activeTab === "settings" ? "block" : "hidden"}>
          {visitedTabs.has("settings") && <SettingsTab demo={demo} />}
        </div>
        <div className={activeTab === "appeals" ? "block" : "hidden"}>
          {visitedTabs.has("appeals") && <AppealsTab demo={demo} />}
        </div>
        <div className={activeTab === "audit" ? "block" : "hidden"}>
          {visitedTabs.has("audit") && <AuditTab demo={demo} />}
        </div>

        {activeTab === "legacy" && (
          <>
        {/* LEGACY PORTAL KPIS */}
        {/* 2. GLOBAL PLATFORM KPIS */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-800/80 bg-[#121820] p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-400">
              Gross volume
            </span>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
              {inr(k?.totalGrossRevenue)}
            </p>
            <span className="text-[11px] text-slate-500">Total room &amp; cab spend</span>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-xs">
            <span className="text-xs font-medium text-emerald-400">
              Platform cut
            </span>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-emerald-300">
              {inr(k?.totalPlatformCommission)}
            </p>
            <span className="text-[11px] text-emerald-500/80">Net revenue earned</span>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-xs">
            <span className="text-xs font-medium text-amber-400">
              Pending payouts
            </span>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-amber-300">
              {inr(k?.pendingPayouts)}
            </p>
            <span className="text-[11px] text-amber-500/80">Awaiting UPI settlement</span>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#121820] p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-400">
              Registered stays
            </span>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
              {k?.totalProperties ?? "—"}
            </p>
            <span className="text-[11px] text-slate-500">Homestays in network</span>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#121820] p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-400">
              Fleet drivers
            </span>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
              {k?.totalDrivers ?? "—"}
            </p>
            <span className="text-[11px] text-slate-500">Active hill partners</span>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#121820] p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-400">
              Total trips
            </span>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
              {k?.totalTrips ?? "—"}
            </p>
            <span className="text-[11px] text-slate-500">Dispatched transfers</span>
          </div>
        </section>
        {/* 4. TAB 1: DRIVER PAYOUT SETTLEMENT DESK */}
        {(
          <section className="rounded-2xl border border-slate-800/80 bg-[#121820] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Hill Cab Transfers &amp; Driver Settlement Ledger
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Drivers collect cash or UPI from passengers directly. Reconciles driver take-home vs platform fee.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400 font-medium">
                  <tr>
                    <th className="p-3">Ref</th>
                    <th className="p-3">Driver</th>
                    <th className="p-3">Passenger</th>
                    <th className="p-3">Route</th>
                    <th className="p-3">Total fare</th>
                    <th className="p-3">Platform cut</th>
                    <th className="p-3">Driver payout</th>
                    <th className="p-3">Settlement</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data?.recentTrips?.length ? (
                    data.recentTrips.map((trip) => (
                      <tr key={trip.id} className="hover:bg-slate-900/40">
                        <td className="p-3 font-mono font-medium text-slate-300">
                          #{trip.reference}
                        </td>
                        <td className="p-3 font-medium text-white">{trip.driverName}</td>
                        <td className="p-3 text-slate-300">{trip.passengerName}</td>
                        <td className="p-3 text-slate-400 max-w-xs truncate">
                          {trip.pickup} ➔ {trip.dropoff}
                        </td>
                        <td className="p-3 font-mono font-medium tabular-nums text-slate-200">
                          {inr(trip.fare)}
                        </td>
                        <td className="p-3 font-mono text-emerald-400 font-medium tabular-nums">
                          {inr(trip.commission)}
                        </td>
                        <td className="p-3 font-mono text-slate-200 font-medium tabular-nums">
                          {inr(trip.payout)}
                        </td>
                        <td className="p-3">
                          {trip.payoutStatus === "settled" ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                              <span className="material-symbols-outlined text-xs">check</span>
                              {trip.settlementReference || "Settled"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 border border-amber-500/20">
                              <span className="material-symbols-outlined text-xs">schedule</span>
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {trip.payoutStatus === "pending" ? (
                            <button
                              onClick={() => setSettlingTrip(trip)}
                              className="rounded-md bg-[#1E7E4B] hover:bg-[#259A5C] px-3 py-1.5 font-medium text-white transition text-xs"
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
          <section className="rounded-2xl border border-slate-800/80 bg-[#121820] p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Network Properties &amp; Host Moderation
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Homestays listed on the platform. Approve new applications or suspend inactive properties.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400 font-medium">
                  <tr>
                    <th className="p-3">Property name</th>
                    <th className="p-3">Host / owner</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Rooms</th>
                    <th className="p-3">Platform rate</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data?.properties?.length ? (
                    data.properties.map((prop) => (
                      <tr key={prop.id} className="hover:bg-slate-900/40">
                        <td className="p-3 font-medium text-white">{prop.name}</td>
                        <td className="p-3">
                          <p className="font-medium text-slate-200">{prop.ownerName}</p>
                          <p className="text-slate-500 text-[11px]">{prop.email} • {prop.phone}</p>
                        </td>
                        <td className="p-3 text-slate-400">{prop.town || "—"}</td>
                        <td className="p-3 font-mono text-slate-300">{prop.roomsCount} units</td>
                        <td className="p-3 font-mono text-emerald-400 font-medium">
                          {typeof prop.commissionRate === "number" ? `${Math.round(prop.commissionRate * 100)}%` : "—"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                              prop.status === "active"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : prop.status === "suspended"
                                  ? "bg-red-500/10 text-red-300 border-red-500/20"
                                  : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                            }`}
                          >
                            {prop.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {prop.status !== "active" && (
                            <button
                              onClick={() => handlePropertyStatus(prop.id, "active", prop.name)}
                              className="rounded-md bg-[#1E7E4B] hover:bg-[#259A5C] px-2.5 py-1 text-xs font-medium text-white transition"
                            >
                              Approve
                            </button>
                          )}
                          {prop.status === "active" && (
                            <button
                              onClick={() => handlePropertyStatus(prop.id, "suspended", prop.name)}
                              className="rounded-md border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300 transition"
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
                        No registered properties found in database.
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
          <div className="w-full max-w-sm rounded-2xl border border-slate-800/80 bg-[#121820] p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-white">
              Settle Driver Payout via UPI
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Trip #{settlingTrip.reference} • Driver: {settlingTrip.driverName}
            </p>

            <div className="my-4 rounded-lg border border-slate-700/60 bg-[#0D1117] p-3 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Driver payout:</span>
                <span className="font-mono font-medium text-white tabular-nums">
                  {inr(settlingTrip.payout)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSettlePayout} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Bank / UPI Transaction Reference ID *
                </label>
                <input
                  type="text"
                  required
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  placeholder="e.g. UPI-202610-849204"
                  className="mt-1.5 w-full rounded-lg border border-slate-800 bg-[#0D1117] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSettlingTrip(null)}
                  className="flex-1 rounded-lg border border-slate-700/80 bg-slate-800/60 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleLoading || !upiRef.trim()}
                  className="flex-1 rounded-lg bg-[#1E7E4B] hover:bg-[#259A5C] py-2 text-xs font-semibold text-white transition disabled:opacity-50"
                >
                  {settleLoading ? "Recording..." : "Confirm settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
