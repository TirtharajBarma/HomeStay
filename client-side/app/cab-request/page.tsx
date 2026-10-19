"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { API_ENDPOINTS, apiFetch } from "@/lib/api-config";

// Pickup times, booking window, vehicle classes and sightseeing presets come from StayRide's admin
// settings (sent with the guest link). These are only used if an older server sends none.
const FALLBACK_TIMES = ["06:00 AM", "07:30 AM", "09:00 AM", "10:30 AM", "12:00 PM", "02:00 PM", "04:30 PM", "06:00 PM", "08:00 PM"];
const FALLBACK_HORIZON_DAYS = 60;

// Presentation copy per vehicle class; the label, seats and which classes exist come from the server.
const VEHICLE_COPY: Record<string, { description: string; tag: string }> = {
  SUV: { description: "High clearance for hill roads and mountain curves.", tag: "Recommended for Hills" },
  Sedan: { description: "Comfortable for smooth town transfers & station pickups.", tag: "Budget Friendly" },
  "7-seater": { description: "Spacious seating for family groups with luggage.", tag: "Family Choice" },
  "9-seater": { description: "Extra luggage space for large group touring.", tag: "Large Group" },
};
const FALLBACK_VEHICLES = [
  { value: "SUV", label: "6-7 Seater (Bolero / Innova)", seats: 7 },
  { value: "Sedan", label: "4 Seater (Sedan)", seats: 4 },
  { value: "7-seater", label: "7 Seater (Ertiga / Maxi)", seats: 7 },
  { value: "9-seater", label: "9+ Seater (Traveller)", seats: 9 },
];

type PublicConfig = {
  pickupTimes?: string[];
  bookingHorizonDays?: number;
  sightseeingPresets?: string[];
  vehicles?: { value: string; label: string; seats: number }[];
};

type GuestLink = {
  homestayName: string;
  pickup: string;
  guestName: string;
  guestPhone: string;
  expiresAt: number | string;
  config?: PublicConfig;
};

type CabRequestStatus = {
  reference: string;
  status: string;
  agreedFare?: number | null;
  advanceAmount?: number | null;
  advancePaid?: boolean;
  remainingCashAmount?: number | null;
  driverName?: string | null;
  vehicle?: string | null;
  refundStatus?: "NONE" | "PENDING" | "REFUNDED" | null;
};

const REFUND_LABELS: Record<string, string> = { PENDING: "Refund in progress", REFUNDED: "Refunded" };

const DEFAULT_TIME = "09:00 AM";
const DEFAULT_DESTINATIONS = [""];

// Local calendar date as YYYY-MM-DD (not UTC)
const toLocalYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const tomorrowYmd = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalYmd(d);
};

// YYYY-MM-DD (+ optional "hh:mm AM") -> epoch ms in local time
const toLocalEpoch = (ymd: string, time?: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  let h = 0;
  let min = 0;
  const match = time?.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
  if (match) {
    h = (Number(match[1]) % 12) + (match[3] === "PM" ? 12 : 0);
    min = Number(match[2]);
  }
  return new Date(y, m - 1, d, h, min).getTime();
};

const formatInr = (n?: number | null) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";

function CabRequestFormContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || "";

  const [link, setLink] = useState<GuestLink | null>(null);
  const [linkState, setLinkState] = useState<"loading" | "ready" | "invalid">("loading");
  const homestayName = link?.homestayName || "your homestay";
  const timeOptions = link?.config?.pickupTimes?.length ? link.config.pickupTimes : FALLBACK_TIMES;
  const vehicleOptions = link?.config?.vehicles?.length ? link.config.vehicles : FALLBACK_VEHICLES;
  const presets = link?.config?.sightseeingPresets ?? [];
  const maxYmd = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (link?.config?.bookingHorizonDays || FALLBACK_HORIZON_DAYS));
    return toLocalYmd(d);
  })();

  // Form State
  const [pickup, setPickup] = useState("");
  const [destinations, setDestinations] = useState<string[]>(DEFAULT_DESTINATIONS);

  const [date, setDate] = useState(tomorrowYmd);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [vehicleType, setVehicleType] = useState<"SUV" | "Sedan" | "7-seater" | "9-seater">("SUV");
  const [passengers, setPassengers] = useState(3);

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Same id on retries of one form; new id per new form
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmedTrip, setConfirmedTrip] = useState<{ reference: string; status: string } | null>(null);
  const [tripStatus, setTripStatus] = useState<CabRequestStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");

  const todayYmd = toLocalYmd(new Date());

  useEffect(() => {
    if (!token) {
      setLinkState("invalid");
      return;
    }
    let cancelled = false;
    setLinkState("loading");
    apiFetch<GuestLink>(API_ENDPOINTS.cabRequests.guestLink(token))
      .then((data) => {
        if (cancelled) return;
        setLink(data);
        setGuestName(data.guestName || "");
        setGuestPhone(data.guestPhone || "");
        setPickup(data.pickup || "");
        setLinkState("ready");
      })
      .catch(() => {
        if (!cancelled) setLinkState("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const fetchStatus = async (reference: string) => {
    setStatusLoading(true);
    setStatusError("");
    try {
      setTripStatus(
        await apiFetch<CabRequestStatus>(API_ENDPOINTS.cabRequests.status(reference, token))
      );
    } catch (err: any) {
      setStatusError(err?.message || "Could not load request status. Please try again.");
    } finally {
      setStatusLoading(false);
    }
  };

  // Destination manipulation
  const handleAddStop = () => {
    if (destinations.length >= 6) return;
    setDestinations([...destinations, ""]);
  };

  const handleUpdateStop = (index: number, val: string) => {
    const updated = [...destinations];
    updated[index] = val;
    setDestinations(updated);
  };

  const handleRemoveStop = (index: number) => {
    if (destinations.length <= 1) {
      setDestinations([""]);
      return;
    }
    setDestinations(destinations.filter((_, i) => i !== index));
  };

  const handleQuickAddPreset = (dest: string) => {
    const emptyIdx = destinations.findIndex((d) => !d.trim());
    if (emptyIdx !== -1) {
      handleUpdateStop(emptyIdx, dest);
    } else {
      if (destinations.length < 6) {
        setDestinations([...destinations, dest]);
      }
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setErrorMessage("");

    const validStops = destinations.filter((d) => d.trim()).map((d) => d.trim());
    if (validStops.length === 0) {
      setErrorMessage("Please enter at least one destination stop.");
      return;
    }
    if (!guestName.trim()) {
      setErrorMessage("Please enter your name.");
      return;
    }
    if (!guestPhone.trim() || guestPhone.replace(/[^0-9]/g, "").length < 10) {
      setErrorMessage("Please enter a valid 10-digit mobile number for driver updates.");
      return;
    }
    if (!date) {
      setErrorMessage("Please choose a ride date.");
      return;
    }
    const pickupAt = toLocalEpoch(date, time);
    if (pickupAt < Date.now()) {
      setErrorMessage("Pickup date and time cannot be in the past.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const payload = {
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        pickup: pickup.trim(),
        destinations: validStops,
        date: toLocalEpoch(date),
        time,
        passengers: Number(passengers),
        vehicleType,
        notes: notes.trim() || undefined,
        clientRequestId,
      };

      const res = await apiFetch<{ reference: string; status: string }>(
        API_ENDPOINTS.cabRequests.submit(token),
        { method: "POST", body: JSON.stringify(payload) }
      );
      if (!res?.reference) throw new Error("Failed to submit request.");
      setConfirmedTrip(res);
      fetchStatus(res.reference);
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Could not reach StayRide transit servers. Please check connection and try again."
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setConfirmedTrip(null);
    setTripStatus(null);
    setStatusError("");
    setErrorMessage("");
    setPickup(link?.pickup || "");
    setGuestName(link?.guestName || "");
    setGuestPhone(link?.guestPhone || "");
    setDestinations(DEFAULT_DESTINATIONS);
    setDate(tomorrowYmd());
    setTime(DEFAULT_TIME);
    setVehicleType("SUV");
    setPassengers(3);
    setNotes("");
    setClientRequestId(crypto.randomUUID());
  };

  const shareOnWhatsApp = () => {
    if (!confirmedTrip) return;
    const ref = confirmedTrip.reference || "REQ";
    const dest = destinations.filter((d) => d.trim()).join(" ➔ ");
    const text =
      `*StayRide Mountain Cab Request: ${ref}*\n` +
      `Host: ${homestayName}\n` +
      `Guest: ${guestName} (${guestPhone})\n` +
      `Pickup: ${pickup}\n` +
      `Route: ${dest}\n` +
      `Date: ${date} at ${time}\n` +
      `Status: Awaiting driver quote & host confirmation.`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  if (linkState !== "ready") {
    return (
      <div className="min-h-screen bg-surface px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm sm:p-8 text-center">
          {linkState === "loading" ? (
            <p className="text-body-md text-primary">Checking your cab request link…</p>
          ) : (
            <>
              <Icon name="link_off" className="text-4xl text-red-600" />
              <h1 className="mt-3 font-display text-headline-lg-mobile font-semibold text-primary">
                This link is invalid or expired
              </h1>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Ask your homestay for a new link.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Navigation Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-body-sm text-on-surface-variant">
          <Link href="/" className="hover:text-primary transition-colors">
            Hill Stays
          </Link>
          <Icon name="chevron_right" className="text-xs" />
          <Link href="/cab" className="hover:text-primary transition-colors">
            Cabs
          </Link>
          <Icon name="chevron_right" className="text-xs" />
          <span className="font-semibold text-primary">Guest Cab Request</span>
        </nav>

        {!confirmedTrip ? (
          <div>
            {/* Header Banner */}
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-label-sm font-semibold uppercase tracking-wider text-primary">
                  <Icon name="verified" className="text-sm" /> Verified Mountain Fleet
                </span>
                {link?.homestayName && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-body-sm font-medium text-emerald-800 border border-emerald-200">
                    <Icon name="home" className="text-xs text-emerald-700" /> Host: {link.homestayName}
                  </span>
                )}
              </div>

              <h1 className="mt-3 font-display text-headline-lg-mobile font-semibold text-primary sm:text-headline-lg">
                Request Your Mountain Cab
              </h1>
              <p className="mt-2 text-body-md text-on-surface-variant leading-relaxed">
                Connect directly with verified local hill drivers vetted by{" "}
                <span className="font-semibold text-primary">{homestayName}</span>. Build a multi-stop
                sightseeing route, get transparent driver quotes, and pay a small advance via a StayRide payment link with the rest in cash.
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-body-sm">
                <Icon name="error" className="shrink-0 text-red-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-8 space-y-8">
              {/* SECTION 1: PICKUP & MULTI-STOP ROUTE */}
              <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-title-md font-semibold text-primary">
                  <Icon name="pin_drop" className="text-primary text-xl" /> 1. Start & Sightseeing Stops
                </h2>

                {/* Pickup Location */}
                <div className="mt-4">
                  <label className="block text-body-sm font-medium text-on-surface">
                    Pickup Location
                  </label>
                  <input
                    type="text"
                    required
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                    placeholder="Homestay name, address, or Bagdogra Airport"
                    className="mt-1.5 w-full rounded-xl border border-outline-variant/60 bg-surface px-4 py-3 text-body-md text-on-surface focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Multi-Stop Destination List */}
                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <label className="block text-body-sm font-medium text-on-surface">
                      Drop Destinations / Mountain Stops
                    </label>
                    <button
                      type="button"
                      onClick={handleAddStop}
                      className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
                    >
                      <Icon name="add_circle" className="text-base" /> Add Another Stop
                    </button>
                  </div>

                  <div className="mt-2 space-y-3">
                    {destinations.map((dest, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-label-sm font-bold text-on-surface-variant">
                          {idx === 0 ? "Drop" : `Stop ${idx + 1}`}
                        </span>
                        <input
                          type="text"
                          required
                          value={dest}
                          onChange={(e) => handleUpdateStop(idx, e.target.value)}
                          placeholder={idx === 0 ? "e.g. Gangtok MG Marg or Tsomgo Lake" : "e.g. Baba Mandir or Rumtek"}
                          className="flex-1 rounded-xl border border-outline-variant/60 bg-surface px-4 py-2.5 text-body-md text-on-surface focus:border-primary focus:outline-none"
                        />
                        {destinations.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStop(idx)}
                            className="p-1.5 text-on-surface-variant hover:text-red-600 transition-colors"
                            title="Remove Stop"
                          >
                            <Icon name="cancel" className="text-xl" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Quick Preset Buttons (admin-managed list) */}
                  {presets.length > 0 && <div className="mt-4">
                    <p className="text-label-sm font-medium text-on-surface-variant">
                      Quick Mountain Presets:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {presets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleQuickAddPreset(preset)}
                          className="inline-flex items-center gap-1 rounded-full border border-outline-variant/60 bg-surface px-3 py-1 text-label-sm text-on-surface hover:border-primary hover:text-primary transition-all"
                        >
                          <Icon name="near_me" className="text-xs text-primary" />
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>}
                </div>

              </div>

              {/* SECTION 2: DATE, TIME & VEHICLE */}
              <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-title-md font-semibold text-primary">
                  <Icon name="calendar_month" className="text-primary text-xl" /> 2. Schedule & Vehicle Type
                </h2>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-body-sm font-medium text-on-surface">
                      Ride Date
                    </label>
                    <input
                      type="date"
                      required
                      min={todayYmd}
                      max={maxYmd}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-outline-variant/60 bg-surface px-4 py-2.5 text-body-md text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-body-sm font-medium text-on-surface">
                      Pickup Time
                    </label>
                    <select
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-outline-variant/60 bg-surface px-4 py-2.5 text-body-md text-on-surface"
                    >
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Vehicle Selection Cards */}
                <div className="mt-6">
                  <label className="block text-body-sm font-medium text-on-surface">
                    Select Vehicle Class
                  </label>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {vehicleOptions.map((v) => {
                      const active = vehicleType === v.value;
                      const copy = VEHICLE_COPY[v.value];
                      return (
                        <button
                          type="button"
                          key={v.value}
                          aria-pressed={active}
                          onClick={() => setVehicleType(v.value as typeof vehicleType)}
                          className={`block w-full text-left cursor-pointer rounded-xl border p-4 transition-all ${
                            active
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-outline-variant/60 bg-surface hover:border-primary/50"
                          }`}
                        >
                          <span className="flex items-start justify-between">
                            <span className="font-semibold text-body-md text-primary">{v.label}</span>
                            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-xs font-semibold text-on-surface-variant">
                              {v.seats} Seater
                            </span>
                          </span>
                          {copy && <span className="mt-1 block text-body-sm text-on-surface-variant">{copy.description}</span>}
                          {copy && (
                            <span className="mt-2 inline-block text-label-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                              {copy.tag}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Passengers count */}
                <div className="mt-4">
                  <label className="block text-body-sm font-medium text-on-surface">
                    Number of Passengers: <span className="font-bold text-primary">{passengers}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="9"
                    value={passengers}
                    onChange={(e) => setPassengers(Number(e.target.value))}
                    className="mt-2 w-full accent-primary"
                  />
                </div>
              </div>

              {/* SECTION 3: GUEST CONTACT INFO */}
              <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-title-md font-semibold text-primary">
                  <Icon name="person" className="text-primary text-xl" /> 3. Guest Information
                </h2>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-body-sm font-medium text-on-surface">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Ananya Sharma"
                      className="mt-1.5 w-full rounded-xl border border-outline-variant/60 bg-surface px-4 py-2.5 text-body-md text-on-surface focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-body-sm font-medium text-on-surface">
                      WhatsApp Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="e.g. 9812345678"
                      className="mt-1.5 w-full rounded-xl border border-outline-variant/60 bg-surface px-4 py-2.5 text-body-md text-on-surface focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-body-sm font-medium text-on-surface">
                    Special Notes / Luggage Requirements
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. 3 large suitcases, require child booster seat, Nathula permit required..."
                    className="mt-1.5 w-full rounded-xl border border-outline-variant/60 bg-surface px-4 py-2.5 text-body-md text-on-surface focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-title-md font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Icon name="progress_activity" className="animate-spin text-xl" />
                    <span>Connecting to Mountain Drivers…</span>
                  </>
                ) : (
                  <>
                    <Icon name="near_me" className="text-xl" />
                    <span>Submit Cab Request to Homestay & Drivers</span>
                  </>
                )}
              </button>

              <p className="text-center text-body-xs text-on-surface-variant">
                🔒 Verified booking · Free cancellation up to 6 hours before pickup · Advance via StayRide payment link, rest in cash to driver.
              </p>
            </form>
          </div>
        ) : (
          /* CONFIRMED STATE */
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-md sm:p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Icon name="check_circle" className="text-4xl" />
            </div>

            <span className="mt-4 inline-block rounded-full bg-primary/10 px-4 py-1 text-label-sm font-bold tracking-wide text-primary uppercase">
              {confirmedTrip.reference || "REQUEST CONFIRMED"}
            </span>

            <h2 className="mt-2 font-display text-headline-lg font-bold text-primary">
              Cab Itinerary Dispatched!
            </h2>
            <p className="mt-2 text-body-md text-on-surface-variant max-w-lg mx-auto">
              Your mountain sightseeing request has been sent to{" "}
              <span className="font-semibold text-primary">{homestayName}</span> and the verified mountain driver pool.
            </p>

            {/* Itinerary Summary Card */}
            <div className="mt-6 rounded-xl border border-outline-variant/40 bg-surface-container-low p-5 text-left max-w-lg mx-auto space-y-3">
              <div>
                <p className="text-label-xs font-semibold text-on-surface-variant uppercase">Route</p>
                <p className="font-semibold text-body-md text-primary">
                  {pickup} ➔ {destinations.filter((d) => d.trim()).join(" ➔ ")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-body-sm">
                <div>
                  <p className="text-label-xs font-semibold text-on-surface-variant uppercase">Date & Time</p>
                  <p className="font-medium text-on-surface">{date} at {time}</p>
                </div>
                <div>
                  <p className="text-label-xs font-semibold text-on-surface-variant uppercase">Vehicle & Party</p>
                  <p className="font-medium text-on-surface">{vehicleType} · {passengers} passengers</p>
                </div>
              </div>

            </div>

            {/* How It Works Steps */}
            <div className="mt-8 max-w-md mx-auto text-left space-y-3 border-t border-outline-variant/40 pt-6">
              <p className="text-title-sm font-bold text-primary">Next Steps:</p>
              <div className="flex items-start gap-3 text-body-sm text-on-surface-variant">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white font-bold text-xs">1</span>
                <span>Nearby drivers quote their best fare on your route.</span>
              </div>
              <div className="flex items-start gap-3 text-body-sm text-on-surface-variant">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold text-xs">2</span>
                <span>Homestay host confirms the best driver for you.</span>
              </div>
              <div className="flex items-start gap-3 text-body-sm text-on-surface-variant">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface font-bold text-xs">3</span>
                <span>StayRide sends you a payment link for the advance; pay the remaining balance in cash to your driver.</span>
              </div>
            </div>

            {/* Request Status */}
            <div className="mt-8 max-w-lg mx-auto rounded-xl border border-outline-variant/60 bg-surface-container-low p-6 text-left shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-label-sm font-bold uppercase tracking-wider text-primary">
                  Request Status
                </span>
                <button
                  type="button"
                  disabled={statusLoading}
                  onClick={() => fetchStatus(confirmedTrip.reference)}
                  className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  <Icon name="refresh" className="text-base" /> {statusLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {statusError && <p className="mt-3 text-body-sm text-red-700">{statusError}</p>}

              {(tripStatus?.status || confirmedTrip.status) === "CANCELLED" && (
                <div role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-body-sm font-semibold text-red-800">
                  This cab request has been cancelled.
                  {tripStatus?.refundStatus && REFUND_LABELS[tripStatus.refundStatus]
                    ? ` ${REFUND_LABELS[tripStatus.refundStatus]}${tripStatus.refundStatus === "REFUNDED" ? " — your advance has been returned." : " — your paid advance will be returned."}`
                    : ""}
                </div>
              )}

              <div className="mt-3 space-y-1 text-body-sm text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`font-semibold ${(tripStatus?.status || confirmedTrip.status) === "CANCELLED" ? "text-red-700" : "text-primary"}`}>
                    {(tripStatus?.status || confirmedTrip.status) === "CANCELLED" ? "Cancelled" : tripStatus?.status || confirmedTrip.status}
                  </span>
                </div>
                {tripStatus?.refundStatus && REFUND_LABELS[tripStatus.refundStatus] && (
                  <div className="flex justify-between">
                    <span>Refund:</span>
                    <span className={`font-semibold ${tripStatus.refundStatus === "REFUNDED" ? "text-emerald-800" : "text-amber-800"}`}>
                      {REFUND_LABELS[tripStatus.refundStatus]}
                    </span>
                  </div>
                )}
                {tripStatus?.driverName && (
                  <div className="flex justify-between">
                    <span>Driver:</span>
                    <span className="font-medium text-on-surface">{tripStatus.driverName}</span>
                  </div>
                )}
                {tripStatus?.vehicle && (
                  <div className="flex justify-between">
                    <span>Vehicle:</span>
                    <span className="font-medium text-on-surface">{tripStatus.vehicle}</span>
                  </div>
                )}
                {typeof tripStatus?.agreedFare === "number" && (
                  <div className="flex justify-between">
                    <span>Agreed Fare:</span>
                    <span className="font-medium text-on-surface">{formatInr(tripStatus.agreedFare)}</span>
                  </div>
                )}
                {typeof tripStatus?.advanceAmount === "number" && (
                  <div className="flex justify-between">
                    <span>Advance:</span>
                    <span className="font-medium text-on-surface">
                      {formatInr(tripStatus.advanceAmount)} {tripStatus.advancePaid ? "(paid)" : "(pending)"}
                    </span>
                  </div>
                )}
                {typeof tripStatus?.remainingCashAmount === "number" && tripStatus.status !== "CANCELLED" && (
                  <div className="flex justify-between text-emerald-800 font-medium">
                    <span>Pay Cash to Driver:</span>
                    <span>{formatInr(tripStatus.remainingCashAmount)}</span>
                  </div>
                )}
              </div>

              {tripStatus?.status !== "CANCELLED" && <p className="mt-3 text-body-sm text-on-surface-variant">
                {typeof tripStatus?.advanceAmount === "number" && !tripStatus.advancePaid
                  ? `Your advance of ${formatInr(tripStatus.advanceAmount)} will be collected via a payment link from StayRide.`
                  : "Once a driver is assigned, the advance amount will be collected via a payment link from StayRide."}
              </p>}
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={shareOnWhatsApp}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 font-semibold text-white shadow hover:opacity-90 transition-all cursor-pointer"
              >
                <Icon name="share" className="text-lg" /> Share Itinerary on WhatsApp
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface px-6 py-3 font-semibold text-on-surface hover:bg-surface-container-low transition-all cursor-pointer"
              >
                Submit Another Request
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CabRequestPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-primary">Loading cab booking form…</div>}>
      <CabRequestFormContent />
    </Suspense>
  );
}
