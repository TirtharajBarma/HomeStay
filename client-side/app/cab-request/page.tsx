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
  let plate = plateMatch ? plateMatch[0].toUpperCase().replace(/\s+/g, " ") : "";
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
  const [activeSuggestIdx, setActiveSuggestIdx] = useState<number | "pickup" | null>(null);
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
        returnDate: undefined,
        returnTime: undefined,
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

  const configuredPaymentPageUrl =
    (tripStatus?.config as any)?.paymentPageUrl ||
    (link?.config as any)?.paymentPageUrl ||
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
      <div className="min-h-screen bg-[#F7FAF7] flex items-center justify-center p-6 font-body">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#14422D] border-t-transparent" />
          <div>
            <p className="text-sm font-bold text-[#14422D]">Connecting to Verified Hill Fleet…</p>
            <p className="text-xs text-[#717973] mt-0.5">StayCabs Mountain Mobility Concierge</p>
          </div>
        </div>
      </div>
    );
  }

  if (linkState === "invalid") {
    if (isNoLink) {
      return (
        <div className="min-h-screen bg-[#F7FAF7] flex items-center justify-center p-6 text-[#181C1B] font-body">
          <div className="max-w-md w-full rounded-3xl border border-[#E5E8E5] bg-white p-8 sm:p-10 text-center space-y-6 shadow-[0_12px_40px_-6px_rgba(20,66,45,0.08)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#14422D]/8 text-[#14422D] border border-[#14422D]/15 shadow-2xs">
              <Icon name="local_taxi" className="text-3xl text-[#14422D]" />
            </div>

            <div className="space-y-2">
              <span className="inline-block rounded-full bg-[#14422D]/10 px-3.5 py-1 text-[11px] font-bold text-[#14422D] uppercase tracking-wider">
                Exclusive Guest Concierge
              </span>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#14422D]">
                {siteConfig.appName} Hill Cabs
              </h1>
              <p className="text-xs sm:text-sm text-[#414943] leading-relaxed">
                Hill Cabs are arranged exclusively for guests of our partner homestays. Check your WhatsApp for your private booking link, or ask your host to send you a booking invite.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E5E8E5] bg-[#F7FAF7] p-4 text-left text-xs space-y-2.5 text-[#181C1B]">
              <div className="flex items-center gap-2.5">
                <Icon name="verified" className="text-[#14422D] text-sm shrink-0" />
                <span>Door-to-door mountain airport & station transfers</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon name="payments" className="text-[#14422D] text-sm shrink-0" />
                <span>100% direct cash fare to mountain drivers</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon name="chat" className="text-[#14422D] text-sm shrink-0" />
                <span>Direct WhatsApp coordination & live PIN verification</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Link
                href="/#accommodations"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14422D] px-5 py-3.5 text-xs font-bold text-white shadow-sm hover:bg-[#1C593E] transition-all"
              >
                <Icon name="cottage" className="text-sm" />
                <span>View Partner Homestays</span>
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D8DBD7] bg-white px-5 py-3 text-xs font-semibold text-[#181C1B] hover:bg-[#F1F4F1] transition-colors"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#F7FAF7] flex items-center justify-center p-6 font-body">
        <div className="max-w-md w-full rounded-3xl border border-[#E5E8E5] bg-white p-8 text-center space-y-5 shadow-[0_10px_30px_-4px_rgba(20,66,45,0.06)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100">
            <Icon name="link_off" className="text-2xl" />
          </div>
          <h1 className="font-display text-xl font-bold text-[#181C1B]">Link Expired or Invalid</h1>
          <p className="text-xs text-[#717973] leading-relaxed">
            This private cab booking link is no longer active. Please contact your homestay host to receive a fresh booking link.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14422D] px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#1C593E] transition-all"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (bookingNotFound) {
    return (
      <div className="min-h-screen bg-[#F7FAF7] flex items-center justify-center p-6 font-body">
        <div className="max-w-md w-full rounded-3xl border border-[#E5E8E5] bg-white p-8 text-center space-y-5 shadow-[0_10px_30px_-4px_rgba(20,66,45,0.06)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100">
            <Icon name="search_off" className="text-2xl" />
          </div>
          <h1 className="font-display text-xl font-bold text-[#181C1B]">Booking Not Found</h1>
          <p className="text-xs text-[#717973] leading-relaxed">
            We could not find a cab booking for this reference. Please check the link in your WhatsApp message or contact your homestay host.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14422D] px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#1C593E] transition-all"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7FAF7] text-[#181C1B] font-body antialiased">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E5E8E5]/80 bg-white/85 backdrop-blur-xl px-4 py-3.5 shadow-[0_2px_12px_-2px_rgba(20,66,45,0.03)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#14422D] text-white shadow-sm">
              <Icon name="local_taxi" className="text-xl text-[#BCEECF]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-[#14422D] text-lg tracking-tight leading-none">
                  {siteConfig.appName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#14422D]/8 px-2 py-0.5 text-[10px] font-bold text-[#14422D] border border-[#14422D]/15 shrink-0">
                  <Icon name="verified" className="text-xs text-[#14422D]" />
                  <span>Verified Network</span>
                </span>
              </div>
              <p className="text-[11px] text-[#717973] truncate font-medium mt-0.5 max-w-[220px] sm:max-w-xs">
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
                className="inline-flex items-center gap-1.5 rounded-full border border-[#14422D]/15 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-[#14422D] hover:bg-[#F1F4F1] transition-all shadow-2xs"
              >
                <Icon name="chat" className="text-xs text-[#25D366]" />
                <span>Concierge</span>
              </a>
            ) : activeSupportEmail ? (
              <a
                href={`mailto:${activeSupportEmail}?subject=${encodeURIComponent(`${siteConfig.appName} Cab Assistance`)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#14422D]/15 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-[#14422D] hover:bg-[#F1F4F1] transition-all shadow-2xs"
              >
                <Icon name="support_agent" className="text-xs text-[#14422D]" />
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
            <div className="rounded-3xl border border-[#E5E8E5]/90 bg-white p-6 sm:p-7 shadow-[0_10px_30px_-4px_rgba(20,66,45,0.05)] space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECEFEB] pb-4">
                <div>
                  <span className="text-[11px] font-semibold text-[#717973] uppercase tracking-wider block">Mountain Trip Reference</span>
                  <p className="text-xl font-mono font-bold text-[#14422D]">#{confirmedTrip.reference}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3.5 py-1 text-xs font-bold ${
                      (tripStatus?.status || confirmedTrip.status) === "COMPLETED"
                        ? "bg-[#14422D]/10 text-[#14422D] border border-[#14422D]/20"
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
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F1F4F1] text-[#717973] hover:text-[#181C1B] transition-colors cursor-pointer"
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
                    <div className="h-2 w-full rounded-full bg-[#14422D]" />
                    <span className="font-bold text-[#14422D] block truncate">1. Received</span>
                  </div>
                  <div className="space-y-1.5">
                    <div
                      className={`h-2 w-full rounded-full transition-all ${
                        ["QUOTE_RECEIVED", "AWAITING_ADVANCE_PAYMENT", "CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(
                          tripStatus?.status || ""
                        )
                          ? "bg-[#14422D]"
                          : ["PENDING_REVIEW", "FINDING_DRIVER"].includes(tripStatus?.status || confirmedTrip.status)
                          ? "bg-sky-500 animate-pulse"
                          : "bg-[#ECEFEB]"
                      }`}
                    />
                    <span
                      className={`block truncate ${
                        ["QUOTE_RECEIVED", "AWAITING_ADVANCE_PAYMENT", "CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(
                          tripStatus?.status || ""
                        )
                          ? "font-bold text-[#14422D]"
                          : "font-medium text-[#717973]"
                      }`}
                    >
                      2. Assigned
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div
                      className={`h-2 w-full rounded-full transition-all ${
                        ["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "")
                          ? "bg-[#14422D]"
                          : tripStatus?.status === "AWAITING_ADVANCE_PAYMENT"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-[#ECEFEB]"
                      }`}
                    />
                    <span
                      className={`block truncate ${
                        ["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "")
                          ? "font-bold text-[#14422D]"
                          : tripStatus?.status === "AWAITING_ADVANCE_PAYMENT"
                          ? "font-bold text-amber-900"
                          : "font-medium text-[#717973]"
                      }`}
                    >
                      3. Confirmed
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div
                      className={`h-2 w-full rounded-full transition-all ${
                        ["TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "")
                          ? "bg-[#14422D]"
                          : ["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY"].includes(tripStatus?.status || "")
                          ? "bg-sky-400"
                          : "bg-[#ECEFEB]"
                      }`}
                    />
                    <span
                      className={`block truncate ${
                        ["TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "")
                          ? "font-bold text-[#14422D]"
                          : "font-medium text-[#717973]"
                      }`}
                    >
                      4. On Trip
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div
                      className={`h-2 w-full rounded-full transition-all ${
                        tripStatus?.status === "COMPLETED" ? "bg-[#14422D]" : "bg-[#ECEFEB]"
                      }`}
                    />
                    <span
                      className={`block truncate ${
                        tripStatus?.status === "COMPLETED" ? "font-bold text-[#14422D]" : "font-medium text-[#717973]"
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
                      <div className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-sky-600" />
                      </div>
                      <span className="text-xs font-bold text-sky-950 uppercase tracking-wider">
                        {tripStatus?.awaitingOwner
                          ? "Request received"
                          : (tripStatus?.status || confirmedTrip.status) === "PENDING_REVIEW"
                          ? "Request received — finding drivers…"
                          : "Finding your driver in this valley…"}
                      </span>
                    </div>
                    <span className="text-[10px] text-sky-800 bg-sky-100/80 px-2.5 py-0.5 rounded-full font-semibold">
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
                <div className="rounded-3xl border border-amber-200/90 bg-white p-6 sm:p-7 shadow-[0_12px_40px_-6px_rgba(20,66,45,0.07)] space-y-6">
                  {/* Status & Deadline Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ECEFEB] pb-5">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-0.5 text-[11px] font-bold text-amber-900">
                        <Icon name="lock" className="text-xs text-amber-700" />
                        <span>Driver Reserved on Hold</span>
                      </span>
                      <h3 className="font-display font-bold text-[#14422D] text-xl sm:text-2xl pt-1">
                        Confirm Mountain Cab
                      </h3>
                      <p className="text-xs text-[#717973]">
                        Pay reservation advance to unlock driver contact & vehicle plate
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-[#717973] uppercase tracking-wider block">
                        Advance Required
                      </span>
                      <p className="text-3xl font-extrabold text-[#14422D] tracking-tight leading-none mt-1">
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
                  <div className="rounded-2xl border border-[#E5E8E5] bg-[#F7FAF7] p-4 sm:p-5 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-[#414943]">
                      <span className="font-medium">Total Trip Fare (Agreed with Driver):</span>
                      <strong className="font-bold text-[#181C1B] text-sm">{formatInr(tripStatus.agreedFare)}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[#717973]">
                      <span>Online Reservation Advance (Pay now):</span>
                      <strong className="text-[#14422D] font-bold text-sm">{formatInr(tripStatus.advanceAmount)}</strong>
                    </div>
                    <div className="pt-2.5 border-t border-[#E5E8E5] flex justify-between items-center text-[#181C1B]">
                      <div>
                        <span className="font-bold block text-sm">Remaining Cash to Driver</span>
                        <span className="text-[11px] text-[#717973]">Hand directly to driver at drop-off</span>
                      </div>
                      <span className="text-base sm:text-lg font-extrabold text-[#14422D]">{formatInr(tripStatus.remainingCashAmount)}</span>
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
                    <div className="rounded-2xl border border-[#14422D]/20 bg-[#14422D]/5 p-5 text-xs text-[#14422D] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-2 font-bold text-[#14422D] text-sm">
                          <Icon name="check_circle" className="text-base text-[#14422D]" />
                          <span>Payment Reference Submitted</span>
                        </p>
                        <span className="rounded-full bg-[#14422D]/15 px-3 py-0.5 text-[10px] font-bold text-[#14422D]">
                          Verifying
                        </span>
                      </div>
                      <p className="leading-relaxed text-[#414943]">
                        UTR / Ref: <span className="font-mono font-bold text-[#14422D] bg-white px-2.5 py-0.5 rounded-lg border border-[#14422D]/20">{tripStatus.paymentClaim?.utr || "received"}</span>. Our operations desk is verifying receipt. Your cab remains reserved on hold.
                      </p>
                      {!editingClaim && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClaim(true);
                            setUtrInput(tripStatus.paymentClaim?.utr || "");
                          }}
                          className="font-bold text-[#14422D] hover:underline cursor-pointer text-xs"
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
                        className="w-full flex items-center justify-between gap-4 rounded-2xl bg-[#14422D] hover:bg-[#1C593E] active:scale-[0.99] p-4 sm:p-5 text-white shadow-[0_10px_25px_-3px_rgba(20,66,45,0.3)] transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white shadow-inner">
                            <Icon name="payments" className="text-2xl text-[#BCEECF]" />
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] uppercase tracking-wider text-[#A1D1B4] font-bold block">
                              Instant Driver Confirmation
                            </span>
                            <span className="text-base sm:text-lg font-bold leading-tight block">
                              Pay {formatInr(tripStatus.advanceAmount)} via Razorpay
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold bg-white/10 px-3.5 py-2 rounded-xl border border-white/15 group-hover:bg-white/20 transition-all">
                          <span>Pay Now</span>
                          <Icon name="arrow_forward" className="text-sm" />
                        </div>
                      </a>

                      <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-[#717973] pt-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          <Icon name="lock" className="text-xs text-[#14422D]" /> 256-Bit SSL Secure
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
                    <form onSubmit={handleSubmitClaim} className="rounded-2xl border border-[#E5E8E5] bg-[#F7FAF7] p-4 sm:p-5 text-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <label htmlFor="utr" className="block font-bold text-[#181C1B] text-xs">
                          Already paid? Enter UPI UTR or Payment ID:
                        </label>
                        <span className="text-[10px] text-[#717973] font-mono">12-digit Ref</span>
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
                          className="min-w-0 flex-1 rounded-xl border border-[#D8DBD7] bg-white px-3.5 py-2.5 font-mono text-sm text-[#181C1B] placeholder:text-[#717973]/60 focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none transition-all"
                        />
                        <button
                          type="submit"
                          disabled={claimBusy}
                          className="rounded-xl bg-[#14422D] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1C593E] disabled:opacity-60 cursor-pointer transition-colors shadow-2xs"
                        >
                          {claimBusy ? "Submitting…" : "Confirm"}
                        </button>
                      </div>
                      <p className="text-[11px] text-[#717973]">
                        Found in your payment receipt / SMS (12-digit UPI Ref / UTR number).
                      </p>
                      {claimError && <p className="text-[11px] font-semibold text-red-700">{claimError}</p>}
                    </form>
                  )}

                  {/* Secondary Alternative: Direct UPI QR Code (Collapsible) */}
                  {activeUpiId && !claimPending && (
                    <div className="rounded-2xl border border-[#E5E8E5] bg-white p-4 text-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#181C1B] text-xs">Alternative: Direct UPI Transfer</span>
                        <button
                          type="button"
                          onClick={() => setShowQr(!showQr)}
                          className="font-bold text-[#14422D] hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
                        >
                          <Icon name="qr_code" className="text-sm" />
                          <span>{showQr ? "Hide UPI QR" : "Show UPI QR & ID"}</span>
                        </button>
                      </div>

                      {showQr && (
                        <div className="space-y-3 pt-3 border-t border-[#ECEFEB]">
                          {advanceUpiUrl && (
                            <a
                              href={advanceUpiUrl}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#14422D] px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#1C593E] transition-all"
                            >
                              <Icon name="account_balance_wallet" className="text-sm" /> Open in UPI App
                            </a>
                          )}

                          <div className="space-y-2 rounded-xl bg-[#F7FAF7] p-3 border border-[#E5E8E5]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[#717973]">UPI ID</span>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-bold text-[#181C1B] break-all">{activeUpiId}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyUpi(activeUpiId)}
                                  className="rounded-lg px-2.5 py-1 font-bold bg-white border border-[#D8DBD7] text-xs hover:bg-[#ECEFEB] cursor-pointer"
                                >
                                  {copiedUpi ? "Copied" : "Copy"}
                                </button>
                              </div>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-[#717973]">Amount</span>
                              <span className="font-mono font-bold text-[#181C1B]">{formatInr(tripStatus.advanceAmount)}</span>
                            </div>
                          </div>

                          {qr.url === advanceUpiUrl && qr.data && (
                            <div className="flex flex-col items-center justify-center pt-1">
                              <img src={qr.data} alt="UPI payment QR code" className="h-44 w-44 rounded-2xl border border-[#E5E8E5] p-2 bg-white shadow-xs" />
                              <span className="mt-2 text-[11px] text-[#717973]">Scan with Google Pay, PhonePe, or Paytm</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Professional Policy & Safety Guarantee */}
                  <div className="rounded-2xl border border-[#E5E8E5] bg-[#F7FAF7] p-4 sm:p-5 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-[#181C1B] border-b border-[#E5E8E5] pb-2.5">
                      <Icon name="shield" className="text-sm text-[#14422D]" />
                      <span>StayCabs Mountain Ride Guarantee & Fair Policy</span>
                    </div>
                    <ul className="space-y-2 text-[11px] leading-relaxed text-[#414943] pt-1">
                      <li className="flex items-start gap-2">
                        <span className="text-[#14422D] font-bold shrink-0">✓</span>
                        <span><strong>Dedicated Cab Hold:</strong> Advance payment guarantees cab allocation from our verified mountain fleet for your scheduled itinerary.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#14422D] font-bold shrink-0">✓</span>
                        <span><strong>Instant Driver Release:</strong> Verified driver contact number, vehicle plate, and live pickup PIN are unlocked immediately upon payment confirmation.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#14422D] font-bold shrink-0">✓</span>
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
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-[#D8DBD7] px-4 py-3 text-xs font-bold text-[#25D366] hover:bg-[#F7FAF7] transition-all w-full shadow-2xs"
                        >
                          <Icon name="chat" className="text-sm" />
                          <span>Share Payment Confirmation on WhatsApp</span>
                        </a>
                        <div className="pt-1">
                          <a
                            href={`https://wa.me/${activeSupportPhone}?text=${encodeURIComponent(`Namaste, regarding cab request #${tripStatus.reference}: the quoted fare is ₹${tripStatus.agreedFare}. Can you assist with the pricing or vehicle options?`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#717973] hover:text-[#14422D] hover:underline"
                          >
                            <Icon name="support_agent" className="text-xs text-[#14422D]" />
                            <span>Need a Different Fare or Vehicle? Chat with Desk</span>
                          </a>
                        </div>
                      </>
                    ) : activeSupportEmail ? (
                      <a
                        href={`mailto:${activeSupportEmail}?subject=${encodeURIComponent(`Payment Confirmation - Reference #${tripStatus.reference}`)}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14422D] hover:underline"
                      >
                        <Icon name="mail" className="text-sm" /> Email Payment Confirmation ({activeSupportEmail})
                      </a>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Cancelled / Expired Details */}
              {["CANCELLED", "EXPIRED"].includes(tripStatus?.status || "") && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-1.5 text-xs text-red-900">
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
              {["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(tripStatus?.status || "") && (() => {
                const vehicleDisplay = formatVehicleDisplay(tripStatus?.vehicle, tripStatus?.vehicleType);
                const driverDisplayName = formatDriverName(tripStatus?.driverName);
                const hasUnlockedContact = Boolean(tripStatus?.driverPhone && !tripStatus.driverPhone.includes("*"));

                return (
                  <div className="rounded-3xl border border-[#E5E8E5] bg-white p-6 sm:p-7 shadow-[0_10px_30px_-4px_rgba(20,66,45,0.05)] space-y-5">
                    {/* Driver Profile Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-[#ECEFEB] pb-4">
                      <div className="flex items-center gap-3.5">
                        <div className="relative">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#14422D] text-white font-display font-bold text-lg shadow-sm">
                            {driverDisplayName.charAt(0) || "D"}
                          </div>
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-xs">
                            <Icon name="verified" className="text-sm text-[#14422D]" />
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-[#181C1B] text-base leading-tight">
                              {driverDisplayName}
                            </h4>
                            <span className="inline-flex items-center rounded-full bg-[#14422D]/8 px-2 py-0.5 text-[10px] font-bold text-[#14422D] border border-[#14422D]/15">
                              Verified Driver
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-[#717973] font-medium">{vehicleDisplay.model}</span>
                            {vehicleDisplay.plate && (
                              <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-950 border border-amber-300 tracking-wider shadow-2xs">
                                {vehicleDisplay.plate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Masked notice if contact still locked */}
                      {!hasUnlockedContact && tripStatus?.driverPhone && (
                        <div className="text-right max-w-[45%]">
                          <p className="font-mono text-xs font-bold text-[#181C1B]">{tripStatus.driverPhone}</p>
                          <p className="text-[10px] text-[#717973] mt-0.5">Unlocked once advance is confirmed</p>
                        </div>
                      )}
                    </div>

                    {/* Dedicated 2-Button Action Row (Apple Native High-Contrast Controls) */}
                    {hasUnlockedContact && (
                      <div className="grid grid-cols-2 gap-3">
                        <a
                          href={`tel:${tripStatus?.driverPhone}`}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-[#D8DBD7] px-4 py-3.5 text-xs font-bold text-[#181C1B] shadow-2xs hover:bg-[#F1F4F1] active:scale-[0.98] transition-all"
                        >
                          <Icon name="phone" className="text-base text-[#14422D]" />
                          <span>Call Driver</span>
                        </a>
                        <a
                          href={`https://wa.me/${waNumber(tripStatus?.driverPhone || "")}?text=${encodeURIComponent(`Namaste ${driverDisplayName}, I am your passenger for StayCabs trip #${confirmedTrip.reference}.`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] px-4 py-3.5 text-xs font-bold text-white shadow-2xs active:scale-[0.98] transition-all"
                        >
                          <Icon name="chat" className="text-base" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}

                    {/* Boarding Verification PIN (Apple Pass Voucher / Passbook Style) */}
                    {tripStatus?.pickupOtp && (
                      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-[#0B2519] via-[#14422D] to-[#0A1D13] text-white p-5 sm:p-6 shadow-[0_12px_36px_-6px_rgba(20,66,45,0.3)]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-[#BCEECF] text-[11px] font-bold uppercase tracking-widest">
                              <Icon name="key" className="text-xs" />
                              <span>Boarding Verification PIN</span>
                            </div>
                            <p className="text-xs text-white/80 max-w-xs leading-relaxed">
                              Share this PIN with your driver upon vehicle arrival to verify trip
                            </p>
                          </div>
                          <div className="inline-flex self-start sm:self-auto items-center tracking-[0.3em] font-mono text-2xl sm:text-3xl font-black text-amber-300 bg-white/10 px-5 py-2.5 rounded-2xl border border-white/15 shadow-inner backdrop-blur-md">
                            {tripStatus.pickupOtp.split("").join(" ")}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cash to Pay Driver Card */}
                    {typeof tripStatus?.remainingCashAmount === "number" && (
                      <div className="flex items-center justify-between rounded-2xl bg-[#F7FAF7] border border-[#E5E8E5] p-4 text-xs">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#14422D]/10 text-[#14422D]">
                            <Icon name="payments" className="text-lg" />
                          </div>
                          <div>
                            <span className="font-bold text-[#181C1B]">Cash Due at Drop-off</span>
                            <p className="text-[11px] text-[#717973]">Pay directly to driver upon reaching destination</p>
                          </div>
                        </div>
                        <span className="text-base sm:text-lg font-extrabold text-[#14422D]">
                          {formatInr(tripStatus.remainingCashAmount)}
                        </span>
                      </div>
                    )}

                    {/* Mountain Safety Assurance Note */}
                    <div className="rounded-2xl border border-[#14422D]/15 bg-[#14422D]/5 p-3.5 text-[11px] leading-relaxed text-[#14422D] flex items-start gap-2.5">
                      <Icon name="check_circle" className="text-xs text-[#14422D] mt-0.5 shrink-0" />
                      <span>
                        <strong>Driver Allocated & Verified:</strong> Contact your driver directly for route coordination or luggage adjustments. Mountain route assistance is monitored by StayCabs operations.
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Guest Rating & Review Form (when COMPLETED) */}
              {tripStatus?.status === "COMPLETED" && (
                <div className="rounded-3xl border border-[#E5E8E5] bg-white p-6 space-y-4 shadow-[0_8px_25px_-4px_rgba(20,66,45,0.05)]">
                  {tripStatus?.guestRating || ratingSuccess ? (
                    <div className="text-center space-y-2 py-2">
                      <p className="font-display font-bold text-[#14422D] text-base">Thank you for rating your trip!</p>
                      <div className="flex items-center justify-center gap-1.5 text-amber-500 text-xl">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className={s <= (tripStatus?.guestRating?.stars || selectedRating) ? "text-amber-500" : "text-[#D8DBD7]"}>
                            ★
                          </span>
                        ))}
                      </div>
                      {(tripStatus?.guestRating?.comment || ratingComment) && (
                        <p className="text-xs text-[#717973] italic max-w-sm mx-auto">&quot;{tripStatus?.guestRating?.comment || ratingComment}&quot;</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-display font-bold text-base text-[#181C1B]">Rate Your Mountain Ride</span>
                          <span className="text-xs font-semibold text-[#14422D] bg-[#14422D]/10 px-2.5 py-0.5 rounded-full">{tripStatus?.driverName || "Driver"}</span>
                        </div>
                        <p className="text-xs text-[#717973] mt-0.5">Your verified feedback ensures high mountain safety standards.</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setSelectedRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="text-2xl cursor-pointer p-1 focus:outline-none transition-transform hover:scale-125"
                          >
                            <span className={star <= (hoverRating || selectedRating) ? "text-amber-500" : "text-[#D8DBD7]"}>★</span>
                          </button>
                        ))}
                        <span className="ml-2 text-xs font-semibold text-[#181C1B]">
                          {selectedRating === 5 ? "Excellent" : selectedRating === 4 ? "Very Good" : selectedRating === 3 ? "Good" : selectedRating === 2 ? "Fair" : "Poor"}
                        </span>
                      </div>

                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Optional: share feedback on driving safety, cleanliness, punctuality..."
                        maxLength={300}
                        rows={2}
                        className="w-full rounded-2xl border border-[#D8DBD7] p-3 text-xs text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none transition-all"
                      />

                      {ratingError && <p className="text-xs text-red-600 font-medium">{ratingError}</p>}

                      <button
                        type="button"
                        disabled={submittingRating}
                        onClick={handleSubmitRating}
                        className="w-full rounded-2xl bg-[#14422D] py-3 text-xs font-bold text-white shadow hover:bg-[#1C593E] cursor-pointer disabled:opacity-50 transition-all"
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
                  className="w-full rounded-2xl border border-[#D8DBD7] bg-white py-3 text-xs font-semibold text-[#181C1B] hover:bg-[#F1F4F1] cursor-pointer transition-colors"
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
            <div className="mx-auto max-w-sm rounded-full bg-[#ECEFEB] p-1.5 shadow-2xs">
              <div className="grid grid-cols-3 gap-1 text-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    currentStep === 1
                      ? "bg-[#14422D] text-white shadow-xs"
                      : "text-[#414943] hover:text-[#181C1B]"
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${currentStep === 1 ? "bg-white/20 text-white font-bold" : "bg-[#D8DBD7] text-white"}`}>
                    1
                  </span>
                  <span>Route</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    currentStep === 2
                      ? "bg-[#14422D] text-white shadow-xs"
                      : "text-[#414943] hover:text-[#181C1B]"
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${currentStep === 2 ? "bg-white/20 text-white font-bold" : "bg-[#D8DBD7] text-white"}`}>
                    2
                  </span>
                  <span>Schedule</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    currentStep === 3
                      ? "bg-[#14422D] text-white shadow-xs"
                      : "text-[#414943] hover:text-[#181C1B]"
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${currentStep === 3 ? "bg-white/20 text-white font-bold" : "bg-[#D8DBD7] text-white"}`}>
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
              <div className="space-y-6 rounded-3xl border border-[#E5E8E5] bg-white p-6 sm:p-8 shadow-[0_10px_35px_-4px_rgba(20,66,45,0.05)]">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#14422D]">Plan Your Mountain Route</h2>
                  <p className="text-xs text-[#717973] mt-1">Select your pickup and destinations across Darjeeling, Sikkim, and the hills.</p>
                </div>

                {/* 2 Tabs: Custom Tour (Default) & Popular Mountain Routes */}
                <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#ECEFEB] rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab("custom")}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "custom"
                        ? "bg-white text-[#14422D] shadow-sm font-bold"
                        : "text-[#414943] hover:text-[#181C1B]"
                    }`}
                  >
                    <Icon name="edit_road" className="text-sm text-[#14422D]" />
                    <span>Custom Itinerary</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("popular");
                      handleSelectPopularRoute(selectedPopularRouteId || "homestay-to-bagdogra");
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "popular"
                        ? "bg-white text-[#14422D] shadow-sm font-bold"
                        : "text-[#414943] hover:text-[#181C1B]"
                    }`}
                  >
                    <Icon name="alt_route" className="text-sm text-[#14422D]" />
                    <span>Popular Transfers</span>
                  </button>
                </div>

                {/* TAB 1: CUSTOM TOUR (Default Active) */}
                {activeTab === "custom" && (
                  <div className="space-y-5">
                    {/* Pickup Location Mode */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#181C1B] flex items-center gap-1.5">
                          <Icon name="location_on" className="text-sm text-[#14422D]" />
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
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#14422D] hover:underline transition-colors cursor-pointer"
                          title="Pin on Map (Blinkit style)"
                        >
                          <Icon name="pin_drop" className="text-xs" />
                          <span>{pickupCoords ? "Adjust Pin on Map" : "Move Pin on Map"}</span>
                        </button>
                      </div>

                      {/* 2-Option Pickup Selection: At Homestay vs Other Location */}
                      <div className="grid grid-cols-2 gap-3">
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
                          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                            !customPickup
                              ? "bg-[#14422D]/8 border-[#14422D] text-[#14422D] shadow-2xs"
                              : "bg-[#F7FAF7] border-[#D8DBD7] text-[#414943] hover:bg-[#F1F4F1]"
                          }`}
                        >
                          <Icon name="home" className="text-base text-[#14422D]" />
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
                          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                            customPickup
                              ? "bg-[#14422D]/8 border-[#14422D] text-[#14422D] shadow-2xs"
                              : "bg-[#F7FAF7] border-[#D8DBD7] text-[#414943] hover:bg-[#F1F4F1]"
                          }`}
                        >
                          <Icon name="edit_location" className="text-base text-[#14422D]" />
                          <span>Other Location</span>
                        </button>
                      </div>

                      {!customPickup ? (
                        <div className="space-y-2">
                          <div className="rounded-2xl border border-[#E5E8E5] bg-[#F7FAF7] p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#14422D]/10 text-[#14422D]">
                                <Icon name="storefront" className="text-lg" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-[#181C1B] truncate">
                                  {link?.homestayName || "Verified Partner Homestay"}
                                </p>
                                <p className="text-[11px] text-[#717973] truncate">
                                  Driver navigates straight to homestay gate
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 rounded-full bg-[#14422D]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#14422D] uppercase tracking-wider">
                              Homestay
                            </span>
                          </div>

                          {pickupCoords && (
                            <div className="flex items-center justify-between rounded-xl bg-[#14422D]/5 px-3 py-1.5 text-[11px] text-[#14422D] border border-[#14422D]/15">
                              <span className="flex items-center gap-1 font-medium">
                                <Icon name="my_location" className="text-xs text-[#14422D]" />
                                <span>GPS Pin: {pickupCoords.latitude.toFixed(5)}, {pickupCoords.longitude.toFixed(5)}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setPickupCoords(null)}
                                className="text-[10px] text-[#14422D] font-bold hover:underline"
                              >
                                Reset Pin
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2.5 pt-1">
                          <div className="relative">
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  value={pickup}
                                  onFocus={() => setActiveSuggestIdx("pickup")}
                                  onChange={(e) => {
                                    setPickup(e.target.value);
                                    setActiveSuggestIdx("pickup");
                                  }}
                                  placeholder="Enter pickup address, landmark, town, or station"
                                  className="w-full rounded-2xl border border-[#D8DBD7] bg-white px-4 py-3 text-sm text-[#181C1B] placeholder:text-[#717973]/60 focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none transition-all shadow-2xs pr-9"
                                />
                                {pickup && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPickup("");
                                      setPickupCoords(null);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717973] hover:text-[#181C1B] cursor-pointer"
                                  >
                                    <Icon name="close" className="text-xs" />
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setMapTarget({
                                    type: "pickup",
                                    title: "Move Map Pin for Pickup",
                                    initialAddress: pickup,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 shrink-0 rounded-2xl border border-[#D8DBD7] bg-white px-3.5 py-3 text-xs font-bold text-[#14422D] hover:bg-[#F1F4F1] transition-colors cursor-pointer"
                                title="Move pin on map"
                              >
                                <Icon name="pin_drop" className="text-base text-[#14422D]" />
                                <span className="hidden sm:inline">Map Pin</span>
                              </button>
                            </div>

                            {/* Autocomplete Suggestions Popover for Pickup */}
                            {activeSuggestIdx === "pickup" && (
                              <div className="absolute z-30 left-0 right-12 sm:right-28 mt-2 rounded-2xl border border-[#E5E8E5] bg-white p-3 shadow-xl space-y-1.5 backdrop-blur-md">
                                <div className="flex items-center justify-between px-2 py-1 border-b border-[#ECEFEB]">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#717973]">
                                    Suggested Pickup Hubs & Towns
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveSuggestIdx(null)}
                                    className="text-[10px] text-[#14422D] font-bold hover:underline cursor-pointer"
                                  >
                                    Done
                                  </button>
                                </div>
                                <div className="max-h-52 overflow-y-auto divide-y divide-[#ECEFEB]/60">
                                  {getFilteredSuggestions(pickup).length > 0 ? (
                                    getFilteredSuggestions(pickup).map((place) => (
                                      <button
                                        key={place}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          setPickup(place);
                                          setActiveSuggestIdx(null);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-[#181C1B] hover:bg-[#14422D]/8 hover:text-[#14422D] rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                                      >
                                        <span className="truncate">{place}</span>
                                        <Icon name="north_west" className="text-xs text-[#717973]" />
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-3 py-2.5 text-xs text-[#717973]">
                                      Type an address, town, or landmark
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {pickupCoords && (
                            <div className="flex items-center justify-between rounded-xl bg-[#14422D]/5 px-3 py-1.5 text-[11px] text-[#14422D] border border-[#14422D]/15">
                              <span className="flex items-center gap-1 font-medium">
                                <Icon name="my_location" className="text-xs text-[#14422D]" />
                                <span>GPS Pin: {pickupCoords.latitude.toFixed(5)}, {pickupCoords.longitude.toFixed(5)}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setPickupCoords(null)}
                                className="text-[10px] text-[#14422D] font-bold hover:underline"
                              >
                                Clear Pin
                              </button>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {["Bagdogra Airport (IXB)", "NJP Railway Station", "Darjeeling Mall", "Siliguri Junction", "Jalpaiguri (DBC Road)"].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setPickup(preset)}
                                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                                  pickup === preset
                                    ? "bg-[#14422D] border-[#14422D] text-white font-bold shadow-xs"
                                    : "bg-white border-[#D8DBD7] text-[#414943] hover:border-[#14422D] hover:text-[#14422D]"
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
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#181C1B] flex items-center gap-1.5">
                          <Icon name="navigation" className="text-sm text-[#14422D]" />
                          <span>Drop Locations</span>
                        </label>
                        <span className="text-[11px] text-[#717973]">Add 1 or more stops</span>
                      </div>

                      <div className="space-y-3">
                        {customDestinations.map((dest, idx) => {
                          const suggestions = getFilteredSuggestions(dest);
                          const isShowingSuggestions = activeSuggestIdx === idx;

                          return (
                            <div key={idx} className="relative">
                              <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#14422D]/8 text-xs font-bold text-[#14422D]">
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
                                    className="w-full rounded-2xl border border-[#D8DBD7] bg-white px-4 py-3 text-sm text-[#181C1B] placeholder:text-[#717973]/60 focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none transition-all shadow-2xs pr-9"
                                  />
                                  {dest && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const copy = [...customDestinations];
                                        copy[idx] = "";
                                        setCustomDestinations(copy);
                                      }}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717973] hover:text-[#181C1B] cursor-pointer"
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
                                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#D8DBD7] text-[#414943] hover:bg-[#14422D]/8 hover:text-[#14422D] hover:border-[#14422D] transition-colors cursor-pointer"
                                  title="Pick drop location on map"
                                >
                                  <Icon name="pin_drop" className="text-base" />
                                </button>

                                {customDestinations.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const copy = customDestinations.filter((_, i) => i !== idx);
                                      setCustomDestinations(copy.length > 0 ? copy : [""]);
                                      setActiveSuggestIdx(null);
                                    }}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Remove this destination"
                                  >
                                    <Icon name="delete" className="text-base" />
                                  </button>
                                )}
                              </div>

                              {/* Interactive Autocomplete / Tourist Spots Popover */}
                              {isShowingSuggestions && (
                                <div className="absolute z-20 left-11 right-0 mt-2 rounded-2xl border border-[#E5E8E5] bg-white p-3 shadow-xl space-y-1.5 backdrop-blur-md">
                                  <div className="flex items-center justify-between px-2 py-1 border-b border-[#ECEFEB]">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#717973]">
                                      Suggested Hill Landmarks & Attractions
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveSuggestIdx(null)}
                                      className="text-[10px] text-[#14422D] font-bold hover:underline cursor-pointer"
                                    >
                                      Done
                                    </button>
                                  </div>
                                  <div className="max-h-52 overflow-y-auto divide-y divide-[#ECEFEB]/60">
                                    {suggestions.length > 0 ? (
                                      suggestions.map((place) => (
                                        <button
                                          key={place}
                                          type="button"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => handleSelectSuggestion(place, idx)}
                                          className="w-full text-left px-3 py-2 text-xs font-medium text-[#181C1B] hover:bg-[#14422D]/8 hover:text-[#14422D] rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                                        >
                                          <span className="truncate">{place}</span>
                                          <Icon name="north_west" className="text-xs text-[#717973]" />
                                        </button>
                                      ))
                                    ) : (
                                      <div className="px-3 py-2.5 text-xs text-[#717973]">
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
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-dashed border-[#14422D]/40 bg-[#14422D]/5 px-4 py-2.5 text-xs font-bold text-[#14422D] hover:bg-[#14422D]/10 transition-colors cursor-pointer"
                        >
                          <Icon name="add" className="text-sm font-bold" />
                          <span>Add Destination Stop</span>
                        </button>
                      )}
                    </div>

                    {/* Round Trip Toggle (Requirement 5) */}
                    <div className="rounded-2xl border border-[#E5E8E5] bg-[#F7FAF7] p-4 sm:p-5 flex items-center justify-between">
                      <div className="space-y-0.5 pr-2">
                        <span className="text-xs font-bold text-[#181C1B] flex items-center gap-1.5">
                          <Icon name="sync_alt" className="text-sm text-[#14422D]" />
                          <span>
                            {!customPickup && link?.homestayName
                              ? `Return to ${link.homestayName}`
                              : "Round Trip (Return to Pickup Location)"}
                          </span>
                        </span>
                        <p className="text-[11px] text-[#717973]">
                          {isRoundTrip
                            ? "Round trip: Driver waits at your destination and brings you back."
                            : "One-way trip: Driver drops you off at your final destination."}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isRoundTrip}
                        onClick={() => setIsRoundTrip(!isRoundTrip)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isRoundTrip ? "bg-[#14422D]" : "bg-[#D8DBD7]"
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
                      <h3 className="text-xs font-bold text-[#181C1B]">Select Transfer Route</h3>
                      <p className="text-[11px] text-[#717973]">Direct transfers between your homestay and major transit hubs.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {POPULAR_TRANSFER_ROUTES.map((route) => {
                        const isSelected = selectedPopularRouteId === route.id;
                        return (
                          <button
                            key={route.id}
                            type="button"
                            onClick={() => handleSelectPopularRoute(route.id)}
                            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? "border-[#14422D] bg-[#14422D]/8 shadow-sm"
                                : "border-[#E5E8E5] bg-white hover:border-[#14422D]/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-base ${
                                  isSelected ? "bg-[#14422D] text-white" : "bg-[#F7FAF7] text-[#14422D]"
                                }`}>
                                  <Icon name={route.direction === "outbound" ? "flight_takeoff" : "flight_land"} className="text-lg" />
                                </span>
                                <div>
                                  <span className="text-xs font-bold tracking-tight text-[#181C1B] block">
                                    {route.name}
                                  </span>
                                  <span className="text-[11px] text-[#717973]">
                                    {route.direction === "outbound" ? "Homestay Drop to Hub" : "Hub Pickup to Homestay"}
                                  </span>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#14422D] text-white">
                                  <Icon name="check" className="text-xs" />
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Round Trip Toggle for Transfer */}
                    <div className="rounded-2xl border border-[#E5E8E5] bg-[#F7FAF7] p-4 sm:p-5 flex items-center justify-between">
                      <div className="space-y-0.5 pr-2">
                        <span className="text-xs font-bold text-[#181C1B] flex items-center gap-1.5">
                          <Icon name="sync_alt" className="text-sm text-[#14422D]" />
                          <span>Round Trip Transfer</span>
                        </span>
                        <p className="text-[11px] text-[#717973]">
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
                          isRoundTrip ? "bg-[#14422D]" : "bg-[#D8DBD7]"
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
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14422D] py-4 text-sm font-bold text-white shadow-[0_8px_25px_-3px_rgba(20,66,45,0.25)] hover:bg-[#1C593E] active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <span>Continue to Schedule & Travelers</span>
                    <Icon name="arrow_forward" className="text-sm" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SCHEDULE & TRAVELERS */}
            {currentStep === 2 && (
              <div className="space-y-6 rounded-3xl border border-[#E5E8E5] bg-white p-6 sm:p-8 shadow-[0_10px_35px_-4px_rgba(20,66,45,0.05)]">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#14422D]">When are you traveling?</h2>
                  <p className="text-xs text-[#717973] mt-1">Set your pickup time and passenger count. Local drivers will quote exact hill fares.</p>
                </div>

                {/* Date Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#181C1B] block">Date of Travel</label>
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
                    className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-sm font-semibold text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none bg-white shadow-2xs transition-all"
                  />
                </div>

                {/* Time Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#181C1B] block">Pickup Time</label>
                    <span className="text-[11px] text-[#14422D] font-bold bg-[#14422D]/8 border border-[#14422D]/15 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                      <Icon name="schedule" className="text-xs text-[#14422D]" />
                      <span>{time}</span>
                    </span>
                  </div>

                  {/* Native Clock Dialer / Time Picker */}
                  <div className="relative flex items-center">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#14422D]">
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
                      className="w-full rounded-2xl border border-[#D8DBD7] bg-white py-3 pl-11 pr-3 sm:pr-24 text-sm font-bold text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none shadow-2xs cursor-pointer transition-all"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 hidden sm:flex items-center pr-4 text-[11px] text-[#717973] font-medium">
                      Tap for clock
                    </div>
                  </div>

                  {/* Quick Mountain Departure Shortcuts */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] text-[#717973] font-semibold uppercase tracking-wider block">Popular Mountain Departures:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                            className={`flex flex-col items-start px-3 py-2.5 rounded-2xl text-left border transition-all cursor-pointer ${
                              isMatch
                                ? "bg-[#14422D] text-white border-[#14422D] shadow-xs"
                                : "bg-[#F7FAF7] border-[#E5E8E5] text-[#181C1B] hover:bg-[#ECEFEB]"
                            }`}
                          >
                            <span className={`text-xs font-bold leading-none ${isMatch ? "text-white" : "text-[#181C1B]"}`}>
                              {slot.label}
                            </span>
                            <span className={`text-[10px] mt-1 line-clamp-1 ${isMatch ? "text-[#BCEECF]" : "text-[#717973]"}`}>
                              {slot.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Round trip: flexible return banner */}
                {isRoundTrip && (
                  <div className="rounded-2xl border border-[#14422D]/15 bg-[#14422D]/5 p-4 text-xs text-[#14422D] flex items-start gap-3 shadow-2xs">
                    <Icon name="schedule" className="text-base text-[#14422D] mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold block">Flexible Return Schedule</span>
                      <span className="text-[11px] text-[#14422D]/90 leading-relaxed block mt-0.5">
                        Your driver will accompany you, wait during sightseeing or meetings, and drive you back to your homestay when you are ready.
                      </span>
                    </div>
                  </div>
                )}

                {/* Requirement 7: Passenger Count Only (No Vehicle Class Selection) */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-[#181C1B] block">Number of Passengers</label>
                  <div className="flex items-center justify-between rounded-2xl border border-[#E5E8E5] p-5 bg-[#F7FAF7]">
                    <div>
                      <span className="text-sm font-bold text-[#181C1B] block">Total Travelers</span>
                      <span className="text-xs text-[#717973]">Adults + Children traveling together</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={passengers <= 1}
                        onClick={() => setPassengers(Math.max(1, passengers - 1))}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D8DBD7] bg-white font-bold text-lg text-[#14422D] hover:bg-[#F1F4F1] disabled:opacity-40 cursor-pointer transition-all shadow-2xs"
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
                        className="w-12 text-center font-bold text-lg text-[#14422D] bg-transparent focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={passengers >= 20}
                        onClick={() => setPassengers(Math.min(20, passengers + 1))}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D8DBD7] bg-white font-bold text-lg text-[#14422D] hover:bg-[#F1F4F1] disabled:opacity-40 cursor-pointer transition-all shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#717973]">
                    Drivers with suitably-sized mountain vehicles will send you their quotes directly.
                  </p>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="w-1/3 rounded-2xl border border-[#D8DBD7] bg-white py-3.5 text-xs font-bold text-[#181C1B] hover:bg-[#F1F4F1] cursor-pointer transition-colors"
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
                    className="w-2/3 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14422D] py-3.5 text-xs font-bold text-white shadow-[0_8px_25px_-3px_rgba(20,66,45,0.25)] hover:bg-[#1C593E] transition-all cursor-pointer"
                  >
                    <span>Continue to Review</span>
                    <Icon name="arrow_forward" className="text-sm" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: GUEST DETAILS & REVIEW */}
            {currentStep === 3 && (
              <div className="space-y-6 rounded-3xl border border-[#E5E8E5] bg-white p-6 sm:p-8 shadow-[0_10px_35px_-4px_rgba(20,66,45,0.05)]">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#14422D]">Passenger Details & Review</h2>
                  <p className="text-xs text-[#717973] mt-1">Enter your WhatsApp details to receive direct hill driver quotes.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#181C1B] block mb-1.5">Guest Full Name</label>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Ankit Sharma"
                      className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-sm text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none shadow-2xs transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                      WhatsApp Contact Number (10 Digits)
                    </label>
                    <div className="flex gap-2">
                      <span className="flex items-center rounded-2xl bg-[#F7FAF7] border border-[#D8DBD7] px-3.5 text-xs font-bold text-[#414943]">
                        +91
                      </span>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="9876543210"
                        className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-sm text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none shadow-2xs transition-all"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-[#717973]">
                      Drivers will send their quotes and booking confirmation directly to this WhatsApp number.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                      Luggage or Special Requests (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. 3 large bags, elderly passenger, luggage roof rack needed"
                      className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-sm text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none shadow-2xs transition-all"
                    />
                  </div>

                  {/* Target Budget (Optional, ₹ - InDrive style) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-[#181C1B]">Target Budget (Optional, ₹)</label>
                      <span className="text-[10px] text-[#717973]">Guest price expectation</span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute left-4 text-sm font-bold text-[#717973]">₹</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={guestBudget}
                        onChange={(e) => setGuestBudget(e.target.value.replace(/\D/g, ""))}
                        placeholder="e.g. 2500"
                        className="w-full rounded-2xl border border-[#D8DBD7] pl-8 pr-4 py-3 text-sm text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none shadow-2xs bg-white transition-all"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-[#717973]">
                      Local verified drivers will see your target budget when submitting their quotes on WhatsApp.
                    </p>
                  </div>
                </div>

                {/* Trip Review Summary Card (Zero Prices) */}
                <div className="rounded-2xl border border-[#E5E8E5] bg-[#F7FAF7] p-5 space-y-3.5 text-xs">
                  <div className="flex items-center justify-between border-b border-[#E5E8E5] pb-2.5">
                    <span className="font-bold text-[#181C1B] text-xs">Trip Summary</span>
                    <span className="rounded-full bg-[#14422D]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#14422D]">
                      {isRoundTrip ? "Round Trip" : "One-Way"}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#717973] shrink-0 font-medium">Pickup:</span>
                      <span className="font-bold text-[#181C1B] text-right truncate">
                        {getResolvedPickup()}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#717973] shrink-0 font-medium">
                        {getResolvedDestinations().length > 1 ? "Drop Locations:" : "Drop Location:"}
                      </span>
                      <div className="text-right">
                        {getResolvedDestinations().map((d, i) => (
                          <div key={i} className="font-bold text-[#181C1B]">
                            {getResolvedDestinations().length > 1 ? `${i + 1}. ${d}` : d}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#717973] shrink-0 font-medium">Return to Homestay:</span>
                      <span className="font-bold text-[#181C1B]">
                        {isRoundTrip ? "Yes (Driver waits & returns)" : "No (One-way drop)"}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#717973] shrink-0 font-medium">Schedule:</span>
                      <span className="font-semibold text-[#181C1B]">{date} at {time}</span>
                    </div>

                    {isRoundTrip && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[#717973] shrink-0 font-medium">Return:</span>
                        <span className="font-semibold text-[#14422D]">Flexible (Same Day / Driver Waits)</span>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#717973] shrink-0 font-medium">Passengers:</span>
                      <span className="font-semibold text-[#181C1B]">{passengers} {passengers === 1 ? "Passenger" : "Passengers"}</span>
                    </div>

                    {pickupCoords && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[#717973] shrink-0 font-medium">GPS Pin:</span>
                        <span className="font-mono text-[11px] text-[#717973]">{pickupCoords.latitude.toFixed(4)}, {pickupCoords.longitude.toFixed(4)}</span>
                      </div>
                    )}

                    {guestBudget && (
                      <div className="flex items-start justify-between gap-2 border-t border-[#E5E8E5] pt-2">
                        <span className="text-[#717973] shrink-0 font-medium">Target Budget:</span>
                        <span className="font-bold text-[#14422D]">₹{Number(guestBudget).toLocaleString("en-IN")}</span>
                      </div>
                    )}

                    {guestName && (
                      <div className="flex items-start justify-between gap-2 border-t border-[#E5E8E5] pt-2">
                        <span className="text-[#717973] shrink-0 font-medium">Guest:</span>
                        <span className="font-semibold text-[#181C1B]">{guestName} {guestPhone ? `(+91 ${guestPhone})` : ""}</span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-[#14422D]/5 border border-[#14422D]/15 p-3 text-[11px] text-[#14422D] leading-snug">
                    <p className="font-bold">💡 No upfront payment required to request.</p>
                    <p className="text-[#14422D]/90 mt-0.5">
                      Verified local drivers will quote their competitive hill rates based on your itinerary. You choose the best driver.
                    </p>
                  </div>

                  {/* DPDP Act 2023 Consent Notice */}
                  <div className="flex items-start gap-2.5 pt-1 pb-0.5">
                    <input
                      type="checkbox"
                      id="dpdp-consent"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[#D8DBD7] text-[#14422D] focus:ring-[#14422D] cursor-pointer"
                    />
                    <label htmlFor="dpdp-consent" className="text-[11px] leading-relaxed text-[#717973] cursor-pointer">
                      I agree to the{" "}
                      <Link href="/legal/terms" target="_blank" className="font-semibold text-[#14422D] underline hover:text-[#1C593E]">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/legal/privacy" target="_blank" className="font-semibold text-[#14422D] underline hover:text-[#1C593E]">
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
                    className="w-1/3 rounded-2xl border border-[#D8DBD7] bg-white py-3.5 text-xs font-bold text-[#181C1B] hover:bg-[#F1F4F1] cursor-pointer transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !agreedToTerms}
                    onClick={handleFormSubmit}
                    className="w-2/3 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14422D] py-3.5 text-xs font-bold text-white shadow-[0_8px_25px_-3px_rgba(20,66,45,0.3)] hover:bg-[#1C593E] transition-all cursor-pointer disabled:opacity-50"
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
