"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/auth-context";
import { API_ENDPOINTS, readApiError } from "@/lib/api-config";

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
  const [activeTab, setActiveTab] = useState<"payouts" | "properties" | "commissions" | "cab-requests" | "appeals" | "host-payouts" | "drivers">("payouts");

  // Payout settlement modal state
  const [settlingTrip, setSettlingTrip] = useState<any | null>(null);
  const [upiRef, setUpiRef] = useState("");
  const [settleLoading, setSettleLoading] = useState(false);

  // 1. Commission Desk State
  const [commSettings, setCommSettings] = useState<{
    globalPlatformFeePercent: number;
    globalHomestayCommissionPercent: number;
    defaultAdvancePercent: number;
    changeReason?: string;
    updatedBy?: string;
    updatedAtIST?: string;
  } | null>(null);
  const [commLoading, setCommLoading] = useState(false);
  const [commSaving, setCommSaving] = useState(false);
  const [pfInput, setPfInput] = useState("5");
  const [hcInput, setHcInput] = useState("10");
  const [advInput, setAdvInput] = useState("15");
  const [commReason, setCommReason] = useState("");
  const [simFare, setSimFare] = useState("3500");
  const [simResult, setSimResult] = useState<any | null>(null);

  // 2. Pending Cab Requests State
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [assigningReq, setAssigningReq] = useState<any | null>(null);
  const [driverNameInput, setDriverNameInput] = useState("");
  const [driverPhoneInput, setDriverPhoneInput] = useState("");
  const [vehicleModelInput, setVehicleModelInput] = useState("Mahindra Bolero SUV");
  const [vehiclePlateInput, setVehiclePlateInput] = useState("");
  const [agreedFareInput, setAgreedFareInput] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [paymentReq, setPaymentReq] = useState<any | null>(null);
  const [paymentTxnInput, setPaymentTxnInput] = useState("");
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentMethodInput, setPaymentMethodInput] = useState<"UPI" | "BANK_TRANSFER" | "CASH" | "GATEWAY">("UPI");
  const [paymentNoteInput, setPaymentNoteInput] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  // 3. Appeals Desk State
  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealNote, setAppealNote] = useState("");

  // 4. Homestay Host Commission Payouts State
  const [hostPayouts, setHostPayouts] = useState<any[]>([]);
  const [hostPayoutsLoading, setHostPayoutsLoading] = useState(false);
  const [settlingHostPayout, setSettlingHostPayout] = useState<any | null>(null);
  const [hostUtrInput, setHostUtrInput] = useState("");
  const [hostSettleLoading, setHostSettleLoading] = useState(false);

  async function fetchHostPayouts() {
    if (!token) return;
    try {
      setHostPayoutsLoading(true);
      const res = await fetch(API_ENDPOINTS.hostPayouts(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setHostPayouts(Array.isArray(json) ? json : []);
      } else {
        alert(await readApiError(res, "Failed to load host payouts."));
      }
    } catch (e: any) {
      alert(e.message || "Failed to load host payouts.");
    } finally {
      setHostPayoutsLoading(false);
    }
  }

  async function handleSettleHostPayout(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !settlingHostPayout) return;
    if (!hostUtrInput.trim()) {
      alert("UTR number is required to settle a payout.");
      return;
    }
    try {
      setHostSettleLoading(true);
      const res = await fetch(API_ENDPOINTS.settleHostPayout(settlingHostPayout._id), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ utrNumber: hostUtrInput.trim() }),
      });
      if (res.ok) {
        alert("Homestay commission payout marked as SETTLED!");
        setSettlingHostPayout(null);
        setHostUtrInput("");
        fetchHostPayouts();
      } else {
        alert(await readApiError(res, "Failed to settle payout."));
        if (res.status === 409) {
          setSettlingHostPayout(null);
          fetchHostPayouts();
        }
      }
    } catch (err: any) {
      alert(err.message || "Failed to settle payout.");
    } finally {
      setHostSettleLoading(false);
    }
  }

  async function handleRejectHostPayout(payoutId: string) {
    if (!token) return;
    const reason = window.prompt("Reason for rejecting this payout request (trips will be unlocked):", "Disputed fares or mismatched bank details");
    if (!reason) return;
    try {
      const res = await fetch(API_ENDPOINTS.rejectHostPayout(payoutId), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        alert("Payout request rejected and trips unlocked.");
        fetchHostPayouts();
      } else {
        alert(await readApiError(res, "Failed to reject payout."));
      }
    } catch (e: any) {
      alert(e?.message || "Failed to reject payout.");
    }
  }

  // 5. Fleet Drivers Management State
  const [driversList, setDriversList] = useState<any[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driverFilterStatus, setDriverFilterStatus] = useState<string>("");

  async function fetchDrivers() {
    if (!token) return;
    setDriversLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.drivers(driverFilterStatus || undefined), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = await res.json();
        setDriversList(body.data || body || []);
      }
    } catch (e: any) {
      console.error("Could not fetch drivers:", e);
    } finally {
      setDriversLoading(false);
    }
  }

  async function handleUpdateDriverStatus(driverId: string, status: "ACTIVE" | "PENDING_APPROVAL" | "BLOCKED") {
    if (!token) return;
    let reason = "";
    if (status === "BLOCKED") {
      const input = window.prompt("Reason for suspending this driver:", "Violation of mountain safety guidelines");
      if (input === null) return;
      reason = input;
    }
    try {
      const res = await fetch(API_ENDPOINTS.driverStatus(driverId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, reason }),
      });
      if (res.ok) {
        alert(`Driver status updated to ${status}.`);
        fetchDrivers();
      } else {
        alert(await readApiError(res, "Failed to update driver status."));
      }
    } catch (e: any) {
      alert(e?.message || "Failed to update driver status.");
    }
  }

  async function fetchOverview() {
    if (!token) return;
    try {
      setLoading(true);
      setOverviewError("");
      const res = await fetch(API_ENDPOINTS.overview(), {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      } else {
        alert(await readApiError(res, "Failed to update property status."));
      }
    } catch (e: any) {
      alert(e.message || "Failed to update property status.");
    }
  }

  // ----------------------------------------------------
  // Commission Settings Desk Handlers
  // ----------------------------------------------------
  async function fetchCommissionSettings() {
    if (!token) return;
    try {
      setCommLoading(true);
      const res = await fetch(API_ENDPOINTS.commissionSettings(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setCommSettings(json.data);
          setPfInput(String(json.data.globalPlatformFeePercent));
          setHcInput(String(json.data.globalHomestayCommissionPercent));
          setAdvInput(String(json.data.defaultAdvancePercent || 15));
        }
      }
    } catch (e) {
      console.error("Error fetching commission settings:", e);
    } finally {
      setCommLoading(false);
    }
  }

  async function handleSaveCommissionSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      setCommSaving(true);
      const res = await fetch(API_ENDPOINTS.commissionSettings(), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          globalPlatformFeePercent: Number(pfInput),
          globalHomestayCommissionPercent: Number(hcInput),
          defaultAdvancePercent: Number(advInput),
          changeReason: commReason.trim() || "Admin updated commission rates",
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setCommSettings(json.data);
        setCommReason("");
        alert("Commission settings successfully updated!");
        runSimulator();
      } else {
        alert(await readApiError(res, "Failed to update commission settings."));
      }
    } catch (e: any) {
      alert(e.message || "Network error updating settings");
    } finally {
      setCommSaving(false);
    }
  }

  async function runSimulator() {
    if (!token || !simFare) return;
    try {
      const res = await fetch(API_ENDPOINTS.previewCommission(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fare: Number(simFare) }),
      });
      if (res.ok) {
        const json = await res.json();
        setSimResult(json.data);
      }
    } catch (e) {
      console.warn("Simulator calculation error:", e);
    }
  }

  // ----------------------------------------------------
  // Pending Cab Requests Desk Handlers (Workflow B)
  // ----------------------------------------------------
  async function fetchPendingRequests() {
    if (!token) return;
    try {
      setRequestsLoading(true);
      const res = await fetch(API_ENDPOINTS.pendingCabRequests(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setPendingRequests(json.data || []);
      }
    } catch (e) {
      console.error("Error fetching pending requests:", e);
    } finally {
      setRequestsLoading(false);
    }
  }

  async function handleAssignDriver(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !assigningReq) return;
    if (!(Number(agreedFareInput) > 0)) {
      alert("Agreed fare must be greater than 0.");
      return;
    }
    try {
      setAssignLoading(true);
      const res = await fetch(API_ENDPOINTS.assignDriverToRequest(assigningReq._id), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assignedDriverName: driverNameInput.trim(),
          assignedDriverPhone: driverPhoneInput.trim(),
          vehicleModel: vehicleModelInput.trim(),
          vehiclePlate: vehiclePlateInput.trim(),
          agreedFare: Number(agreedFareInput),
        }),
      });
      if (res.ok) {
        setAssigningReq(null);
        setDriverNameInput("");
        setDriverPhoneInput("");
        setVehiclePlateInput("");
        setAgreedFareInput("");
        fetchPendingRequests();
        alert("Driver assigned and fare terms prepared for guest advance confirmation!");
      } else {
        alert(await readApiError(res, "Failed to assign driver."));
      }
    } catch (e: any) {
      alert(e.message || "Failed to assign driver.");
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !paymentReq) return;
    if (!paymentTxnInput.trim()) {
      alert("Transaction ID is required.");
      return;
    }
    if (!(Number(paymentAmountInput) > 0)) {
      alert("Amount must be greater than 0.");
      return;
    }
    try {
      setPaymentLoading(true);
      const res = await fetch(API_ENDPOINTS.recordCabRequestPayment(paymentReq._id), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transactionId: paymentTxnInput.trim(),
          amount: Number(paymentAmountInput),
          method: paymentMethodInput,
          note: paymentNoteInput.trim() || undefined,
        }),
      });
      if (res.ok) {
        setPaymentReq(null);
        fetchPendingRequests();
        alert("Advance payment recorded.");
      } else {
        alert(await readApiError(res, "Failed to record payment."));
        if (res.status === 409) {
          setPaymentReq(null);
          fetchPendingRequests();
        }
      }
    } catch (e: any) {
      alert(e.message || "Failed to record payment.");
    } finally {
      setPaymentLoading(false);
    }
  }

  // ----------------------------------------------------
  // Feature Access Appeals Handlers
  // ----------------------------------------------------
  async function fetchAppeals() {
    if (!token) return;
    try {
      setAppealsLoading(true);
      const res = await fetch(API_ENDPOINTS.appeals(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setAppeals(json.data || []);
      }
    } catch (e) {
      console.error("Error fetching appeals:", e);
    } finally {
      setAppealsLoading(false);
    }
  }

  async function handleDecideAppeal(id: string, status: "APPROVED" | "REJECTED") {
    if (!token) return;
    const note = prompt(`Enter optional decision note for ${status}:`, "") || "";
    try {
      const res = await fetch(API_ENDPOINTS.decideAppeal(id), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, decisionNote: note }),
      });
      if (res.ok) {
        fetchAppeals();
        alert(`Appeal marked as ${status}`);
      } else {
        alert(await readApiError(res, "Failed to decide appeal."));
        if (res.status === 409) fetchAppeals();
      }
    } catch (e: any) {
      alert(e.message || "Failed to decide appeal.");
    }
  }

  // Effect to load respective data when tab changes
  useEffect(() => {
    if (activeTab === "commissions") {
      fetchCommissionSettings();
      runSimulator();
    } else if (activeTab === "cab-requests") {
      fetchPendingRequests();
    } else if (activeTab === "appeals") {
      fetchAppeals();
    } else if (activeTab === "host-payouts") {
      fetchHostPayouts();
    } else if (activeTab === "drivers") {
      fetchDrivers();
    }
  }, [activeTab, token]);

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
        {overviewError && (
          <div className="rounded-xl border border-red-800/40 bg-red-950/40 px-4 py-3 text-xs font-semibold text-red-300">
            {overviewError}
          </div>
        )}
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
        <div className="flex border-b border-slate-800 overflow-x-auto no-scrollbar">
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
            <span>Homestay Properties</span>
          </button>

          <button
            onClick={() => setActiveTab("commissions")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
              activeTab === "commissions"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-lg">percent</span>
            <span>Commission Engine &amp; Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab("cab-requests")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
              activeTab === "cab-requests"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-lg">local_taxi</span>
            <span>Pending Cab Requests ({pendingRequests.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("appeals")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
              activeTab === "appeals"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-lg">verified_user</span>
            <span>Feature Appeals ({appeals.filter((a) => a.status === 'PENDING').length})</span>
          </button>

          <button
            onClick={() => setActiveTab("host-payouts")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
              activeTab === "host-payouts"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
            <span>Homestay Commission Payouts ({hostPayouts.filter((p) => p.status === 'PENDING').length})</span>
          </button>

          <button
            onClick={() => setActiveTab("drivers")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition whitespace-nowrap ${
              activeTab === "drivers"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-lg">local_taxi</span>
            <span>Fleet Drivers ({driversList.length})</span>
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

        {/* 5. TAB 3: COMMISSION ENGINE & SIMULATOR DESK (Section 2.3) */}
        {activeTab === "commissions" && (
          <section className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Form Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-400">tune</span>
                    <span>Global Commission &amp; Payout Rules</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Configure platform commission percentages without code deployments. Changes apply to all new cab quotes.
                  </p>
                </div>

                {commLoading ? (
                  <p className="text-xs text-slate-400">Loading current settings...</p>
                ) : (
                  <form onSubmit={handleSaveCommissionSettings} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300">
                          Platform Fee % (PF%)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="50"
                          required
                          value={pfInput}
                          onChange={(e) => setPfInput(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500">Retained by StayRide (e.g. 5%)</span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300">
                          Homestay Commission % (HC%)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="50"
                          required
                          value={hcInput}
                          onChange={(e) => setHcInput(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500">Earned by referring host (e.g. 10%)</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300">
                        Default Advance Required %
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="5"
                        max="50"
                        required
                        value={advInput}
                        onChange={(e) => setAdvInput(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500">Paid online by guest to confirm trip (e.g. 15%)</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300">
                        Reason for Update (Audit Log)
                      </label>
                      <input
                        type="text"
                        value={commReason}
                        onChange={(e) => setCommReason(e.target.value)}
                        placeholder="e.g. Peak tourist season promotional host rate"
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-3 text-[11px] text-blue-300">
                      💡 <strong>Driver Payout Formula:</strong> 100% - ({Number(pfInput) || 0}% PF + {Number(hcInput) || 0}% HC) = <span className="font-bold text-white">{100 - ((Number(pfInput) || 0) + (Number(hcInput) || 0))}%</span> net to driver.
                    </div>

                    <button
                      type="submit"
                      disabled={commSaving}
                      className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-500 disabled:opacity-50"
                    >
                      {commSaving ? "Saving Settings..." : "Save Commission Rules"}
                    </button>
                  </form>
                )}
              </div>

              {/* Live Mountain Fare Simulator Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400">calculate</span>
                    <span>Live Mountain Fare Simulator</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Simulate how any quoted fare divides between StayRide, Host, and Driver.
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-300">
                    Sample Agreed Fare (₹)
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="number"
                      value={simFare}
                      onChange={(e) => setSimFare(e.target.value)}
                      placeholder="e.g. 3500"
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-mono font-bold text-white focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={runSimulator}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                    >
                      Recalculate
                    </button>
                  </div>
                </div>

                {simResult && (
                  <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex justify-between border-b border-slate-800 pb-2 text-xs">
                      <span className="text-slate-400">Agreed Mountain Fare:</span>
                      <span className="font-mono font-bold text-white">₹{simResult.agreedFare?.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800 pb-2 text-xs">
                      <span className="text-blue-400">StayRide Platform Fee ({simResult.platformFeePercent}%):</span>
                      <span className="font-mono font-bold text-blue-300">₹{simResult.platformFeeAmount?.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800 pb-2 text-xs">
                      <span className="text-emerald-400">Homestay Commission ({simResult.homestayCommissionPercent}%):</span>
                      <span className="font-mono font-bold text-emerald-300">+₹{simResult.homestayCommissionAmount?.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800 pb-2 text-xs">
                      <span className="text-amber-400">Driver Net Payout ({Math.round(simResult.driverPayoutRate * 100)}%):</span>
                      <span className="font-mono font-bold text-amber-300">₹{simResult.driverPayoutAmount?.toLocaleString()}</span>
                    </div>

                    <div className="pt-2 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>Advance Paid Online by Guest:</span>
                        <span className="font-mono font-bold text-purple-300">₹{simResult.advanceAmount?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-400 mt-1">
                        <span>Remaining Cash Paid to Driver on Trip:</span>
                        <span className="font-mono font-bold text-slate-200">₹{simResult.remainingCashToDriver?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-amber-900/30 bg-amber-950/20 p-3 text-[11px] text-amber-300">
                  🛡️ <strong>Immutability Guarantee:</strong> Changing these percentages now will <em>never</em> alter historical or confirmed bookings. Confirmed bookings store an immutable financial snapshot.
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 6. TAB 4: PENDING CAB REQUESTS QUEUE (Workflow B - Section 2.5 & 6) */}
        {activeTab === "cab-requests" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400">pending_actions</span>
                  <span>Pending Cab Requests Queue (Workflow B)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Requests submitted by hosts or guests. Admin phones drivers, negotiates flat fare, and assigns the trip.
                </p>
              </div>
              <button
                onClick={fetchPendingRequests}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Refresh Queue
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="p-3">Ref &amp; Date</th>
                    <th className="p-3">Homestay &amp; Passenger</th>
                    <th className="p-3">Itinerary Route</th>
                    <th className="p-3">Type &amp; Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {requestsLoading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Loading pending requests...
                      </td>
                    </tr>
                  ) : pendingRequests.length ? (
                    pendingRequests.map((req) => (
                      <tr key={req._id} className="hover:bg-slate-900/40">
                        <td className="p-3">
                          <p className="font-mono font-bold text-white">#{req.reference}</p>
                          <p className="text-slate-500">{new Date(req.date).toLocaleDateString()} • {req.time}</p>
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-slate-200">{req.guestName}</p>
                          <p className="text-slate-400">{req.homestayName}</p>
                          <p className="text-slate-500 font-mono text-[10px]">{req.guestPhone}</p>
                        </td>
                        <td className="p-3 max-w-xs">
                          <p className="text-emerald-400 font-semibold truncate">📍 {req.pickupLocation?.address || "Homestay"}</p>
                          <p className="text-slate-300 truncate">
                            🏁 {req.destinations?.map((d: any) => d.address).join(" ➔ ") || "Destination"}
                          </p>
                          {req.isRoundTrip && (
                            <span className="inline-block mt-0.5 rounded px-1.5 py-0.2 bg-blue-950 text-blue-300 text-[10px]">
                              Round Trip
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="rounded px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-bold">
                            {req.vehicleType || "SUV"}
                          </span>
                          <span className="ml-2 rounded px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800/40 text-[10px] font-bold">
                            {req.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setAssigningReq(req);
                              setAgreedFareInput(req.agreedFare ? String(req.agreedFare) : "");
                            }}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 shadow"
                          >
                            Assign Driver &amp; Fare
                          </button>
                          {req.status === "AWAITING_ADVANCE_PAYMENT" && (
                            <button
                              onClick={() => {
                                setPaymentReq(req);
                                setPaymentTxnInput("");
                                setPaymentAmountInput(req.advanceAmount ? String(req.advanceAmount) : "");
                                setPaymentMethodInput("UPI");
                                setPaymentNoteInput("");
                              }}
                              className="ml-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow"
                            >
                              Record Payment
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No pending requests in queue.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 7. TAB 5: FEATURE ACCESS APPEALS DESK (Section 2.4 & 9) */}
        {activeTab === "appeals" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-400">verified_user</span>
                  <span>Feature Access Appeals Desk (Section 2.4 &amp; 9)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Homestay hosts request access to restricted features (e.g., Campaigns, Network Dispatch).
                </p>
              </div>
              <button
                onClick={fetchAppeals}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Refresh Appeals
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="p-3">Homestay &amp; Owner</th>
                    <th className="p-3">Feature Requested</th>
                    <th className="p-3">Host Reason</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {appealsLoading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Loading feature appeals...
                      </td>
                    </tr>
                  ) : appeals.length ? (
                    appeals.map((app) => (
                      <tr key={app._id} className="hover:bg-slate-900/40">
                        <td className="p-3">
                          <p className="font-semibold text-white">{app.homestayName}</p>
                          <p className="text-slate-500">{app.ownerEmail}</p>
                        </td>
                        <td className="p-3">
                          <span className="rounded-full bg-purple-950 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-800/40">
                            {app.featureKey}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300 max-w-sm">
                          {app.reason}
                          {app.decisionNote && (
                            <p className="mt-1 text-[11px] text-slate-500 italic">Note: {app.decisionNote}</p>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              app.status === "APPROVED"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                                : app.status === "REJECTED"
                                  ? "bg-red-950 text-red-400 border border-red-800/40"
                                  : "bg-amber-950 text-amber-400 border border-amber-800/40"
                            }`}
                          >
                            {app.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {app.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleDecideAppeal(app._id, "APPROVED")}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDecideAppeal(app._id, "REJECTED")}
                                className="rounded-lg border border-red-500/40 bg-red-950/40 px-2.5 py-1 text-[11px] font-bold text-red-400 hover:bg-red-900/60"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No feature appeals submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 7. TAB 5: HOMESTAY COMMISSION PAYOUTS DESK */}
        {activeTab === "host-payouts" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  Homestay Host Commission Payout Desk
                </h2>
                <p className="text-xs text-slate-400">
                  Hosts request redemption of their accumulated cab booking commissions. Settle via direct UPI transfer and record UTR.
                </p>
              </div>
              <button
                onClick={fetchHostPayouts}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                <span className="material-symbols-outlined text-sm">sync</span>
                <span>Refresh Payouts</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400">
                    <th className="p-3">Homestay & Host</th>
                    <th className="p-3">Redemption Amount</th>
                    <th className="p-3">Payout Method & UPI ID</th>
                    <th className="p-3">Requested At</th>
                    <th className="p-3">Status / Reference</th>
                    <th className="p-3 text-right">Settlement Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {hostPayouts.length > 0 ? (
                    hostPayouts.map((p) => (
                      <tr key={p._id || p.id} className="hover:bg-slate-900/30">
                        <td className="p-3">
                          <p className="font-bold text-white">{p.homestayName}</p>
                          <p className="text-[11px] text-slate-400">
                            {p.ownerName} • {p.tenantId}
                          </p>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-sm font-bold text-emerald-400">
                            ₹{(p.amount || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-200">
                          {p.upiId || p.bankDetails?.accountNumber || "UPI"}
                        </td>
                        <td className="p-3 text-slate-400">
                          {p.requestedAt ? new Date(p.requestedAt).toLocaleString("en-IN") : "Recent"}
                        </td>
                        <td className="p-3">
                          {p.status === "SETTLED" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/40">
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              SETTLED ({p.utrNumber || "TRANSFERRED"})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-800/40">
                              <span className="material-symbols-outlined text-xs">hourglass_top</span>
                              PENDING DISBURSEMENT
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {p.status === "PENDING" ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSettlingHostPayout(p);
                                  setHostUtrInput("");
                                }}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition"
                              >
                                Settle via UPI
                              </button>
                              <button
                                onClick={() => handleRejectHostPayout(p._id || p.id)}
                                className="rounded-lg bg-red-950 px-2.5 py-1.5 text-xs font-bold text-red-400 border border-red-800/40 hover:bg-red-900 transition"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono">
                              {p.status === "REJECTED" ? "Rejected ✕" : "Settled ✓"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        {hostPayoutsLoading
                          ? "Loading homestay commission payout requests..."
                          : "No homestay payout requests currently pending."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 8. TAB 7: FLEET DRIVERS MANAGEMENT */}
        {activeTab === "drivers" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  Mountain Fleet Drivers Desk
                </h2>
                <p className="text-xs text-slate-400">
                  Review hill driver profiles, verify commercial vehicle details, and approve or suspend driver access.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={driverFilterStatus}
                  onChange={(e) => setDriverFilterStatus(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="ACTIVE">Active / Approved</option>
                  <option value="BLOCKED">Suspended / Blocked</option>
                </select>
                <button
                  onClick={fetchDrivers}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  <span className="material-symbols-outlined text-sm">sync</span>
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400">
                    <th className="p-3">Driver Name & Contact</th>
                    <th className="p-3">Vehicle Details</th>
                    <th className="p-3">Registration Plate</th>
                    <th className="p-3">Seating & Region</th>
                    <th className="p-3">Account Status</th>
                    <th className="p-3 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {driversList.length > 0 ? (
                    driversList.map((d: any) => (
                      <tr key={d._id || d.id} className="hover:bg-slate-900/30">
                        <td className="p-3">
                          <p className="font-bold text-white">{d.name || "Driver"}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {d.phone || "No phone"} • {d.email}
                          </p>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-200">
                            {d.vehicle?.model || d.vehicle || "SUV"}
                          </span>
                          <span className="ml-1 text-[11px] text-slate-500">
                            ({d.vehicle?.type || "Standard"})
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-amber-300">
                          {d.vehicle?.plate || d.plate || "Pending Plate"}
                        </td>
                        <td className="p-3 text-slate-300">
                          {d.vehicle?.seats || d.seats || 4} Seats • {d.vehicle?.area || d.area || "Hill Circuit"}
                        </td>
                        <td className="p-3">
                          {d.accountStatus === "ACTIVE" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/40">
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              ACTIVE
                            </span>
                          ) : d.accountStatus === "BLOCKED" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-950 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-800/40">
                              <span className="material-symbols-outlined text-xs">cancel</span>
                              SUSPENDED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-800/40">
                              <span className="material-symbols-outlined text-xs">pending</span>
                              PENDING APPROVAL
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {d.accountStatus !== "ACTIVE" && (
                              <button
                                onClick={() => handleUpdateDriverStatus(d._id || d.id, "ACTIVE")}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow hover:bg-emerald-500 transition"
                              >
                                Approve
                              </button>
                            )}
                            {d.accountStatus !== "BLOCKED" && (
                              <button
                                onClick={() => handleUpdateDriverStatus(d._id || d.id, "BLOCKED")}
                                className="rounded-lg bg-red-950 px-2.5 py-1 text-[11px] font-bold text-red-400 border border-red-800/40 hover:bg-red-900 transition"
                              >
                                Suspend
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        {driversLoading ? "Loading drivers..." : "No drivers found for this filter."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* 8. DRIVER ASSIGNMENT & FARE NEGOTIATION MODAL (Workflow B) */}
      {assigningReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              Assign Driver &amp; Finalize Fare Terms
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Request #{assigningReq.reference} • Homestay: {assigningReq.homestayName}
            </p>

            <form onSubmit={handleAssignDriver} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300">Driver Full Name *</label>
                <input
                  type="text"
                  required
                  value={driverNameInput}
                  onChange={(e) => setDriverNameInput(e.target.value)}
                  placeholder="e.g. Tshering Lepcha"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">Driver Phone / WhatsApp *</label>
                <input
                  type="text"
                  required
                  value={driverPhoneInput}
                  onChange={(e) => setDriverPhoneInput(e.target.value)}
                  placeholder="e.g. +91 98000 12345"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300">Vehicle Model</label>
                  <input
                    type="text"
                    value={vehicleModelInput}
                    onChange={(e) => setVehicleModelInput(e.target.value)}
                    placeholder="e.g. Innova / Bolero"
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300">Plate Number</label>
                  <input
                    type="text"
                    value={vehiclePlateInput}
                    onChange={(e) => setVehiclePlateInput(e.target.value)}
                    placeholder="e.g. SK-01-E-1234"
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">Agreed Flat Fare (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={agreedFareInput}
                  onChange={(e) => setAgreedFareInput(e.target.value)}
                  placeholder="e.g. 3500"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-mono font-bold text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningReq(null)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading || !driverNameInput || !agreedFareInput}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-500 disabled:opacity-50"
                >
                  {assignLoading ? "Saving..." : "Confirm & Ready Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD ADVANCE PAYMENT MODAL (audited manual reconciliation) */}
      {paymentReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">Record Advance Payment</h3>
            <p className="mt-1 text-xs text-slate-400">
              Request #{paymentReq.reference} • {paymentReq.guestName}
            </p>

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300">Transaction ID *</label>
                <input
                  type="text"
                  required
                  value={paymentTxnInput}
                  onChange={(e) => setPaymentTxnInput(e.target.value)}
                  placeholder="e.g. UTR / UPI reference"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={paymentAmountInput}
                    onChange={(e) => setPaymentAmountInput(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300">Method *</label>
                  <select
                    value={paymentMethodInput}
                    onChange={(e) => setPaymentMethodInput(e.target.value as typeof paymentMethodInput)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="GATEWAY">Gateway</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">Note</label>
                <input
                  type="text"
                  value={paymentNoteInput}
                  onChange={(e) => setPaymentNoteInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentReq(null)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading || !paymentTxnInput.trim() || !paymentAmountInput}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                >
                  {paymentLoading ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* 10. HOMESTAY COMMISSION SETTLEMENT MODAL */}
      {settlingHostPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              Settle Homestay Commission Payout
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Host: {settlingHostPayout.ownerName} • {settlingHostPayout.homestayName}
            </p>

            <form onSubmit={handleSettleHostPayout} className="mt-4 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Payable Amount:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    ₹{settlingHostPayout.amount?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Destination UPI ID:</span>
                  <span className="font-mono text-white">
                    {settlingHostPayout.upiId || 'Direct Bank'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Bank / UPI Transaction Reference (UTR) *
                </label>
                <input
                  type="text"
                  required
                  value={hostUtrInput}
                  onChange={(e) => setHostUtrInput(e.target.value)}
                  placeholder="e.g. 425619889201 or UPI_TXN_..."
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlingHostPayout(null)}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={hostSettleLoading || !hostUtrInput.trim()}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {hostSettleLoading ? "Marking Settled..." : "Confirm UPI Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
