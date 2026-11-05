"use client";

// Driver quote page, opened from the dispatch WhatsApp message: drivers who do not use the app send
// their fare (or accept the homestay's counter-offer) here. The signed link identifies the driver and
// the trip; guest contact details are never shown before the advance is paid.
// Also includes the driver's Sovereign Wallet & Instant UPI Payout console.
import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { API_ENDPOINTS, apiFetch } from "@/lib/api-config";
import { siteConfig } from "@/lib/site-config";
import { waNumber } from "@/lib/whatsapp";

type QuoteView = {
  reference: string;
  homestayName?: string;
  driverName?: string;
  pickup: string;
  pickupLat?: number;
  pickupLng?: number;
  destination: string;
  destinationLat?: number;
  destinationLng?: number;
  date: number;
  time: string;
  passengers: number;
  vehicleType: string;
  isRoundTrip?: boolean;
  returnDate?: number;
  returnTime?: string;
  status: string;
  driverView?: "OPEN" | "QUOTED" | "ASSIGNED" | "REASSIGNED" | "TAKEN" | "EXPIRED" | "CANCELLED";
  canQuote: boolean;
  cancellationReason?: string | null;
  assignedToMe?: boolean;
  guestName?: string;
  phone?: string;
  fare?: number;
  advanceAmount?: number;
  advancePaid?: boolean;
  remainingCashAmount?: number;
  pickupOtpRequired?: boolean;
  guestBudget?: number | null;
  commissionConfig?: {
    totalCommissionPercent: number;
    defaultAdvancePercent: number;
    minAdvanceAmount: number;
    minDriverPayoutThreshold: number;
  };
  myQuote: { quotedFare: number; status: string; notes?: string; counterFare?: number | null } | null;
};

type WalletData = {
  available: number;
  eligibleTrips: number;
  trips: Array<{ reference: string; date: number; time: string; amount: number }>;
  pendingPayout: { id: string; amount: number; requestedAt: string | number | Date } | null;
  history?: Array<{
    id: string;
    amount: number;
    status: string;
    method: string;
    upiId?: string;
    settlementReference?: string;
    requestedAt?: string;
    settledAt?: string;
    rejectionReason?: string;
  }>;
};

const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "EXPIRED"];
const TERMINAL_DRIVER_VIEWS = ["TAKEN", "REASSIGNED", "EXPIRED", "CANCELLED"];
const ACTIVE_TRIP_STATUSES = ["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED"];

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const istDate = (v: string | number | Date) => new Date(v).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

function DriverQuoteContent() {
  const token = useSearchParams().get("t") || "";
  const [view, setView] = useState<QuoteView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"trip" | "wallet">("trip");
  const [fare, setFare] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [notes, setNotes] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Driver Wallet & Payouts State
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState("");

  const otp = otpDigits.join("");
  const noSavedMethodText = `Add your UPI in the ${siteConfig.appName} driver app, or contact ${siteConfig.appName} support.`;

  const handleOtpDigitChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 3) {
      const nextInput = document.getElementById(`otp-d-${index + 1}`);
      if (nextInput) (nextInput as HTMLInputElement).focus();
    }
    if (digit && index === 3) {
      const fullOtp = next.join("");
      if (fullOtp.length === 4 && !busy) {
        handleTripAction("start", fullOtp);
      }
    }
  };

  const fetchWallet = useCallback(async () => {
    if (!token) return;
    setWalletLoading(true);
    try {
      const data = await apiFetch<WalletData>(API_ENDPOINTS.driverQuote.wallet(token));
      setWallet(data);
    } catch {
      // Ignore wallet fetch errors gracefully
    } finally {
      setWalletLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!token) throw new Error("This link is incomplete. Open it again from the WhatsApp message.");
        const [viewRes, walletRes] = await Promise.allSettled([
          apiFetch<QuoteView>(API_ENDPOINTS.driverQuote.view(token)),
          apiFetch<WalletData>(API_ENDPOINTS.driverQuote.wallet(token)),
        ]);

        if (!cancelled) {
          if (viewRes.status === "fulfilled") {
            const v = viewRes.value;
            setView(v);
            if (v.myQuote?.notes) setNotes(v.myQuote.notes);
            if (v.myQuote?.quotedFare) {
              setFare(String(v.myQuote.quotedFare));
            }
          } else {
            throw viewRes.reason;
          }

          if (walletRes.status === "fulfilled") {
            setWallet(walletRes.value);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "This link is invalid or has expired.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Keep the view fresh while the trip can still change (every 30s and when the driver returns to the tab).
  const viewIsLive = Boolean(
    view && !TERMINAL_STATUSES.includes(view.status) && !TERMINAL_DRIVER_VIEWS.includes(view.driverView || "")
  );
  useEffect(() => {
    if (!token || !viewIsLive) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      apiFetch<QuoteView>(API_ENDPOINTS.driverQuote.view(token))
        .then(setView)
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const interval = setInterval(refresh, 30000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      clearInterval(interval);
    };
  }, [token, viewIsLive]);

  // Share GPS only while this driver is running the trip, never for open, lost or finished trips.
  const gpsActive = Boolean(view?.assignedToMe && ACTIVE_TRIP_STATUSES.includes(view.status));

  const [gpsStatus, setGpsStatus] = useState<string>("");

  const sendLocationPing = useCallback(() => {
    if (!token || typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        apiFetch(API_ENDPOINTS.driverQuote.location(), {
          method: "POST",
          body: JSON.stringify({
            t: token,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        })
          .then(() => setGpsStatus("Live GPS Active"))
          .catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [token]);

  // Continuous mid-ride & visibility location tracking
  useEffect(() => {
    if (!token || !gpsActive) return;

    if (typeof navigator !== "undefined" && "permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((result) => {
          if (result.state === "granted") {
            sendLocationPing();
          }
        })
        .catch(() => {
          sendLocationPing();
        });
    } else {
      sendLocationPing();
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        sendLocationPing();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", sendLocationPing);

    // Periodic mid-ride ping every 90 seconds while the driver keeps the page open
    const interval = setInterval(sendLocationPing, 90000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", sendLocationPing);
      clearInterval(interval);
    };
  }, [token, gpsActive, sendLocationPing]);

  const [standbyPlate, setStandbyPlate] = useState("");
  const [showPlateModal, setShowPlateModal] = useState(false);
  const [plateBusy, setPlateBusy] = useState(false);
  const [plateMessage, setPlateMessage] = useState("");

  const updateStandbyVehicle = async () => {
    const clean = standbyPlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean || clean.length < 5) {
      setPlateMessage("Please enter a valid registration plate (e.g. WB74E5555)");
      return;
    }
    setPlateBusy(true);
    setPlateMessage("");
    try {
      const res = await apiFetch<{ success?: boolean; message?: string }>(API_ENDPOINTS.driverQuote.updateVehicle(), {
        method: "POST",
        body: JSON.stringify({ t: token, vehiclePlate: clean }),
      });
      setPlateMessage(res.message || `Standby vehicle updated to ${clean}. Guest notified.`);
      setShowPlateModal(false);
      setStandbyPlate("");
      const v = await apiFetch<QuoteView>(API_ENDPOINTS.driverQuote.view(token));
      setView(v);
    } catch (e) {
      setPlateMessage(e instanceof Error ? e.message : "Failed to update standby plate.");
    } finally {
      setPlateBusy(false);
    }
  };

  const send = async (kind: "quote" | "accept") => {
    setBusy(true);
    setMessage("");
    try {
      const cashAmount = Number(fare) || 0;
      const v =
        kind === "quote"
          ? await apiFetch<QuoteView>(API_ENDPOINTS.driverQuote.quote(), {
              method: "POST",
              body: JSON.stringify({
                t: token,
                quotedFare: cashAmount,
                notes,
                vehiclePlate: vehiclePlate.trim().toUpperCase() || undefined,
              }),
            })
          : await apiFetch<QuoteView>(API_ENDPOINTS.driverQuote.acceptCounter(), {
              method: "POST",
              body: JSON.stringify({ t: token }),
            });
      setView(v);
      setMessage(kind === "quote" ? "Your fare quote was submitted successfully." : "Offer accepted. Trip is confirmed once advance payment is recorded.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setMessage(
        /not open to nearby drivers/i.test(msg)
          ? "Open to nearby drivers soon. Check again in a few minutes."
          : msg || "Could not send. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleTripAction = async (action: "start" | "complete", enteredOtp?: string) => {
    setBusy(true);
    setMessage("");
    try {
      const endpoint = action === "start" ? API_ENDPOINTS.driverQuote.start() : API_ENDPOINTS.driverQuote.complete();
      const v = await apiFetch<QuoteView>(endpoint, {
        method: "POST",
        body: JSON.stringify({ t: token, otp: enteredOtp || otp }),
      });
      setView(v);
      setShowOtpModal(false);
      setMessage(action === "start" ? "Trip started." : "Trip completed. Excess advance credited to your wallet!");
      fetchWallet();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const requestPayout = async () => {
    if (!token) return;
    setPayoutBusy(true);
    setPayoutMessage("");
    try {
      // The server pays only to the driver's saved UPI / bank (a quote link can be forwarded)
      const res = await apiFetch<{ success?: boolean; message?: string }>(API_ENDPOINTS.driverQuote.requestPayout(), {
        method: "POST",
        body: JSON.stringify({ t: token }),
      });
      setPayoutMessage(res.message || "Payout request submitted! Admin will transfer funds to your saved UPI.");
      await fetchWallet();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setPayoutMessage(
        /add your upi/i.test(msg) ? noSavedMethodText : msg || "Payout request failed. Please try again."
      );
    } finally {
      setPayoutBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7FAF7] flex items-center justify-center p-6 font-body">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#14422D] border-t-transparent" />
          <div>
            <p className="text-sm font-bold text-[#14422D]">Loading Mountain Trip Console…</p>
            <p className="text-xs text-[#717973] mt-0.5">StayCabs Driver Portal</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !view) {
    return (
      <div className="min-h-screen bg-[#F7FAF7] flex items-center justify-center p-6 font-body">
        <div className="mx-auto max-w-md w-full rounded-3xl border border-[#E5E8E5] bg-white p-8 sm:p-10 text-center space-y-4 shadow-[0_12px_40px_-6px_rgba(20,66,45,0.08)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100">
            <Icon name="error_outline" className="text-2xl" />
          </div>
          <h1 className="font-display text-xl font-bold text-[#181C1B]">Trip Link Not Available</h1>
          <p className="text-xs text-[#717973] leading-relaxed">{error || "This trip request has expired or was already assigned."}</p>
        </div>
      </div>
    );
  }

  const q = view.myQuote;
  const counter = q?.status === "PENDING" && q.counterFare ? q.counterFare : null;
  const when = `${new Date(Number(view.date)).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" })}${view.time ? ` at ${view.time}` : ""}`;

  // Counter-offer: the server accepts it even while quoting is off
  const counterOffer = counter ? (
    <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-5 space-y-3.5 shadow-2xs">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#14422D]">Homestay Counter-Offer</span>
        <span className="text-[10px] bg-[#14422D] text-white font-bold px-2.5 py-0.5 rounded-full">New Rate</span>
      </div>
      <div className="grid grid-cols-2 gap-2 bg-white rounded-xl p-3 border border-emerald-200 text-center">
        <div>
          <span className="text-[10px] text-[#717973] block">Your Quote</span>
          <span className="text-xs font-bold line-through text-[#717973]">{q ? inr(q.quotedFare) : "—"}</span>
        </div>
        <div>
          <span className="text-[10px] text-[#14422D] font-semibold block">Counter-Offer</span>
          <span className="text-sm font-extrabold text-[#14422D]">{inr(counter)}</span>
        </div>
      </div>
      <p className="text-xs text-[#181C1B]">
        The homestay offers <strong className="text-[#14422D] font-extrabold">{inr(counter)}</strong>. Accepting confirms this trip immediately.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => send("accept")}
        className="w-full rounded-2xl bg-[#14422D] py-3 text-xs font-bold text-white shadow-sm hover:bg-[#1C593E] cursor-pointer disabled:opacity-50 transition-all"
      >
        {busy ? "Accepting…" : `Accept ${inr(counter)} & Confirm Trip`}
      </button>
    </div>
  ) : null;

  // Live Calculations (Zero hardcoding - driven by admin settings)
  const enteredFare = Number(fare) || 0;
  const commPct = view.commissionConfig?.totalCommissionPercent ?? 10;
  const advPct = view.commissionConfig?.defaultAdvancePercent ?? 15;
  const minAdv = view.commissionConfig?.minAdvanceAmount ?? 500;
  const minThreshold = view.commissionConfig?.minDriverPayoutThreshold ?? 100;
  // Same rule as the server: pay to the UPI / bank of the last settled payout
  const savedPayout = wallet?.history?.find((p) => p.status === "SETTLED");
  const hasSavedMethod = Boolean(savedPayout && (savedPayout.method !== "UPI" || savedPayout.upiId));

  const calculatedAdvance = Math.max(minAdv, Math.round(enteredFare * (advPct / 100)));
  const calculatedCommission = Math.round(enteredFare * (commPct / 100));
  const calculatedCashToCollect = Math.max(0, enteredFare - calculatedAdvance);
  const calculatedWalletExcess = Math.max(0, calculatedAdvance - calculatedCommission);
  const calculatedTotalEarnings = calculatedCashToCollect + calculatedWalletExcess;

  return (
    <div className="min-h-screen bg-[#F7FAF7] text-[#181C1B] antialiased selection:bg-[#14422D]/15 selection:text-[#14422D]">
      {/* Driver Header */}
      <header className="sticky top-0 z-30 border-b border-[#E5E8E5]/80 bg-white/85 backdrop-blur-xl px-4 py-3 shadow-[0_4px_20px_-4px_rgba(20,66,45,0.03)]">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#14422D] text-white font-serif font-black text-xs shadow-xs">
              SC
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-bold text-xs text-[#181C1B] tracking-tight">{siteConfig.appName} Driver Portal</span>
                <span className="rounded-full bg-[#14422D]/8 px-2 py-0.5 text-[9px] font-bold text-[#14422D] border border-[#14422D]/15">
                  Verified
                </span>
              </div>
              <p className="text-[11px] text-[#717973] font-mono tracking-wide">Trip #{view.reference}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {view.driverName && (
              <span className="text-xs font-semibold text-[#14422D] bg-[#ECEFEB] border border-[#E5E8E5] rounded-full px-3 py-1">
                {view.driverName}
              </span>
            )}
          </div>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="mx-auto max-w-md mt-3 pt-2.5 border-t border-[#ECEFEB]">
          <div className="flex rounded-2xl bg-[#ECEFEB] p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("trip")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "trip"
                  ? "bg-[#14422D] text-white shadow-xs"
                  : "text-[#717973] hover:text-[#181C1B]"
              }`}
            >
              <Icon name="local_taxi" className="text-sm" /> Trip Console
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("wallet");
                fetchWallet();
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "wallet"
                  ? "bg-[#14422D] text-white shadow-xs"
                  : "text-[#717973] hover:text-[#181C1B]"
              }`}
            >
              <Icon name="account_balance_wallet" className="text-sm" />
              <span>Wallet</span>
              {wallet && wallet.available > 0 && (
                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                  activeTab === "wallet" ? "bg-white/20 text-white" : "bg-[#14422D] text-white"
                }`}>
                  {inr(wallet.available)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-4">
        {activeTab === "wallet" ? (
          /* SOVEREIGN DRIVER WALLET & UPI PAYOUT CONSOLE */
          <div className="space-y-4">
            <div className="rounded-3xl border border-[#14422D]/15 bg-gradient-to-br from-[#14422D]/8 via-white to-[#14422D]/4 p-6 shadow-[0_10px_30px_-4px_rgba(20,66,45,0.06)] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#14422D]">Available Driver Balance</span>
                  <div className="text-4xl font-serif font-bold text-[#14422D] mt-1 tracking-tight">
                    {walletLoading ? "…" : inr(wallet?.available ?? 0)}
                  </div>
                </div>
                <div className="h-13 w-13 rounded-2xl bg-[#14422D] text-white flex items-center justify-center shadow-md">
                  <Icon name="account_balance_wallet" className="text-2xl" />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/95 border border-[#E5E8E5] text-xs text-[#717973] space-y-2">
                <div className="flex justify-between items-center">
                  <span>Completed Eligible Trips:</span>
                  <span className="font-bold text-[#181C1B]">{wallet?.eligibleTrips ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Minimum Payout Threshold:</span>
                  <span className="font-semibold text-[#181C1B]">{inr(minThreshold)}</span>
                </div>
              </div>

              {/* Pending Payout Banner */}
              {wallet?.pendingPayout ? (
                <div className="rounded-2xl border border-amber-300/80 bg-amber-50/80 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <Icon name="hourglass_empty" className="text-sm animate-pulse text-amber-700" /> Payout Request Under Processing
                  </div>
                  <p className="text-xs text-amber-950 font-serif font-bold">
                    Amount: {inr(wallet.pendingPayout.amount)}
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Admin has received your request. The amount will be transferred directly to your UPI ID and the bank UTR will be recorded.
                  </p>
                </div>
              ) : (
                /* Withdrawal: paid only to the driver's saved UPI / bank */
                <div className="space-y-3 pt-2 border-t border-[#14422D]/10">
                  <label className="text-xs font-bold text-[#181C1B] block">
                    Withdraw to Saved UPI
                  </label>
                  {!hasSavedMethod ? (
                    <p className="text-xs text-[#717973] leading-relaxed">{noSavedMethodText}</p>
                  ) : (
                  <>
                  <p className="text-xs text-[#717973] leading-relaxed">
                    Paid to {savedPayout?.upiId ? `your UPI ${savedPayout.upiId}` : "your saved bank account"}. Funds are transferred manually by {siteConfig.appName} Admin.
                  </p>

                  <button
                    type="button"
                    disabled={payoutBusy || (wallet?.available ?? 0) < minThreshold}
                    onClick={requestPayout}
                    className="w-full rounded-2xl bg-[#14422D] py-3.5 text-xs font-bold text-white shadow-[0_8px_20px_-4px_rgba(20,66,45,0.25)] hover:bg-[#0B2519] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  >
                    <Icon name="bolt" className="text-sm" />
                    <span>
                      {payoutBusy
                        ? "Submitting Request…"
                        : (wallet?.available ?? 0) < minThreshold
                        ? `Min Balance ${inr(minThreshold)} Required`
                        : `Withdraw ${inr(wallet?.available ?? 0)}`}
                    </span>
                  </button>
                  </>
                  )}
                </div>
              )}

              {payoutMessage && (
                <div className="rounded-2xl bg-emerald-50 border border-[#14422D]/20 p-3 text-center text-xs font-semibold text-[#14422D]">
                  {payoutMessage}
                </div>
              )}
            </div>

            {/* Payout Settlement History */}
            <div className="rounded-3xl border border-[#E5E8E5] bg-white p-5 shadow-[0_4px_20px_-4px_rgba(20,66,45,0.04)] space-y-3.5">
              <h4 className="text-xs font-bold text-[#181C1B] flex items-center gap-2">
                <Icon name="history" className="text-sm text-[#717973]" /> Payout & Settlement History
              </h4>

              {wallet?.history && wallet.history.length > 0 ? (
                <div className="space-y-2.5">
                  {wallet.history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl border border-[#ECEFEB] bg-[#F7FAF7] space-y-1.5 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-serif font-bold text-sm text-[#181C1B]">{inr(item.amount)}</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === "SETTLED"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : item.status === "REJECTED"
                              ? "bg-red-50 text-red-800 border border-red-200"
                              : "bg-amber-50 text-amber-900 border border-amber-200"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#717973] flex justify-between">
                        <span>UPI: {item.upiId || "Bank"}</span>
                        <span>
                          {item.requestedAt ? istDate(item.requestedAt) : ""}
                        </span>
                      </div>
                      {item.settlementReference && (
                        <div className="pt-1.5 border-t border-[#E5E8E5] text-[11px] text-[#14422D] font-mono flex items-center gap-1.5 font-bold">
                          <Icon name="check_circle" className="text-xs" /> UTR / Ref: {item.settlementReference}
                        </div>
                      )}
                      {item.rejectionReason && (
                        <div className="pt-1.5 border-t border-red-200 text-[11px] text-red-800">
                          Reason: {item.rejectionReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#717973] text-center py-4">No payout requests yet.</p>
              )}
            </div>

            {/* Eligible Trips Breakdown */}
            {wallet?.trips && wallet.trips.length > 0 && (
              <div className="rounded-3xl border border-[#E5E8E5] bg-white p-5 shadow-[0_4px_20px_-4px_rgba(20,66,45,0.04)] space-y-3">
                <h4 className="text-xs font-bold text-[#181C1B] flex items-center gap-2">
                  <Icon name="receipt_long" className="text-sm text-[#717973]" /> Trips Credited to Wallet
                </h4>
                <div className="space-y-2">
                  {wallet.trips.map((t) => (
                    <div
                      key={t.reference}
                      className="flex justify-between items-center p-3 rounded-2xl bg-[#F7FAF7] border border-[#ECEFEB] text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#181C1B]">Trip #{t.reference}</span>
                        <span className="text-[10px] text-[#717973] block">
                          {istDate(Number(t.date))}
                        </span>
                      </div>
                      <span className="font-serif font-bold text-sm text-[#14422D]">+{inr(t.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ACTIVE TRIP CONSOLE */
          <div className="space-y-4">
            {/* Live GPS Return Match Banner */}
            <div className="flex items-center justify-between rounded-3xl border border-[#14422D]/15 bg-gradient-to-r from-emerald-50/90 via-white to-[#14422D]/5 p-4 shadow-xs text-xs">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#14422D]/10 text-[#14422D] flex items-center justify-center shrink-0">
                  <Icon name="my_location" className="text-xl" />
                </div>
                <div>
                  <p className="font-bold text-[#14422D]">
                    {gpsStatus || "Live Return Match Ready"}
                  </p>
                  <p className="text-[11px] text-[#717973] leading-tight">
                    Auto-matches return rides when you reach NJP, Bagdogra, or Darjeeling
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  sendLocationPing();
                  setGpsStatus("Updating GPS…");
                }}
                className="rounded-xl bg-[#14422D] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0B2519] cursor-pointer shrink-0 transition-all"
              >
                Share GPS
              </button>
            </div>

            {/* Trip Overview Card */}
            <div className="rounded-3xl border border-[#E5E8E5] bg-white p-6 shadow-[0_10px_30px_-4px_rgba(20,66,45,0.05)] space-y-4">
              <div className="flex items-center justify-between border-b border-[#ECEFEB] pb-3.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#717973]">Homestay Origin</span>
                  <h2 className="text-base font-serif font-bold text-[#181C1B]">{view.homestayName || "Partner Homestay"}</h2>
                </div>
                <span className="rounded-full bg-[#14422D]/8 border border-[#14422D]/15 px-3 py-1 text-xs font-semibold text-[#14422D]">
                  {view.vehicleType} · {view.passengers} Pax
                </span>
              </div>

              {/* Route Timeline */}
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center mt-1">
                    <div className="h-3 w-3 rounded-full bg-[#14422D]" />
                    <div className="h-8 w-0.5 bg-[#E5E8E5] my-0.5" />
                    <div className="h-3 w-3 rounded-full bg-red-600" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#717973]">Pickup Location</span>
                      <p className="font-semibold text-xs text-[#181C1B]">{view.pickup}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#717973]">Drop Destination</span>
                      <p className="font-semibold text-xs text-[#181C1B]">{view.destination}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#ECEFEB] flex items-center gap-2.5">
                  <Icon name="calendar_today" className="text-sm text-[#717973] shrink-0" />
                  <div>
                    <span className="text-[10px] font-medium text-[#717973]">Pickup Schedule: </span>
                    <span className="font-semibold text-xs text-[#181C1B]">{when}</span>
                  </div>
                </div>

                {view.isRoundTrip && (
                  <div className="rounded-2xl bg-[#14422D]/6 border border-[#14422D]/15 p-3 text-[#14422D] font-semibold text-xs">
                    Round trip return scheduled: {view.returnDate ? `${new Date(Number(view.returnDate)).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}${view.returnTime ? ` at ${view.returnTime}` : ""}` : ""}
                  </div>
                )}
              </div>
            </div>

            {/* State Handlers */}
            {view.driverView === "TAKEN" && view.status !== "CANCELLED" ? (
              <div className="rounded-3xl border border-[#E5E8E5] bg-[#F7FAF7] p-5 text-xs text-[#717973] font-medium text-center">
                This trip went to another driver.
              </div>
            ) : view.driverView === "REASSIGNED" ? (
              <div className="rounded-3xl border border-[#E5E8E5] bg-[#F7FAF7] p-5 text-xs text-[#717973] font-medium text-center">
                This trip was given to another driver.
              </div>
            ) : view.driverView === "EXPIRED" || view.status === "EXPIRED" ? (
              <div className="rounded-3xl border border-[#E5E8E5] bg-[#F7FAF7] p-5 text-xs text-[#717973] font-medium text-center">
                Pickup time passed.
              </div>
            ) : view.status === "CANCELLED" || view.driverView === "CANCELLED" ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-xs text-red-800 font-medium">
                {view.cancellationReason ? `This trip was cancelled: ${view.cancellationReason}` : "This trip request was cancelled."}
              </div>
            ) : view.assignedToMe && view.advancePaid ? (
              /* CONFIRMED TRIP MANAGEMENT CONSOLE */
              <div className="rounded-3xl border border-[#14422D]/25 bg-white p-6 shadow-[0_12px_36px_-6px_rgba(20,66,45,0.07)] space-y-5">
                <div className="flex items-center justify-between border-b border-[#ECEFEB] pb-3.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#14422D]/10 px-3 py-1 text-xs font-bold text-[#14422D] border border-[#14422D]/20">
                    <Icon name="check_circle" className="text-xs" /> Trip Confirmed With You
                  </span>
                  <span className="rounded-full bg-[#ECEFEB] border border-[#E5E8E5] px-3 py-1 text-xs font-semibold text-[#717973]">
                    {view.status === "COMPLETED" ? "Completed" : view.status === "TRIP_STARTED" ? "Ride in Progress" : "Ready for Pickup"}
                  </span>
                </div>

                {/* Passenger Contact Card */}
                {view.guestName && (
                  <div className="rounded-2xl bg-[#F7FAF7] border border-[#E5E8E5] p-4 space-y-3">
                    <div>
                      <span className="text-[10px] text-[#717973] font-bold uppercase tracking-wider block">Passenger Name</span>
                      <p className="font-serif font-bold text-base text-[#181C1B]">{view.guestName}</p>
                    </div>
                    {view.phone && (
                      <div className="flex gap-2.5 pt-1">
                        <a
                          href={`tel:${view.phone}`}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14422D] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#0B2519] transition-all"
                        >
                          <Icon name="phone" className="text-xs" /> Call Passenger
                        </a>
                        <a
                          href={`https://wa.me/${waNumber(view.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3 text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all"
                        >
                          <Icon name="chat" className="text-xs" /> WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation Deeplink */}
                <a
                  href={(view.pickupLat && view.pickupLng)
                    ? `https://www.google.com/maps/dir/?api=1&destination=${view.pickupLat},${view.pickupLng}`
                    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(view.pickup)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600/95 py-3 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-all"
                >
                  <Icon name="navigation" className="text-sm" />
                  <span>🗺️ Navigate to Pickup</span>
                </a>

                {/* Cash Collection Banner */}
                {typeof view.remainingCashAmount === "number" && view.remainingCashAmount > 0 && (
                  <div className="rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50 to-orange-50/40 p-5 space-y-1.5">
                    <span className="text-[11px] font-bold text-amber-950 uppercase tracking-wide">
                      Cash to Collect at Drop-Off
                    </span>
                    <p className="text-3xl font-serif font-bold text-amber-950">{inr(view.remainingCashAmount)}</p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Collect directly from passenger in cash or personal UPI. The rest is already credited to your wallet.
                    </p>
                  </div>
                )}

                {/* Start Ride / Complete Ride Actions */}
                {view.status !== "COMPLETED" && (
                  <div className="space-y-2.5 pt-1">
                    {view.status !== "TRIP_STARTED" && (
                      <>
                        {showOtpModal ? (
                          <div className="rounded-2xl border border-[#14422D]/30 bg-emerald-50/70 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#14422D]">Enter Passenger Boarding PIN:</span>
                              <button
                                type="button"
                                onClick={() => { setShowOtpModal(false); setOtpDigits(["","","",""]); }}
                                className="text-xs text-[#717973] hover:underline cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                            <p className="text-xs text-[#717973] leading-relaxed">
                              Ask passenger for the 4-digit PIN displayed on their booking confirmation.
                            </p>
                            <div className="flex gap-2.5 justify-center">
                              {[0, 1, 2, 3].map((i) => (
                                <input
                                  key={i}
                                  id={`otp-d-${i}`}
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={1}
                                  value={otpDigits[i]}
                                  onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Backspace" && !otpDigits[i] && i > 0) {
                                      const prev = document.getElementById(`otp-d-${i - 1}`);
                                      if (prev) (prev as HTMLInputElement).focus();
                                    }
                                  }}
                                  className="w-12 h-14 font-mono text-center text-2xl font-bold rounded-2xl border-2 border-[#E5E8E5] bg-white text-[#181C1B] focus:border-[#14422D] focus:ring-2 focus:ring-[#14422D]/15 focus:outline-none transition-all"
                                />
                              ))}
                            </div>
                            <button
                              type="button"
                              disabled={busy || otp.length < 4}
                              onClick={() => handleTripAction("start", otp)}
                              className="w-full rounded-2xl bg-[#14422D] px-4 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#0B2519] disabled:opacity-50 cursor-pointer transition-all"
                            >
                              {busy ? "Verifying…" : "Verify & Start Ride"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (view.pickupOtpRequired) {
                                setShowOtpModal(true);
                              } else {
                                handleTripAction("start");
                              }
                            }}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E5E8E5] bg-white py-3 text-xs font-bold text-[#181C1B] hover:bg-[#ECEFEB] cursor-pointer disabled:opacity-50 transition-all shadow-xs"
                          >
                            <Icon name="play_arrow" className="text-sm text-[#14422D]" />
                            <span>{busy ? "Updating…" : "Start Ride"}</span>
                          </button>
                        )}
                      </>
                    )}

                    {showCompleteConfirm ? (
                      <div className="rounded-2xl border-2 border-[#14422D] bg-emerald-50/80 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <Icon name="check_circle" className="text-[#14422D] text-lg" />
                          <span className="text-xs font-bold text-[#14422D]">Confirm Ride Completion & Cash Collection</span>
                        </div>
                        <p className="text-xs text-[#181C1B] leading-relaxed">
                          Did you drop off the passenger and collect{" "}
                          <strong className="font-extrabold text-[#14422D]">
                            {view.remainingCashAmount ? inr(view.remainingCashAmount) : "cash balance"}
                          </strong>
                          ?
                        </p>
                        <div className="flex gap-2.5 pt-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setShowCompleteConfirm(false);
                              handleTripAction("complete");
                            }}
                            className="flex-1 rounded-2xl bg-[#14422D] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#0B2519] disabled:opacity-50 cursor-pointer transition-all"
                          >
                            {busy ? "Completing…" : "Yes, Completed & Collected"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowCompleteConfirm(false)}
                            className="rounded-2xl border border-[#E5E8E5] bg-white px-4 py-3 text-xs font-semibold text-[#717973] hover:bg-[#ECEFEB] cursor-pointer transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setShowCompleteConfirm(true)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14422D] py-3.5 text-xs font-bold text-white shadow-[0_8px_20px_-4px_rgba(20,66,45,0.25)] hover:bg-[#0B2519] cursor-pointer disabled:opacity-50 transition-all"
                      >
                        <Icon name="done_all" className="text-sm" />
                        <span>{busy ? "Completing…" : "Complete Ride & Confirm Cash"}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Standby Vehicle Swap (for Syndicate Standby / Breakdown Replacement) */}
                {view.status !== "COMPLETED" && (
                  <div className="pt-3 border-t border-[#ECEFEB]">
                    {showPlateModal ? (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-950">Update Standby Vehicle Plate:</span>
                          <button
                            type="button"
                            onClick={() => { setShowPlateModal(false); setStandbyPlate(""); }}
                            className="text-xs text-[#717973] hover:underline cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="text-[11px] text-[#717973] leading-relaxed">
                          If sending a different union cab or substitute car today, enter the new plate number. An automated WhatsApp alert will update the passenger.
                        </p>
                        <input
                          type="text"
                          value={standbyPlate}
                          onChange={(e) => setStandbyPlate(e.target.value.toUpperCase())}
                          placeholder="e.g. WB74E5555"
                          className="w-full rounded-2xl border border-[#E5E8E5] bg-white px-3.5 py-2.5 text-xs font-semibold uppercase text-[#181C1B] focus:border-blue-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={plateBusy || !standbyPlate.trim()}
                          onClick={updateStandbyVehicle}
                          className="w-full rounded-2xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-all"
                        >
                          {plateBusy ? "Updating Plate…" : "Save Plate & Alert Passenger"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowPlateModal(true)}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Icon name="local_taxi" className="text-sm" />
                        <span>Substitute / Standby Vehicle Plate Swap</span>
                      </button>
                    )}
                    {plateMessage && (
                      <p className="mt-1 text-xs font-medium text-blue-800">{plateMessage}</p>
                    )}
                  </div>
                )}

                {view.status === "COMPLETED" && (
                  <div className="rounded-2xl bg-emerald-50 border border-[#14422D]/20 p-4 text-center text-xs font-semibold text-[#14422D]">
                    Trip completed and settled. Thank you for providing safe mountain transit!
                  </div>
                )}
              </div>
            ) : view.assignedToMe ? (
              <div className="rounded-3xl border border-amber-300/80 bg-amber-50/70 p-6 text-xs text-amber-950 space-y-1.5">
                <span className="font-serif font-bold text-sm block">Trip Awarded to You</span>
                <p className="text-[#717973] leading-relaxed">Waiting for guest advance payment. Passenger contact and cash collection will unlock here immediately upon payment.</p>
              </div>
            ) : !view.canQuote ? (
              counterOffer || (
                <div className="rounded-3xl border border-[#E5E8E5] bg-white p-6 text-center text-xs text-[#717973]">
                  This trip request is no longer taking quotes.
                </div>
              )
            ) : (
              /* FARE QUOTATION FORM WITH ALL-INCLUSIVE MATHEMATICAL BREAKDOWN */
              <div className="rounded-3xl border border-[#E5E8E5] bg-white p-6 shadow-[0_10px_30px_-4px_rgba(20,66,45,0.05)] space-y-5">
                <div>
                  <h3 className="font-serif font-bold text-base text-[#181C1B]">Submit Your Total Fare Quote</h3>
                  <p className="text-xs text-[#717973] mt-0.5">Quote the total fare. Guest pays flat all-inclusive rate with zero extra booking fee.</p>
                </div>

                {view.guestBudget && (
                  <div className="rounded-2xl border border-blue-200/80 bg-blue-50/80 p-3 text-xs text-blue-950 font-medium flex items-center justify-between">
                    <span>Passenger Target Budget:</span>
                    <strong className="font-serif font-bold text-sm text-blue-950">{inr(view.guestBudget)}</strong>
                  </div>
                )}

                {counterOffer}

                {q && !counter && (
                  <div className="rounded-2xl bg-[#F7FAF7] border border-[#E5E8E5] p-4 text-xs text-[#717973] space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Your Quoted Fare:</span>
                      <strong className="font-serif font-bold text-base text-[#14422D]">{inr(q.quotedFare)}</strong>
                    </div>
                    <div className="text-[11px] text-[#717973] flex justify-between">
                      <span>Status:</span>
                      <span className="font-semibold text-[#181C1B]">{q.status === "PENDING" ? "Waiting for window close" : q.status}</span>
                    </div>
                  </div>
                )}

                {/* Quick Fare Shortcut Pills */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-[#717973] block">
                    Quick-Select Total Fare:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[1800, 2200, 2600, 3000, 3400, 3800].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setFare(String(amount))}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                          fare === String(amount)
                            ? "bg-[#14422D] text-white shadow-xs"
                            : "bg-[#ECEFEB] border border-[#E5E8E5] text-[#181C1B] hover:bg-[#E5E8E5]"
                        }`}
                      >
                        {inr(amount)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Fare Input */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#181C1B] block">
                    Total Ride Fare (₹) *
                  </label>
                  <span className="text-[11px] text-[#717973] block">
                    Enter the total price. Guest pays {advPct}% (min {inr(minAdv)}) online advance, the rest in cash directly to you.
                  </span>
                  <div className="flex gap-2.5">
                    <span className="flex items-center rounded-2xl bg-[#ECEFEB] border border-[#E5E8E5] px-4 text-sm font-serif font-bold text-[#14422D]">
                      ₹
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fare}
                      onChange={(e) => setFare(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 3000"
                      className="w-full rounded-2xl border border-[#E5E8E5] px-4 py-3 text-sm font-bold text-[#181C1B] focus:border-[#14422D] focus:ring-2 focus:ring-[#14422D]/15 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Real-time Math Breakdown */}
                  {enteredFare > 0 && (
                    <div className="mt-3 rounded-2xl bg-gradient-to-br from-[#14422D]/6 via-[#14422D]/3 to-transparent border border-[#14422D]/20 p-4 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center text-[#181C1B] pb-2 border-b border-[#14422D]/15">
                        <span className="font-bold">Total Fare Quoted (All-Inclusive):</span>
                        <strong className="text-base font-serif font-bold text-[#14422D]">{inr(enteredFare)}</strong>
                      </div>

                      <div className="space-y-2 text-[11px] text-[#181C1B]">
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1.5">
                            <Icon name="payments" className="text-xs text-amber-600" />
                            <span>1. Cash you collect in car at drop-off:</span>
                          </span>
                          <strong className="font-extrabold text-[#181C1B]">{inr(calculatedCashToCollect)}</strong>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1.5">
                            <Icon name="account_balance_wallet" className="text-xs text-[#14422D]" />
                            <span>2. Credited to your platform wallet:</span>
                          </span>
                          <strong className="font-extrabold text-[#14422D]">+{inr(calculatedWalletExcess)}</strong>
                        </div>

                        <div className="flex justify-between items-center text-[#717973]">
                          <span className="flex items-center gap-1.5">
                            <Icon name="percent" className="text-xs" />
                            <span>Platform & Homestay Commission ({commPct}%):</span>
                          </span>
                          <span className="font-semibold text-red-600">-{inr(calculatedCommission)}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#14422D]/15 flex justify-between items-center">
                        <span className="font-extrabold text-[#181C1B] text-xs">Your Net Total In-Hand:</span>
                        <span className="text-lg font-serif font-bold text-[#14422D]">
                          {inr(calculatedTotalEarnings)} ({100 - commPct}%)
                        </span>
                      </div>

                      <p className="pt-1 text-[11px] text-[#14422D] leading-relaxed">
                        🛡️ Zero extra fee on top. The guest sees flat {inr(enteredFare)}. You collect {inr(calculatedCashToCollect)} cash, and {inr(calculatedWalletExcess)} is in your wallet for 1-tap UPI withdrawal.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#181C1B] block">
                    Vehicle Number Plate (Optional)
                  </label>
                  <span className="text-[11px] text-[#717973] block">
                    If driving a syndicate/union cab or different vehicle today (e.g. WB 74 B 1234)
                  </span>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="e.g. WB74B1234 (Auto-uses your profile plate if blank)"
                    className="w-full rounded-2xl border border-[#E5E8E5] px-4 py-2.5 text-xs font-semibold text-[#181C1B] uppercase focus:border-[#14422D] focus:ring-2 focus:ring-[#14422D]/15 focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#181C1B] block">
                    Vehicle Notes (Optional, no phone numbers)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, 300))}
                    placeholder="e.g. Bolero 4WD, luggage carrier on roof, clean seats"
                    className="w-full rounded-2xl border border-[#E5E8E5] px-4 py-2.5 text-xs text-[#181C1B] focus:border-[#14422D] focus:ring-2 focus:ring-[#14422D]/15 focus:outline-none transition-all"
                  />
                </div>

                <button
                  type="button"
                  disabled={busy || !(enteredFare > 0)}
                  onClick={() => send("quote")}
                  className="w-full rounded-2xl bg-[#14422D] py-3.5 text-xs font-bold text-white shadow-[0_8px_20px_-4px_rgba(20,66,45,0.25)] hover:bg-[#0B2519] cursor-pointer disabled:opacity-50 transition-all"
                >
                  {busy ? "Submitting…" : q ? "Update Fare Quote" : "Submit Fare Quote"}
                </button>
              </div>
            )}

            {message && (
              <div className="rounded-2xl bg-blue-50 border border-blue-200/80 p-3.5 text-center text-xs font-semibold text-blue-950">
                {message}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function DriverQuotePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-emerald-700 font-medium">Loading…</div>}>
      <DriverQuoteContent />
    </Suspense>
  );
}
