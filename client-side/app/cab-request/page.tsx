"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { API_ENDPOINTS, apiFetch } from "@/lib/api-config";
import { siteConfig } from "@/lib/site-config";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { waNumber } from "@/lib/whatsapp";
import { upiPayUrl, isUtr, cleanUtr } from "@/lib/upi";
import { toDataURL } from "qrcode";
import { WebLocationPicker, PickedLocation } from "@/components/web-location-picker";

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

const FALLBACK_VEHICLES = [
  { value: "SUV", label: "6-7 Seater Mountain SUV", seats: 7 },
  { value: "Sedan", label: "4 Seater Sedan / Hatchback", seats: 4 },
  { value: "7-seater", label: "7 Seater Family MPV", seats: 7 },
  { value: "9-seater", label: "9-10 Seater Large Group Cruiser", seats: 10 },
];

export interface PopularTransferRoute {
  id: string;
  name: string;
  from: string;
  to: string;
  direction: "outbound" | "inbound";
  icon: string;
}

const POPULAR_TRANSFER_ROUTES: PopularTransferRoute[] = [
  {
    id: "homestay-to-bagdogra",
    name: "HOMESTAY ➔ BAGDOGRA AIRPORT",
    from: "Homestay",
    to: "Bagdogra Airport (IXB)",
    direction: "outbound",
    icon: "flight_takeoff",
  },
  {
    id: "homestay-to-njp",
    name: "HOMESTAY ➔ NJP RAILWAY STATION",
    from: "Homestay",
    to: "NJP Railway Station",
    direction: "outbound",
    icon: "train",
  },
  {
    id: "njp-to-homestay",
    name: "NJP RAILWAY STATION ➔ HOMESTAY",
    from: "NJP Railway Station",
    to: "Homestay",
    direction: "inbound",
    icon: "home",
  },
  {
    id: "bagdogra-to-homestay",
    name: "BAGDOGRA AIRPORT ➔ HOMESTAY",
    from: "Bagdogra Airport (IXB)",
    to: "Homestay",
    direction: "inbound",
    icon: "home",
  },
];

const DEFAULT_TOURIST_DESTINATIONS = [
  "Tiger Hill Sunrise Point",
  "Batasia Loop & War Memorial",
  "Darjeeling Mall Road / Chowrasta",
  "Japanese Peace Pagoda",
  "Rock Garden & Ganga Maya Park",
  "Happy Valley Tea Estate",
  "Padmaja Naidu Zoo & HMI",
  "Ghoom Monastery",
  "Lamahatta Eco Park",
  "Mirik Lake",
  "Pashupati Nagar (Nepal Border)",
  "Bagdogra Airport (IXB)",
  "NJP Railway Station",
  "Kalimpong Town",
  "Gangtok MG Marg",
  "Pelling Skywalk",
];

type PublicConfig = {
  pickupTimes?: string[];
  bookingHorizonDays?: number;
  sightseeingPresets?: string[];
  routePresets?: RoutePreset[];
  vehicles?: { value: string; label: string; seats: number; estFare?: number }[];
  upiId?: string;
  businessName?: string;
  supportPhone?: string;
  supportEmail?: string;
};

type PaymentClaim = { status: "PENDING" | "REJECTED"; submittedAt: string; reason?: string; utr?: string };

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
  cancellationReason?: string | null;
  guestRating?: { stars: number; comment?: string; ratedAt: string } | null;
  biddingFallback?: boolean;
  awaitingOwner?: boolean;
  paymentClaim?: PaymentClaim | null;
  config?: PublicConfig;
};

const REFUND_LABELS: Record<string, string> = { PENDING: "Refund in progress", REFUNDED: "Refunded" };

const STATUS_FRIENDLY_LABELS: Record<string, string> = {
  FINDING_DRIVER: "Finding Nearby Drivers",
  QUOTE_RECEIVED: "Reviewing Driver Quotes",
  PENDING_REVIEW: "Request Received",
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

const toTime24 = (t12: string) => {
  if (!t12) return "09:00";
  const match = t12.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "09:00";
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
};

const toTime12 = (t24: string) => {
  if (!t24) return "09:00 AM";
  const parts = t24.split(":");
  if (parts.length < 2) return "09:00 AM";
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${m} ${ampm}`;
};

// Minutes after midnight for "hh:mm AM"
const minutesOf = (t12: string) => {
  const [h, m] = toTime24(t12).split(":").map(Number);
  return h * 60 + m;
};

// The instant of a "YYYY-MM-DD" day and "hh:mm AM" time in IST, as the server reads it
const istInstant = (ymd: string, t12: string) => Date.parse(`${ymd}T${toTime24(t12)}:00+05:30`);

const isNotFound = (e: unknown) => (e as { status?: number } | null)?.status === 404;

const formatIstDateTime = (v: number | string) =>
  new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const formatInr = (n: number | null | undefined) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";

function CabRequestFormContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || "";
  const refParam = searchParams.get("ref") || "";
  const homestayParam = searchParams.get("h") || searchParams.get("homestay") || "";
  const isNoLink = !token && !refParam && !homestayParam;

  // Multi-step form state: 1 = Route & Stops, 2 = Schedule & Travelers, 3 = Review & Submit
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [linkState, setLinkState] = useState<"loading" | "valid" | "invalid">(() =>
    isNoLink ? "invalid" : "loading"
  );
  const [link, setLink] = useState<GuestLink | null>(null);

  // Active Tab: Custom Tour is the default active tab on initial page load
  const [activeTab, setActiveTab] = useState<"custom" | "popular">("custom");
  const [selectedPopularRouteId, setSelectedPopularRouteId] = useState<string>("homestay-to-bagdogra");

  // Round Trip preference (Requirement 5)
  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(false);

  // Pickup & Drop locations
  const [pickup, setPickup] = useState("");
  const [customPickup, setCustomPickup] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [customDestinations, setCustomDestinations] = useState<string[]>([""]);

  // Interactive Blinkit/Zepto Map Picker state (stationary center pin)
  const [mapTarget, setMapTarget] = useState<
    | { type: "pickup"; title: string; initialAddress: string }
    | { type: "drop"; index: number; title: string; initialAddress: string }
    | null
  >(null);

  // Guest Target Budget (Optional, ₹ - InDrive style)
  const [guestBudget, setGuestBudget] = useState<string>("");

  // Autocomplete / Suggestions state
  const [activeSuggestIdx, setActiveSuggestIdx] = useState<number | null>(null);
  const [placesList, setPlacesList] = useState<string[]>([]);

  // Schedule & Passengers (Requirement 7: Number of Passengers only)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowYmd = toLocalYmd(tomorrow);
  const [date, setDate] = useState(tomorrowYmd);
  const [time, setTime] = useState("09:00 AM");
  const [returnDate, setReturnDate] = useState(tomorrowYmd);
  const [returnTime, setReturnTime] = useState("06:00 PM");
  const [passengers, setPassengers] = useState(2);

  // Guest Details
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(true);

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
    refParam ? { reference: refParam, status: "" } : null
  );
  const [bookingNotFound, setBookingNotFound] = useState(false);
  const [tripStatus, setTripStatus] = useState<CabRequestStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Payment states
  const [showQr, setShowQr] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [qr, setQr] = useState({ url: "", data: "" });
  const [utrInput, setUtrInput] = useState("");
  const [editingClaim, setEditingClaim] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState("");

  // Rating states
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>("");
  const [submittingRating, setSubmittingRating] = useState<boolean>(false);
  const [ratingSuccess, setRatingSuccess] = useState<boolean>(false);
  const [ratingError, setRatingError] = useState<string>("");

  // Fetch curated places for tourist suggestions
  useEffect(() => {
    apiFetch<{ data?: Array<{ name?: string }> }>(API_ENDPOINTS.cabs.places())
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) {
          setPlacesList(res.data.map((p) => p.name || "").filter(Boolean));
        }
      })
      .catch(() => {});
  }, []);

  const getFilteredSuggestions = (query: string) => {
    const q = query.trim().toLowerCase();
    const presets = Array.from(
      new Set([
        ...DEFAULT_TOURIST_DESTINATIONS,
        ...placesList,
        ...(link?.config?.sightseeingPresets || []),
      ])
    );
    if (!q) return presets.slice(0, 8);
    return presets.filter((p) => p.toLowerCase().includes(q)).slice(0, 8);
  };

  const handleSelectSuggestion = (place: string, idx: number) => {
    const copy = [...customDestinations];
    copy[idx] = place;
    setCustomDestinations(copy);
    setActiveSuggestIdx(null);
  };

  const handleSelectPopularRoute = (routeId: string) => {
    setSelectedPopularRouteId(routeId);
    const route = POPULAR_TRANSFER_ROUTES.find((r) => r.id === routeId);
    if (!route) return;

    const homestayPlace = link?.pickup || link?.homestayName || "Verified Partner Homestay";
    if (route.direction === "outbound") {
      setCustomPickup(false);
      setPickup(homestayPlace);
      setCustomDestinations([route.to]);
    } else {
      setCustomPickup(true);
      setPickup(route.from);
      setCustomDestinations([homestayPlace]);
    }
  };

  const getResolvedPickup = (): string => {
    if (activeTab === "popular") {
      const route = POPULAR_TRANSFER_ROUTES.find((r) => r.id === selectedPopularRouteId);
      if (!route) return link?.pickup || link?.homestayName || "Verified Partner Homestay";
      const homestayPlace = link?.pickup || link?.homestayName || "Verified Partner Homestay";
      return route.direction === "outbound" ? homestayPlace : route.from;
    }
    if (!customPickup) {
      return link?.pickup || link?.homestayName || "Verified Partner Homestay";
    }
    return pickup.trim();
  };

  const getResolvedDestinations = (): string[] => {
    if (activeTab === "popular") {
      const route = POPULAR_TRANSFER_ROUTES.find((r) => r.id === selectedPopularRouteId);
      if (!route) return ["Bagdogra Airport (IXB)"];
      const homestayPlace = link?.pickup || link?.homestayName || "Verified Partner Homestay";
      return [route.direction === "outbound" ? route.to : homestayPlace];
    }
    return customDestinations.map((d) => d.trim()).filter(Boolean);
  };

  // Same checks the server runs on a round trip's return
  const getReturnError = (): string => {
    if (!isRoundTrip) return "";
    if (!returnDate || !returnTime) return "Round trips need a return date and time.";
    const returnAt = istInstant(returnDate, returnTime);
    if (!(returnAt > istInstant(date, time))) return "Return must be after the pickup date and time.";
    const horizonDays = link?.config?.bookingHorizonDays || 30;
    if (returnAt > Date.now() + (horizonDays + 1) * 86400000) return `Return date must be within the next ${horizonDays} days.`;
    const times = link?.config?.pickupTimes || [];
    if (times.length) {
      const start = times[0];
      const end = times[times.length - 1];
      const t = minutesOf(returnTime);
      if (t < minutesOf(start) || t > minutesOf(end)) return `Return time must be between ${start} and ${end}.`;
    }
    return "";
  };

  const fetchStatus = async (reference: string) => {
    setStatusLoading(true);
    try {
      const data = await apiFetch<CabRequestStatus>(API_ENDPOINTS.cabRequests.status(reference, token));
      setTripStatus(data);
    } catch (e) {
      if (isNotFound(e)) setBookingNotFound(true);
      // Otherwise ignored: network retry will refresh
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
          .catch((e) => {
            if (cancelled) return;
            if (isNotFound(e)) setBookingNotFound(true);
            setLinkState("valid");
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
                  upiId: siteConfig.upiId || process.env.NEXT_PUBLIC_UPI_ID || "",
                  supportPhone: (siteConfig.supportPhone || process.env.NEXT_PUBLIC_SUPPORT_PHONE || "").replace(/[^0-9]/g, ""),
                  supportEmail: siteConfig.supportEmail || "",
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
                      upiId: live.upiId || prev.config?.upiId || siteConfig.upiId || process.env.NEXT_PUBLIC_UPI_ID || "",
                      supportPhone: live.supportPhone || prev.config?.supportPhone || (siteConfig.supportPhone || process.env.NEXT_PUBLIC_SUPPORT_PHONE || "").replace(/[^0-9]/g, ""),
                      supportEmail: (live as any).supportEmail || prev.config?.supportEmail || siteConfig.supportEmail || "",
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
        const resolvedPickup =
          data.homestayName && data.pickup && !data.pickup.toLowerCase().includes(data.homestayName.toLowerCase())
            ? `${data.homestayName}, ${data.pickup}`
            : data.pickup || data.homestayName || "";
        setPickup(resolvedPickup);
        if (data.guestName) setGuestName(data.guestName);
        if (data.guestPhone) setGuestPhone(data.guestPhone);
        setLinkState("valid");
        if (refParam) {
          fetchStatus(refParam);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        // Link expired or used up: a guest with a trip reference can still see the status and pay
        if (!refParam || !isNotFound(e)) {
          setLinkState("invalid");
          return;
        }
        apiFetch<CabRequestStatus>(API_ENDPOINTS.cabRequests.status(refParam, token))
          .then((data) => {
            if (cancelled) return;
            setTripStatus(data);
            setLinkState("valid");
          })
          .catch(() => {
            if (!cancelled) setLinkState("invalid");
          });
      });

    return () => {
      cancelled = true;
    };
  }, [token, refParam, homestayParam]);

  // Status polling every 10 seconds while active
  useEffect(() => {
    const activeRef = confirmedTrip?.reference || refParam;
    if (!activeRef || bookingNotFound) return;
    const finalStatuses = ["COMPLETED", "CANCELLED", "EXPIRED"];
    if (tripStatus?.status && finalStatuses.includes(tripStatus.status)) return;

    const interval = setInterval(() => {
      apiFetch<CabRequestStatus>(API_ENDPOINTS.cabRequests.status(activeRef, token))
        .then((data) => {
          if (data?.status) setTripStatus(data);
        })
        .catch((e) => {
          if (isNotFound(e)) setBookingNotFound(true);
        });
    }, 10000);

    return () => clearInterval(interval);
  }, [confirmedTrip?.reference, refParam, token, tripStatus?.status, bookingNotFound]);

  const handleCopyUpi = (upiString: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(upiString);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (claimBusy || !tripStatus) return;
    if (!isUtr(utrInput)) {
      setClaimError("Enter the 12-digit UTR number from your UPI app.");
      return;
    }
    setClaimBusy(true);
    setClaimError("");
    try {
      const res = await apiFetch<{ advanceDueAt?: string | null; paymentClaim: PaymentClaim }>(
        API_ENDPOINTS.cabRequests.paymentClaim(tripStatus.reference, token),
        { method: "POST", body: JSON.stringify({ utr: cleanUtr(utrInput), phone: guestPhone || link?.guestPhone || "" }) }
      );
      setTripStatus((prev) => (prev ? { ...prev, paymentClaim: res.paymentClaim, advanceDueAt: res.advanceDueAt ?? prev.advanceDueAt } : prev));
      setUtrInput("");
      setEditingClaim(false);
    } catch (err: unknown) {
      setClaimError(err instanceof Error ? err.message : "Could not submit. Please try again.");
    } finally {
      setClaimBusy(false);
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
        body: JSON.stringify({ stars: selectedRating, comment: ratingComment, phone: guestPhone || link?.guestPhone || "" }),
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
    const resolvedPickup = getResolvedPickup();
    const destinations = getResolvedDestinations();

    if (!resolvedPickup) {
      setErrorMessage("Please select or enter a pickup location.");
      setCurrentStep(1);
      return;
    }

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

    if (!agreedToTerms) {
      setErrorMessage("Please agree to the Terms of Service and Privacy Policy to submit your request.");
      setCurrentStep(3);
      return;
    }

    const returnError = getReturnError();
    if (returnError) {
      setErrorMessage(returnError);
      setCurrentStep(2);
      return;
    }

    // Smallest enabled vehicle with enough seats (the largest one when none is big enough)
    const enabledVehicles = [...(link?.config?.vehicles?.length ? link.config.vehicles : FALLBACK_VEHICLES)].sort((a, b) => a.seats - b.seats);
    const autoVehicleType = (enabledVehicles.find((v) => v.seats >= passengers) || enabledVehicles[enabledVehicles.length - 1])?.value || "SUV";

    setSubmitting(true);
    try {
      const recaptchaToken = await getRecaptchaToken("guest_cab_request");
      const selectedDateObj = new Date(`${date}T12:00:00Z`);
      const payload = {
        pickup: resolvedPickup,
        destinations,
        pickupLat: pickupCoords?.latitude ?? null,
        pickupLng: pickupCoords?.longitude ?? null,
        guestBudget: guestBudget ? Number(guestBudget) : null,
        date: selectedDateObj.getTime(),
        time,
        passengers,
        vehicleType: autoVehicleType,
        isRoundTrip,
        returnDate: isRoundTrip ? new Date(`${returnDate}T12:00:00Z`).getTime() : undefined,
        returnTime: isRoundTrip ? returnTime : undefined,
        guestName: guestName.trim(),
        phone: cleanPhone,
        notes: notes.trim(),
        clientRequestId,
        recaptchaToken,
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

  const activeUpiId = tripStatus?.config?.upiId || link?.config?.upiId || siteConfig.upiId || process.env.NEXT_PUBLIC_UPI_ID || "";
  const activeSupportPhone = waNumber(tripStatus?.config?.supportPhone || link?.config?.supportPhone || siteConfig.supportPhone || process.env.NEXT_PUBLIC_SUPPORT_PHONE || "");
  const activeSupportEmail = tripStatus?.config?.supportEmail || link?.config?.supportEmail || siteConfig.supportEmail || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
  const payeeName = tripStatus?.config?.businessName || link?.config?.businessName || siteConfig.appName;
  // "" when no UPI ID is configured or the trip is not waiting for its advance: the UPI section is not shown
  const advanceUpiUrl =
    tripStatus?.status === "AWAITING_ADVANCE_PAYMENT" && !tripStatus.advancePaid && activeUpiId
      ? upiPayUrl({ upiId: activeUpiId, payee: payeeName, amount: Number(tripStatus.advanceAmount), reference: tripStatus.reference })
      : "";
  const claimPending = tripStatus?.paymentClaim?.status === "PENDING";

  // QR made in the browser: the payment details never go to a third-party QR service
  useEffect(() => {
    if (!advanceUpiUrl) return;
    let live = true;
    toDataURL(advanceUpiUrl, { margin: 1, width: 220 })
      .then((data) => live && setQr({ url: advanceUpiUrl, data }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [advanceUpiUrl]);

  if (linkState === "loading") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-xs font-medium text-[#57606A]">Connecting to verified cab network…</p>
        </div>
      </div>
    );
  }

  if (linkState === "invalid") {
    if (isNoLink) {
      return (
        <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6 text-[#1F2328]">
          <div className="max-w-md w-full rounded-2xl border border-[#D0D7DE] bg-white p-8 text-center space-y-5 shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100 shadow-xs">
              <Icon name="local_taxi" className="text-3xl text-emerald-700" />
            </div>

            <div>
              <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                Exclusive Guest Concierge
              </span>
              <h1 className="mt-2 text-xl font-extrabold text-[#1F2328]">
                {siteConfig.appName} Hill Cabs
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-[#57606A] leading-relaxed">
                Hill Cabs are arranged exclusively for guests of our partner homestays. Check your WhatsApp for your private booking link, or ask your host to send you a booking invite.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-left text-xs space-y-2 text-[#24292F]">
              <div className="flex items-center gap-2">
                <Icon name="verified" className="text-emerald-700 text-sm" />
                <span>Door-to-door mountain airport & station transfers</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="payments" className="text-emerald-700 text-sm" />
                <span>100% direct cash fare to mountain drivers</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="chat" className="text-emerald-700 text-sm" />
                <span>Direct WhatsApp coordination & tracking</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/#accommodations"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-900 transition-colors"
              >
                <Icon name="cottage" className="text-sm" />
                <span>View Partner Homestays</span>
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D0D7DE] bg-white px-5 py-2.5 text-xs font-semibold text-[#1F2328] hover:bg-[#F6F8FA] transition-colors"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

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
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (bookingNotFound) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-[#D0D7DE] bg-white p-8 text-center space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Icon name="search_off" className="text-2xl" />
          </div>
          <h1 className="text-base font-bold text-[#1F2328]">Booking Not Found</h1>
          <p className="text-xs text-[#57606A]">
            We could not find a cab booking for this reference. Please check the link in your WhatsApp message or contact your homestay host.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F2328] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1F2328] antialiased">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E1E4E8] bg-white/95 backdrop-blur-md px-4 py-3.5 shadow-xs">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-xs">
              HC
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#1F2328] text-sm tracking-tight">{siteConfig.appName}</span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                  Verified Mountain Network
                </span>
              </div>
              <p className="text-[11px] text-[#57606A] truncate max-w-[200px] sm:max-w-xs">
                {link?.homestayName || "Verified Hill Stay"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSupportPhone ? (
              <a
                href={`https://wa.me/${activeSupportPhone}?text=${encodeURIComponent(`Hello, I need assistance with cab booking on ${siteConfig.appName}.`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D0D7DE] bg-white px-3 py-1.5 text-xs font-semibold text-[#24292F] hover:bg-[#F6F8FA] transition-colors"
              >
                <Icon name="support_agent" className="text-sm text-emerald-700" />
                <span>Help</span>
              </a>
            ) : activeSupportEmail ? (
              <a
                href={`mailto:${activeSupportEmail}?subject=${encodeURIComponent(`${siteConfig.appName} Cab Assistance`)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D0D7DE] bg-white px-3 py-1.5 text-xs font-semibold text-[#24292F] hover:bg-[#F6F8FA] transition-colors"
              >
                <Icon name="support_agent" className="text-sm text-emerald-700" />
                <span>Help</span>
              </a>
            ) : null}
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
                        : ["CANCELLED", "EXPIRED"].includes(tripStatus?.status || confirmedTrip.status)
                        ? "bg-red-100 text-red-900 border border-red-300"
                        : "bg-amber-100 text-amber-900 border border-amber-300"
                    }`}
                  >
                    {STATUS_FRIENDLY_LABELS[tripStatus?.status || confirmedTrip.status] || tripStatus?.status || confirmedTrip.status || "Loading…"}
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

              {/* Fix 12: 5-Step Visual Timeline */}
              <div className="py-3">
                <div className="grid grid-cols-5 gap-1.5 text-center text-[11px]">
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-emerald-600" />
                    <span className="font-bold text-emerald-900 block truncate">Received</span>
                  </div>
                  <div className="space-y-1">
                    <div
                      className={`h-1.5 w-full rounded-full ${
                        ["QUOTE_RECEIVED", "AWAITING_ADVANCE_PAYMENT", "CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(
                          tripStatus?.status || ""
                        )
                          ? "bg-emerald-600"
                          : ["PENDING_REVIEW", "FINDING_DRIVER"].includes(tripStatus?.status || confirmedTrip.status)
                          ? "bg-blue-500 animate-pulse"
                          : "bg-[#E1E4E8]"
                      }`}
                    />
                    <span className="font-medium text-[#57606A] block truncate">Assigned</span>
                  </div>
                  <div className="space-y-1">
                    <div
                      className={`h-1.5 w-full rounded-full ${
                        ["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "")
                          ? "bg-emerald-600"
                          : tripStatus?.status === "AWAITING_ADVANCE_PAYMENT"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-[#E1E4E8]"
                      }`}
                    />
                    <span className="font-medium text-[#57606A] block truncate">Confirmed</span>
                  </div>
                  <div className="space-y-1">
                    <div
                      className={`h-1.5 w-full rounded-full ${
                        ["TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "")
                          ? "bg-emerald-600"
                          : ["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY"].includes(tripStatus?.status || "")
                          ? "bg-blue-400"
                          : "bg-[#E1E4E8]"
                      }`}
                    />
                    <span className="font-medium text-[#57606A] block truncate">In Progress</span>
                  </div>
                  <div className="space-y-1">
                    <div
                      className={`h-1.5 w-full rounded-full ${
                        tripStatus?.status === "COMPLETED" ? "bg-emerald-600" : "bg-[#E1E4E8]"
                      }`}
                    />
                    <span className="font-medium text-[#57606A] block truncate">Completed</span>
                  </div>
                </div>
              </div>

              {/* Bidding Radar / Active Searching Banner */}
              {["PENDING_REVIEW", "FINDING_DRIVER"].includes(tripStatus?.status || confirmedTrip.status) && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600" />
                      </div>
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                        {tripStatus?.awaitingOwner
                          ? "Request received"
                          : (tripStatus?.status || confirmedTrip.status) === "PENDING_REVIEW"
                          ? "Request received — finding drivers…"
                          : "Finding your driver in this valley…"}
                      </span>
                    </div>
                    <span className="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-semibold">
                      Auto-syncing
                    </span>
                  </div>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    {tripStatus?.awaitingOwner
                      ? "Received. The homestay will arrange your cab shortly."
                      : tripStatus?.quotesCount && tripStatus.quotesCount > 0
                      ? `${tripStatus.quotesCount} local driver quote(s) received. Best rate is being matched.`
                      : "Dispatched to verified local hill drivers. Connecting with available cabs near your homestay."}
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
                      {tripStatus.advanceDueAt && !claimPending && (
                        <p className="text-[11px] font-semibold text-amber-900">Pay by {formatIstDateTime(tripStatus.advanceDueAt)} IST</p>
                      )}
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

                  <p className="text-xs font-semibold text-[#57606A]">Driver details after payment.</p>

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

                  {tripStatus.paymentClaim?.status === "REJECTED" && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                      <p className="font-bold">Your payment could not be verified{tripStatus.paymentClaim.reason ? `: ${tripStatus.paymentClaim.reason}` : "."}</p>
                      <p className="mt-0.5">Please check the UTR in your UPI app and submit it again, or pay below.</p>
                    </div>
                  )}

                  {claimPending && (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-1">
                      <p className="flex items-center gap-1.5 font-bold text-emerald-950">
                        <Icon name="check_circle" className="text-sm" /> Payment submitted
                      </p>
                      <p>
                        UTR <span className="font-mono font-bold">{tripStatus.paymentClaim?.utr || "received"}</span>. Waiting for {payeeName} to confirm (usually within a few hours). Your driver stays reserved meanwhile.
                      </p>
                      {!editingClaim && (
                        <button type="button" onClick={() => { setEditingClaim(true); setUtrInput(tripStatus.paymentClaim?.utr || ""); }} className="font-semibold text-emerald-700 hover:underline cursor-pointer">
                          Wrong UTR? Correct it
                        </button>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    {tripStatus.paymentLinkUrl && !claimPending && (
                      <a
                        href={tripStatus.paymentLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white shadow hover:bg-emerald-900 transition-all cursor-pointer"
                      >
                        <Icon name="payments" className="text-base" /> Pay {formatInr(tripStatus.advanceAmount)} Online
                      </a>
                    )}
                  </div>

                  {/* Manual UPI: pay, then send the UTR for us to verify */}
                  {advanceUpiUrl && !claimPending && (
                    <div className="rounded-xl border border-[#D0D7DE] bg-white p-3.5 text-xs space-y-3">
                      <ol className="list-decimal pl-4 space-y-0.5 text-[#24292F]">
                        <li>Pay <strong>{formatInr(tripStatus.advanceAmount)}</strong> to the UPI ID below.</li>
                        <li>Enter the 12-digit UTR number from your UPI app below.</li>
                      </ol>

                      {/* upi:// opens the UPI app on Android; iPhones may not open it, so the ID and QR are shown too */}
                      <a
                        href={advanceUpiUrl}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 transition-all cursor-pointer"
                      >
                        <Icon name="account_balance_wallet" className="text-base" /> Pay {formatInr(tripStatus.advanceAmount)} with UPI app
                      </a>

                      <div className="space-y-1.5 rounded-lg bg-[#F6F8FA] p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#57606A]">UPI ID</span>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-[#1F2328] break-all">{activeUpiId}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyUpi(activeUpiId)}
                              className="rounded px-2 py-0.5 font-bold bg-white border border-[#D0D7DE] text-xs hover:bg-[#E1E4E8] cursor-pointer"
                            >
                              {copiedUpi ? "Copied" : "Copy"}
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#57606A]">Amount</span>
                          <span className="font-mono font-bold text-[#1F2328]">{formatInr(tripStatus.advanceAmount)}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#57606A]">Note / remark</span>
                          <span className="font-mono font-bold text-[#1F2328]">{tripStatus.reference}</span>
                        </div>
                      </div>

                      {/* QR open on wide screens; behind a button on phones (they pay from the same device) */}
                      <button type="button" onClick={() => setShowQr(!showQr)} className="md:hidden font-semibold text-emerald-700 hover:underline cursor-pointer">
                        {showQr ? "Hide QR" : "Show QR"}
                      </button>
                      {qr.url === advanceUpiUrl && (
                        <div className={`${showQr ? "flex" : "hidden md:flex"} flex-col items-center justify-center`}>
                          <img src={qr.data} alt="UPI payment QR code" className="h-44 w-44 rounded-lg border border-[#D0D7DE] p-1 bg-white" />
                          <span className="mt-1 text-[11px] text-[#57606A]">Scan with any UPI app</span>
                        </div>
                      )}
                    </div>
                  )}

                  {advanceUpiUrl && (!claimPending || editingClaim) && (
                    <form onSubmit={handleSubmitClaim} className="rounded-xl border border-[#D0D7DE] bg-white p-3.5 text-xs space-y-2">
                      <label htmlFor="utr" className="block font-semibold text-[#1F2328]">
                        UPI reference / UTR number (12 digits)
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="utr"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={20}
                          placeholder="e.g. 412345678901"
                          value={utrInput}
                          onChange={(e) => setUtrInput(e.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-[#D0D7DE] px-3 py-2 font-mono text-sm text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                        />
                        <button type="submit" disabled={claimBusy} className="rounded-lg bg-[#1F2328] px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-60 cursor-pointer">
                          {claimBusy ? "Submitting..." : "Submit"}
                        </button>
                      </div>
                      <p className="text-[11px] text-[#57606A]">Find it in your UPI app under the payment details (also called UPI Ref No. or Transaction ID).</p>
                      {claimError && <p className="text-[11px] font-semibold text-red-700">{claimError}</p>}
                    </form>
                  )}

                  {/* Verification & Help */}
                  <div className="pt-1 text-center space-y-2">
                    {activeSupportPhone ? (
                      <>
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
                            href={`https://wa.me/${activeSupportPhone}?text=${encodeURIComponent(`Namaste, regarding cab request ${tripStatus.reference}: the quoted fare is ₹${tripStatus.agreedFare}. Can you assist with the pricing or vehicle options?`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#57606A] hover:text-[#1F2328] hover:underline"
                          >
                            <Icon name="chat" className="text-xs text-emerald-700" /> Need a Different Fare or Vehicle? Chat with Desk
                          </a>
                        </div>
                      </>
                    ) : activeSupportEmail ? (
                      <a
                        href={`mailto:${activeSupportEmail}?subject=${encodeURIComponent(`Payment Confirmation - Reference ${tripStatus.reference}`)}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#128C7E] hover:underline"
                      >
                        <Icon name="mail" className="text-sm" /> Email Payment Confirmation ({activeSupportEmail})
                      </a>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Cancelled / Expired Details */}
              {["CANCELLED", "EXPIRED"].includes(tripStatus?.status || "") && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-1.5 text-xs text-red-900">
                  <p className="font-bold">
                    {tripStatus?.status === "EXPIRED" ? "This cab request has expired." : "This cab request was cancelled."}
                  </p>
                  {tripStatus?.cancellationReason && <p>Reason: {tripStatus.cancellationReason}</p>}
                  {tripStatus?.refundStatus && REFUND_LABELS[tripStatus.refundStatus] && (
                    <p className="font-semibold">Advance: {REFUND_LABELS[tripStatus.refundStatus]}</p>
                  )}
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
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            Verified
                          </span>
                        </div>
                        <p className="text-xs text-[#57606A]">{tripStatus?.vehicle || "Mountain Cab"}</p>
                      </div>
                    </div>

                    {tripStatus?.driverPhone?.includes("*") ? (
                      <div className="text-right max-w-[50%]">
                        <p className="font-mono text-xs font-bold text-[#1F2328]">{tripStatus.driverPhone}</p>
                        <p className="text-[10px] text-[#57606A]">Driver contact appears after your advance is confirmed.</p>
                      </div>
                    ) : tripStatus?.driverPhone && (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${tripStatus.driverPhone}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-[#D0D7DE] text-[#24292F] shadow-xs hover:bg-[#F6F8FA]"
                          title="Call Driver"
                        >
                          <Icon name="phone" className="text-sm text-emerald-700" />
                        </a>
                        <a
                          href={`https://wa.me/${waNumber(tripStatus.driverPhone)}`}
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
            <div className="rounded-2xl border border-[#D0D7DE] bg-white p-2.5 sm:p-3 shadow-xs">
              <div className="grid grid-cols-3 gap-2 text-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
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
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    currentStep === 2 ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "text-[#57606A] hover:bg-[#F6F8FA]"
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${currentStep === 2 ? "bg-emerald-600 text-white" : "bg-[#D0D7DE] text-white"}`}>
                    2
                  </span>
                  <span>Schedule</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    currentStep === 3 ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "text-[#57606A] hover:bg-[#F6F8FA]"
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${currentStep === 3 ? "bg-emerald-600 text-white" : "bg-[#D0D7DE] text-white"}`}>
                    3
                  </span>
                  <span>Review</span>
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
              <div className="space-y-5 rounded-2xl border border-[#D0D7DE] bg-white p-4 sm:p-6 shadow-xs">
                {/* 2 Tabs: Custom Tour (Default) & Popular Mountain Routes */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F6F8FA] border border-[#D0D7DE] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab("custom")}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "custom"
                        ? "bg-white text-emerald-950 shadow-xs border border-emerald-600/30 font-extrabold"
                        : "text-[#57606A] hover:text-[#1F2328]"
                    }`}
                  >
                    <Icon name="edit_road" className="text-sm text-emerald-700" />
                    <span>Custom Tour</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("popular");
                      handleSelectPopularRoute(selectedPopularRouteId || "homestay-to-bagdogra");
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "popular"
                        ? "bg-white text-emerald-950 shadow-xs border border-emerald-600/30 font-extrabold"
                        : "text-[#57606A] hover:text-[#1F2328]"
                    }`}
                  >
                    <Icon name="alt_route" className="text-sm text-emerald-700" />
                    <span>Popular Mountain Routes</span>
                  </button>
                </div>

                {/* TAB 1: CUSTOM TOUR (Default Active) */}
                {activeTab === "custom" && (
                  <div className="space-y-4">
                    {/* Pickup Location Mode */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#1F2328] flex items-center gap-1.5">
                          <Icon name="location_on" className="text-xs text-emerald-700" />
                          <span>Pickup Location</span>
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setMapTarget({
                              type: "pickup",
                              title: "Move Map Pin for Pickup",
                              initialAddress: getResolvedPickup(),
                            })
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
                          title="Pin on Map (Blinkit style)"
                        >
                          <Icon name="pin_drop" className="text-xs" />
                          <span>{pickupCoords ? "Adjust Pin on Map" : "Move Pin on Map"}</span>
                        </button>
                      </div>

                      {/* 2-Option Pickup Selection: At Homestay vs Other Location */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomPickup(false);
                            const homestayLoc = link?.pickup
                              ? (link.homestayName && !link.pickup.toLowerCase().includes(link.homestayName.toLowerCase())
                                  ? `${link.homestayName}, ${link.pickup}`
                                  : link.pickup)
                              : link?.homestayName || "Homestay gate";
                            setPickup(homestayLoc);
                          }}
                          className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            !customPickup
                              ? "bg-emerald-50/70 border-emerald-600 text-emerald-950 ring-1 ring-emerald-600 shadow-2xs"
                              : "bg-[#F6F8FA] border-[#D0D7DE] text-[#57606A] hover:bg-[#E1E4E8]"
                          }`}
                        >
                          <Icon name="home" className="text-sm text-emerald-700" />
                          <span>At Homestay</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCustomPickup(true);
                            if (!pickup || pickup === link?.pickup || pickup === link?.homestayName) {
                              setPickup("");
                            }
                          }}
                          className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            customPickup
                              ? "bg-emerald-50/70 border-emerald-600 text-emerald-950 ring-1 ring-emerald-600 shadow-2xs"
                              : "bg-[#F6F8FA] border-[#D0D7DE] text-[#57606A] hover:bg-[#E1E4E8]"
                          }`}
                        >
                          <Icon name="edit_location" className="text-sm text-emerald-700" />
                          <span>Other Location</span>
                        </button>
                      </div>

                      {!customPickup ? (
                        <div className="space-y-1.5">
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                                <Icon name="storefront" className="text-sm" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-emerald-950 truncate">
                                  {link?.homestayName || "Verified Partner Homestay"}
                                </p>
                                <p className="text-[11px] text-emerald-800/80 truncate">
                                  Driver navigates straight to homestay gate
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900 uppercase">
                              Homestay
                            </span>
                          </div>

                          {pickupCoords && (
                            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-900 border border-emerald-200">
                              <span className="flex items-center gap-1 font-medium">
                                <Icon name="my_location" className="text-xs text-emerald-700" />
                                <span>GPS Pin: {pickupCoords.latitude.toFixed(5)}, {pickupCoords.longitude.toFixed(5)}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setPickupCoords(null)}
                                className="text-[10px] text-emerald-700 font-bold hover:underline"
                              >
                                Reset Pin
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={pickup}
                              onChange={(e) => setPickup(e.target.value)}
                              placeholder="Enter pickup address, landmark, or station"
                              className="w-full rounded-xl border border-[#D0D7DE] bg-white px-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none shadow-2xs"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setMapTarget({
                                  type: "pickup",
                                  title: "Move Map Pin for Pickup",
                                  initialAddress: pickup,
                                })
                              }
                              className="inline-flex items-center gap-1 shrink-0 rounded-xl border border-emerald-600/40 bg-emerald-50/70 px-3 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="Move pin on map"
                            >
                              <Icon name="pin_drop" className="text-sm text-emerald-700" />
                              <span className="hidden sm:inline">Map Pin</span>
                            </button>
                          </div>

                          {pickupCoords && (
                            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-900 border border-emerald-200">
                              <span className="flex items-center gap-1 font-medium">
                                <Icon name="my_location" className="text-xs text-emerald-700" />
                                <span>GPS Pin: {pickupCoords.latitude.toFixed(5)}, {pickupCoords.longitude.toFixed(5)}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setPickupCoords(null)}
                                className="text-[10px] text-emerald-700 font-bold hover:underline"
                              >
                                Clear Pin
                              </button>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5">
                            {["Bagdogra Airport (IXB)", "NJP Railway Station", "Darjeeling Mall", "Siliguri Junction"].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setPickup(preset)}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                                  pickup === preset
                                    ? "bg-emerald-100 border-emerald-400 text-emerald-900 font-bold"
                                    : "bg-[#F6F8FA] border-[#D0D7DE] text-[#57606A] hover:bg-[#E1E4E8]"
                                }`}
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Drop Locations (Multiple stops + Suggestions) */}
                    <div className="space-y-2.5 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#1F2328] flex items-center gap-1.5">
                          <Icon name="navigation" className="text-xs text-emerald-700" />
                          <span>Drop Locations</span>
                        </label>
                        <span className="text-[11px] text-[#57606A]">Add 1 or more stops</span>
                      </div>

                      <div className="space-y-2.5">
                        {customDestinations.map((dest, idx) => {
                          const suggestions = getFilteredSuggestions(dest);
                          const isShowingSuggestions = activeSuggestIdx === idx;

                          return (
                            <div key={idx} className="relative">
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F6F8FA] border border-[#D0D7DE] text-[11px] font-bold text-[#57606A]">
                                  {idx + 1}
                                </span>
                                <div className="relative flex-1">
                                  <input
                                    type="text"
                                    value={dest}
                                    onFocus={() => setActiveSuggestIdx(idx)}
                                    onChange={(e) => {
                                      const copy = [...customDestinations];
                                      copy[idx] = e.target.value;
                                      setCustomDestinations(copy);
                                      setActiveSuggestIdx(idx);
                                    }}
                                    placeholder={idx === 0 ? "Enter destination (e.g. Tiger Hill, Batasia Loop)" : `Destination ${idx + 1}`}
                                    className="w-full rounded-xl border border-[#D0D7DE] bg-white px-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none shadow-2xs pr-8"
                                  />
                                  {dest && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const copy = [...customDestinations];
                                        copy[idx] = "";
                                        setCustomDestinations(copy);
                                      }}
                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C959F] hover:text-[#1F2328] cursor-pointer"
                                    >
                                      <Icon name="close" className="text-xs" />
                                    </button>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setMapTarget({
                                      type: "drop",
                                      index: idx,
                                      title: `Set Destination ${idx + 1} Pin`,
                                      initialAddress: dest,
                                    })
                                  }
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D0D7DE] text-[#57606A] hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors cursor-pointer"
                                  title="Pick drop location on map"
                                >
                                  <Icon name="pin_drop" className="text-sm" />
                                </button>

                                {customDestinations.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const copy = customDestinations.filter((_, i) => i !== idx);
                                      setCustomDestinations(copy.length > 0 ? copy : [""]);
                                      setActiveSuggestIdx(null);
                                    }}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D0D7DE] text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Remove this destination"
                                  >
                                    <Icon name="delete" className="text-sm" />
                                  </button>
                                )}
                              </div>

                              {/* Interactive Autocomplete / Tourist Spots Popover */}
                              {isShowingSuggestions && (
                                <div className="absolute z-20 left-9 right-0 mt-1 rounded-xl border border-[#D0D7DE] bg-white p-2 shadow-lg space-y-1">
                                  <div className="flex items-center justify-between px-2 py-1 border-b border-[#F0F2F5]">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#57606A]">
                                      Suggested Tourist Spots & Places
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveSuggestIdx(null)}
                                      className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer"
                                    >
                                      Done
                                    </button>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto divide-y divide-[#F6F8FA]">
                                    {suggestions.length > 0 ? (
                                      suggestions.map((place) => (
                                        <button
                                          key={place}
                                          type="button"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => handleSelectSuggestion(place, idx)}
                                          className="w-full text-left px-2.5 py-1.5 text-xs text-[#1F2328] hover:bg-emerald-50 hover:text-emerald-900 rounded-lg flex items-center justify-between transition-colors cursor-pointer"
                                        >
                                          <span className="truncate">{place}</span>
                                          <Icon name="north_west" className="text-xs text-[#8C959F]" />
                                        </button>
                                      ))
                                    ) : (
                                      <div className="px-2.5 py-2 text-xs text-[#57606A]">
                                        Type a specific landmark or attraction
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Destination Button (Up to 6 stops) */}
                      {customDestinations.length < 6 && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomDestinations([...customDestinations, ""]);
                            setActiveSuggestIdx(customDestinations.length);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-emerald-600/60 bg-emerald-50/50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100/60 transition-colors cursor-pointer"
                        >
                          <Icon name="add" className="text-xs font-bold" />
                          <span>Add Destination</span>
                        </button>
                      )}
                    </div>

                    {/* Round Trip Toggle (Requirement 5) */}
                    <div className="rounded-xl border border-[#D0D7DE] bg-[#F6F8FA] p-3.5 flex items-center justify-between">
                      <div className="space-y-0.5 pr-2">
                        <span className="text-xs font-bold text-[#1F2328] flex items-center gap-1.5">
                          <Icon name="sync_alt" className="text-xs text-emerald-700" />
                          <span>Return to Homestay</span>
                        </span>
                        <p className="text-[11px] text-[#57606A]">
                          {isRoundTrip
                            ? "Round trip: Driver will wait and take you back to homestay."
                            : "One-way trip: Driver drops you off at the final destination."}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isRoundTrip}
                        onClick={() => setIsRoundTrip(!isRoundTrip)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isRoundTrip ? "bg-emerald-600" : "bg-[#D0D7DE]"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            isRoundTrip ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: POPULAR MOUNTAIN ROUTES (4 Transfer Options Only, Zero Prices) */}
                {activeTab === "popular" && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-[#1F2328]">Select Transfer Route</h3>
                      <p className="text-[11px] text-[#57606A]">Direct transfers between your homestay and major transit hubs.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {POPULAR_TRANSFER_ROUTES.map((route) => {
                        const isSelected = selectedPopularRouteId === route.id;
                        return (
                          <button
                            key={route.id}
                            type="button"
                            onClick={() => handleSelectPopularRoute(route.id)}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? "border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 shadow-2xs"
                                : "border-[#D0D7DE] bg-white hover:border-[#8C959F]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                                  isSelected ? "bg-emerald-600 text-white" : "bg-[#F6F8FA] text-emerald-800"
                                }`}>
                                  <Icon name={route.direction === "outbound" ? "flight_takeoff" : "flight_land"} className="text-base" />
                                </span>
                                <div>
                                  <span className="text-xs font-extrabold tracking-wide text-[#1F2328] block">
                                    {route.name}
                                  </span>
                                  <span className="text-[11px] text-[#57606A]">
                                    {route.direction === "outbound" ? "Homestay Drop to Hub" : "Hub Pickup to Homestay"}
                                  </span>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                                  <Icon name="check" className="text-xs" />
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Round Trip Toggle for Transfer */}
                    <div className="rounded-xl border border-[#D0D7DE] bg-[#F6F8FA] p-3.5 flex items-center justify-between">
                      <div className="space-y-0.5 pr-2">
                        <span className="text-xs font-bold text-[#1F2328] flex items-center gap-1.5">
                          <Icon name="sync_alt" className="text-xs text-emerald-700" />
                          <span>Round Trip Transfer</span>
                        </span>
                        <p className="text-[11px] text-[#57606A]">
                          {isRoundTrip
                            ? "Round trip: Includes return transfer."
                            : "One-way transfer."}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isRoundTrip}
                        onClick={() => setIsRoundTrip(!isRoundTrip)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isRoundTrip ? "bg-emerald-600" : "bg-[#D0D7DE]"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            isRoundTrip ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* Continue to Step 2 Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const pickupLoc = getResolvedPickup();
                      const drops = getResolvedDestinations();
                      if (!pickupLoc) {
                        setErrorMessage("Please choose or specify a pickup location.");
                        return;
                      }
                      if (drops.length === 0) {
                        setErrorMessage("Please specify at least one drop location.");
                        return;
                      }
                      setErrorMessage("");
                      setCurrentStep(2);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer"
                  >
                    <span>Continue to Schedule & Travelers</span>
                    <Icon name="arrow_forward" className="text-sm" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SCHEDULE & TRAVELERS */}
            {currentStep === 2 && (
              <div className="space-y-5 rounded-2xl border border-[#D0D7DE] bg-white p-4 sm:p-6 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-[#1F2328]">When are you traveling?</h2>
                  <p className="text-xs text-[#57606A]">Set your schedule and traveler count. Verified local drivers will receive your request.</p>
                </div>

                {/* Date Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#1F2328] block">Date of Travel</label>
                  <input
                    type="date"
                    value={date}
                    min={toLocalYmd(new Date())}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setDate(newDate);
                      if (returnDate && returnDate < newDate) {
                        setReturnDate(newDate);
                      }
                    }}
                    className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none bg-white shadow-2xs"
                  />
                </div>

                {/* Time Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#1F2328] block">Pickup Time</label>
                    <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                      <Icon name="schedule" className="text-xs text-emerald-700" />
                      <span>{time}</span>
                    </span>
                  </div>

                  {/* Native Clock Dialer / Time Picker */}
                  <div className="relative flex items-center">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-emerald-700">
                      <Icon name="alarm" className="text-base" />
                    </div>
                    <input
                      type="time"
                      value={toTime24(time)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setTime(toTime12(e.target.value));
                        }
                      }}
                      className="w-full rounded-xl border border-[#D0D7DE] bg-white py-2.5 pl-10 pr-3 sm:pr-24 text-sm font-bold text-[#1F2328] focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-2xs cursor-pointer"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 hidden sm:flex items-center pr-3 text-[11px] text-[#57606A] font-medium">
                      Tap for clock
                    </div>
                  </div>

                  {/* Quick Mountain Departure Shortcuts */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] text-[#57606A] font-medium">Popular Mountain Departures:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {[
                        { label: "04:00 AM", sub: "Tiger Hill Sunrise" },
                        { label: "07:30 AM", sub: "Flight / Train Drop" },
                        { label: "09:30 AM", sub: "Check-out Transfer" },
                        { label: "10:30 AM", sub: "Day Sightseeing" },
                        { label: "02:00 PM", sub: "Afternoon Tour" },
                        { label: "06:00 PM", sub: "Dinner / Mall Road" },
                      ].map((slot) => {
                        const isMatch = time === slot.label;
                        return (
                          <button
                            key={slot.label}
                            type="button"
                            onClick={() => setTime(slot.label)}
                            className={`flex flex-col items-start px-2.5 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                              isMatch
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs ring-1 ring-emerald-600"
                                : "bg-[#F6F8FA] border-[#D0D7DE] text-[#24292F] hover:bg-[#E1E4E8]"
                            }`}
                          >
                            <span className={`text-xs font-bold leading-none ${isMatch ? "text-white" : "text-[#1F2328]"}`}>
                              {slot.label}
                            </span>
                            <span className={`text-[10px] mt-1 line-clamp-1 ${isMatch ? "text-emerald-100" : "text-[#57606A]"}`}>
                              {slot.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Round trip: return date and time (same controls as the pickup) */}
                {isRoundTrip && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#1F2328] block">Return Date</label>
                      <input
                        type="date"
                        value={returnDate}
                        min={date || toLocalYmd(new Date())}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none bg-white shadow-2xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#1F2328] block">Return Time</label>
                        <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                          <Icon name="schedule" className="text-xs text-emerald-700" />
                          <span>{returnTime}</span>
                        </span>
                      </div>
                      <div className="relative flex items-center">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-emerald-700">
                          <Icon name="alarm" className="text-base" />
                        </div>
                        <input
                          type="time"
                          value={toTime24(returnTime)}
                          onChange={(e) => {
                            if (e.target.value) {
                              setReturnTime(toTime12(e.target.value));
                            }
                          }}
                          className="w-full rounded-xl border border-[#D0D7DE] bg-white py-2.5 pl-10 pr-3 sm:pr-24 text-sm font-bold text-[#1F2328] focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-2xs cursor-pointer"
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 hidden sm:flex items-center pr-3 text-[11px] text-[#57606A] font-medium">
                          Tap for clock
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Requirement 7: Passenger Count Only (No Vehicle Class Selection) */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-[#1F2328] block">Number of Passengers</label>
                  <div className="flex items-center justify-between rounded-xl border border-[#D0D7DE] p-4 bg-[#F6F8FA]">
                    <div>
                      <span className="text-xs font-bold text-[#1F2328] block">Total Travelers</span>
                      <span className="text-[11px] text-[#57606A]">Adults + Children traveling together</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={passengers <= 1}
                        onClick={() => setPassengers(Math.max(1, passengers - 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D0D7DE] bg-white font-bold text-base text-[#1F2328] hover:bg-[#F0F2F5] disabled:opacity-40 cursor-pointer transition-colors"
                      >
                        –
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={passengers}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 1) {
                            setPassengers(Math.min(20, val));
                          }
                        }}
                        className="w-12 text-center font-bold text-sm text-[#1F2328] bg-transparent focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={passengers >= 20}
                        onClick={() => setPassengers(Math.min(20, passengers + 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D0D7DE] bg-white font-bold text-base text-[#1F2328] hover:bg-[#F0F2F5] disabled:opacity-40 cursor-pointer transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#57606A]">
                    Drivers with suitably-sized mountain vehicles will send you their quotes directly.
                  </p>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="w-1/3 rounded-xl border border-[#D0D7DE] bg-white py-3 text-xs font-bold text-[#24292F] hover:bg-[#F6F8FA] cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!date) {
                        setErrorMessage("Please select a date of travel.");
                        return;
                      }
                      if (!passengers || passengers < 1) {
                        setErrorMessage("Please specify at least 1 passenger.");
                        return;
                      }
                      const returnError = getReturnError();
                      if (returnError) {
                        setErrorMessage(returnError);
                        return;
                      }
                      setErrorMessage("");
                      setCurrentStep(3);
                    }}
                    className="w-2/3 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer"
                  >
                    <span>Continue to Review</span>
                    <Icon name="arrow_forward" className="text-sm" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: GUEST DETAILS & REVIEW */}
            {currentStep === 3 && (
              <div className="space-y-5 rounded-2xl border border-[#D0D7DE] bg-white p-4 sm:p-6 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-[#1F2328]">Passenger Details & Trip Review</h2>
                  <p className="text-xs text-[#57606A]">Enter your contact information and verify your itinerary before submitting.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-[#1F2328] block mb-1">Guest Full Name</label>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Ankit Sharma"
                      className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#1F2328] block mb-1">
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
                        className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none shadow-2xs"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-[#57606A]">
                      Drivers will send their quotes and booking confirmation directly to this WhatsApp number.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#1F2328] block mb-1">
                      Luggage or Special Requests (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. 3 large bags, elderly passenger, luggage roof rack needed"
                      className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none shadow-2xs"
                    />
                  </div>

                  {/* Target Budget (Optional, ₹ - InDrive style) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-[#1F2328]">Target Budget (Optional, ₹)</label>
                      <span className="text-[10px] text-[#57606A]">Guest price expectation</span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-xs font-bold text-[#57606A]">₹</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={guestBudget}
                        onChange={(e) => setGuestBudget(e.target.value.replace(/\D/g, ""))}
                        placeholder="e.g. 2500"
                        className="w-full rounded-xl border border-[#D0D7DE] pl-7 pr-3.5 py-2.5 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none shadow-2xs bg-white"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-[#57606A]">
                      Local verified drivers will see your target budget when submitting their quotes on WhatsApp.
                    </p>
                  </div>
                </div>

                {/* Trip Review Summary Card (Zero Prices) */}
                <div className="rounded-xl border border-[#D0D7DE] bg-[#F6F8FA] p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-[#E1E4E8] pb-2">
                    <span className="font-bold text-[#1F2328] text-xs">Trip Summary</span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                      {isRoundTrip ? "Round Trip" : "One-Way"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#57606A] shrink-0 font-medium">Pickup:</span>
                      <span className="font-bold text-[#1F2328] text-right truncate">
                        {getResolvedPickup()}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#57606A] shrink-0 font-medium">
                        {getResolvedDestinations().length > 1 ? "Drop Locations:" : "Drop Location:"}
                      </span>
                      <div className="text-right">
                        {getResolvedDestinations().map((d, i) => (
                          <div key={i} className="font-bold text-[#1F2328]">
                            {getResolvedDestinations().length > 1 ? `${i + 1}. ${d}` : d}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#57606A] shrink-0 font-medium">Return to Homestay:</span>
                      <span className="font-bold text-[#1F2328]">
                        {isRoundTrip ? "Yes (Driver waits & returns)" : "No (One-way drop)"}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#57606A] shrink-0 font-medium">Schedule:</span>
                      <span className="font-semibold text-[#1F2328]">{date} at {time}</span>
                    </div>

                    {isRoundTrip && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[#57606A] shrink-0 font-medium">Return:</span>
                        <span className="font-semibold text-[#1F2328]">{returnDate} at {returnTime}</span>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#57606A] shrink-0 font-medium">Passengers:</span>
                      <span className="font-semibold text-[#1F2328]">{passengers} {passengers === 1 ? "Passenger" : "Passengers"}</span>
                    </div>

                    {pickupCoords && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[#57606A] shrink-0 font-medium">GPS Pin:</span>
                        <span className="font-mono text-[11px] text-[#57606A]">{pickupCoords.latitude.toFixed(4)}, {pickupCoords.longitude.toFixed(4)}</span>
                      </div>
                    )}

                    {guestBudget && (
                      <div className="flex items-start justify-between gap-2 border-t border-[#E1E4E8] pt-2">
                        <span className="text-[#57606A] shrink-0 font-medium">Target Budget:</span>
                        <span className="font-bold text-emerald-800">₹{Number(guestBudget).toLocaleString("en-IN")}</span>
                      </div>
                    )}

                    {guestName && (
                      <div className="flex items-start justify-between gap-2 border-t border-[#E1E4E8] pt-2">
                        <span className="text-[#57606A] shrink-0 font-medium">Guest:</span>
                        <span className="font-semibold text-[#1F2328]">{guestName} {guestPhone ? `(+91 ${guestPhone})` : ""}</span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-2.5 text-[11px] text-emerald-900 leading-snug">
                    <p className="font-semibold">💡 No immediate payment required.</p>
                    <p className="text-emerald-800/90 mt-0.5">
                      Drivers will quote their competitive prices based on your exact route and passengers. You can choose the best quote.
                    </p>
                  </div>

                  {/* DPDP Act 2023 Consent Notice */}
                  <div className="flex items-start gap-2.5 pt-1 pb-0.5">
                    <input
                      type="checkbox"
                      id="dpdp-consent"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[#D0D7DE] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="dpdp-consent" className="text-[11px] leading-relaxed text-[#57606A] cursor-pointer">
                      I agree to the{" "}
                      <Link href="/legal/terms" target="_blank" className="font-semibold text-emerald-700 underline hover:text-emerald-800">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/legal/privacy" target="_blank" className="font-semibold text-emerald-700 underline hover:text-emerald-800">
                        Privacy Policy
                      </Link>
                      . My contact info will be used solely for verified driver coordination.
                    </label>
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
                    disabled={submitting || !agreedToTerms}
                    onClick={handleFormSubmit}
                    className="w-2/3 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Submitting Request…
                      </span>
                    ) : (
                      <>
                        <Icon name="local_taxi" className="text-sm" />
                        <span>Submit Cab Request</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Blinkit/Zepto Map Picker Modal */}
      <WebLocationPicker
        isOpen={mapTarget !== null}
        title={mapTarget?.title}
        initialAddress={mapTarget?.initialAddress}
        initialCoords={mapTarget?.type === "pickup" ? pickupCoords : null}
        onClose={() => setMapTarget(null)}
        onConfirm={(loc: PickedLocation) => {
          if (mapTarget?.type === "pickup") {
            setPickup(loc.address);
            setPickupCoords({ latitude: loc.latitude, longitude: loc.longitude });
            setCustomPickup(true);
          } else if (mapTarget?.type === "drop") {
            const copy = [...customDestinations];
            copy[mapTarget.index] = loc.address;
            setCustomDestinations(copy);
          }
          setMapTarget(null);
        }}
      />
    </div>
  );
}

export default function CabRequestPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-emerald-700 font-medium">Loading…</div>}>
      <CabRequestFormContent />
    </Suspense>
  );
}
