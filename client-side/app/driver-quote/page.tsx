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
  driverView?: string;
  canQuote: boolean;
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

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

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
  const [upiId, setUpiId] = useState("");
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState("");

  const otp = otpDigits.join("");

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
      if (fullOtp.length === 4) {
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
    if (!token) return;

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
  }, [token, sendLocationPing]);

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
      setMessage(e instanceof Error ? e.message : "Could not send. Please try again.");
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

      // Upon trip completion, update driver GPS coordinates at the drop-off location
      if (action === "complete" && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            apiFetch(API_ENDPOINTS.driverQuote.location(), {
              method: "POST",
              body: JSON.stringify({
                t: token,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              }),
            }).catch(() => {});
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const requestPayout = async () => {
    if (!token || !upiId.trim()) return;
    setPayoutBusy(true);
    setPayoutMessage("");
    try {
      const res = await apiFetch<{ success?: boolean; message?: string }>(API_ENDPOINTS.driverQuote.requestPayout(), {
        method: "POST",
        body: JSON.stringify({ t: token, method: "UPI", upiId: upiId.trim() }),
      });
      setPayoutMessage(res.message || "Payout request submitted! Admin will transfer funds via UPI.");
      setUpiId("");
      await fetchWallet();
    } catch (e) {
      setPayoutMessage(e instanceof Error ? e.message : "Payout request failed. Please check your UPI ID.");
    } finally {
      setPayoutBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-xs font-medium text-[#57606A]">Loading Trip Details…</p>
        </div>
      </div>
    );
  }

  if (error || !view) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="mx-auto max-w-md w-full rounded-2xl border border-[#D0D7DE] bg-white p-8 text-center space-y-3 shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Icon name="error_outline" className="text-2xl" />
          </div>
          <h1 className="text-base font-bold text-[#1F2328]">Trip Link Not Available</h1>
          <p className="text-xs text-[#57606A]">{error || "This trip request has expired or was already assigned."}</p>
        </div>
      </div>
    );
  }

  const q = view.myQuote;
  const counter = q?.status === "PENDING" && q.counterFare ? q.counterFare : null;
  const when = `${new Date(Number(view.date)).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" })}${view.time ? ` at ${view.time}` : ""}`;

  // Live Calculations (Zero hardcoding - driven by admin settings)
  const enteredFare = Number(fare) || 0;
  const commPct = view.commissionConfig?.totalCommissionPercent ?? 10;
  const advPct = view.commissionConfig?.defaultAdvancePercent ?? 15;
  const minAdv = view.commissionConfig?.minAdvanceAmount ?? 500;
  const minThreshold = view.commissionConfig?.minDriverPayoutThreshold ?? 100;

  const calculatedAdvance = Math.max(minAdv, Math.round(enteredFare * (advPct / 100)));
  const calculatedCommission = Math.round(enteredFare * (commPct / 100));
  const calculatedCashToCollect = Math.max(0, enteredFare - calculatedAdvance);
  const calculatedWalletExcess = Math.max(0, calculatedAdvance - calculatedCommission);
  const calculatedTotalEarnings = calculatedCashToCollect + calculatedWalletExcess;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1F2328] antialiased">
      {/* Driver Header */}
      <header className="sticky top-0 z-30 border-b border-[#E1E4E8] bg-white/95 backdrop-blur-md px-4 py-3 shadow-xs">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
              SR
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-[#1F2328]">{siteConfig.appName} Driver Portal</span>
                <span className="rounded bg-emerald-50 px-1 py-0.2 text-[9px] font-bold text-emerald-800 border border-emerald-200">
                  Verified
                </span>
              </div>
              <p className="text-[10px] text-[#57606A] font-mono">Trip #{view.reference}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {view.driverName && (
              <span className="text-xs font-semibold text-[#57606A] bg-[#F6F8FA] border border-[#D0D7DE] rounded-full px-2.5 py-1">
                {view.driverName}
              </span>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mx-auto max-w-md mt-2.5 pt-2 border-t border-[#E1E4E8] flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("trip")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "trip"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-[#F6F8FA] text-[#57606A] hover:bg-[#E1E4E8]"
            }`}
          >
            <Icon name="local_taxi" className="text-xs" /> Trip Console
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("wallet");
              fetchWallet();
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "wallet"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-[#F6F8FA] text-[#57606A] hover:bg-[#E1E4E8]"
            }`}
          >
            <Icon name="account_balance_wallet" className="text-xs" />
            <span>Wallet</span>
            {wallet && wallet.available > 0 && (
              <span className={`px-1.5 py-0.2 text-[10px] font-extrabold rounded-full ${
                activeTab === "wallet" ? "bg-white text-emerald-800" : "bg-emerald-600 text-white"
              }`}>
                {inr(wallet.available)}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-4">
        {activeTab === "wallet" ? (
          /* SOVEREIGN DRIVER WALLET & UPI PAYOUT CONSOLE */
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Available Driver Balance</span>
                  <div className="text-3xl font-black text-emerald-900 mt-0.5">
                    {walletLoading ? "…" : inr(wallet?.available ?? 0)}
                  </div>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Icon name="account_balance_wallet" className="text-2xl" />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-emerald-200 text-xs text-[#57606A] space-y-1">
                <div className="flex justify-between items-center">
                  <span>Completed Eligible Trips:</span>
                  <span className="font-bold text-[#1F2328]">{wallet?.eligibleTrips ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Minimum Payout Threshold:</span>
                  <span className="font-semibold text-[#1F2328]">{inr(minThreshold)}</span>
                </div>
              </div>

              {/* Pending Payout Banner */}
              {wallet?.pendingPayout ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <Icon name="hourglass_empty" className="text-sm animate-pulse" /> Payout Request Under Processing
                  </div>
                  <p className="text-xs text-amber-950 font-extrabold">
                    Amount: {inr(wallet.pendingPayout.amount)}
                  </p>
                  <p className="text-[11px] text-amber-800 leading-tight">
                    Admin has received your request. The amount will be transferred directly to your UPI ID and the bank UTR will be recorded.
                  </p>
                </div>
              ) : (
                /* Instant UPI Withdrawal Request Form */
                <div className="space-y-2.5 pt-1 border-t border-emerald-200">
                  <label className="text-xs font-bold text-[#1F2328] block">
                    Instant UPI Withdrawal
                  </label>
                  <p className="text-[11px] text-[#57606A]">
                    Enter your GPay / PhonePe / Paytm UPI ID. Funds are transferred manually by {siteConfig.appName} Admin.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value.trim())}
                      placeholder="e.g. 9832012345@paytm or name@oksbi"
                      className="flex-1 rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs font-medium text-[#1F2328] bg-white focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={payoutBusy || !upiId.trim() || (wallet?.available ?? 0) < minThreshold}
                    onClick={requestPayout}
                    className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Icon name="bolt" className="text-sm" />
                    <span>
                      {payoutBusy
                        ? "Submitting Request…"
                        : (wallet?.available ?? 0) < minThreshold
                        ? `Min Balance ${inr(minThreshold)} Required`
                        : `Withdraw ${inr(wallet?.available ?? 0)} via UPI`}
                    </span>
                  </button>
                </div>
              )}

              {payoutMessage && (
                <div className="rounded-xl bg-emerald-100 border border-emerald-300 p-2.5 text-center text-xs font-semibold text-emerald-950">
                  {payoutMessage}
                </div>
              )}
            </div>

            {/* Payout Settlement History */}
            <div className="rounded-2xl border border-[#D0D7DE] bg-white p-4 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-[#1F2328] flex items-center gap-1.5">
                <Icon name="history" className="text-sm text-[#57606A]" /> Payout & Settlement History
              </h4>

              {wallet?.history && wallet.history.length > 0 ? (
                <div className="space-y-2">
                  {wallet.history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-[#E1E4E8] bg-[#F6F8FA] space-y-1 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-[#1F2328]">{inr(item.amount)}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === "SETTLED"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : item.status === "REJECTED"
                              ? "bg-red-100 text-red-800 border border-red-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#57606A] flex justify-between">
                        <span>UPI: {item.upiId || "Bank"}</span>
                        <span>
                          {item.requestedAt ? new Date(item.requestedAt).toLocaleDateString("en-IN") : ""}
                        </span>
                      </div>
                      {item.settlementReference && (
                        <div className="pt-1 border-t border-[#E1E4E8] text-[10px] text-emerald-800 font-mono flex items-center gap-1">
                          <Icon name="check_circle" className="text-xs" /> UTR / Ref: {item.settlementReference}
                        </div>
                      )}
                      {item.rejectionReason && (
                        <div className="pt-1 border-t border-red-200 text-[10px] text-red-800">
                          Reason: {item.rejectionReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#57606A] text-center py-4">No payout requests yet.</p>
              )}
            </div>

            {/* Eligible Trips Breakdown */}
            {wallet?.trips && wallet.trips.length > 0 && (
              <div className="rounded-2xl border border-[#D0D7DE] bg-white p-4 shadow-xs space-y-2.5">
                <h4 className="text-xs font-bold text-[#1F2328] flex items-center gap-1.5">
                  <Icon name="receipt_long" className="text-sm text-[#57606A]" /> Trips Credited to Wallet
                </h4>
                <div className="space-y-1.5">
                  {wallet.trips.map((t) => (
                    <div
                      key={t.reference}
                      className="flex justify-between items-center p-2 rounded-lg bg-[#F8F9FA] border border-[#E1E4E8] text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#1F2328]">Trip #{t.reference}</span>
                        <span className="text-[10px] text-[#57606A] block">
                          {new Date(Number(t.date)).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                      <span className="font-extrabold text-emerald-700">+{inr(t.amount)}</span>
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
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs">
              <div className="flex items-center gap-2">
                <Icon name="my_location" className="text-emerald-700 text-base shrink-0" />
                <div>
                  <p className="font-bold text-emerald-950">
                    {gpsStatus || "Live Return Match Ready"}
                  </p>
                  <p className="text-[10px] text-emerald-800">
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
                className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-800 cursor-pointer shrink-0"
              >
                Share GPS
              </button>
            </div>

            {/* Trip Overview Card */}
            <div className="rounded-2xl border border-[#D0D7DE] bg-white p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#E1E4E8] pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#57606A]">Homestay Origin</span>
                  <h2 className="text-sm font-bold text-[#1F2328]">{view.homestayName || "Partner Homestay"}</h2>
                </div>
                <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                  {view.vehicleType} · {view.passengers} Pax
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <Icon name="my_location" className="text-xs text-emerald-700 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[#57606A] block text-[10px]">Pickup:</span>
                    <span className="font-semibold text-[#1F2328]">{view.pickup}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Icon name="location_on" className="text-xs text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[#57606A] block text-[10px]">Destination:</span>
                    <span className="font-semibold text-[#1F2328]">{view.destination}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Icon name="calendar_today" className="text-xs text-[#57606A] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[#57606A] block text-[10px]">Pickup Schedule:</span>
                    <span className="font-semibold text-[#1F2328]">{when}</span>
                  </div>
                </div>

                {view.isRoundTrip && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-emerald-900 font-semibold text-[11px]">
                    Round trip return scheduled: {view.returnDate ? `${new Date(Number(view.returnDate)).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}${view.returnTime ? ` at ${view.returnTime}` : ""}` : ""}
                  </div>
                )}
              </div>
            </div>

            {/* State Handlers */}
            {view.status === "CANCELLED" || view.driverView === "CANCELLED" ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 font-medium">
                This trip request was cancelled by the homestay.
              </div>
            ) : view.assignedToMe && view.advancePaid ? (
              /* CONFIRMED TRIP MANAGEMENT CONSOLE */
              <div className="rounded-2xl border border-emerald-300 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#E1E4E8] pb-3">
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                    <Icon name="check_circle" className="text-xs" /> Trip Confirmed With You
                  </span>
                  <span className="rounded-full bg-[#F6F8FA] border border-[#D0D7DE] px-2.5 py-0.5 text-[10px] font-bold text-[#57606A]">
                    {view.status === "COMPLETED" ? "Completed" : view.status === "TRIP_STARTED" ? "Ride in Progress" : "Ready for Pickup"}
                  </span>
                </div>

                {/* Passenger Contact Card */}
                {view.guestName && (
                  <div className="rounded-xl bg-[#F6F8FA] border border-[#D0D7DE] p-3.5 space-y-2.5">
                    <div>
                      <span className="text-[10px] text-[#57606A] font-medium block">Passenger Name</span>
                      <p className="font-bold text-sm text-[#1F2328]">{view.guestName}</p>
                    </div>
                    {view.phone && (
                      <div className="flex gap-2 pt-1">
                        <a
                          href={`tel:${view.phone}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                        >
                          <Icon name="phone" className="text-xs" /> Call Passenger
                        </a>
                        <a
                          href={`https://wa.me/${view.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2.5 text-xs font-bold text-white shadow-xs hover:opacity-90"
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
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  <Icon name="navigation" className="text-sm" />
                  <span>🗺️ Navigate to Pickup</span>
                </a>

                {/* Cash Collection Banner */}
                {typeof view.remainingCashAmount === "number" && view.remainingCashAmount > 0 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-1">
                    <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide">
                      Cash to Collect at Drop-Off
                    </span>
                    <p className="text-2xl font-black text-amber-900">{inr(view.remainingCashAmount)}</p>
                    <p className="text-[10px] text-amber-800">
                      Collect directly from passenger in cash or personal UPI. The rest is already credited to your wallet.
                    </p>
                  </div>
                )}

                {/* Start Ride / Complete Ride Actions */}
                {view.status !== "COMPLETED" && (
                  <div className="space-y-2 pt-1">
                    {view.status !== "TRIP_STARTED" && (
                      <>
                        {showOtpModal ? (
                          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-950">Enter Passenger Boarding PIN:</span>
                              <button
                                type="button"
                                onClick={() => { setShowOtpModal(false); setOtpDigits(["","","",""]); }}
                                className="text-xs text-[#57606A] hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                            <p className="text-[11px] text-[#57606A]">
                              Ask passenger for the 4-digit PIN displayed on their booking confirmation.
                            </p>
                            <div className="flex gap-2 justify-center">
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
                                  className="w-12 h-12 font-mono text-center text-xl font-bold rounded-xl border-2 border-[#D0D7DE] bg-white text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                                />
                              ))}
                            </div>
                            <button
                              type="button"
                              disabled={busy || otp.length < 4}
                              onClick={() => handleTripAction("start", otp)}
                              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
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
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D0D7DE] bg-white py-2.5 text-xs font-bold text-[#1F2328] hover:bg-[#F6F8FA] cursor-pointer disabled:opacity-50"
                          >
                            <Icon name="play_arrow" className="text-sm text-emerald-700" />
                            <span>{busy ? "Updating…" : "Start Ride"}</span>
                          </button>
                        )}
                      </>
                    )}

                    {showCompleteConfirm ? (
                      <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Icon name="check_circle" className="text-emerald-700 text-lg" />
                          <span className="text-xs font-bold text-emerald-950">Confirm Ride Completion & Cash Collection</span>
                        </div>
                        <p className="text-xs text-emerald-900 leading-relaxed">
                          Did you drop off the passenger and collect{" "}
                          <strong className="font-extrabold text-emerald-950">
                            {view.remainingCashAmount ? inr(view.remainingCashAmount) : "cash balance"}
                          </strong>
                          ?
                        </p>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setShowCompleteConfirm(false);
                              handleTripAction("complete");
                            }}
                            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                          >
                            {busy ? "Completing…" : "Yes, Completed & Collected"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowCompleteConfirm(false)}
                            className="rounded-xl border border-[#D0D7DE] bg-white px-3 py-2.5 text-xs font-semibold text-[#57606A] hover:bg-[#F6F8FA] cursor-pointer"
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
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                      >
                        <Icon name="done_all" className="text-sm" />
                        <span>{busy ? "Completing…" : "Complete Ride & Confirm Cash"}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Standby Vehicle Swap (for Syndicate Standby / Breakdown Replacement) */}
                {view.status !== "COMPLETED" && (
                  <div className="pt-2 border-t border-[#D0D7DE]">
                    {showPlateModal ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-950">Update Standby Vehicle Plate:</span>
                          <button
                            type="button"
                            onClick={() => { setShowPlateModal(false); setStandbyPlate(""); }}
                            className="text-xs text-[#57606A] hover:underline cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="text-[11px] text-[#57606A]">
                          If sending a different union cab or substitute car today, enter the new plate number. An automated WhatsApp alert will update the passenger.
                        </p>
                        <input
                          type="text"
                          value={standbyPlate}
                          onChange={(e) => setStandbyPlate(e.target.value.toUpperCase())}
                          placeholder="e.g. WB74E5555"
                          className="w-full rounded-xl border border-[#D0D7DE] bg-white px-3 py-2 text-xs font-semibold uppercase text-[#1F2328] focus:border-blue-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={plateBusy || !standbyPlate.trim()}
                          onClick={updateStandbyVehicle}
                          className="w-full rounded-xl bg-blue-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                        >
                          {plateBusy ? "Updating Plate…" : "Save Plate & Alert Passenger"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowPlateModal(true)}
                        className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Icon name="local_taxi" className="text-sm" />
                        <span>Substitute / Standby Vehicle Plate Swap</span>
                      </button>
                    )}
                    {plateMessage && (
                      <p className="mt-1 text-[11px] font-medium text-blue-800">{plateMessage}</p>
                    )}
                  </div>
                )}

                {view.status === "COMPLETED" && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-center text-xs font-semibold text-emerald-900">
                    Trip completed and settled. Thank you for providing safe mountain transit!
                  </div>
                )}
              </div>
            ) : view.assignedToMe ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-5 text-xs text-amber-900 space-y-1">
                <span className="font-bold block">Trip Awarded to You</span>
                <p>Waiting for guest advance payment. Passenger contact and cash collection will unlock here immediately upon payment.</p>
              </div>
            ) : !view.canQuote ? (
              <div className="rounded-2xl border border-[#D0D7DE] bg-white p-5 text-center text-xs text-[#57606A]">
                This trip request is no longer taking quotes.
              </div>
            ) : (
              /* FARE QUOTATION FORM WITH ALL-INCLUSIVE MATHEMATICAL BREAKDOWN */
              <div className="rounded-2xl border border-[#D0D7DE] bg-white p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-[#1F2328]">Submit Your Total Fare Quote</h3>
                  <p className="text-xs text-[#57606A]">Quote the total fare. Guest pays flat all-inclusive rate with zero extra booking fee.</p>
                </div>

                {view.guestBudget && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-900 font-medium flex items-center justify-between">
                    <span>Passenger Target Budget:</span>
                    <strong className="font-bold text-blue-950">{inr(view.guestBudget)}</strong>
                  </div>
                )}

                {/* Counter-Offer Notification */}
                {counter && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Homestay Counter-Offer</span>
                      <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">New Rate</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 bg-white rounded-lg p-2.5 border border-emerald-200 text-center">
                      <div>
                        <span className="text-[10px] text-[#57606A] block">Your Quote</span>
                        <span className="text-xs font-bold line-through text-[#57606A]">{q ? inr(q.quotedFare) : "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-700 font-semibold block">Counter-Offer</span>
                        <span className="text-sm font-extrabold text-emerald-700">{inr(counter)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#1F2328]">
                      The homestay offers <strong className="text-emerald-900 font-extrabold">{inr(counter)}</strong>. Accepting confirms this trip immediately.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => send("accept")}
                      className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                    >
                      {busy ? "Accepting…" : `Accept ${inr(counter)} & Confirm Trip`}
                    </button>
                  </div>
                )}

                {q && !counter && (
                  <div className="rounded-xl bg-[#F6F8FA] border border-[#D0D7DE] p-3 text-xs text-[#57606A] space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Your Quoted Fare:</span>
                      <strong className="text-emerald-700 text-sm font-extrabold">{inr(q.quotedFare)}</strong>
                    </div>
                    <div className="text-[10px] text-[#57606A] flex justify-between">
                      <span>Status:</span>
                      <span className="font-semibold text-[#1F2328]">{q.status === "PENDING" ? "Waiting for window close" : q.status}</span>
                    </div>
                  </div>
                )}

                {/* Quick Fare Shortcut Pills */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-[#57606A] block">
                    Quick-Select Total Fare:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[1800, 2200, 2600, 3000, 3400, 3800].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setFare(String(amount))}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                          fare === String(amount)
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] hover:bg-[#E1E4E8]"
                        }`}
                      >
                        {inr(amount)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Fare Input */}
                <div>
                  <label className="text-xs font-semibold text-[#57606A] block mb-0.5">
                    Total Ride Fare (₹) *
                  </label>
                  <span className="text-[10px] text-[#57606A] block mb-1.5">
                    Enter the total price. Guest pays 15% (min ₹500) online advance, remaining 85% in cash directly to you.
                  </span>
                  <div className="flex gap-2">
                    <span className="flex items-center rounded-xl bg-[#F6F8FA] border border-[#D0D7DE] px-3 text-xs font-bold text-[#57606A]">
                      ₹
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fare}
                      onChange={(e) => setFare(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 3000"
                      className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs font-bold text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  {/* Real-time Math Breakdown */}
                  {enteredFare > 0 && (
                    <div className="mt-3 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-300 p-3.5 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-[#1F2328] pb-1.5 border-b border-emerald-200">
                        <span className="font-bold">Total Fare Quoted (All-Inclusive):</span>
                        <strong className="text-sm font-black text-emerald-900">{inr(enteredFare)}</strong>
                      </div>

                      <div className="space-y-1.5 text-[11px] text-[#333]">
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1">
                            <Icon name="payments" className="text-xs text-amber-600" />
                            <span>1. Cash you collect in car at drop-off:</span>
                          </span>
                          <strong className="font-extrabold text-[#1F2328]">{inr(calculatedCashToCollect)}</strong>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1">
                            <Icon name="account_balance_wallet" className="text-xs text-emerald-700" />
                            <span>2. Credited to your platform wallet:</span>
                          </span>
                          <strong className="font-extrabold text-emerald-700">+{inr(calculatedWalletExcess)}</strong>
                        </div>

                        <div className="flex justify-between items-center text-[#57606A]">
                          <span className="flex items-center gap-1">
                            <Icon name="percent" className="text-xs" />
                            <span>Platform & Homestay Commission ({commPct}%):</span>
                          </span>
                          <span className="font-semibold text-red-600">-{inr(calculatedCommission)}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-200 flex justify-between items-center">
                        <span className="font-extrabold text-emerald-950 text-xs">Your Net Total In-Hand:</span>
                        <span className="text-base font-black text-emerald-800">
                          {inr(calculatedTotalEarnings)} ({100 - commPct}%)
                        </span>
                      </div>

                      <p className="pt-1 text-[10px] text-emerald-800 leading-tight">
                        🛡️ Zero extra fee on top. The guest sees flat {inr(enteredFare)}. You collect {inr(calculatedCashToCollect)} cash, and {inr(calculatedWalletExcess)} is in your wallet for 1-tap UPI withdrawal.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#57606A] block mb-0.5">
                    Vehicle Number Plate (Optional)
                  </label>
                  <span className="text-[10px] text-[#57606A] block mb-1">
                    If driving a syndicate/union cab or different vehicle today (e.g. WB 74 B 1234)
                  </span>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="e.g. WB74B1234 (Auto-uses your profile plate if blank)"
                    className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2 text-xs font-semibold text-[#1F2328] uppercase focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#57606A] block mb-1">
                    Vehicle Notes (Optional, no phone numbers)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, 300))}
                    placeholder="e.g. Bolero 4WD, luggage carrier on roof, clean seats"
                    className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  disabled={busy || !(enteredFare > 0)}
                  onClick={() => send("quote")}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                >
                  {busy ? "Submitting…" : q ? "Update Fare Quote" : "Submit Fare Quote"}
                </button>
              </div>
            )}

            {message && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center text-xs font-semibold text-blue-900">
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
