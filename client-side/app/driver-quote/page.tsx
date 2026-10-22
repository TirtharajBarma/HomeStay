"use client";

// Driver quote page, opened from the StayRide WhatsApp message: drivers who do not use the app send
// their fare (or accept the homestay's counter-offer) here. The signed link identifies the driver and
// the trip; guest contact details are never shown before the advance is paid.
import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { API_ENDPOINTS, apiFetch } from "@/lib/api-config";

type QuoteView = {
  reference: string;
  homestayName?: string;
  driverName?: string;
  pickup: string;
  destination: string;
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
  myQuote: { quotedFare: number; status: string; notes?: string; counterFare?: number | null } | null;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function DriverQuoteContent() {
  const token = useSearchParams().get("t") || "";
  const [view, setView] = useState<QuoteView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [fare, setFare] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!token) throw new Error("This link is incomplete. Open it again from the WhatsApp message.");
        const v = await apiFetch<QuoteView>(API_ENDPOINTS.driverQuote.view(token));
        if (!cancelled) {
          setView(v);
          if (v.myQuote?.notes) setNotes(v.myQuote.notes);
          if (v.myQuote?.quotedFare) {
            // Reverse the exact calculation: totalGrossFare = cashAmount + Math.max(200, Math.round(cashAmount * 0.10))
            const gross = v.myQuote.quotedFare;
            const netCash = gross <= 2200 ? Math.max(0, gross - 200) : Math.round(gross / 1.10);
            setFare(String(netCash));
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

  const send = async (kind: "quote" | "accept") => {
    setBusy(true);
    setMessage("");
    try {
      const cashAmount = Number(fare) || 0;
      const bookingFee = Math.max(200, Math.round(cashAmount * 0.10));
      const totalGrossFare = cashAmount + bookingFee;

      const v =
        kind === "quote"
          ? await apiFetch<QuoteView>(API_ENDPOINTS.driverQuote.quote(), {
              method: "POST",
              body: JSON.stringify({ t: token, quotedFare: totalGrossFare, notes }),
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

  const handleTripAction = async (action: "start" | "complete") => {
    setBusy(true);
    setMessage("");
    try {
      const endpoint = action === "start" ? API_ENDPOINTS.driverQuote.start() : API_ENDPOINTS.driverQuote.complete();
      const v = await apiFetch<QuoteView>(endpoint, {
        method: "POST",
        body: JSON.stringify({ t: token }),
      });
      setView(v);
      setMessage(action === "start" ? "Trip started." : "Trip completed. Thank you!");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-xs font-medium text-[#57606A]">Loading StayRide Trip Details…</p>
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
                <span className="font-bold text-xs text-[#1F2328]">StayRide Driver Portal</span>
                <span className="rounded bg-emerald-50 px-1 py-0.2 text-[9px] font-bold text-emerald-800 border border-emerald-200">
                  Verified
                </span>
              </div>
              <p className="text-[10px] text-[#57606A] font-mono">Trip #{view.reference}</p>
            </div>
          </div>

          {view.driverName && (
            <span className="text-xs font-semibold text-[#57606A] bg-[#F6F8FA] border border-[#D0D7DE] rounded-full px-2.5 py-1">
              {view.driverName}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-4">
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

            {/* Cash Collection Banner */}
            {typeof view.remainingCashAmount === "number" && view.remainingCashAmount > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-1">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide">
                  Cash to Collect at Drop-Off
                </span>
                <p className="text-xl font-extrabold text-amber-900">{inr(view.remainingCashAmount)}</p>
                <p className="text-[10px] text-amber-800">
                  Collect directly from the passenger in cash or personal UPI.
                </p>
              </div>
            )}

            {/* Start Ride / Complete Ride Actions */}
            {view.status !== "COMPLETED" && (
              <div className="space-y-2 pt-1">
                {view.status !== "TRIP_STARTED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleTripAction("start")}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D0D7DE] bg-white py-2.5 text-xs font-bold text-[#1F2328] hover:bg-[#F6F8FA] cursor-pointer disabled:opacity-50"
                  >
                    <Icon name="play_arrow" className="text-sm text-emerald-700" />
                    <span>{busy ? "Updating…" : "Start Ride"}</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Did you complete this ride and collect ${view.remainingCashAmount ? inr(view.remainingCashAmount) : "cash balance"}?`)) {
                      handleTripAction("complete");
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                >
                  <Icon name="done_all" className="text-sm" />
                  <span>{busy ? "Completing…" : "Complete Ride & Confirm Cash"}</span>
                </button>
              </div>
            )}

            {view.status === "COMPLETED" && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-center text-xs font-semibold text-emerald-900">
                Trip completed and settled. Thank you for providing safe mountain transit.
              </div>
            )}
          </div>
        ) : view.assignedToMe ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-5 text-xs text-amber-900 space-y-1">
            <span className="font-bold block">Trip Awarded to You</span>
            <p>Waiting for the guest to pay the advance deposit. Passenger contact and cash collection balance will unlock here immediately upon payment.</p>
          </div>
        ) : !view.canQuote ? (
          <div className="rounded-2xl border border-[#D0D7DE] bg-white p-5 text-center text-xs text-[#57606A]">
            This trip request is no longer taking quotes.
          </div>
        ) : (
          /* FARE QUOTATION FORM WITH QUICK BID CHIPS */
          <div className="rounded-2xl border border-[#D0D7DE] bg-white p-5 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-sm text-[#1F2328]">Submit Your Fare Quote</h3>
              <p className="text-xs text-[#57606A]">Enter your all-inclusive fare for the full journey.</p>
            </div>

            {/* Counter-Offer Notification */}
            {counter && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Homestay Counter-Offer</span>
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
                  <span className="font-medium">Your In-Hand Cash:</span>
                  <strong className="text-emerald-700 text-sm font-extrabold">{inr(Math.round(q.quotedFare * 0.90))}</strong>
                </div>
                <div className="flex justify-between items-center text-[11px] text-[#57606A] border-t border-[#E1E4E8] pt-1.5">
                  <span>Passenger Total Fare:</span>
                  <span className="font-semibold text-[#1F2328]">{inr(q.quotedFare)}</span>
                </div>
                <div className="text-[10px] text-[#57606A] flex justify-between">
                  <span>Status:</span>
                  <span className="font-semibold text-[#1F2328]">{q.status === "PENDING" ? "Waiting for auction close" : q.status}</span>
                </div>
              </div>
            )}

            {/* Quick Fare Shortcut Pills */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[#57606A] block">
                Quick-Select In-Hand Cash:
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
                    ₹{amount.toLocaleString("en-IN")} in-hand
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Fare Input */}
            <div>
              <label className="text-xs font-semibold text-[#57606A] block mb-0.5">
                Cash You Want in Hand from Passenger (₹) *
              </label>
              <span className="text-[10px] text-[#57606A] block mb-1.5">
                Enter the exact cash amount you want to pocket at drop-off.
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
                  placeholder="e.g. 2600"
                  className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs font-bold text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {Number(fare) > 0 && (
                <div className="mt-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-emerald-950 font-bold">
                    <span>Cash you collect at drop-off:</span>
                    <span className="text-sm font-extrabold text-emerald-700">{inr(Number(fare))}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#57606A] text-[11px]">
                    <span>Online Booking Fee (paid by tourist to StayRide):</span>
                    <span>+{inr(Math.max(200, Math.round(Number(fare) * 0.10)))}</span>
                  </div>
                  <div className="pt-1.5 border-t border-emerald-200 flex justify-between items-center text-[#24292F] text-xs">
                    <span className="font-medium">Total Tourist Bill:</span>
                    <strong className="font-bold">{inr(Number(fare) + Math.max(200, Math.round(Number(fare) * 0.10)))}</strong>
                  </div>
                  <p className="pt-1 text-[10px] text-emerald-800 leading-tight">
                    Both you and the passenger see this exact breakdown. You get 100% of your ₹{Number(fare).toLocaleString("en-IN")} in cash.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-[#57606A] block mb-1">
                Vehicle Notes (Optional, no contact info)
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
              disabled={busy || !(Number(fare) > 0)}
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
      </main>
    </div>
  );
}

export default function DriverQuotePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-emerald-700 font-medium">Loading StayRide…</div>}>
      <DriverQuoteContent />
    </Suspense>
  );
}
