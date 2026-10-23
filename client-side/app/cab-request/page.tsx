"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { API_ENDPOINTS, apiFetch } from "@/lib/api-config";

export interface RoutePreset {
  id: string;
  name: string;
  category: "AIRPORT_STATION" | "SIGHTSEEING" | "DAY_EXCURSION" | "LOCAL_DROP";
  duration?: string;
  description?: string;
  fares: Record<string, number>;
}

const DEFAULT_ROUTE_PRESETS: RoutePreset[] = [
  {
    id: "bagdogra-airport",
    name: "Bagdogra Airport (IXB) Transfer",
    category: "AIRPORT_STATION",
    duration: "approx 3 hrs (70 km)",
    description: "One-way hill transfer via Rohini / Hill Cart Road",
    fares: { Sedan: 2800, SUV: 3600, "7-seater": 3900, "9-seater": 5200 },
  },
  {
    id: "njp-railway",
    name: "NJP Railway Station Drop / Pickup",
    category: "AIRPORT_STATION",
    duration: "approx 3.5 hrs (75 km)",
    description: "Major railway junction connecting North Bengal and Northeast",
    fares: { Sedan: 2700, SUV: 3500, "7-seater": 3800, "9-seater": 5000 },
  },
  {
    id: "tiger-hill-sunrise",
    name: "Tiger Hill Sunrise & Ghoom Tour",
    category: "SIGHTSEEING",
    duration: "3:30 AM departure (3 hrs)",
    description: "Early morning Kanchenjunga sunrise + Ghoom Monastery & Batasia Loop",
    fares: { Sedan: 1800, SUV: 2400, "7-seater": 2600, "9-seater": 3500 },
  },
  {
    id: "darjeeling-7-point",
    name: "Darjeeling 7-Point Sightseeing",
    category: "SIGHTSEEING",
    duration: "Half day (4-5 hrs)",
    description: "HMI, Padmaja Naidu Zoo, Ropeway, Tea Estate & Japanese Peace Pagoda",
    fares: { Sedan: 2200, SUV: 2800, "7-seater": 3100, "9-seater": 4200 },
  },
  {
    id: "mirik-lake",
    name: "Mirik Lake & Pashupati Border Excursion",
    category: "DAY_EXCURSION",
    duration: "Full day (6-7 hrs)",
    description: "Sumendu Lake boating, pine forests, orange orchards & border market",
    fares: { Sedan: 3200, SUV: 4000, "7-seater": 4400, "9-seater": 5800 },
  },
  {
    id: "lamahatta-ecopark",
    name: "Lamahatta Eco Park & Lovers Meet Point",
    category: "DAY_EXCURSION",
    duration: "Half / full day (5 hrs)",
    description: "Pine forest trail, prayer flags garden & Teesta river confluence view",
    fares: { Sedan: 2400, SUV: 3200, "7-seater": 3500, "9-seater": 4600 },
  },
];

const FALLBACK_TIMES = [
  "03:30 AM",
  "04:00 AM",
  "06:00 AM",
  "07:30 AM",
  "09:00 AM",
  "10:30 AM",
  "12:00 PM",
  "02:00 PM",
  "04:30 PM",
  "06:00 PM",
  "08:00 PM",
];

const VEHICLE_COPY: Record<string, { description: string; tag: string; icon: string }> = {
  SUV: { description: "High ground clearance Bolero / Innova / Scorpio. Best for hill curves.", tag: "Most Popular in Hills", icon: "directions_car" },
  Sedan: { description: "Comfortable Dzire / Etios. Best for couples & smooth town roads.", tag: "Budget Friendly", icon: "directions_car" },
  "7-seater": { description: "Spacious Ertiga / Maxi cab for families with multiple bags.", tag: "Family Choice", icon: "airport_shuttle" },
  "9-seater": { description: "High capacity Tempo Traveller for touring groups.", tag: "Large Group", icon: "airport_shuttle" },
};

const FALLBACK_VEHICLES = [
  { value: "SUV", label: "6-7 Seater Mountain SUV", seats: 7, estFare: 3000 },
  { value: "Sedan", label: "4 Seater Sedan / Hatchback", seats: 4, estFare: 2200 },
  { value: "7-seater", label: "7 Seater Family MPV", seats: 7, estFare: 3200 },
  { value: "9-seater", label: "9+ Seater Group Traveller", seats: 9, estFare: 4200 },
];

type PublicConfig = {
  pickupTimes?: string[];
  bookingHorizonDays?: number;
  sightseeingPresets?: string[];
  routePresets?: RoutePreset[];
  vehicles?: { value: string; label: string; seats: number; estFare?: number }[];
  upiId?: string;
  supportPhone?: string;
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
  advanceDueAt?: number | string | null;
  remainingCashAmount?: number | null;
  paymentLinkUrl?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  vehicle?: string | null;
  pickup?: string | null;
  destinations?: string[] | null;
  date?: number | null;
  time?: string | null;
  passengers?: number | null;
  vehicleType?: string | null;
  pickupOtp?: string | null;
  guestBudget?: number | null;
  quotesCount?: number | null;
  biddingClosesAt?: string | number | null;
  refundStatus?: "NONE" | "PENDING" | "REFUNDED" | null;
  guestRating?: { stars: number; comment?: string; ratedAt: string } | null;
  biddingFallback?: boolean;
  config?: PublicConfig;
};

const REFUND_LABELS: Record<string, string> = { PENDING: "Refund in progress", REFUNDED: "Refunded" };

const STATUS_FRIENDLY_LABELS: Record<string, string> = {
  FINDING_DRIVER: "Finding Nearby Drivers",
  QUOTE_RECEIVED: "Reviewing Driver Quotes",
  PENDING_REVIEW: "Pending Confirmation",
  AWAITING_ADVANCE_PAYMENT: "Awaiting Advance Payment",
  CONFIRMED: "Cab Confirmed!",
  EN_ROUTE_PICKUP: "Driver En Route to Pickup",
  ARRIVED_HOMESTAY: "Driver Arrived at Homestay",
  TRIP_STARTED: "Trip in Progress",
  COMPLETED: "Trip Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const toLocalYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const formatInr = (n: number | null | undefined) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";

function CabRequestFormContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || "";
  const refParam = searchParams.get("ref") || "";
  const homestayParam = searchParams.get("h") || searchParams.get("homestay") || "";

  // Multi-step form state: 1 = Route, 2 = Schedule & Vehicle, 3 = Guest Details & Review
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [linkState, setLinkState] = useState<"loading" | "valid" | "invalid">(() =>
    !token && !refParam && !homestayParam ? "invalid" : "loading"
  );
  const [link, setLink] = useState<GuestLink | null>(null);

  const [pickup, setPickup] = useState("");
  const [customPickup, setCustomPickup] = useState(false);

  // Route selection
  const [selectedRoutePresetId, setSelectedRoutePresetId] = useState<string>("darjeeling-7-point");
  const [routeCategory, setRouteCategory] = useState<string>("ALL");
  const [customDestinations, setCustomDestinations] = useState<string[]>([""]);
  const [isCustomRoute, setIsCustomRoute] = useState(false);

  // Schedule & Vehicle
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowYmd = toLocalYmd(tomorrow);
  const [date, setDate] = useState(tomorrowYmd);
  const [time, setTime] = useState("09:00 AM");
  const [vehicleType, setVehicleType] = useState<string>("SUV");
  const [passengers, setPassengers] = useState(3);

  // Guest Details
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [guestBudget, setGuestBudget] = useState("");

  // Submission & Lifecycle
  const [clientRequestId] = useState(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Confirmed trip & live tracking
  const [confirmedTrip, setConfirmedTrip] = useState<{ reference: string; status: string } | null>(
    refParam ? { reference: refParam, status: "AWAITING_ADVANCE_PAYMENT" } : null
  );
  const [tripStatus, setTripStatus] = useState<CabRequestStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Payment states
  const [showQr, setShowQr] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Rating states
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>("");
  const [submittingRating, setSubmittingRating] = useState<boolean>(false);
  const [ratingSuccess, setRatingSuccess] = useState<boolean>(false);
  const [ratingError, setRatingError] = useState<string>("");

  const activeRoutePresets: RoutePreset[] =
    link?.config?.routePresets && link.config.routePresets.length > 0
      ? link.config.routePresets
      : DEFAULT_ROUTE_PRESETS;

  const vehicleOptions =
    link?.config?.vehicles && link.config.vehicles.length > 0
      ? link.config.vehicles
      : FALLBACK_VEHICLES;

  const timeOptions =
    link?.config?.pickupTimes && link.config.pickupTimes.length > 0
      ? link.config.pickupTimes
      : FALLBACK_TIMES;

  const selectedPreset = activeRoutePresets.find((r) => r.id === selectedRoutePresetId);

  // Dynamic route-specific fare calculation
  const getEstimatedFare = (vType: string) => {
    if (!isCustomRoute && selectedPreset && selectedPreset.fares && selectedPreset.fares[vType]) {
      return {
        fare: selectedPreset.fares[vType],
        isPreset: true,
        routeName: selectedPreset.name,
      };
    }
    const matched = vehicleOptions.find((v) => v.value === vType);
    const baseline = matched?.estFare || (vType === "SUV" ? 3000 : vType === "Sedan" ? 2200 : vType === "7-seater" ? 3200 : 4200);
    return {
      fare: baseline,
      isPreset: false,
      routeName: isCustomRoute ? customDestinations.filter(Boolean).join(" → ") : "Custom Route",
    };
  };

  const currentFareEstimate = getEstimatedFare(vehicleType);
  const estimatedAdvance = Math.max(200, Math.round(currentFareEstimate.fare * 0.10));

  const fetchStatus = async (reference: string) => {
    setStatusLoading(true);
    try {
      const data = await apiFetch<CabRequestStatus>(API_ENDPOINTS.cabRequests.status(reference, token));
      setTripStatus(data);
    } catch {
      // Ignored: network retry will refresh
    } finally {
      setStatusLoading(false);
    }
  };

  // Load guest link data
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      if (refParam) {
        apiFetch<CabRequestStatus>(API_ENDPOINTS.cabRequests.status(refParam, token))
          .then((data) => {
            if (!cancelled) {
              setTripStatus(data);
              setLinkState("valid");
            }
          })
          .catch(() => {
            if (!cancelled) setLinkState("valid");
          });
        return () => {
          cancelled = true;
        };
      }
      if (homestayParam) {
        interface PropertyResponse {
          success?: boolean;
          data?: { name?: string; town?: string };
          name?: string;
        }
        apiFetch<PropertyResponse>(API_ENDPOINTS.properties.bySlug(homestayParam))
          .then((res) => {
            const prop = res?.data || res;
            if (prop && prop.name) {
              setPickup(prop.name);
              setLink({
                homestayName: prop.name,
                pickup: prop.name,
                guestName: "",
                guestPhone: "",
                expiresAt: Date.now() + 86400000 * 7,
                config: {
                  pickupTimes: FALLBACK_TIMES,
                  bookingHorizonDays: 30,
                  vehicles: FALLBACK_VEHICLES,
                  sightseeingPresets: [],
                  routePresets: [],
                  upiId: "stayride@okhdfcbank",
                  supportPhone: "919830041000",
                },
              });
              setLinkState("valid");

              // Dynamically fetch live platform config configured by admin
              apiFetch<{ config: PublicConfig }>(API_ENDPOINTS.platform.publicConfig())
                .then((cfgRes) => {
                  if (cancelled || !cfgRes?.config) return;
                  const live = cfgRes.config;
                  setLink((prev) => prev ? {
                    ...prev,
                    config: {
                      pickupTimes: live.pickupTimes || prev.config?.pickupTimes || FALLBACK_TIMES,
                      bookingHorizonDays: live.bookingHorizonDays || prev.config?.bookingHorizonDays || 30,
                      vehicles: live.vehicles || prev.config?.vehicles || FALLBACK_VEHICLES,
                      sightseeingPresets: live.sightseeingPresets || prev.config?.sightseeingPresets || [],
                      routePresets: live.routePresets || prev.config?.routePresets || [],
                      upiId: live.upiId || prev.config?.upiId || "stayride@okhdfcbank",
                      supportPhone: live.supportPhone || prev.config?.supportPhone || "919830041000",
                    },
                  } : prev);
                })
                .catch(() => {});
            } else {
              setLinkState("invalid");
            }
          })
          .catch(() => setLinkState("invalid"));
        return;
      }
      return;
    }

    apiFetch<GuestLink>(API_ENDPOINTS.cabRequests.guestLink(token))
      .then((data) => {
        if (cancelled) return;
        setLink(data);
        setPickup(data.pickup || "");
        if (data.guestName) setGuestName(data.guestName);
        if (data.guestPhone) setGuestPhone(data.guestPhone);
        setLinkState("valid");
        if (refParam) {
          fetchStatus(refParam);
        }
      })
      .catch(() => {
        if (!cancelled) setLinkState("invalid");
      });

    return () => {
      cancelled = true;
    };
  }, [token, refParam, homestayParam]);

  // Status polling every 10 seconds while active
  useEffect(() => {
    const activeRef = confirmedTrip?.reference || refParam;
    if (!activeRef) return;
    const finalStatuses = ["COMPLETED", "CANCELLED", "EXPIRED"];
    if (tripStatus?.status && finalStatuses.includes(tripStatus.status)) return;

    const interval = setInterval(() => {
      apiFetch<CabRequestStatus>(API_ENDPOINTS.cabRequests.status(activeRef, token))
        .then((data) => {
          if (data?.status) setTripStatus(data);
        })
        .catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, [confirmedTrip?.reference, refParam, token, tripStatus?.status]);

  const handleCopyUpi = (upiString: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(upiString);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  const handleSubmitRating = async () => {
    if (selectedRating < 1 || selectedRating > 5) return;
    const activeRef = confirmedTrip?.reference || refParam;
    if (!activeRef) return;
    setSubmittingRating(true);
    setRatingError("");
    try {
      await apiFetch(API_ENDPOINTS.cabRequests.rate(activeRef, token), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars: selectedRating, comment: ratingComment }),
      });
      setRatingSuccess(true);
      if (tripStatus) {
        setTripStatus({
          ...tripStatus,
          guestRating: { stars: selectedRating, comment: ratingComment, ratedAt: new Date().toISOString() },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit review. Please try again.";
      setRatingError(msg);
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleFormSubmit = async () => {
    setErrorMessage("");
    if (!pickup.trim()) {
      setErrorMessage("Please enter a pickup location.");
      setCurrentStep(1);
      return;
    }

    const destinations = isCustomRoute
      ? customDestinations.map((d) => d.trim()).filter(Boolean)
      : selectedPreset
      ? [selectedPreset.name]
      : [];

    if (destinations.length === 0) {
      setErrorMessage("Please select or enter at least one destination.");
      setCurrentStep(1);
      return;
    }

    if (!guestName.trim()) {
      setErrorMessage("Please enter your name.");
      setCurrentStep(3);
      return;
    }

    const cleanPhone = guestPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage("Please enter a valid 10-digit WhatsApp phone number.");
      setCurrentStep(3);
      return;
    }

    setSubmitting(true);
    try {
      const selectedDateObj = new Date(`${date}T12:00:00Z`);
      const payload = {
        pickup: pickup.trim(),
        destinations,
        date: selectedDateObj.getTime(),
        time,
        passengers,
        vehicleType,
        guestName: guestName.trim(),
        phone: cleanPhone,
        notes: notes.trim(),
        guestBudget: guestBudget ? Number(guestBudget) : undefined,
        clientRequestId,
      };

      const submitEndpoint = token
        ? API_ENDPOINTS.cabRequests.submit(token)
        : homestayParam
          ? API_ENDPOINTS.cabRequests.bySlugSubmit(homestayParam)
          : API_ENDPOINTS.cabRequests.submit("");

      const res = await apiFetch<{ reference: string; status: string }>(
        submitEndpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      setConfirmedTrip({ reference: res.reference, status: res.status });
      await fetchStatus(res.reference);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit request. Please try again.";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const activeUpiId = tripStatus?.config?.upiId || link?.config?.upiId || process.env.NEXT_PUBLIC_UPI_ID || "stayride@upi";
  const activeSupportPhone = (tripStatus?.config?.supportPhone || link?.config?.supportPhone || process.env.NEXT_PUBLIC_SUPPORT_PHONE || "919800000001").replace(/\D/g, "");

  if (linkState === "loading") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-xs font-medium text-[#57606A]">Connecting to StayRide verified cab network…</p>
        </div>
      </div>
    );
  }

  if (linkState === "invalid") {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-[#D0D7DE] bg-white p-8 text-center space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Icon name="link_off" className="text-2xl" />
          </div>
          <h1 className="text-base font-bold text-[#1F2328]">Link Expired or Invalid</h1>
          <p className="text-xs text-[#57606A]">
            This private cab booking link is no longer active. Please contact your homestay host to receive a fresh booking link.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F2328] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            Go to StayRide Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1F2328] antialiased">
      {/* Top Google-style Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E1E4E8] bg-white/95 backdrop-blur-md px-4 py-3.5 shadow-xs">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-xs">
              SR
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#1F2328] text-sm tracking-tight">StayRide</span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                  Verified Mountain Network
                </span>
              </div>
              <p className="text-[11px] text-[#57606A] truncate max-w-[200px] sm:max-w-xs">
                {link?.homestayName || "Verified Hill Stay"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${activeSupportPhone}?text=${encodeURIComponent("Hello StayRide, I need assistance with cab booking.")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D0D7DE] bg-white px-3 py-1.5 text-xs font-semibold text-[#24292F] hover:bg-[#F6F8FA] transition-colors"
            >
              <Icon name="support_agent" className="text-sm text-emerald-700" />
              <span>Help</span>
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* If Active Request is Loaded: Show Live Console */}
        {confirmedTrip ? (
          <div className="space-y-6">
            {/* Live Status Tracker Header */}
            <div className="rounded-2xl border border-[#D0D7DE] bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E1E4E8] pb-4">
                <div>
                  <span className="text-xs font-semibold text-[#57606A] uppercase tracking-wider">Trip Reference</span>
                  <p className="text-lg font-mono font-bold text-[#1F2328]">#{confirmedTrip.reference}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      (tripStatus?.status || confirmedTrip.status) === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : (tripStatus?.status || confirmedTrip.status) === "CONFIRMED"
                        ? "bg-blue-100 text-blue-900 border border-blue-300"
                        : (tripStatus?.status || confirmedTrip.status) === "CANCELLED"
                        ? "bg-red-100 text-red-900 border border-red-300"
                        : "bg-amber-100 text-amber-900 border border-amber-300"
                    }`}
                  >
                    {STATUS_FRIENDLY_LABELS[tripStatus?.status || confirmedTrip.status] || tripStatus?.status || confirmedTrip.status}
                  </span>
                  <button
                    type="button"
                    disabled={statusLoading}
                    onClick={() => fetchStatus(confirmedTrip.reference)}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F6F8FA] text-[#57606A] transition-colors cursor-pointer"
                    title="Refresh Status"
                  >
                    <Icon name="refresh" className={`text-base ${statusLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Status Stepper Progression */}
              <div className="py-2">
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-emerald-600" />
                    <span className="font-semibold text-emerald-900">Requested</span>
                  </div>
                  <div className="space-y-1">
                    <div
                      className={`h-1.5 w-full rounded-full ${
                        ["QUOTE_RECEIVED", "AWAITING_ADVANCE_PAYMENT", "CONFIRMED", "TRIP_STARTED", "COMPLETED"].includes(
                          tripStatus?.status || ""
                        )
                          ? "bg-emerald-600"
                          : "bg-[#E1E4E8]"
                      }`}
                    />
                    <span className="font-medium text-[#57606A]">Quotes</span>
                  </div>
                  <div className="space-y-1">
                    <div
                      className={`h-1.5 w-full rounded-full ${
                        ["CONFIRMED", "TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "")
                          ? "bg-emerald-600"
                          : tripStatus?.status === "AWAITING_ADVANCE_PAYMENT"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-[#E1E4E8]"
                      }`}
                    />
                    <span className="font-medium text-[#57606A]">Advance</span>
                  </div>
                  <div className="space-y-1">
                    <div
                      className={`h-1.5 w-full rounded-full ${
                        tripStatus?.status === "COMPLETED" ? "bg-emerald-600" : "bg-[#E1E4E8]"
                      }`}
                    />
                    <span className="font-medium text-[#57606A]">Complete</span>
                  </div>
                </div>
              </div>

              {/* Bidding Radar / Active Searching Banner */}
              {(tripStatus?.status || confirmedTrip.status) === "FINDING_DRIVER" && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600" />
                    </div>
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                      {tripStatus?.quotesCount && tripStatus.quotesCount > 0
                        ? `${tripStatus.quotesCount} Mountain Driver Quote(s) Received`
                        : "Broadcasting to Nearby Mountain Drivers"}
                    </span>
                  </div>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    {tripStatus?.quotesCount && tripStatus.quotesCount > 0
                      ? "Mountain drivers in this valley have submitted competitive quotes. Lowest market bid will be automatically locked."
                      : "Your trip has been dispatched to verified hill drivers in this valley. Lowest market bid will be automatically confirmed in 5 minutes."}
                  </p>
                  {tripStatus?.biddingFallback && (
                    <div className="rounded-lg bg-amber-50 border border-amber-300 p-2.5 text-xs text-amber-900 font-medium">
                      Nearby drivers are currently on other mountain routes. Your homestay host has been notified to assist and allocate private fleet options.
                    </div>
                  )}
                </div>
              )}

              {/* Advance Payment Card (when reserved) */}
              {tripStatus?.status === "AWAITING_ADVANCE_PAYMENT" && !tripStatus.advancePaid && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/50 p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                        <Icon name="lock" className="text-xs" /> Driver Reserved on Hold
                      </span>
                      <h3 className="mt-1 font-bold text-[#1F2328] text-base">Confirm with Advance Payment</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[#57606A]">Advance Due</span>
                      <p className="text-xl font-extrabold text-emerald-800">{formatInr(tripStatus.advanceAmount)}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-[#24292F]">
                      <span>Total Trip Fare:</span>
                      <strong className="font-bold">{formatInr(tripStatus.agreedFare)}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[#57606A]">
                      <span>Online Booking Fee (Pay now):</span>
                      <strong className="text-emerald-800">{formatInr(tripStatus.advanceAmount)}</strong>
                    </div>
                    <div className="pt-1.5 border-t border-emerald-200 flex justify-between items-center text-emerald-950 font-bold">
                      <span>Driver Cash Fare (Pay driver at destination):</span>
                      <span className="text-sm font-extrabold text-emerald-700">{formatInr(tripStatus.remainingCashAmount)}</span>
                    </div>
                  </div>

                  {/* Advance Policy & Cancellation Notice */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                      <Icon name="info" className="text-xs text-amber-700" /> Non-Refundable Vehicle Reservation Fee
                    </div>
                    <p>
                      This advance locks in your verified mountain driver exclusively for your schedule. Once paid, verified driver contact details are released instantly.
                    </p>
                    <p className="text-amber-800">
                      <strong>Cancellation Policy:</strong> To protect mountain drivers against empty hill runs and avoid offline platform bypass, this advance is strictly non-refundable once driver details are unlocked (except in cases of driver cancellation, breakdown, or official road blockage).
                    </p>
                  </div>

                  {/* 1-Tap UPI Intent Button (Opens PhonePe / GPay on Android) */}
                  <div>
                    <a
                      href={`upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=StayRide&am=${tripStatus.advanceAmount}&cu=INR&tn=${encodeURIComponent(`Advance for ${tripStatus.reference}`)}`}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 transition-all cursor-pointer"
                    >
                      <Icon name="account_balance_wallet" className="text-base" /> Pay {formatInr(tripStatus.advanceAmount)} via UPI App
                    </a>
                  </div>

                  {/* Manual UPI ID & Dynamic QR Code Box */}
                  <div className="rounded-xl border border-[#D0D7DE] bg-white p-3.5 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#57606A] font-medium">Platform UPI ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#1F2328]">{activeUpiId}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyUpi(activeUpiId)}
                          className="rounded px-2 py-0.5 font-bold bg-[#F6F8FA] border border-[#D0D7DE] text-xs hover:bg-[#E1E4E8] cursor-pointer"
                        >
                          {copiedUpi ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#E1E4E8]">
                      <button
                        type="button"
                        onClick={() => setShowQr(!showQr)}
                        className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                      >
                        {showQr ? "Hide QR Code" : "Show QR Code to Scan"}
                      </button>
                    </div>

                    {showQr && (
                      <div className="flex flex-col items-center justify-center pt-2">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=${activeUpiId}&pn=StayRide&am=${tripStatus.advanceAmount}&cu=INR&tn=${encodeURIComponent(`Advance for ${tripStatus.reference}`)}`)}`}
                          alt="UPI Payment QR Code"
                          className="h-44 w-44 rounded-lg border border-[#D0D7DE] p-1 bg-white"
                        />
                        <span className="mt-1 text-[11px] text-[#57606A]">Scan with GPay, PhonePe, or Paytm</span>
                      </div>
                    )}
                  </div>

                  {/* WhatsApp Verification */}
                  <div className="pt-1 text-center space-y-2">
                    <a
                      href={`https://wa.me/${activeSupportPhone}?text=${encodeURIComponent(`Namaste, I have paid the advance of ₹${tripStatus.advanceAmount} for cab reference ${tripStatus.reference}. Please confirm my booking.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#128C7E] hover:underline"
                    >
                      <Icon name="chat" className="text-sm" /> Share Payment Screenshot on WhatsApp
                    </a>
                    <div className="pt-1 border-t border-amber-200/60">
                      <a
                        href={`https://wa.me/${activeSupportPhone}?text=${encodeURIComponent(`Namaste, regarding cab request ${tripStatus.reference}: my budget is around ₹${tripStatus.guestBudget || currentFareEstimate.fare}, but quote is ₹${tripStatus.agreedFare}. Can you assist?`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#57606A] hover:text-[#1F2328] hover:underline"
                      >
                        <Icon name="chat" className="text-xs text-emerald-700" /> Need a Different Fare or Vehicle? Chat with Host
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmed Driver Details Card */}
              {["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "") && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50/40 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white font-bold">
                        {tripStatus?.driverName?.charAt(0) || "D"}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-[#1F2328] text-sm">{tripStatus?.driverName || "Assigned Driver"}</h4>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                            Verified
                          </span>
                        </div>
                        <p className="text-xs text-[#57606A]">{tripStatus?.vehicle || "Mountain Cab"}</p>
                      </div>
                    </div>

                    {tripStatus?.driverPhone && (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${tripStatus.driverPhone}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-[#D0D7DE] text-[#24292F] shadow-xs hover:bg-[#F6F8FA]"
                          title="Call Driver"
                        >
                          <Icon name="phone" className="text-sm text-emerald-700" />
                        </a>
                        <a
                          href={`https://wa.me/${tripStatus.driverPhone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xs hover:opacity-90"
                          title="WhatsApp Driver"
                        >
                          <Icon name="chat" className="text-sm" />
                        </a>
                      </div>
                    )}
                  </div>

                  {typeof tripStatus?.remainingCashAmount === "number" && (
                    <div className="flex items-center justify-between rounded-xl bg-white border border-[#D0D7DE] p-3 text-xs">
                      <span className="text-[#57606A] font-medium">Cash to pay driver at drop-off:</span>
                      <span className="font-bold text-base text-emerald-900">{formatInr(tripStatus.remainingCashAmount)}</span>
                    </div>
                  )}

                  {tripStatus?.pickupOtp && (
                    <div className="rounded-xl border border-emerald-300 bg-white p-3.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                            <Icon name="key" className="text-base" />
                          </div>
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                              Boarding Verification PIN
                            </span>
                            <p className="text-[11px] text-[#57606A]">Share with driver upon vehicle boarding to start trip</p>
                          </div>
                        </div>
                        <div className="flex items-center font-mono text-xl font-extrabold tracking-widest text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                          {tripStatus.pickupOtp}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-2.5 text-[11px] leading-relaxed text-emerald-950 flex items-start gap-2">
                    <Icon name="check_circle" className="text-xs text-emerald-700 mt-0.5 shrink-0" />
                    <span>
                      <strong>Driver Allocated:</strong> For coordination or minor pickup adjustments, contact your driver directly. Note: Advance payments are non-refundable once driver contact details are released.
                    </span>
                  </div>
                </div>
              )}

              {/* Guest Rating & Review Form (when COMPLETED) */}
              {tripStatus?.status === "COMPLETED" && (
                <div className="rounded-2xl border border-[#D0D7DE] bg-white p-5 space-y-3">
                  {tripStatus?.guestRating || ratingSuccess ? (
                    <div className="text-center space-y-1">
                      <p className="font-bold text-emerald-900 text-sm">Thank you for rating your trip!</p>
                      <div className="flex items-center justify-center gap-1 text-amber-500 text-lg">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className={s <= (tripStatus?.guestRating?.stars || selectedRating) ? "text-amber-500" : "text-[#D0D7DE]"}>
                            ★
                          </span>
                        ))}
                      </div>
                      {(tripStatus?.guestRating?.comment || ratingComment) && (
                        <p className="text-xs text-[#57606A] italic">&quot;{tripStatus?.guestRating?.comment || ratingComment}&quot;</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#1F2328]">Rate Your Mountain Ride</span>
                        <span className="text-xs font-semibold text-emerald-700">{tripStatus?.driverName || "Driver"}</span>
                      </div>
                      <p className="text-xs text-[#57606A]">Your verified feedback ensures high mountain safety standards.</p>

                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setSelectedRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="text-2xl cursor-pointer p-0.5 focus:outline-none transition-transform hover:scale-125"
                          >
                            <span className={star <= (hoverRating || selectedRating) ? "text-amber-500" : "text-[#D0D7DE]"}>★</span>
                          </button>
                        ))}
                        <span className="ml-2 text-xs font-semibold text-[#1F2328]">
                          {selectedRating === 5 ? "Excellent" : selectedRating === 4 ? "Very Good" : selectedRating === 3 ? "Good" : selectedRating === 2 ? "Fair" : "Poor"}
                        </span>
                      </div>

                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Optional: share feedback on driving safety, cleanliness, punctuality..."
                        maxLength={300}
                        rows={2}
                        className="w-full rounded-xl border border-[#D0D7DE] p-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                      />

                      {ratingError && <p className="text-xs text-red-600 font-medium">{ratingError}</p>}

                      <button
                        type="button"
                        disabled={submittingRating}
                        onClick={handleSubmitRating}
                        className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                      >
                        {submittingRating ? "Submitting..." : "Submit Driver Review"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedTrip(null);
                    setCurrentStep(1);
                  }}
                  className="w-full rounded-xl border border-[#D0D7DE] bg-white py-2.5 text-xs font-bold text-[#24292F] hover:bg-[#F6F8FA] cursor-pointer"
                >
                  Book Another Cab
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Multi-Step Booking Form */
          <div className="space-y-6">
            {/* Step Progress Stepper Bar */}
            <div className="rounded-2xl border border-[#D0D7DE] bg-white p-3.5 shadow-xs">
              <div className="grid grid-cols-3 gap-2 text-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`flex items-center justify-center gap-1.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    currentStep === 1 ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "text-[#57606A] hover:bg-[#F6F8FA]"
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${currentStep === 1 ? "bg-emerald-600 text-white" : "bg-[#D0D7DE] text-white"}`}>
                    1
                  </span>
                  <span>Route</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className={`flex items-center justify-center gap-1.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    currentStep === 2 ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "text-[#57606A] hover:bg-[#F6F8FA]"
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${currentStep === 2 ? "bg-emerald-600 text-white" : "bg-[#D0D7DE] text-white"}`}>
                    2
                  </span>
                  <span>Vehicle & Time</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className={`flex items-center justify-center gap-1.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    currentStep === 3 ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "text-[#57606A] hover:bg-[#F6F8FA]"
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${currentStep === 3 ? "bg-emerald-600 text-white" : "bg-[#D0D7DE] text-white"}`}>
                    3
                  </span>
                  <span>Review & Pay</span>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-800 font-medium">
                {errorMessage}
              </div>
            )}

            {/* STEP 1: ROUTE & ITINERARY */}
            {currentStep === 1 && (
              <div className="space-y-5 rounded-2xl border border-[#D0D7DE] bg-white p-5 sm:p-6 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-[#1F2328]">Where are you traveling?</h2>
                  <p className="text-xs text-[#57606A]">Select a popular mountain route or customize your itinerary.</p>
                </div>

                {/* Pickup Location */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#57606A] flex items-center gap-1">
                      <Icon name="location_on" className="text-xs text-emerald-700" />
                      <span>Pickup Location (Homestay)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomPickup(!customPickup)}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      {customPickup ? "Use Default" : "Change Pickup"}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={pickup}
                    readOnly={!customPickup}
                    onChange={(e) => setPickup(e.target.value)}
                    className={`w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs text-[#1F2328] ${
                      customPickup ? "bg-white focus:border-emerald-600" : "bg-[#F6F8FA]"
                    }`}
                    placeholder="Enter pickup address"
                  />
                </div>

                {/* Mode Switch: Popular Routes vs Custom */}
                <div className="flex items-center gap-2 border-b border-[#E1E4E8] pb-3">
                  <button
                    type="button"
                    onClick={() => setIsCustomRoute(false)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      !isCustomRoute ? "bg-[#1F2328] text-white" : "bg-[#F6F8FA] text-[#57606A] hover:bg-[#E1E4E8]"
                    }`}
                  >
                    Popular Mountain Routes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomRoute(true)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      isCustomRoute ? "bg-[#1F2328] text-white" : "bg-[#F6F8FA] text-[#57606A] hover:bg-[#E1E4E8]"
                    }`}
                  >
                    Custom Itinerary
                  </button>
                </div>

                {/* Popular Route Presets */}
                {!isCustomRoute ? (
                  <div className="space-y-3">
                    {/* Category Filter Pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: "ALL", label: "All Routes" },
                        { key: "AIRPORT_STATION", label: "Airport / Railway" },
                        { key: "SIGHTSEEING", label: "Sightseeing" },
                        { key: "DAY_EXCURSION", label: "Excursions" },
                      ].map((cat) => (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setRouteCategory(cat.key)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                            routeCategory === cat.key
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold"
                              : "bg-[#F6F8FA] text-[#57606A] border border-[#D0D7DE] hover:bg-[#E1E4E8]"
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Route Preset Cards */}
                    <div className="grid grid-cols-1 gap-2.5 pt-1">
                      {activeRoutePresets
                        .filter((r) => routeCategory === "ALL" || r.category === routeCategory)
                        .map((route) => {
                          const isSelected = selectedRoutePresetId === route.id;
                          return (
                            <div
                              key={route.id}
                              onClick={() => setSelectedRoutePresetId(route.id)}
                              className={`rounded-xl border p-3.5 cursor-pointer transition-all ${
                                isSelected
                                  ? "border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600 shadow-xs"
                                  : "border-[#D0D7DE] bg-white hover:border-[#8C959F]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-xs text-[#1F2328]">{route.name}</span>
                                    {route.category === "AIRPORT_STATION" && (
                                      <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[9px] font-bold text-blue-800">
                                        Transfer
                                      </span>
                                    )}
                                  </div>
                                  {route.description && (
                                    <p className="mt-0.5 text-[11px] text-[#57606A]">{route.description}</p>
                                  )}
                                  {route.duration && (
                                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800">
                                      <Icon name="schedule" className="text-[10px]" /> {route.duration}
                                    </span>
                                  )}
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="text-[10px] text-[#57606A] block">From</span>
                                  <span className="text-xs font-extrabold text-[#1F2328]">
                                    {formatInr(route.fares.Sedan || route.fares.SUV)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  /* Custom Destination Input */
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-[#57606A] block">
                      Custom Destinations / Hill Points
                    </label>
                    {customDestinations.map((dest, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={dest}
                          onChange={(e) => {
                            const copy = [...customDestinations];
                            copy[idx] = e.target.value;
                            setCustomDestinations(copy);
                          }}
                          placeholder={`Stop ${idx + 1} (e.g. Batasia Loop, Rock Garden)`}
                          className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                        />
                        {customDestinations.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setCustomDestinations(customDestinations.filter((_, i) => i !== idx))}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D0D7DE] text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Icon name="close" className="text-sm" />
                          </button>
                        )}
                      </div>
                    ))}
                    {customDestinations.length < 5 && (
                      <button
                        type="button"
                        onClick={() => setCustomDestinations([...customDestinations, ""])}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                      >
                        <Icon name="add" className="text-xs" /> Add Another Hill Stop
                      </button>
                    )}
                  </div>
                )}

                {/* Continue to Step 2 Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer"
                  >
                    <span>Choose Vehicle & Schedule</span>
                    <Icon name="arrow_forward" className="text-sm" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SCHEDULE & VEHICLE */}
            {currentStep === 2 && (
              <div className="space-y-5 rounded-2xl border border-[#D0D7DE] bg-white p-5 sm:p-6 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-[#1F2328]">When and in what car?</h2>
                  <p className="text-xs text-[#57606A]">Mountain routes require high clearance and experienced local drivers.</p>
                </div>

                {/* Date Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#57606A] block">Date of Travel</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={date}
                      min={toLocalYmd(new Date())}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Time Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#57606A] block">Pickup Time</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {timeOptions.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTime(t)}
                        className={`rounded-lg py-2 text-center text-xs font-bold transition-all cursor-pointer ${
                          time === t
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] hover:bg-[#E1E4E8]"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Passenger Stepper */}
                <div className="flex items-center justify-between rounded-xl border border-[#D0D7DE] p-3.5 bg-[#F6F8FA]">
                  <div>
                    <span className="text-xs font-bold text-[#1F2328] block">Passengers</span>
                    <span className="text-[11px] text-[#57606A]">Adults + Children</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={passengers <= 1}
                      onClick={() => setPassengers(Math.max(1, passengers - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D0D7DE] bg-white font-bold text-sm disabled:opacity-40 cursor-pointer"
                    >
                      –
                    </button>
                    <span className="font-bold text-sm text-[#1F2328] w-4 text-center">{passengers}</span>
                    <button
                      type="button"
                      disabled={passengers >= 10}
                      onClick={() => setPassengers(passengers + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D0D7DE] bg-white font-bold text-sm disabled:opacity-40 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Vehicle Selection Cards with Dynamic Route Estimates */}
                <div className="space-y-2.5">
                  <label className="text-xs font-semibold text-[#57606A] block">
                    Select Vehicle Class (Route-Specific Estimate)
                  </label>
                  <div className="grid grid-cols-1 gap-2.5">
                    {vehicleOptions.map((v) => {
                      const isSelected = vehicleType === v.value;
                      const copy = VEHICLE_COPY[v.value] || { description: "Verified local mountain cab.", tag: "Available", icon: "directions_car" };
                      const routeFare = getEstimatedFare(v.value).fare;
                      const advEst = Math.max(200, Math.round(routeFare * 0.10));

                      return (
                        <div
                          key={v.value}
                          onClick={() => setVehicleType(v.value)}
                          className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                            isSelected
                              ? "border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600 shadow-xs"
                              : "border-[#D0D7DE] bg-white hover:border-[#8C959F]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-[#1F2328]">{v.label}</span>
                                <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                                  {copy.tag}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-[#57606A] leading-relaxed">{copy.description}</p>
                              <div className="mt-1.5 flex items-center gap-3 text-[10px] text-[#57606A]">
                                <span>Up to {v.seats} seats</span>
                                <span>Advance deposit ~{formatInr(advEst)}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-[#57606A] block">Est. Route Fare</span>
                              <span className="text-sm font-extrabold text-[#1F2328]">{formatInr(routeFare)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="w-1/3 rounded-xl border border-[#D0D7DE] bg-white py-3 text-xs font-bold text-[#24292F] hover:bg-[#F6F8FA] cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="w-2/3 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer"
                  >
                    <span>Guest Details & Review</span>
                    <Icon name="arrow_forward" className="text-sm" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: GUEST CONTACT & REVIEW */}
            {currentStep === 3 && (
              <div className="space-y-5 rounded-2xl border border-[#D0D7DE] bg-white p-5 sm:p-6 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-[#1F2328]">Passenger Details & Summary</h2>
                  <p className="text-xs text-[#57606A]">Driver contact details are shared as soon as the advance is placed.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-[#57606A] block mb-1">Guest Full Name</label>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Ankit Sharma"
                      className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#57606A] block mb-1">
                      WhatsApp Contact Number (10 Digits)
                    </label>
                    <div className="flex gap-2">
                      <span className="flex items-center rounded-xl bg-[#F6F8FA] border border-[#D0D7DE] px-3 text-xs font-bold text-[#57606A]">
                        +91
                      </span>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="9876543210"
                        className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#57606A] block mb-1">
                      Luggage or Special Instructions (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. 3 large bags, need luggage roof rack"
                      className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#57606A] block mb-1">
                      Target Budget (Optional, ₹)
                    </label>
                    <input
                      type="number"
                      value={guestBudget}
                      onChange={(e) => setGuestBudget(e.target.value.replace(/\D/g, ""))}
                      placeholder={`e.g. ${currentFareEstimate.fare}`}
                      className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                    />
                    <p className="mt-1 text-[11px] text-[#57606A]">
                      Helps nearby verified mountain drivers quote matching your expectation.
                    </p>
                  </div>
                </div>

                {/* Booking Itinerary Summary Card */}
                <div className="rounded-xl border border-[#D0D7DE] bg-[#F6F8FA] p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#57606A]">Route:</span>
                    <span className="font-bold text-[#1F2328] text-right truncate max-w-[200px]">
                      {isCustomRoute ? customDestinations.filter(Boolean).join(" → ") : selectedPreset?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#57606A]">Pickup Time:</span>
                    <span className="font-semibold text-[#1F2328]">{date} at {time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#57606A]">Vehicle & Seats:</span>
                    <span className="font-semibold text-[#1F2328]">{vehicleType} · {passengers} Pax</span>
                  </div>
                  <div className="flex justify-between border-t border-[#E1E4E8] pt-2">
                    <span className="text-[#57606A]">Driver Cash Fare (to driver):</span>
                    <span className="font-semibold text-[#1F2328]">{formatInr(currentFareEstimate.fare - estimatedAdvance)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800">
                    <span className="font-medium">Online Booking Fee (~10%):</span>
                    <span className="font-bold">{formatInr(estimatedAdvance)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#E1E4E8] pt-1.5 font-bold text-[#1F2328]">
                    <span>Total Estimated Fare:</span>
                    <span className="text-sm font-extrabold text-emerald-700">{formatInr(currentFareEstimate.fare)}</span>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="w-1/3 rounded-xl border border-[#D0D7DE] bg-white py-3 text-xs font-bold text-[#24292F] hover:bg-[#F6F8FA] cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleFormSubmit}
                    className="w-2/3 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Dispatches…
                      </span>
                    ) : (
                      <>
                        <Icon name="local_taxi" className="text-sm" />
                        <span>Request Mountain Cab</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CabRequestPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-emerald-700 font-medium">Loading StayRide…</div>}>
      <CabRequestFormContent />
    </Suspense>
  );
}
