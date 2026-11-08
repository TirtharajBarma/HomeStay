"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
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
    name: "Homestay → Bagdogra Airport",
    from: "Homestay",
    to: "Bagdogra Airport (IXB)",
    direction: "outbound",
    icon: "flight_takeoff",
  },
  {
    id: "homestay-to-njp",
    name: "Homestay → NJP Railway Station",
    from: "Homestay",
    to: "NJP Railway Station",
    direction: "outbound",
    icon: "train",
  },
  {
    id: "njp-to-homestay",
    name: "NJP Railway Station → Homestay",
    from: "NJP Railway Station",
    to: "Homestay",
    direction: "inbound",
    icon: "home",
  },
  {
    id: "bagdogra-to-homestay",
    name: "Bagdogra Airport → Homestay",
    from: "Bagdogra Airport (IXB)",
    to: "Homestay",
    direction: "inbound",
    icon: "home",
  },
];

const DEFAULT_TOURIST_DESTINATIONS = [
  // Airport & Railway Transit Hubs
  "Bagdogra Airport (IXB)",
  "NJP Railway Station (New Jalpaiguri)",
  "Siliguri Junction",
  "Tenzing Norgay Bus Terminus, Siliguri",
  "Sevoke Road, Siliguri",
  "Hill Cart Road, Siliguri",
  "Pradhan Nagar, Siliguri",

  // Jalpaiguri Hubs
  "DBC Road, Jalpaiguri",
  "Gomastapara, Jalpaiguri",
  "Kadamtala, Jalpaiguri",
  "Babupara, Jalpaiguri",
  "Jalpaiguri Town",
  "Jalpaiguri Road Railway Station",

  // Darjeeling & Hill Heritage Points
  "Darjeeling Mall Road / Chowrasta",
  "Tiger Hill Sunrise Point",
  "Batasia Loop & War Memorial",
  "Happy Valley Tea Estate",
  "Padmaja Naidu Zoo & HMI",
  "Ghoom Monastery",
  "Japanese Peace Pagoda",
  "Rock Garden & Ganga Maya Park",
  "Lebong & Tukvar Valley",
  "Lamahatta Eco Park",
  "Mirik Lake (Sumendu Lake)",
  "Pashupati Nagar (Nepal Border)",
  "Kurseong Town (Dow Hill)",
  "Rohini Viewpoint",

  // Kalimpong & Dooars
  "Kalimpong Town",
  "Deolo Hill, Kalimpong",
  "Lava & Rishop Pine Forest",
  "Pedong / Sillery Gaon",
  "Malbazar & Chalsa Junction",
  "Lataguri (Gorumara National Park)",
  "Madarihat (Jaldapara Safari)",
  "Cooch Behar Palace",
  "Alipurduar Town & Buxa",

  // Sikkim & Higher Ranges
  "Gangtok MG Marg",
  "Deorali, Gangtok",
  "Tsomgo (Changu) Lake & Baba Mandir",
  "Pelling Skywalk & Helipad",
  "Ravangla Buddha Park",
  "Namchi Char Dham",
];

type PublicConfig = {
  pickupTimes?: string[];
  bookingHorizonDays?: number;
  sightseeingPresets?: string[];
  routePresets?: RoutePreset[];
  vehicles?: { value: string; label: string; seats: number; estFare?: number }[];
  upiId?: string;
  paymentPageUrl?: string;
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

const toDisplayDate = (ymdOrMs: string | number | null | undefined): string => {
  if (!ymdOrMs) return "—";
  if (typeof ymdOrMs === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ymdOrMs)) {
    const [y, m, d] = ymdOrMs.split("-");
    return `${d}/${m}/${y}`;
  }
  const dateObj = new Date(ymdOrMs);
  if (isNaN(dateObj.getTime())) return String(ymdOrMs);
  const d = String(dateObj.getDate()).padStart(2, "0");
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const y = dateObj.getFullYear();
  return `${d}/${m}/${y}`;
};

const calcReturnYmd = (startDateYmd: string, days: number): string => {
  if (!startDateYmd) return startDateYmd;
  const [y, m, d] = startDateYmd.split("-").map(Number);
  const dtObj = new Date(y, m - 1, d);
  dtObj.setDate(dtObj.getDate() + Math.max(0, days - 1));
  const ry = dtObj.getFullYear();
  const rm = String(dtObj.getMonth() + 1).padStart(2, "0");
  const rd = String(dtObj.getDate()).padStart(2, "0");
  return `${ry}-${rm}-${rd}`;
};

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

const formatVehicleDisplay = (vehicleRaw?: string | null, typeRaw?: string | null) => {
  if (!vehicleRaw && !typeRaw) return { model: "Verified Mountain Cab", plate: "" };
  const str = (vehicleRaw || "").trim();
  const plateMatch = str.match(/([A-Z]{2}\s*[-]?\s*\d{1,2}\s*[-]?\s*[A-Z]{0,3}\s*[-]?\s*\d{4})/i);
  const plate = plateMatch ? plateMatch[0].toUpperCase().replace(/\s+/g, " ") : "";
  let model = str;
  if (plate) {
    model = str.replace(plateMatch![0], "").trim().replace(/^[-•,]+|[-•,]+$/g, "").trim();
  }
  if (!model && typeRaw) {
    model = typeRaw;
  }
  if (!model) {
    model = "Mountain Cab";
  }
  return { model, plate };
};

const formatDriverName = (name?: string | null) => {
  if (!name) return "Assigned Driver";
  return name
    .split(" ")
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
};

function CabRequestFormContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || "";
  const refParam = searchParams.get("ref") || "";
  const phoneParam = searchParams.get("phone") || searchParams.get("p") || "";
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

  // Trip Type: Multi-Day Tour (Default & 1st) vs Round Trip vs One-Way Drop
  const [tripType, setTripType] = useState<"multiday" | "roundtrip" | "oneway">("multiday");
  const [tourDays, setTourDays] = useState<number>(3);
  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(true);

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
  const [activeSuggestIdx, setActiveSuggestIdx] = useState<number | "pickup" | null>(null);
  const [placesList, setPlacesList] = useState<string[]>([]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (activeSuggestIdx === null) return;
      const target = e.target as HTMLElement;
      if (target && target.closest && (target.closest(".suggest-container") || target.closest("input"))) {
        return;
      }
      setActiveSuggestIdx(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [activeSuggestIdx]);

  // Schedule & Passengers (Requirement 7: Number of Passengers only)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowYmd = toLocalYmd(tomorrow);
  const [date, setDate] = useState(tomorrowYmd);
  const [time, setTime] = useState("09:00 AM");
  const [returnDate, setReturnDate] = useState(tomorrowYmd);
  const [returnTime, setReturnTime] = useState("06:00 PM");
  const [returnTimingMode, setReturnTimingMode] = useState<"flexible" | "specific">("flexible");
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
    apiFetch<unknown>(API_ENDPOINTS.cabs.places())
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : res && typeof res === "object" && "data" in res && Array.isArray((res as { data: unknown[] }).data)
          ? (res as { data: unknown[] }).data
          : [];
        if (list.length > 0) {
          setPlacesList(
            list
              .map((p: unknown) =>
                p && typeof p === "object" && "name" in p && typeof (p as { name: unknown }).name === "string"
                  ? (p as { name: string }).name
                  : typeof p === "string"
                  ? p
                  : ""
              )
              .filter(Boolean)
          );
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
    const tokens = q.split(/[\s,]+/).filter(Boolean);
    return presets
      .filter((p) => {
        const lower = p.toLowerCase();
        return tokens.every((token) => lower.includes(token));
      })
      .slice(0, 8);
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

  // Round trips have flexible return schedules (driver waits)
  const getReturnError = (): string => {
    return "";
  };

  const fetchStatus = async (reference: string) => {
    setStatusLoading(true);
    try {
      const data = await apiFetch<CabRequestStatus>(API_ENDPOINTS.cabRequests.status(reference, token, guestPhone.trim() || phoneParam));
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
        apiFetch<CabRequestStatus>(API_ENDPOINTS.cabRequests.status(refParam, token, phoneParam))
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
                  paymentPageUrl: siteConfig.paymentPageUrl || process.env.NEXT_PUBLIC_PAYMENT_PAGE_URL || "https://rzp.io/rzp/id3OHPlh",
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
                      paymentPageUrl: live.paymentPageUrl || prev.config?.paymentPageUrl || siteConfig.paymentPageUrl || "https://rzp.io/rzp/id3OHPlh",
                      supportPhone: live.supportPhone || prev.config?.supportPhone || (siteConfig.supportPhone || process.env.NEXT_PUBLIC_SUPPORT_PHONE || "").replace(/[^0-9]/g, ""),
                      supportEmail: live.supportEmail || prev.config?.supportEmail || siteConfig.supportEmail || "",
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
        apiFetch<CabRequestStatus>(API_ENDPOINTS.cabRequests.status(refParam, token, phoneParam))
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
  }, [token, refParam, homestayParam, phoneParam]);

  // Status polling every 10 seconds while active
  useEffect(() => {
    const activeRef = confirmedTrip?.reference || refParam;
    if (!activeRef || bookingNotFound) return;
    const finalStatuses = ["COMPLETED", "CANCELLED", "EXPIRED"];
    if (tripStatus?.status && finalStatuses.includes(tripStatus.status)) return;

    const interval = setInterval(() => {
      apiFetch<CabRequestStatus>(API_ENDPOINTS.cabRequests.status(activeRef, token, guestPhone.trim() || phoneParam))
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
      const selectedReturnDateObj = returnDate ? new Date(`${returnDate}T12:00:00Z`) : null;
      const sendSpecificReturn = isRoundTrip && returnTimingMode === "specific" && !!returnTime;
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
        returnDate:
          sendSpecificReturn && selectedReturnDateObj
            ? selectedReturnDateObj.getTime()
            : tripType === "multiday"
              ? selectedDateObj.getTime() + (Math.max(1, tourDays) - 1) * 86400000
              : undefined,
        returnTime: sendSpecificReturn ? returnTime : undefined,
        guestName: guestName.trim(),
        phone: cleanPhone,
        notes: (
          (tripType === "multiday" ? `[Multi-Day Tour: ${tourDays} Days Package] ` : "") +
          (tripType === "roundtrip" && returnTimingMode === "flexible" ? `[Round Trip: Return schedule flexible / driver waits] ` : "") +
          notes.trim()
        ).trim(),
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
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("ref", res.reference);
        if (cleanPhone) url.searchParams.set("phone", cleanPhone);
        window.history.replaceState(null, "", url.toString());
      }
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

  const configuredPaymentPageUrl =
    tripStatus?.config?.paymentPageUrl ||
    link?.config?.paymentPageUrl ||
    siteConfig.paymentPageUrl ||
    process.env.NEXT_PUBLIC_PAYMENT_PAGE_URL ||
    "https://rzp.io/rzp/id3OHPlh";

  // Dynamic payment link: when direct Razorpay API is active, server provides tripStatus.paymentLinkUrl; otherwise falls back to configured hosted payment page
  const effectivePaymentUrl = tripStatus?.paymentLinkUrl || configuredPaymentPageUrl;
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
      <div className="min-h-screen bg-surface flex items-center justify-center p-6 font-body">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <div>
            <p className="text-sm font-bold text-primary">Connecting to verified hill fleet…</p>
            <p className="text-xs text-outline mt-0.5">StayRide cab transfer service</p>
          </div>
        </div>
      </div>
    );
  }

  if (linkState === "invalid") {
    if (isNoLink) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6 text-on-surface font-body">
          <div className="max-w-md w-full rounded-2xl border border-outline-variant bg-white p-8 sm:p-10 text-center space-y-6 shadow-ambient">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <Icon name="local_taxi" className="text-3xl text-primary" />
            </div>

            <div className="space-y-2">
              <span className="inline-block rounded-full bg-primary/10 px-3 py-0.5 text-label-sm font-medium text-primary">
                Exclusive guest concierge
              </span>
              <h1 className="font-display text-2xl sm:text-3xl font-medium text-primary">
                {siteConfig.appName} hill cabs
              </h1>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Hill Cabs are arranged exclusively for guests of our partner homestays. Check your WhatsApp for your private booking link, or ask your host to send you a booking invite.
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant bg-surface p-4 text-left text-xs space-y-2.5 text-on-surface">
              <div className="flex items-center gap-2.5">
                <Icon name="verified" className="text-primary text-sm shrink-0" />
                <span>Door-to-door mountain airport & station transfers</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon name="payments" className="text-primary text-sm shrink-0" />
                <span>100% direct cash fare to mountain drivers</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon name="chat" className="text-primary text-sm shrink-0" />
                <span>Direct WhatsApp coordination & live PIN verification</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Link
                href="/#accommodations"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-xs font-bold text-white shadow-sm hover:bg-primary-container transition-all"
              >
                <Icon name="cottage" className="text-sm" />
                <span>View Partner Homestays</span>
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-white px-5 py-3 text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6 font-body">
        <div className="max-w-md w-full rounded-2xl border border-outline-variant bg-white p-8 text-center space-y-5 shadow-ambient">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100">
            <Icon name="link_off" className="text-2xl" />
          </div>
          <h1 className="font-display text-xl font-bold text-on-surface">Link expired or invalid</h1>
          <p className="text-xs text-outline leading-relaxed">
            This private cab booking link is no longer active. Please contact your homestay host to receive a fresh booking link.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-primary-container transition-all"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (bookingNotFound) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6 font-body">
        <div className="max-w-md w-full rounded-2xl border border-outline-variant bg-white p-8 text-center space-y-5 shadow-ambient">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100">
            <Icon name="search_off" className="text-2xl" />
          </div>
          <h1 className="font-display text-xl font-bold text-on-surface">Booking not found</h1>
          <p className="text-xs text-outline leading-relaxed">
            We could not find a cab booking for this reference. Please check the link in your WhatsApp message or contact your homestay host.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-primary-container transition-all"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body antialiased">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-outline-variant/80 bg-white/85 backdrop-blur-xl px-4 py-3.5 shadow-ambient">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
              <Icon name="local_taxi" className="text-xl text-primary-fixed-dim" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-primary text-lg tracking-tight leading-none">
                  {siteConfig.appName}
                </span>
                {/* <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20 shrink-0">
                  <Icon name="verified" className="text-xs text-primary" />
                  <span>Verified Network</span>
                </span> */}
              </div>
              <p className="text-[11px] text-outline truncate font-medium mt-0.5 max-w-[220px] sm:max-w-xs">
                {link?.homestayName || "Verified Hill Stay Partner"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeSupportPhone ? (
              <a
                href={`https://wa.me/${activeSupportPhone}?text=${encodeURIComponent(`Hello, I need assistance with cab booking on ${siteConfig.appName}.`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container-low transition-all shadow-2xs"
              >
                <Icon name="chat" className="text-xs text-[#25D366]" />
                <span>Concierge</span>
              </a>
            ) : activeSupportEmail ? (
              <a
                href={`mailto:${activeSupportEmail}?subject=${encodeURIComponent(`${siteConfig.appName} Cab Assistance`)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container-low transition-all shadow-2xs"
              >
                <Icon name="support_agent" className="text-xs text-primary" />
                <span>Concierge</span>
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
            <div className="rounded-2xl border border-outline-variant/90 bg-white p-6 sm:p-7 shadow-ambient space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/60 pb-4">
                <div>
                  <span className="text-label-sm font-medium text-outline block">Mountain trip reference</span>
                  <p className="text-xl font-mono font-medium text-primary tabular-nums">#{confirmedTrip.reference}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3.5 py-1 text-xs font-bold ${
                      (tripStatus?.status || confirmedTrip.status) === "COMPLETED"
                        ? "bg-primary/10 text-primary border border-primary/25"
                        : (tripStatus?.status || confirmedTrip.status) === "CONFIRMED"
                        ? "bg-blue-50 text-blue-900 border border-blue-200"
                        : ["CANCELLED", "EXPIRED"].includes(tripStatus?.status || confirmedTrip.status)
                        ? "bg-red-50 text-red-900 border border-red-200"
                        : "bg-amber-50 text-amber-900 border border-amber-200"
                    }`}
                  >
                    {STATUS_FRIENDLY_LABELS[tripStatus?.status || confirmedTrip.status] || tripStatus?.status || confirmedTrip.status || "Loading…"}
                  </span>
                  <button
                    type="button"
                    disabled={statusLoading}
                    onClick={() => fetchStatus(confirmedTrip.reference)}
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container-low text-outline hover:text-on-surface transition-colors cursor-pointer"
                    title="Refresh Status"
                  >
                    <Icon name="refresh" className={`text-base ${statusLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* 5-Step Visual Timeline */}
              <div className="py-2">
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center text-[10px] sm:text-xs">
                  <div className="space-y-1.5">
                    <div className="h-2 w-full rounded-full bg-primary" />
                    <span className="font-bold text-primary block truncate">1. Received</span>
                  </div>
                  <div className="space-y-1.5">
                    <div
                      className={`h-2 w-full rounded-full transition-all ${
                        ["QUOTE_RECEIVED", "AWAITING_ADVANCE_PAYMENT", "CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(
                          tripStatus?.status || ""
                        )
                          ? "bg-primary"
                          : ["PENDING_REVIEW", "FINDING_DRIVER"].includes(tripStatus?.status || confirmedTrip.status)
                          ? "bg-sky-500 animate-pulse"
                          : "bg-surface-container"
                      }`}
                    />
                    <span
                      className={`block truncate ${
                        ["QUOTE_RECEIVED", "AWAITING_ADVANCE_PAYMENT", "CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(
                          tripStatus?.status || ""
                        )
                          ? "font-bold text-primary"
                          : "font-medium text-outline"
                      }`}
                    >
                      2. Assigned
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div
                      className={`h-2 w-full rounded-full transition-all ${
                        ["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "")
                          ? "bg-primary"
                          : tripStatus?.status === "AWAITING_ADVANCE_PAYMENT"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-surface-container"
                      }`}
                    />
                    <span
                      className={`block truncate ${
                        ["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "")
                          ? "font-bold text-primary"
                          : tripStatus?.status === "AWAITING_ADVANCE_PAYMENT"
                          ? "font-bold text-amber-900"
                          : "font-medium text-outline"
                      }`}
                    >
                      3. Confirmed
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div
                      className={`h-2 w-full rounded-full transition-all ${
                        ["TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "")
                          ? "bg-primary"
                          : ["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY"].includes(tripStatus?.status || "")
                          ? "bg-sky-400"
                          : "bg-surface-container"
                      }`}
                    />
                    <span
                      className={`block truncate ${
                        ["TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "")
                          ? "font-bold text-primary"
                          : "font-medium text-outline"
                      }`}
                    >
                      4. On Trip
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div
                      className={`h-2 w-full rounded-full transition-all ${
                        tripStatus?.status === "COMPLETED" ? "bg-primary" : "bg-surface-container"
                      }`}
                    />
                    <span
                      className={`block truncate ${
                        tripStatus?.status === "COMPLETED" ? "font-bold text-primary" : "font-medium text-outline"
                      }`}
                    >
                      5. Done
                    </span>
                  </div>
                </div>
              </div>

              {/* Bidding Radar / Active Searching Banner */}
              {["PENDING_REVIEW", "FINDING_DRIVER"].includes(tripStatus?.status || confirmedTrip.status) && (
                <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-r from-sky-50/80 via-white to-emerald-50/40 p-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-3.5 w-3.5 items-center justify-center">
                        <span className="h-2 w-2 rounded-full bg-sky-600" />
                      </div>
                      <span className="text-body-sm font-medium text-sky-950">
                        {tripStatus?.awaitingOwner
                          ? "Request received"
                          : (tripStatus?.status || confirmedTrip.status) === "PENDING_REVIEW"
                          ? "Request received — finding drivers…"
                          : "Finding your driver in this valley…"}
                      </span>
                    </div>
                    <span className="text-[11px] text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-md font-medium">
                      Auto-syncing
                    </span>
                  </div>
                  <p className="text-xs text-sky-900 leading-relaxed">
                    {tripStatus?.awaitingOwner
                      ? "Received. The homestay will arrange your cab shortly."
                      : tripStatus?.quotesCount && tripStatus.quotesCount > 0
                      ? `${tripStatus.quotesCount} local driver quote(s) received. Best rate is being matched.`
                      : "Dispatched to verified local hill drivers. Connecting with available cabs near your homestay."}
                  </p>
                  {tripStatus?.biddingFallback && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 font-medium">
                      Nearby drivers are currently on other mountain routes. Your homestay host has been notified to assist and allocate private fleet options.
                    </div>
                  )}
                </div>
              )}

              {/* Advance Payment Card (when reserved) */}
              {tripStatus?.status === "AWAITING_ADVANCE_PAYMENT" && !tripStatus.advancePaid && (
                <div className="rounded-2xl border border-amber-200/90 bg-white p-6 sm:p-7 shadow-[0_12px_40px_-6px_rgba(20,66,45,0.07)] space-y-6">
                  {/* Status & Deadline Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant/60 pb-5">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-0.5 text-[11px] font-bold text-amber-900">
                        <Icon name="lock" className="text-xs text-amber-700" />
                        <span>Driver Reserved on Hold</span>
                      </span>
                      <h3 className="font-display font-bold text-primary text-xl sm:text-2xl pt-1">
                        Confirm Mountain Cab
                      </h3>
                      <p className="text-xs text-outline">
                        Pay reservation advance to unlock driver contact & vehicle plate
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-label-sm font-medium text-outline block">
                        Advance required
                      </span>
                      <p className="text-2xl sm:text-3xl font-display font-medium text-primary tracking-tight leading-none mt-1 tabular-nums">
                        {formatInr(tripStatus.advanceAmount)}
                      </p>
                      {tripStatus.advanceDueAt && !claimPending && (
                        <p className="text-[11px] font-semibold text-amber-800 mt-1.5">
                          Pay before {formatIstDateTime(tripStatus.advanceDueAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Fare Transparency Breakdown */}
                  <div className="rounded-2xl border border-outline-variant bg-surface p-4 sm:p-5 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-on-surface-variant">
                      <span className="font-medium">Total Trip Fare (Agreed with Driver):</span>
                      <strong className="font-bold text-on-surface text-sm">{formatInr(tripStatus.agreedFare)}</strong>
                    </div>
                    <div className="flex justify-between items-center text-outline">
                      <span>Online Reservation Advance (Pay now):</span>
                      <strong className="text-primary font-bold text-sm">{formatInr(tripStatus.advanceAmount)}</strong>
                    </div>
                    <div className="pt-2.5 border-t border-outline-variant flex justify-between items-center text-on-surface">
                      <div>
                        <span className="font-bold block text-sm">Remaining Cash to Driver</span>
                        <span className="text-[11px] text-outline">Hand directly to driver at drop-off</span>
                      </div>
                      <span className="text-base sm:text-lg font-extrabold text-primary">{formatInr(tripStatus.remainingCashAmount)}</span>
                    </div>
                  </div>

                  {tripStatus.paymentClaim?.status === "REJECTED" && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <Icon name="error" className="text-sm text-red-700" />
                        <span>Payment verification issue{tripStatus.paymentClaim.reason ? `: ${tripStatus.paymentClaim.reason}` : ""}</span>
                      </p>
                      <p className="text-[11px] text-red-800">
                        Please check the 12-digit UTR in your payment app and submit it again below, or contact concierge.
                      </p>
                    </div>
                  )}

                  {claimPending && (
                    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 text-xs text-primary space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-2 font-bold text-primary text-sm">
                          <Icon name="check_circle" className="text-base text-primary" />
                          <span>Payment Reference Submitted</span>
                        </p>
                        <span className="rounded-full bg-primary/15 px-3 py-0.5 text-[10px] font-bold text-primary">
                          Verifying
                        </span>
                      </div>
                      <p className="leading-relaxed text-on-surface-variant">
                        UTR / Ref: <span className="font-mono font-bold text-primary bg-white px-2.5 py-0.5 rounded-lg border border-primary/25">{tripStatus.paymentClaim?.utr || "received"}</span>. Our operations desk is verifying receipt. Your cab remains reserved on hold.
                      </p>
                      {!editingClaim && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClaim(true);
                            setUtrInput(tripStatus.paymentClaim?.utr || "");
                          }}
                          className="font-bold text-primary hover:underline cursor-pointer text-xs"
                        >
                          Entered wrong UTR? Update Reference
                        </button>
                      )}
                    </div>
                  )}

                  {/* PRIMARY ACTION: High-Converting Razorpay Online Payment Button */}
                  {!claimPending && (
                    <div className="space-y-3">
                      <a
                        href={effectivePaymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-between gap-4 rounded-xl bg-primary hover:bg-primary-container active:opacity-90 p-4 sm:p-5 text-on-primary shadow-sm transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white shadow-inner">
                            <Icon name="payments" className="text-2xl text-primary-fixed-dim" />
                          </div>
                          <div className="text-left">
                            <span className="text-label-sm text-primary-fixed-dim font-medium block">
                              Instant driver confirmation
                            </span>
                            <span className="text-base sm:text-lg font-medium leading-tight block">
                              Pay {formatInr(tripStatus.advanceAmount)} via Razorpay
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-label-md font-medium bg-white/10 px-3.5 py-2 rounded-lg border border-white/15 group-hover:bg-white/20 transition-colors">
                          <span>Pay now</span>
                          <Icon name="arrow_forward" className="text-sm" />
                        </div>
                      </a>

                      <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-outline pt-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          <Icon name="lock" className="text-xs text-primary" /> 256-Bit SSL Secure
                        </span>
                        <span>•</span>
                        <span>UPI (GPay / PhonePe / Paytm)</span>
                        <span>•</span>
                        <span>Cards & NetBanking</span>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Instant UTR / Payment Reference Submission */}
                  {(!claimPending || editingClaim) && (
                    <form onSubmit={handleSubmitClaim} className="rounded-2xl border border-outline-variant bg-surface p-4 sm:p-5 text-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <label htmlFor="utr" className="block font-bold text-on-surface text-xs">
                          Already paid? Enter UPI UTR or Payment ID:
                        </label>
                        <span className="text-[10px] text-outline font-mono">12-digit Ref</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          id="utr"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={24}
                          placeholder="e.g. 412345678901"
                          value={utrInput}
                          onChange={(e) => setUtrInput(e.target.value)}
                          className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-white px-3.5 py-2.5 font-mono text-sm text-on-surface placeholder:text-outline/60 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all"
                        />
                        <button
                          type="submit"
                          disabled={claimBusy}
                          className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-container disabled:opacity-60 cursor-pointer transition-colors shadow-2xs"
                        >
                          {claimBusy ? "Submitting…" : "Confirm"}
                        </button>
                      </div>
                      <p className="text-[11px] text-outline">
                        Found in your payment receipt / SMS (12-digit UPI Ref / UTR number).
                      </p>
                      {claimError && <p className="text-[11px] font-semibold text-red-700">{claimError}</p>}
                    </form>
                  )}

                  {/* Secondary Alternative: Direct UPI QR Code (Collapsible) */}
                  {activeUpiId && !claimPending && (
                    <div className="rounded-2xl border border-outline-variant bg-white p-4 text-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-on-surface text-xs">Alternative: Direct UPI Transfer</span>
                        <button
                          type="button"
                          onClick={() => setShowQr(!showQr)}
                          className="font-bold text-primary hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
                        >
                          <Icon name="qr_code" className="text-sm" />
                          <span>{showQr ? "Hide UPI QR" : "Show UPI QR & ID"}</span>
                        </button>
                      </div>

                      {showQr && (
                        <div className="space-y-3 pt-3 border-t border-outline-variant/60">
                          {advanceUpiUrl && (
                            <a
                              href={advanceUpiUrl}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-primary-container transition-all"
                            >
                              <Icon name="account_balance_wallet" className="text-sm" /> Open in UPI App
                            </a>
                          )}

                          <div className="space-y-2 rounded-xl bg-surface p-3 border border-outline-variant">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-outline">UPI ID</span>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-bold text-on-surface break-all">{activeUpiId}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyUpi(activeUpiId)}
                                  className="rounded-lg px-2.5 py-1 font-bold bg-white border border-outline-variant text-xs hover:bg-surface-container cursor-pointer"
                                >
                                  {copiedUpi ? "Copied" : "Copy"}
                                </button>
                              </div>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-outline">Amount</span>
                              <span className="font-mono font-bold text-on-surface">{formatInr(tripStatus.advanceAmount)}</span>
                            </div>
                          </div>

                          {qr.url === advanceUpiUrl && qr.data && (
                            <div className="flex flex-col items-center justify-center pt-1">
                              <img src={qr.data} alt="UPI payment QR code" className="h-44 w-44 rounded-2xl border border-outline-variant p-2 bg-white shadow-xs" />
                              <span className="mt-2 text-[11px] text-outline">Scan with Google Pay, PhonePe, or Paytm</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Professional Policy & Safety Guarantee */}
                  <div className="rounded-2xl border border-outline-variant bg-surface p-4 sm:p-5 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-on-surface border-b border-outline-variant pb-2.5">
                      <Icon name="shield" className="text-sm text-primary" />
                      <span>StayCabs Mountain Ride Guarantee & Fair Policy</span>
                    </div>
                    <ul className="space-y-2 text-[11px] leading-relaxed text-on-surface-variant pt-1">
                      <li className="flex items-start gap-2">
                        <span className="text-primary font-semibold shrink-0">•</span>
                        <span><strong>Dedicated Cab Hold:</strong> Advance payment guarantees cab allocation from our verified mountain fleet for your scheduled itinerary.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary font-semibold shrink-0">•</span>
                        <span><strong>Instant Driver Release:</strong> Verified driver contact number, vehicle plate, and live pickup PIN are unlocked immediately upon payment confirmation.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary font-semibold shrink-0">•</span>
                        <span><strong>Fair Weather & Mountain Policy:</strong> 100% full refund or free reschedule if hill roads are blocked due to weather or landslides, or in case of vehicle breakdown. Advance is non-refundable for guest no-shows once the driver has been dispatched.</span>
                      </li>
                    </ul>
                  </div>

                  {/* WhatsApp Verification & Concierge Help */}
                  <div className="pt-1 text-center space-y-2.5">
                    {activeSupportPhone ? (
                      <>
                        <a
                          href={`https://wa.me/${activeSupportPhone}?text=${encodeURIComponent(`Namaste, I am at the advance payment step for StayCabs trip #${tripStatus.reference} (Amount: ₹${tripStatus.advanceAmount}). Please confirm my booking.`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-container-lowest border border-outline-variant px-4 py-3 text-label-md font-medium text-primary hover:bg-surface-container-low transition-colors w-full shadow-sm"
                        >
                          <Icon name="chat" className="text-sm" />
                          <span>Share payment confirmation on WhatsApp</span>
                        </a>
                        <div className="pt-1">
                          <a
                            href={`https://wa.me/${activeSupportPhone}?text=${encodeURIComponent(`Namaste, regarding cab request #${tripStatus.reference}: the quoted fare is ₹${tripStatus.agreedFare}. Can you assist with the pricing or vehicle options?`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-label-sm font-medium text-outline hover:text-primary hover:underline"
                          >
                            <Icon name="support_agent" className="text-xs text-primary" />
                            <span>Need a different fare or vehicle? Chat with desk</span>
                          </a>
                        </div>
                      </>
                    ) : activeSupportEmail ? (
                      <a
                        href={`mailto:${activeSupportEmail}?subject=${encodeURIComponent(`Payment Confirmation - Reference #${tripStatus.reference}`)}`}
                        className="inline-flex items-center gap-1.5 text-label-sm font-medium text-primary hover:underline"
                      >
                        <Icon name="mail" className="text-sm" /> Email payment confirmation ({activeSupportEmail})
                      </a>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Cancelled / Expired Details */}
              {["CANCELLED", "EXPIRED"].includes(tripStatus?.status || "") && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-1.5 text-body-sm text-red-900">
                  <p className="font-medium">
                    {tripStatus?.status === "EXPIRED" ? "This cab request has expired." : "This cab request was cancelled."}
                  </p>
                  {tripStatus?.cancellationReason && <p>Reason: {tripStatus.cancellationReason}</p>}
                  {tripStatus?.refundStatus && REFUND_LABELS[tripStatus.refundStatus] && (
                    <p className="font-medium">Advance: {REFUND_LABELS[tripStatus.refundStatus]}</p>
                  )}
                </div>
              )}

              {/* Confirmed Driver Details Card */}
              {["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "") && (() => {
                const vehicleDisplay = formatVehicleDisplay(tripStatus?.vehicle, tripStatus?.vehicleType);
                const driverDisplayName = formatDriverName(tripStatus?.driverName);
                const hasUnlockedContact = Boolean(tripStatus?.driverPhone && !tripStatus.driverPhone.includes("*"));

                return (
                  <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-7 shadow-ambient space-y-5">
                    {/* Driver Profile Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-outline-variant/60 pb-4">
                      <div className="flex items-center gap-3.5">
                        <div className="relative">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary font-display font-medium text-lg shadow-sm">
                            {driverDisplayName.charAt(0) || "D"}
                          </div>
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-lowest shadow-xs">
                            <Icon name="verified" className="text-sm text-primary" />
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-on-surface text-body-lg leading-tight">
                              {driverDisplayName}
                            </h4>
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-label-sm font-medium text-primary border border-primary/20">
                              Verified driver
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-body-sm text-outline font-medium">{vehicleDisplay.model}</span>
                            {vehicleDisplay.plate && (
                              <span className="inline-flex items-center rounded-lg bg-surface-container-low px-2.5 py-0.5 font-mono text-label-sm font-medium text-on-surface border border-outline-variant shadow-xs">
                                {vehicleDisplay.plate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Masked notice if contact still locked */}
                      {!hasUnlockedContact && tripStatus?.driverPhone && (
                        <div className="text-right max-w-[45%]">
                          <p className="font-mono text-label-sm font-medium text-on-surface">{tripStatus.driverPhone}</p>
                          <p className="text-label-sm text-outline mt-0.5">Unlocked once advance is confirmed</p>
                        </div>
                      )}
                    </div>

                    {/* Dedicated 2-Button Action Row */}
                    {hasUnlockedContact && (
                      <div className="grid grid-cols-2 gap-3">
                        <a
                          href={`tel:${tripStatus?.driverPhone}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-container-lowest border border-outline-variant px-4 py-3.5 text-label-md font-medium text-on-surface shadow-sm hover:bg-surface-container-low transition-colors"
                        >
                          <Icon name="phone" className="text-base text-primary" />
                          <span>Call driver</span>
                        </a>
                        <a
                          href={`https://wa.me/${waNumber(tripStatus?.driverPhone || "")}?text=${encodeURIComponent(`Namaste ${driverDisplayName}, I am your passenger for StayCabs trip #${confirmedTrip.reference}.`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-container px-4 py-3.5 text-label-md font-medium text-on-primary shadow-sm transition-colors"
                        >
                          <Icon name="chat" className="text-base" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}

                    {/* Boarding Verification PIN (Apple Pass Voucher / Passbook Style) */}
                    {tripStatus?.pickupOtp && (
                      <div className="relative overflow-hidden rounded-xl border border-primary-container bg-primary text-on-primary p-5 sm:p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-primary-fixed-dim text-label-sm font-medium">
                              <Icon name="key" className="text-xs" />
                              <span>Boarding verification PIN</span>
                            </div>
                            <p className="text-xs text-white/80 max-w-xs leading-relaxed">
                              Share this PIN with your driver upon vehicle arrival to verify trip
                            </p>
                          </div>
                          <div className="inline-flex self-start sm:self-auto items-center tracking-[0.3em] font-mono text-2xl sm:text-3xl font-medium text-amber-200 bg-white/10 px-5 py-2.5 rounded-xl border border-white/15 shadow-inner backdrop-blur-md tabular-nums">
                            {tripStatus.pickupOtp.split("").join(" ")}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cash to Pay Driver Card */}
                    {typeof tripStatus?.remainingCashAmount === "number" && (
                      <div className="flex items-center justify-between rounded-2xl bg-surface border border-outline-variant p-4 text-xs">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Icon name="payments" className="text-lg" />
                          </div>
                          <div>
                            <span className="font-bold text-on-surface">Cash Due at Drop-off</span>
                            <p className="text-[11px] text-outline">Pay directly to driver upon reaching destination</p>
                          </div>
                        </div>
                        <span className="text-base sm:text-lg font-extrabold text-primary">
                          {formatInr(tripStatus.remainingCashAmount)}
                        </span>
                      </div>
                    )}

                    {/* Mountain Safety Assurance Note */}
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-[11px] leading-relaxed text-primary flex items-start gap-2.5">
                      <Icon name="check_circle" className="text-xs text-primary mt-0.5 shrink-0" />
                      <span>
                        <strong>Driver Allocated & Verified:</strong> Contact your driver directly for route coordination or luggage adjustments. Mountain route assistance is monitored by StayCabs operations.
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Guest Rating & Review Form (when COMPLETED) */}
              {tripStatus?.status === "COMPLETED" && (
                <div className="rounded-2xl border border-outline-variant bg-white p-6 space-y-4 shadow-[0_8px_25px_-4px_rgba(20,66,45,0.05)]">
                  {tripStatus?.guestRating || ratingSuccess ? (
                    <div className="text-center space-y-2 py-2">
                      <p className="font-display font-bold text-primary text-base">Thank you for rating your trip!</p>
                      <div className="flex items-center justify-center gap-1.5 text-amber-500 text-xl">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className={s <= (tripStatus?.guestRating?.stars || selectedRating) ? "text-amber-500" : "text-outline-variant"}>
                            ★
                          </span>
                        ))}
                      </div>
                      {(tripStatus?.guestRating?.comment || ratingComment) && (
                        <p className="text-xs text-outline italic max-w-sm mx-auto">&quot;{tripStatus?.guestRating?.comment || ratingComment}&quot;</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-display font-bold text-base text-on-surface">Rate Your Mountain Ride</span>
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">{tripStatus?.driverName || "Driver"}</span>
                        </div>
                        <p className="text-xs text-outline mt-0.5">Your verified feedback ensures high mountain safety standards.</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setSelectedRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="text-2xl cursor-pointer p-1 focus:outline-none transition-colors"
                          >
                            <span className={star <= (hoverRating || selectedRating) ? "text-amber-500" : "text-outline-variant"}>★</span>
                          </button>
                        ))}
                        <span className="ml-2 text-xs font-semibold text-on-surface">
                          {selectedRating === 5 ? "Excellent" : selectedRating === 4 ? "Very Good" : selectedRating === 3 ? "Good" : selectedRating === 2 ? "Fair" : "Poor"}
                        </span>
                      </div>

                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Optional: share feedback on driving safety, cleanliness, punctuality..."
                        maxLength={300}
                        rows={2}
                        className="w-full rounded-2xl border border-outline-variant p-3 text-xs text-on-surface focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all"
                      />

                      {ratingError && <p className="text-xs text-red-600 font-medium">{ratingError}</p>}

                      <button
                        type="button"
                        disabled={submittingRating}
                        onClick={handleSubmitRating}
                        className="w-full rounded-2xl bg-primary py-3 text-xs font-bold text-white shadow hover:bg-primary-container cursor-pointer disabled:opacity-50 transition-all"
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
                  className="w-full rounded-2xl border border-outline-variant bg-white py-3 text-xs font-semibold text-on-surface hover:bg-surface-container-low cursor-pointer transition-colors"
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
            <div className="mx-auto max-w-sm rounded-full bg-surface-container p-1.5 shadow-2xs">
              <div className="grid grid-cols-3 gap-1 text-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer  ${
                    currentStep === 1
                      ? "bg-primary text-white shadow-xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${currentStep === 1 ? "bg-white/20 text-white font-bold" : "bg-outline-variant text-white"}`}>
                    1
                  </span>
                  <span>Route</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer  ${
                    currentStep === 2
                      ? "bg-primary text-white shadow-xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${currentStep === 2 ? "bg-white/20 text-white font-bold" : "bg-outline-variant text-white"}`}>
                    2
                  </span>
                  <span>Schedule</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer  ${
                    currentStep === 3
                      ? "bg-primary text-white shadow-xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${currentStep === 3 ? "bg-white/20 text-white font-bold" : "bg-outline-variant text-white"}`}>
                    3
                  </span>
                  <span>Review</span>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 font-medium">
                {errorMessage}
              </div>
            )}

            {/* STEP 1: ROUTE & ITINERARY */}
            {currentStep === 1 && (
              <div className="space-y-6 rounded-2xl border border-outline-variant bg-white p-6 sm:p-8 shadow-[0_10px_35px_-4px_rgba(20,66,45,0.05)]">
                {/* Header & Trip Type Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-outline-variant/60 pb-5">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-primary">Where are you heading?</h2>
                    <p className="text-xs text-outline mt-0.5">Verified local drivers · Fair rates · Door-to-door hill transfers</p>
                  </div>

                  {/* Top-Level Trip Type Segmented Pill: Multi-Day Tour vs Round Trip vs One-Way */}
                  <div className="inline-flex items-center p-1 bg-surface-container rounded-full self-start sm:self-auto shadow-inner">
                    <button
                      type="button"
                      onClick={() => {
                        setTripType("multiday");
                        setIsRoundTrip(true);
                      }}
                      className={`inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        tripType === "multiday"
                          ? "bg-primary text-white shadow-xs"
                          : "text-outline hover:text-on-surface"
                      }`}
                    >
                      <Icon name="explore" className="text-xs" />
                      <span>Multi-Day Tour</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTripType("roundtrip");
                        setIsRoundTrip(true);
                      }}
                      className={`inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        tripType === "roundtrip"
                          ? "bg-primary text-white shadow-xs"
                          : "text-outline hover:text-on-surface"
                      }`}
                    >
                      <Icon name="sync_alt" className="text-xs" />
                      <span>Round Trip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTripType("oneway");
                        setIsRoundTrip(false);
                      }}
                      className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        tripType === "oneway"
                          ? "bg-primary text-white shadow-xs"
                          : "text-outline hover:text-on-surface"
                      }`}
                    >
                      One-Way Drop
                    </button>
                  </div>
                </div>

                {/* Multi-Day Tour Package Banner & Duration */}
                {tripType === "multiday" && (
                  <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3.5 sm:p-4 text-xs text-primary flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                        <Icon name="verified" className="text-base" />
                      </div>
                      <div>
                        <span className="font-bold text-xs block text-primary">Dedicated Cab &amp; Driver for Entire Tour</span>
                        <span className="text-[11px] text-outline">Driver stays with you for all sightseeing, viewpoints, and multi-day travel.</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 self-end sm:self-center shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-primary">Tour Duration:</span>
                        <select
                          value={tourDays}
                          onChange={(e) => {
                            const count = Number(e.target.value);
                            setTourDays(count);
                            setReturnDate(calcReturnYmd(date, count));
                          }}
                          className="rounded-xl border border-outline-variant bg-white px-2.5 py-1 text-xs font-bold text-primary focus:outline-none cursor-pointer"
                        >
                          <option value={2}>2 Days / 1 Night</option>
                          <option value={3}>3 Days / 2 Nights</option>
                          <option value={4}>4 Days / 3 Nights</option>
                          <option value={5}>5 Days / 4 Nights</option>
                          <option value={6}>6 Days / 5 Nights</option>
                          <option value={7}>7+ Days Full Tour</option>
                        </select>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-primary/10 px-2 py-0.5 rounded text-primary">
                        {toDisplayDate(date)} → {toDisplayDate(calcReturnYmd(date, tourDays))}
                      </span>
                    </div>
                  </div>
                )}

                {/* Unified Connected Route Card */}
                <div className="rounded-2xl border border-outline-variant bg-surface/60 p-4 sm:p-5 shadow-2xs space-y-3.5">
                  <div className="flex gap-3">
                    {/* Visual Route Indicator Column */}
                    <div className="flex flex-col items-center pt-3 shrink-0 select-none">
                      <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/15" />
                      <div className="w-0.5 flex-1 bg-gradient-to-b from-primary via-outline-variant to-red-500 my-1 min-h-[44px]" />
                      <div className="h-3 w-3 rounded-full bg-red-600 ring-4 ring-red-100" />
                    </div>

                    {/* Inputs Column */}
                    <div className="flex-1 space-y-3.5">
                      {/* Pickup Field */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-label-sm font-medium text-outline flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            <span>Pickup location</span>
                          </span>
                          {pickupCoords && (
                            <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Icon name="my_location" className="text-[10px]" /> Pinned ({pickupCoords.latitude.toFixed(3)}, {pickupCoords.longitude.toFixed(3)})
                            </span>
                          )}
                        </div>

                        <div className="relative">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={pickup}
                              onClick={() =>
                                setMapTarget({
                                  type: "pickup",
                                  title: "Pin Pickup Location on Map",
                                  initialAddress: getResolvedPickup(),
                                })
                              }
                              onFocus={() => setActiveSuggestIdx("pickup")}
                              onChange={(e) => {
                                setPickup(e.target.value);
                                setCustomPickup(true);
                                setActiveSuggestIdx("pickup");
                              }}
                              placeholder="Tap to pick on map or search pickup location"
                              className="w-full rounded-2xl border border-outline-variant bg-white pl-4 pr-24 py-2.5 text-xs font-semibold text-on-surface placeholder:text-outline/60 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition-all shadow-2xs cursor-pointer"
                            />
                            <div className="absolute right-2.5 flex items-center gap-1.5">
                              {pickup && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPickup("");
                                    setPickupCoords(null);
                                    setCustomPickup(true);
                                  }}
                                  className="h-6 w-6 rounded-full bg-surface-container hover:bg-outline-variant text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                  title="Clear text"
                                >
                                  <Icon name="close" className="text-xs font-bold" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setMapTarget({
                                    type: "pickup",
                                    title: "Pin Pickup Location on Map",
                                    initialAddress: getResolvedPickup(),
                                  })
                                }
                                className="h-7 px-2 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer shrink-0"
                                title="Pin on Map"
                              >
                                <Icon name="pin_drop" className="text-sm" />
                              </button>
                            </div>
                          </div>

                          {/* Pickup Suggestions Popover - Matches exact input width on mobile and desktop */}
                          {activeSuggestIdx === "pickup" && (
                            <div className="suggest-container absolute z-30 left-0 right-0 top-full mt-1.5 w-full rounded-2xl border border-outline-variant bg-white p-3 shadow-xl space-y-1.5 backdrop-blur-md">
                              <div className="flex items-center justify-between px-2 py-1 border-b border-outline-variant/60">
                                <span className="text-label-sm font-medium text-outline">
                                  Suggested pickup hubs &amp; towns
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActiveSuggestIdx(null)}
                                  className="text-[10px] text-primary font-bold hover:underline cursor-pointer"
                                >
                                  Done
                                </button>
                              </div>
                              <div className="max-h-52 overflow-y-auto divide-y divide-outline-variant/40">
                                {getFilteredSuggestions(pickup).length > 0 ? (
                                  getFilteredSuggestions(pickup).map((place) => (
                                    <button
                                      key={place}
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        setPickup(place);
                                        setCustomPickup(true);
                                        setActiveSuggestIdx(null);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs font-medium text-on-surface hover:bg-primary/10 hover:text-primary rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                                    >
                                      <span className="truncate">{place}</span>
                                      <Icon name="north_west" className="text-xs text-outline" />
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-3 py-2.5 text-xs text-outline">
                                    Type an address, town, or landmark
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Swap Pickup & Destination Button (Only for 1-to-1 route) */}
                      {customDestinations.length === 1 && (
                        <div className="flex justify-end pr-2 -my-2 relative z-10">
                          <button
                            type="button"
                            onClick={() => {
                              const curPickup = pickup || getResolvedPickup();
                              const curDrop = customDestinations[0] || "";
                              setPickup(curDrop);
                              const copy = [...customDestinations];
                              copy[0] = curPickup;
                              setCustomDestinations(copy);
                              setCustomPickup(true);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-outline-variant text-primary shadow-2xs hover:bg-surface-container-low   transition-all cursor-pointer"
                            title="Swap Pickup and Destination"
                          >
                            <Icon name="swap_vert" className="text-sm" />
                          </button>
                        </div>
                      )}

                      {/* Destination / Multi-Stop Route */}
                      <div className="space-y-3">
                        {customDestinations.map((dest, idx) => {
                          const suggestions = getFilteredSuggestions(dest);
                          const isShowingSuggestions = activeSuggestIdx === idx;
                          const isFinal = idx === customDestinations.length - 1;

                          return (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-label-sm font-medium text-outline flex items-center gap-1.5">
                                  <span className={`h-2 w-2 rounded-full ${customDestinations.length === 1 ? "bg-red-600" : isFinal ? "bg-red-600" : "bg-amber-500"}`} />
                                  <span>
                                    {customDestinations.length === 1
                                      ? "Where to? (Destination)"
                                      : isFinal
                                      ? `Stop ${idx + 1}: Final destination`
                                      : `Stop ${idx + 1}`}
                                  </span>
                                </span>
                              </div>

                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  value={dest}
                                  onClick={() =>
                                    setMapTarget({
                                      type: "drop",
                                      index: idx,
                                      title: customDestinations.length > 1 ? `Pin Stop ${idx + 1} on Map` : "Pin Destination on Map",
                                      initialAddress: dest,
                                    })
                                  }
                                  onFocus={() => setActiveSuggestIdx(idx)}
                                  onChange={(e) => {
                                    const copy = [...customDestinations];
                                    copy[idx] = e.target.value;
                                    setCustomDestinations(copy);
                                    setActiveSuggestIdx(idx);
                                  }}
                                  placeholder={idx === 0 ? "Tap to pick on map or search destination" : `Destination stop ${idx + 1} (tap for map)`}
                                  className={`w-full rounded-2xl border border-outline-variant bg-white pl-4 py-2.5 text-xs font-semibold text-on-surface placeholder:text-outline/60 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition-all shadow-2xs cursor-pointer ${
                                    customDestinations.length > 1 ? "pr-32" : "pr-24"
                                  }`}
                                />

                                <div className="absolute right-2.5 flex items-center gap-1.5">
                                  {dest && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const copy = [...customDestinations];
                                        copy[idx] = "";
                                        setCustomDestinations(copy);
                                      }}
                                      className="h-6 w-6 rounded-full bg-surface-container hover:bg-outline-variant text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                      title="Clear text"
                                    >
                                      <Icon name="close" className="text-xs font-bold" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMapTarget({
                                        type: "drop",
                                        index: idx,
                                        title: customDestinations.length > 1 ? `Pin Stop ${idx + 1} on Map` : "Pin Destination on Map",
                                        initialAddress: dest,
                                      })
                                    }
                                    className="h-7 px-2 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer shrink-0"
                                    title="Open interactive map"
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
                                      className="h-7 w-7 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                      title="Remove this stop"
                                    >
                                      <Icon name="delete_outline" className="text-sm" />
                                    </button>
                                  )}
                                </div>

                                {/* Autocomplete Dropdown Popover */}
                                {isShowingSuggestions && (
                                  <div className="suggest-container absolute z-20 left-0 right-0 top-full mt-1.5 rounded-2xl border border-outline-variant bg-white p-3 shadow-2xl space-y-1.5 backdrop-blur-md">
                                    <div className="flex items-center justify-between px-2 py-1 border-b border-outline-variant/60">
                                      <span className="text-label-sm font-medium text-outline">
                                        Suggested hill landmarks &amp; attractions
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setActiveSuggestIdx(null)}
                                        className="text-[10px] text-primary font-bold hover:underline cursor-pointer"
                                      >
                                        Done
                                      </button>
                                    </div>
                                    <div className="max-h-52 overflow-y-auto divide-y divide-outline-variant/40">
                                      {suggestions.length > 0 ? (
                                        suggestions.map((place) => (
                                          <button
                                            key={place}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleSelectSuggestion(place, idx)}
                                            className="w-full text-left px-3 py-2 text-xs font-medium text-on-surface hover:bg-primary/10 hover:text-primary rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                                          >
                                            <span className="truncate">{place}</span>
                                            <Icon name="north_west" className="text-xs text-outline" />
                                          </button>
                                        ))
                                      ) : (
                                        <div className="px-3 py-2.5 text-xs text-outline">
                                          Type a specific landmark, station, or airport
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Route Card Footer: Add Stop & Round Trip Return Notice */}
                  <div className="pt-2.5 border-t border-outline-variant/60 space-y-2">
                    {customDestinations.length < 5 && (
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomDestinations([...customDestinations, ""]);
                            setActiveSuggestIdx(customDestinations.length);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/12 border border-primary/20 px-3.5 py-1.5 rounded-full transition-all cursor-pointer"
                        >
                          <Icon name="add" className="text-sm font-bold" />
                          <span>Add Stop along Route</span>
                        </button>
                        <span className="text-[10px] text-outline font-medium">Up to 5 stops</span>
                      </div>
                    )}

                    {/* Return Leg Notice if Round Trip */}
                    {isRoundTrip && (
                      <div className="pt-1 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                          <Icon name="sync_alt" className="text-sm text-primary" />
                          <span>Return Leg: Back to {pickup || getResolvedPickup()}</span>
                        </div>
                        <span className="text-[10px] text-outline bg-white border border-outline-variant px-2 py-0.5 rounded-md font-medium">
                          Driver Waits
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Popular Transfer Quick Chips */}
                <div className="space-y-2 pt-1">
                  <span className="text-label-sm font-medium text-outline block">
                    Popular destinations &amp; hill excursions
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: "Bagdogra Airport (IXB)", icon: "flight" },
                      { name: "NJP Railway Station", icon: "train" },
                      { name: "Tiger Hill Sunrise", icon: "wb_sunny" },
                      { name: "Darjeeling Mall Road", icon: "store" },
                      { name: "Mirik Lake", icon: "park" },
                      { name: "Lamahatta Eco Park", icon: "forest" },
                      { name: "Siliguri Junction", icon: "directions_car" },
                    ].map((spot) => (
                      <button
                        key={spot.name}
                        type="button"
                        onClick={() => {
                          const copy = [...customDestinations];
                          copy[0] = spot.name;
                          setCustomDestinations(copy);
                          setActiveSuggestIdx(null);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                          customDestinations[0] === spot.name
                            ? "bg-primary border-primary text-white shadow-xs font-bold"
                            : "bg-white border-outline-variant text-on-surface hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        <Icon name={spot.icon} className="text-xs" />
                        <span>{spot.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Next Step CTA Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const pickupLoc = getResolvedPickup();
                      if (!pickupLoc) {
                        setErrorMessage("Please choose or specify a pickup location.");
                        return;
                      }
                      const drops = getResolvedDestinations();
                      if (!drops || drops.length === 0 || !drops[0]?.trim()) {
                        setErrorMessage("Please select or enter at least one destination.");
                        return;
                      }
                      setErrorMessage("");
                      setCurrentStep(2);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-sm hover:bg-primary-container  cursor-pointer transition-all"
                  >
                    <span>Continue to Schedule & Travelers</span>
                    <Icon name="arrow_forward" className="text-base" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SCHEDULE & TRAVELERS */}
            {currentStep === 2 && (
              <div className="space-y-6 rounded-2xl border border-outline-variant bg-white p-6 sm:p-8 shadow-[0_10px_35px_-4px_rgba(20,66,45,0.05)]">
                {/* Top Nav Back Link */}
                <div className="flex items-center justify-between border-b border-outline-variant/60 pb-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="group inline-flex items-center gap-1.5 text-xs font-bold text-outline hover:text-primary transition-colors cursor-pointer"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2.2"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    <span>Back to route</span>
                  </button>
                  <span className="text-label-sm font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                    Step 2 of 3
                  </span>
                </div>

                <div>
                  <h2 className="font-display text-2xl font-medium text-primary">When are you traveling?</h2>
                  <p className="text-xs text-outline mt-1">Set your pickup time and passenger count. Local drivers will quote exact hill fares.</p>
                </div>

                {/* Date Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-on-surface block">Date of Travel</label>
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: "Today", days: 0 },
                        { label: "Tomorrow", days: 1 },
                        { label: "Day After", days: 2 },
                      ].map((item) => {
                        const target = new Date();
                        target.setDate(target.getDate() + item.days);
                        const targetYmd = toLocalYmd(target);
                        const isMatch = date === targetYmd;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              setDate(targetYmd);
                              if (returnDate && returnDate < targetYmd) {
                                setReturnDate(targetYmd);
                              }
                            }}
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                              isMatch
                                ? "bg-primary text-white shadow-xs"
                                : "bg-surface border border-outline-variant text-on-surface-variant hover:border-primary"
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <input
                    type="date"
                    value={date}
                    min={toLocalYmd(new Date())}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setDate(newDate);
                      if (tripType === "multiday") {
                        setReturnDate(calcReturnYmd(newDate, tourDays));
                      } else if (returnDate && returnDate < newDate) {
                        setReturnDate(newDate);
                      }
                    }}
                    className="w-full rounded-2xl border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none bg-white shadow-2xs transition-all"
                  />
                </div>

                {/* Time Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-on-surface block">Pickup Time</label>
                  </div>

                  {/* Native Clock Dialer / Time Picker */}
                  <div className="relative flex items-center">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-primary">
                      <Icon name="alarm" className="text-lg" />
                    </div>
                    <input
                      type="time"
                      value={toTime24(time)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setTime(toTime12(e.target.value));
                        }
                      }}
                      className="w-full rounded-2xl border border-outline-variant bg-white py-3 pl-11 pr-3 sm:pr-24 text-sm font-bold text-on-surface focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none shadow-2xs cursor-pointer transition-all"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 hidden sm:flex items-center pr-4 text-[11px] text-outline font-medium">
                      Tap for clock
                    </div>
                  </div>
                </div>

                {/* Round Trip Return Schedule Options */}
                {isRoundTrip && (
                  <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5 text-xs text-primary space-y-3.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon name="sync_alt" className="text-base text-primary" />
                        <span className="font-bold text-sm">Round Trip Return Schedule</span>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                        Driver Accompanies You
                      </span>
                    </div>

                    {/* 2-Option Selector: Flexible vs Specific */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReturnTimingMode("flexible")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          returnTimingMode === "flexible"
                            ? "bg-white border-primary shadow-xs text-primary"
                            : "bg-primary/5 border-transparent text-outline hover:bg-primary/10"
                        }`}
                      >
                        <span className="font-bold text-xs block leading-tight">Flexible Return</span>
                        <span className="text-[10px] opacity-80 mt-0.5 block">Driver waits during tour</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReturnTimingMode("specific")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          returnTimingMode === "specific"
                            ? "bg-white border-primary shadow-xs text-primary"
                            : "bg-primary/5 border-transparent text-outline hover:bg-primary/10"
                        }`}
                      >
                        <span className="font-bold text-xs block leading-tight">Set Return Time</span>
                        <span className="text-[10px] opacity-80 mt-0.5 block">Specific return time</span>
                      </button>
                    </div>

                    {returnTimingMode === "flexible" ? (
                      <p className="text-[11px] text-primary/90 leading-relaxed">
                        Your driver will accompany you, wait during sightseeing or meetings, and drive you back to your homestay when you are ready.
                      </p>
                    ) : (
                      <div className="space-y-3 pt-1 border-t border-primary/20">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-bold block mb-1">Return Date</label>
                            <input
                              type="date"
                              value={returnDate}
                              min={date}
                              onChange={(e) => setReturnDate(e.target.value)}
                              className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold block mb-1">Expected Return Time</label>
                            <input
                              type="time"
                              value={toTime24(returnTime)}
                              onChange={(e) => {
                                if (e.target.value) setReturnTime(toTime12(e.target.value));
                              }}
                              className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Requirement 7: Passenger Count Only (No Vehicle Class Selection) */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-on-surface block">Number of Passengers</label>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-outline-variant p-5 bg-surface">
                    <div>
                      <span className="text-sm font-bold text-on-surface block">Total Travelers</span>
                      <span className="text-xs text-outline">Adults + Children traveling together</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={passengers <= 1}
                        onClick={() => setPassengers(Math.max(1, passengers - 1))}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-outline-variant bg-white font-bold text-lg text-primary hover:bg-surface-container-low  disabled:opacity-40 cursor-pointer transition-all shadow-2xs"
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
                        className="w-12 text-center font-bold text-lg text-primary bg-transparent focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={passengers >= 20}
                        onClick={() => setPassengers(Math.min(20, passengers + 1))}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-outline-variant bg-white font-bold text-lg text-primary hover:bg-surface-container-low  disabled:opacity-40 cursor-pointer transition-all shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-outline pt-0.5">
                    Drivers with suitably-sized mountain vehicles (Hatchbacks, Boleros, Innovas, or Travellers) will quote you directly.
                  </p>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="w-1/3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest py-3.5 text-label-md font-medium text-on-surface hover:bg-surface-container-low active:opacity-90 cursor-pointer transition-colors"
                  >
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2.2"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    <span>Back</span>
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
                    className="w-2/3 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-xs font-bold text-white shadow-sm hover:bg-primary-container  transition-all cursor-pointer"
                  >
                    <span>Continue to Review</span>
                    <Icon name="arrow_forward" className="text-sm" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: GUEST DETAILS & REVIEW */}
            {currentStep === 3 && (
              <div className="space-y-6 rounded-2xl border border-outline-variant bg-white p-6 sm:p-8 shadow-[0_10px_35px_-4px_rgba(20,66,45,0.05)]">
                {/* Top Nav Back Link */}
                <div className="flex items-center justify-between border-b border-outline-variant/60 pb-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="group inline-flex items-center gap-1.5 text-xs font-bold text-outline hover:text-primary transition-colors cursor-pointer"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2.2"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    <span>Back to schedule</span>
                  </button>
                  <span className="text-label-sm font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                    Step 3 of 3
                  </span>
                </div>

                <div>
                  <h2 className="font-display text-2xl font-medium text-primary">Passenger details &amp; review</h2>
                  <p className="text-xs text-outline mt-1">Direct hill driver quotes · Zero upfront commission · Pay driver directly</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-on-surface block mb-1.5">Guest Full Name</label>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Ankit Sharma"
                      className="w-full rounded-2xl border border-outline-variant px-4 py-3 text-sm text-on-surface focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none shadow-2xs transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-on-surface block mb-1.5">
                      WhatsApp Contact Number (10 Digits)
                    </label>
                    <div className="flex gap-2">
                      <span className="flex items-center rounded-2xl bg-surface border border-outline-variant px-3.5 text-xs font-bold text-on-surface-variant">
                        +91
                      </span>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="9876543210"
                        className="w-full rounded-2xl border border-outline-variant px-4 py-3 text-sm text-on-surface focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none shadow-2xs transition-all"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-outline">
                      Drivers will send their quotes and booking confirmation directly to this WhatsApp number.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-on-surface block mb-1.5">
                      Luggage or Special Requests (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. 3 large bags, elderly passenger, luggage roof rack needed"
                      className="w-full rounded-2xl border border-outline-variant px-4 py-3 text-sm text-on-surface focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none shadow-2xs transition-all"
                    />
                  </div>

                  {/* Target Budget (Optional, ₹ - InDrive style) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-on-surface">Target Budget (Optional, ₹)</label>
                      <span className="text-[10px] text-outline">Guest price expectation</span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute left-4 text-sm font-bold text-outline">₹</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={guestBudget}
                        onChange={(e) => setGuestBudget(e.target.value.replace(/\D/g, ""))}
                        placeholder="e.g. 2500"
                        className="w-full rounded-2xl border border-outline-variant pl-8 pr-4 py-3 text-sm text-on-surface focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none shadow-2xs bg-white transition-all"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-outline">
                      Local verified drivers will see your target budget when submitting their quotes on WhatsApp.
                    </p>
                  </div>
                </div>

                {/* Bespoke Boarding-Pass Trip Review Card */}
                <div className="rounded-2xl border border-outline-variant bg-surface p-5 sm:p-6 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs">
                        <Icon name="check" className="text-xs" />
                      </div>
                      <span className="font-display font-medium text-primary text-sm">Trip Summary</span>
                    </div>
                    <span className="rounded-md bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-label-sm font-medium text-primary">
                      {tripType === "multiday" ? `Multi-day tour (${tourDays} days)` : isRoundTrip ? "Round trip" : "One-way transfer"}
                    </span>
                  </div>

                  {/* Connected Route Timeline */}
                  <div className="rounded-2xl border border-outline-variant bg-white p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center mt-1">
                        <span className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/15" />
                        <span className="h-7 w-0.5 bg-outline-variant my-0.5" />
                        <span className="h-3 w-3 rounded-full bg-red-600 ring-4 ring-red-600/15" />
                        {isRoundTrip && (
                          <>
                            <span className="h-7 w-0.5 border-l border-dashed border-primary my-0.5" />
                            <span className="h-3.5 w-3.5 rounded-full bg-primary flex items-center justify-center text-[9px] text-white font-bold">↺</span>
                          </>
                        )}
                      </div>

                      <div className="flex-1 space-y-2.5 text-xs">
                        <div>
                          <span className="text-label-sm font-medium text-outline block">
                            Pickup location
                          </span>
                          <p className="font-medium text-on-surface text-xs mt-0.5">{getResolvedPickup()}</p>
                          {pickupCoords && (
                            <span className="font-mono text-[10px] text-outline">
                              GPS Pin: {pickupCoords.latitude.toFixed(4)}, {pickupCoords.longitude.toFixed(4)}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-label-sm font-medium text-outline block">
                            {getResolvedDestinations().length > 1 ? "Drop locations" : "Destination"}
                          </span>
                          {getResolvedDestinations().map((d, i) => (
                            <p key={i} className="font-medium text-on-surface text-xs mt-0.5">
                              {getResolvedDestinations().length > 1 ? `${i + 1}. ${d}` : d}
                            </p>
                          ))}
                        </div>

                        {isRoundTrip && (
                          <div className="pt-1">
                            <span className="text-label-sm font-medium text-primary block">
                              {tripType === "multiday" ? `Multi-day tour return (${tourDays} days)` : "Return journey (round trip)"}
                            </span>
                            <p className="font-bold text-primary text-xs mt-0.5">
                              Return drop back to {getResolvedPickup()}
                            </p>
                            <span className="text-[11px] text-outline">
                              {returnTimingMode === "specific" && returnTime
                                ? `Specific Return: ${returnDate === date ? "Same Day" : toDisplayDate(returnDate)} at ${returnTime}`
                                : tripType === "multiday"
                                  ? `Tour Return: ${toDisplayDate(returnDate || calcReturnYmd(date, tourDays))} at drop-off`
                                  : "Flexible Return: Driver waits during your sightseeing/visit"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Trip Spec Chips Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="rounded-2xl border border-outline-variant/60 bg-white p-3">
                      <span className="text-[10px] text-outline block font-medium">Departure Date</span>
                      <span className="font-bold text-on-surface block mt-0.5">{toDisplayDate(date)}</span>
                      <span className="text-[11px] text-primary font-bold block">{time}</span>
                    </div>

                    <div className="rounded-2xl border border-outline-variant/60 bg-white p-3">
                      <span className="text-[10px] text-outline block font-medium">Travelers</span>
                      <span className="font-bold text-on-surface block mt-0.5">
                        {passengers} {passengers === 1 ? "Passenger" : "Passengers"}
                      </span>
                      <span className="text-[10px] text-outline block">All seats included</span>
                    </div>

                    <div className="rounded-2xl border border-outline-variant/60 bg-white p-3 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-outline block font-medium">Target Budget</span>
                      <span className="font-bold text-primary block mt-0.5">
                        {guestBudget ? `₹${Number(guestBudget).toLocaleString("en-IN")}` : "Open Bidding"}
                      </span>
                      <span className="text-[10px] text-outline block">Driver bids welcome</span>
                    </div>
                  </div>

                  {/* No Upfront Guarantee Banner */}
                  <div className="rounded-2xl bg-primary/10 border border-primary/25 p-3.5 text-[11px] text-primary leading-snug space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Icon name="verified" className="text-sm text-primary" />
                      <span>Zero upfront fee to request quotes</span>
                    </p>
                    <p className="text-primary/90">
                      Local verified drivers will review your itinerary and send direct hill quotes to your WhatsApp. You only pay after you accept a driver.
                    </p>
                  </div>

                  {/* DPDP Act 2023 Consent Notice */}
                  <div className="flex items-start gap-2.5 pt-1">
                    <input
                      type="checkbox"
                      id="dpdp-consent"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="dpdp-consent" className="text-[11px] leading-relaxed text-outline cursor-pointer">
                      I agree to the{" "}
                      <Link href="/legal/terms" target="_blank" className="font-semibold text-primary underline hover:text-primary-container">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/legal/privacy" target="_blank" className="font-semibold text-primary underline hover:text-primary-container">
                        Privacy Policy
                      </Link>
                      . My contact info will be used solely for verified driver coordination.
                    </label>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="w-1/3 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-outline-variant bg-white py-3.5 text-xs font-bold text-on-surface hover:bg-surface-container-low  cursor-pointer transition-all"
                  >
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2.2"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !agreedToTerms}
                    onClick={handleFormSubmit}
                    className="w-2/3 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-xs font-bold text-white shadow-sm hover:bg-primary-container  transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Submitting Request…
                      </span>
                    ) : (
                      <>
                        <Icon name="local_taxi" className="text-base" />
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
