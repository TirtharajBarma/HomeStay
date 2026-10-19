"use client";

// Driver quote page, opened from the StayRide WhatsApp message: drivers who do not use the app send
// their fare (or accept the homestay's counter-offer) here. The signed link identifies the driver and
// the trip; guest contact details are never shown before the advance is paid.
import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  status: string;
  driverView?: string;
  canQuote: boolean;
  assignedToMe?: boolean;
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
        if (!cancelled) setView(v);
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
      const v =
        kind === "quote"
          ? await apiFetch<QuoteView>(API_ENDPOINTS.driverQuote.quote(), {
              method: "POST",
              body: JSON.stringify({ t: token, quotedFare: Number(fare), notes }),
            })
          : await apiFetch<QuoteView>(API_ENDPOINTS.driverQuote.acceptCounter(), {
              method: "POST",
              body: JSON.stringify({ t: token }),
            });
      setView(v);
      setFare("");
      setMessage(kind === "quote" ? "Your fare was sent to the homestay." : "You accepted the offer. The trip is yours once the guest pays the advance.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not send. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="p-10 text-center text-on-surface-variant">Loading trip…</p>;
  if (error || !view) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-title-lg font-semibold text-primary">Link not available</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">{error || "This trip is no longer available."}</p>
      </div>
    );
  }

  const q = view.myQuote;
  const counter = q?.status === "PENDING" && q.counterFare ? q.counterFare : null;
  const when = `${new Date(view.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} at ${view.time}`;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <p className="text-label-sm font-semibold uppercase tracking-wide text-secondary">StayRide trip request</p>
      <h1 className="mt-1 text-title-lg font-semibold text-primary">{view.homestayName || "Homestay"}</h1>
      {view.driverName && <p className="text-body-sm text-on-surface-variant">For {view.driverName}</p>}

      <div className="mt-5 space-y-2 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 text-body-md">
        <p><span className="text-on-surface-variant">From:</span> {view.pickup}</p>
        <p><span className="text-on-surface-variant">To:</span> {view.destination}</p>
        <p><span className="text-on-surface-variant">When:</span> {when}</p>
        <p><span className="text-on-surface-variant">Vehicle:</span> {view.vehicleType} · {view.passengers} passenger(s)</p>
        <p className="text-label-sm text-on-surface-variant">Trip {view.reference}</p>
      </div>

      {view.assignedToMe ? (
        <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-body-md text-emerald-800">
          This trip is yours. You get the guest&apos;s details once the advance is paid. Use the StayRide app or wait for the WhatsApp confirmation.
        </p>
      ) : !view.canQuote ? (
        <p className="mt-5 rounded-xl bg-surface-container-low p-4 text-body-md text-on-surface-variant">
          This request is no longer taking fares.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {counter && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-body-md font-semibold text-primary">The homestay offers {inr(counter)}</p>
              <p className="text-body-sm text-on-surface-variant">Your fare was {inr(q!.quotedFare)}. Accepting confirms the trip at {inr(counter)}.</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => send("accept")}
                className="mt-3 w-full rounded-xl bg-primary py-3 text-body-md font-semibold text-on-primary disabled:opacity-60"
              >
                {busy ? "Accepting…" : `Accept ${inr(counter)}`}
              </button>
            </div>
          )}
          {q && !counter && (
            <p className="text-body-sm text-on-surface-variant">
              Your fare: {inr(q.quotedFare)} ·{" "}
              {q.status === "EXPIRED" ? "expired, send a new fare" : q.status === "REJECTED" ? "not selected" : "waiting for the homestay"}
            </p>
          )}
          <label className="block text-body-sm font-medium text-on-surface">
            {q ? "Change your fare (₹)" : "Your fare for the whole trip (₹)"}
            <input
              inputMode="numeric"
              value={fare}
              onChange={(e) => setFare(e.target.value.replace(/[^0-9]/g, ""))}
              className="mt-1.5 w-full rounded-xl border border-outline-variant/60 bg-surface px-4 py-3 text-body-md text-on-surface"
              placeholder="e.g. 3000"
            />
          </label>
          <label className="block text-body-sm font-medium text-on-surface">
            Note (optional, no phone numbers)
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 300))}
              className="mt-1.5 w-full rounded-xl border border-outline-variant/60 bg-surface px-4 py-3 text-body-md text-on-surface"
              placeholder="e.g. Innova, AC, carrier for luggage"
            />
          </label>
          <button
            type="button"
            disabled={busy || !(Number(fare) > 0)}
            onClick={() => send("quote")}
            className="w-full rounded-xl bg-primary py-3 text-body-md font-semibold text-on-primary disabled:opacity-60"
          >
            {busy ? "Sending…" : q ? "Send new fare" : "Send fare"}
          </button>
        </div>
      )}
      {message && <p className="mt-4 text-center text-body-sm text-on-surface">{message}</p>}
    </main>
  );
}

export default function DriverQuotePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-primary">Loading…</div>}>
      <DriverQuoteContent />
    </Suspense>
  );
}
