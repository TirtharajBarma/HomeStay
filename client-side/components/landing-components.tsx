"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "./icon";
import { API_ENDPOINTS, apiFetch } from "@/lib/api-config";
import { siteConfig } from "@/lib/site-config";
import { waNumber } from "@/lib/whatsapp";
import {
  Bed,
  Users,
  Car,
  ShieldCheck,
  Check,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Phone,
  MessageSquare,
  MapPin,
  MountainSnow,
  TrendingUp,
  Clock,
  Sparkles,
  Zap,
  Calendar,
  Compass,
  Star,
  FileText,
  BadgeCheck,
  Navigation,
} from "lucide-react";

// ---------------------------------------------------------------------------
// 1. Sleek Live Interactive OS Mockup for Hero (Ultra-Premium Shadcn / Linear Style)
// ---------------------------------------------------------------------------
export function DashboardMockup() {
  const [activeTab, setActiveTab] = useState<"rooms" | "guests" | "cabs">("cabs");

  return (
    <div className="relative mx-auto w-full max-w-5xl rounded-2xl border border-primary/25 bg-surface-container-lowest p-3 sm:p-5 shadow-2xl shadow-primary/15 backdrop-blur-md">
      {/* Top window chrome: Balanced header on mobile & desktop (No awkward truncation!) */}
      <div className="mb-3 sm:mb-4 border-b border-outline-variant/60 pb-2.5 sm:pb-3 space-y-2 sm:space-y-0">
        <div className="flex items-center justify-between gap-2">
          {/* Mac controls + Property Name */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 shrink-0">
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-400" />
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-primary-fixed px-2.5 py-0.5 text-xs font-semibold text-primary">
              <MountainSnow className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Pine View Retreat · Kalimpong</span>
              <span className="hidden sm:inline opacity-70">(2,042m)</span>
            </div>
          </div>

          {/* Desktop Tab Switcher */}
          <div className="hidden sm:flex items-center rounded-xl bg-surface-container p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("rooms")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all cursor-pointer ${
                activeTab === "rooms"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              <Bed className="h-3.5 w-3.5" />
              <span>Rooms &amp; Bookings</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("guests")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all cursor-pointer ${
                activeTab === "guests"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Guest Records</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cabs")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all cursor-pointer ${
                activeTab === "cabs"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              <Car className="h-3.5 w-3.5" />
              <span>Cab Requests</span>
              <span className="rounded-full bg-amber-400/90 px-1.5 py-0.2 text-[10px] font-bold text-slate-900">
                3
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-outline shrink-0">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Live Cloud Sync</span>
            <span className="sm:hidden font-medium text-emerald-700">Live</span>
          </div>
        </div>

        {/* Mobile Dedicated Full-Width Tab Bar (Spacious, balanced, zero squishing!) */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-container p-1 text-xs sm:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("rooms")}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-center font-medium transition-all cursor-pointer ${
              activeTab === "rooms"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <Bed className="h-3.5 w-3.5" />
            <span className="text-[11px]">Rooms</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("guests")}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-center font-medium transition-all cursor-pointer ${
              activeTab === "guests"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span className="text-[11px]">Guests</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cabs")}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-center font-medium transition-all cursor-pointer ${
              activeTab === "cabs"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <Car className="h-3.5 w-3.5" />
            <span className="text-[11px]">Cabs</span>
            <span className="rounded-full bg-amber-400/90 px-1 py-0.1 text-[9px] font-bold text-slate-900">
              3
            </span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar: Ultra-Clean, Compact 4-Tile Strip (Saves 100px vertical space on mobile!) */}
      <div className="mb-3 sm:mb-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2 sm:p-3 shadow-2xs space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs text-outline font-medium">Monthly Occupancy</p>
            <TrendingUp className="h-3 w-3 text-emerald-600 hidden sm:block" />
          </div>
          <p className="font-display text-base sm:text-2xl font-bold text-primary">88.4%</p>
          <p className="text-[9px] sm:text-[10px] text-emerald-600 font-semibold">+14.2% vs last month</p>
        </div>

        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2 sm:p-3 shadow-2xs space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs text-outline font-medium">Active Guests</p>
            <Users className="h-3 w-3 text-primary hidden sm:block" />
          </div>
          <p className="font-display text-base sm:text-2xl font-bold text-on-surface">6 Guests</p>
          <p className="text-[9px] sm:text-[10px] text-primary font-semibold truncate">2 checking out today</p>
        </div>

        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2 sm:p-3 shadow-2xs space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs text-outline font-medium">Hill Cabs Arranged</p>
            <Car className="h-3 w-3 text-primary hidden sm:block" />
          </div>
          <p className="font-display text-base sm:text-2xl font-bold text-primary">14 Trips</p>
          <p className="text-[9px] sm:text-[10px] text-outline font-medium truncate">NJP &amp; Bagdogra</p>
        </div>

        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2 sm:p-3 shadow-2xs space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs text-outline font-medium">Software Cost</p>
            <Sparkles className="h-3 w-3 text-emerald-600 hidden sm:block" />
          </div>
          <p className="font-display text-base sm:text-2xl font-bold text-emerald-600">₹0</p>
          <p className="text-[9px] sm:text-[10px] text-emerald-700 font-semibold">Always Free for Hosts</p>
        </div>
      </div>

      {/* Tab 1: Rooms & Bookings (Fixes image copy 12: Horizontal Snap on Mobile, 3-Col on Desktop — Eliminates 600px scroll!) */}
      {activeTab === "rooms" && (
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold text-on-surface">Room Inventory &amp; Live Availability</span>
            </div>
            <span className="text-[10px] sm:text-xs text-outline">Nov 18 – 24 · 3 Active Rooms</span>
          </div>

          {/* Responsive Layout: Horizontal Snap Carousel on Mobile (Never takes 100% height!), 3-Col on Desktop */}
          <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1 sm:grid sm:grid-cols-3 sm:gap-2.5">
            {/* Room 1 */}
            <div className="w-[78vw] max-w-[270px] shrink-0 snap-center sm:w-auto rounded-xl border border-emerald-500/30 bg-emerald-50/40 p-2.5 sm:p-3.5 space-y-2 shadow-2xs flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-on-surface truncate">Deluxe Kanchenjunga</span>
                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold text-white shrink-0">Occupied</span>
                </div>
                <div className="rounded-lg bg-surface-container-lowest p-2 border border-emerald-200/60 text-[10px] space-y-0.5">
                  <p className="font-medium text-on-surface truncate">Tushar S. (2 guests · Kolkata)</p>
                  <p className="text-emerald-700 font-semibold">Check-out Tomorrow · 3 Nights</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-emerald-200/50">
                <span className="text-outline">Folio: ₹9,600 Paid</span>
                <span className="font-bold text-primary text-[11px]">₹3,200/night</span>
              </div>
            </div>

            {/* Room 2 */}
            <div className="w-[78vw] max-w-[270px] shrink-0 snap-center sm:w-auto rounded-xl border border-primary/30 bg-primary-fixed/50 p-2.5 sm:p-3.5 space-y-2 shadow-2xs flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-on-surface truncate">Attic Pine Suite</span>
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-white shrink-0">Arriving Today</span>
                </div>
                <div className="rounded-lg bg-surface-container-lowest p-2 border border-primary/20 text-[10px] space-y-0.5">
                  <p className="font-medium text-on-surface truncate">Ananya R. (3 guests)</p>
                  <p className="text-primary font-medium truncate">🚕 Bagdogra cab en route (Tenzing)</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-primary/15">
                <span className="text-outline">ETA: 03:30 PM</span>
                <span className="font-bold text-primary text-[11px]">₹4,000/night</span>
              </div>
            </div>

            {/* Room 3 */}
            <div className="w-[78vw] max-w-[270px] shrink-0 snap-center sm:w-auto rounded-xl border border-outline-variant/60 bg-surface-container-low p-2.5 sm:p-3.5 space-y-2 shadow-2xs flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-on-surface truncate">Garden Cottage</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-700 shrink-0">Available</span>
                </div>
                <div className="rounded-lg bg-surface-container-lowest p-2 border border-outline-variant/40 text-[10px] space-y-0.5">
                  <p className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0" /> Cleaned &amp; Inspected
                  </p>
                  <p className="text-outline">Ready for instant check-in</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-outline-variant/40">
                <span className="text-outline">Walk-in ready</span>
                <span className="font-bold text-primary text-[11px]">₹2,400/night</span>
              </div>
            </div>
          </div>

          {/* Mobile Swipe Hint for Rooms */}
          <div className="flex sm:hidden items-center justify-center gap-1 text-[10px] text-outline pt-0.5">
            <span>Swipe horizontally to view all 3 rooms</span>
            <ArrowRight className="h-3 w-3 text-primary" />
          </div>
        </div>
      )}

      {/* Tab 2: Guest Records (Fixes image copy 13: Unclustered, Spacious Shadcn CRM Cards) */}
      {activeTab === "guests" && (
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold text-on-surface">Guest CRM &amp; Verified Identity Vault</span>
            </div>
            <span className="text-[10px] sm:text-xs text-outline">Cloud-synced</span>
          </div>

          <div className="space-y-2 text-xs">
            {/* Guest 1: Unclustered, Clean 3-Tier Hierarchy */}
            <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2.5 sm:p-3 space-y-2 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary font-bold text-xs shrink-0 shadow-xs">
                    AR
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-xs text-on-surface">Ananya R.</p>
                      <span className="text-[10px] text-outline">(Kolkata)</span>
                      <span className="rounded bg-primary-fixed text-primary px-1.5 py-0.2 text-[9px] font-bold">VIP · 3rd Stay</span>
                    </div>
                    <p className="text-[10px] text-outline mt-0.5">Deluxe Kanchenjunga Suite · +91 98310 •••••</p>
                  </div>
                </div>
                <span className="text-[10px] text-outline font-medium shrink-0">Nov 18 Check-in</span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/40 text-[10px]">
                <span className="text-primary font-medium flex items-center gap-1 truncate">
                  <Car className="h-3 w-3 shrink-0" />
                  <span>Bagdogra Drop Booked (PIN: 4892)</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-800 shrink-0">
                  <Check className="h-2.5 w-2.5" /> ID Verified
                </span>
              </div>
            </div>

            {/* Guest 2: Unclustered, Clean 3-Tier Hierarchy */}
            <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2.5 sm:p-3 space-y-2 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-on-secondary font-bold text-xs shrink-0 shadow-xs">
                    DK
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-xs text-on-surface">Deepak K.</p>
                      <span className="text-[10px] text-outline">(Pune)</span>
                      <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[9px] font-bold">Family 4 pax</span>
                    </div>
                    <p className="text-[10px] text-outline mt-0.5">Attic Pine Suite · +91 94220 •••••</p>
                  </div>
                </div>
                <span className="text-[10px] text-outline font-medium shrink-0">Nov 20 Check-in</span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/40 text-[10px]">
                <span className="text-primary font-medium flex items-center gap-1 truncate">
                  <Car className="h-3 w-3 shrink-0" />
                  <span>NJP Railway Pickup Confirmed</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-primary-fixed px-1.5 py-0.2 text-[9px] font-semibold text-primary shrink-0">
                  <MessageSquare className="h-2.5 w-2.5" /> WhatsApp Sent
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Cab Requests (Fixes image copy 14: Clean Dispatch Radar Cards with clear hierarchy) */}
      {activeTab === "cabs" && (
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold text-on-surface">Live Mountain Transit Dispatch Radar</span>
            </div>
            <span className="text-[10px] sm:text-xs text-outline">Verified Hill Drivers</span>
          </div>

          <div className="space-y-2 text-xs">
            {/* Trip 1: Clean, Structured Card */}
            <div className="rounded-xl border border-primary/30 bg-primary-fixed/40 p-2.5 sm:p-3 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-primary text-xs">REQ-792B8</span>
                  <span className="rounded bg-emerald-600 px-1.5 py-0.2 text-[9px] font-bold text-white flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    En Route
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs sm:text-sm text-primary">₹3,200</span>
                  <span className="text-[9px] text-emerald-700 font-semibold block">100% Cash Direct</span>
                </div>
              </div>

              <p className="text-xs text-on-surface font-semibold">Bagdogra Airport (IXB) ➔ Pine View Retreat</p>

              <div className="flex items-center justify-between pt-1 border-t border-primary/20 text-[10px] text-outline">
                <span className="truncate">Driver: <strong>Tenzing B.</strong> (Innova 4x4 · ★ 4.98)</span>
                <span className="rounded bg-surface-container px-1.5 py-0.2 font-mono font-bold text-primary shrink-0">
                  PIN: 4892
                </span>
              </div>
            </div>

            {/* Trip 2: Clean Sightseeing Quote Card */}
            <div className="rounded-xl border border-amber-400/40 bg-amber-50/50 p-2.5 sm:p-3 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-amber-900 text-xs">REQ-841A2</span>
                  <span className="rounded bg-amber-500 px-1.5 py-0.2 text-[9px] font-bold text-slate-900">
                    2 Driver Quotes
                  </span>
                </div>
                <Link
                  href="/cab-request"
                  className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-[10px] font-semibold text-white shadow-xs hover:bg-primary-container shrink-0"
                >
                  <span>Review &amp; Confirm</span>
                  <ArrowRight className="h-2.5 w-2.5" />
                </Link>
              </div>

              <p className="text-xs text-on-surface font-semibold">Day Tour: Lava Pine Forest, Rishyap &amp; Delo</p>

              <div className="flex items-center gap-2 pt-1 border-t border-amber-200/50 text-[10px]">
                <span className="rounded bg-white px-1.5 py-0.2 border border-amber-200 text-slate-800">
                  Passang: <strong>₹2,400</strong>
                </span>
                <span className="rounded bg-white px-1.5 py-0.2 border border-amber-200 text-slate-800">
                  Karma: <strong>₹2,500</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer hint */}
      <div className="mt-2.5 sm:mt-3 flex items-center justify-between border-t border-outline-variant/40 pt-2 text-[10px] sm:text-[11px] text-outline">
        <span className="flex items-center gap-1 truncate">
          <Sparkles className="h-3 w-3 text-primary shrink-0" /> Works on mobile phone, iPad, and desktop.
        </span>
        <span className="font-semibold text-primary shrink-0">₹0 fees on bookings.</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 2. Interactive Bento & Swipeable Feature Showcase for Section 3
// ---------------------------------------------------------------------------
const FEATURES_DATA = [
  {
    id: "rooms",
    icon: "bedroom_parent",
    title: "1. Room & Booking Management",
    desc: "Manage rooms, bookings and availability from one dashboard. Keep track of upcoming stays and avoid booking conflicts effortlessly.",
    highlight: "Direct calendar tracking · 100% Free",
    sub: "Supports multi-room inventory, nightly rates & instant check-in tags.",
    preview: (
      <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2.5 space-y-1.5 text-xs">
        <div className="flex justify-between items-center text-[11px] font-medium text-on-surface">
          <span>Room Inventory (3 Active)</span>
          <span className="text-emerald-700 font-semibold text-[10px]">Real-time</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center font-medium">
          <div className="rounded-lg bg-emerald-100/90 text-emerald-800 p-1 border border-emerald-300/60">
            <p className="truncate">Deluxe View</p>
            <p className="font-semibold">Occupied</p>
          </div>
          <div className="rounded-lg bg-primary-fixed text-primary p-1 border border-primary/20">
            <p className="truncate">Attic Suite</p>
            <p className="font-semibold">Reserved</p>
          </div>
          <div className="rounded-lg bg-surface-container-lowest text-on-surface-variant p-1 border border-outline-variant/60">
            <p className="truncate">Cottage</p>
            <p className="font-semibold text-emerald-700">Available</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "crm",
    icon: "badge",
    title: "2. Guest Management (CRM)",
    desc: "Store guest details, ID proofs, booking history and stay information. Keep all your guest records organized in one secure place.",
    highlight: "Organized contact logs · Secure",
    sub: "Quick lookup for repeat guests, family sizes, and special mountain requests.",
    preview: (
      <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary font-semibold text-[10px]">
            AR
          </div>
          <div>
            <p className="font-semibold text-[11px] text-on-surface">Ananya R. (Kolkata)</p>
            <p className="text-[10px] text-outline">Verified ID · 3 Past Stays</p>
          </div>
        </div>
        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
          WhatsApp Active
        </span>
      </div>
    ),
  },
  {
    id: "analytics",
    icon: "trending_up",
    title: "3. Business Analytics",
    desc: "Track bookings, revenue, occupancy and customer activity to understand how your homestay is performing across seasons.",
    highlight: "Clear financial visibility · Real-time",
    sub: "Monthly revenue summaries and occupancy rate charts at a glance.",
    preview: (
      <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2.5 space-y-1.5 text-xs">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-outline font-medium">Monthly Occupancy</span>
          <span className="font-semibold text-primary">88.4%</span>
        </div>
        <div className="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
          <div className="bg-primary h-full rounded-full w-[88.4%]" />
        </div>
        <div className="flex justify-between text-[10px] text-emerald-700 font-medium">
          <span>+12% vs last month</span>
          <span>₹0 Software Fee</span>
        </div>
      </div>
    ),
  },
  {
    id: "cabs",
    icon: "local_taxi",
    title: "4. Cab Booking for Guests",
    desc: "Arrange NJP and Bagdogra pickups, sightseeing, local rides and return drops through a connected driver network with zero stress.",
    highlight: "Own fleet + hill network · 100% Cash",
    sub: "Transparent driver bidding and direct cash settlement without deductions.",
    preview: (
      <div className="rounded-xl border border-primary/25 bg-primary-fixed/40 p-2.5 flex items-center justify-between text-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Icon name="local_taxi" className="text-primary text-xs" />
            <span className="font-semibold text-[11px] text-on-surface">Bagdogra ➔ Homestay</span>
          </div>
          <p className="text-[10px] text-outline">Tenzing Bhutia · Innova Crysta</p>
        </div>
        <div className="text-right">
          <span className="font-semibold text-xs text-primary">₹3,200</span>
          <p className="text-[9px] text-emerald-700 font-semibold">100% Cash Direct</p>
        </div>
      </div>
    ),
  },
  {
    id: "whatsapp",
    icon: "chat",
    title: "5. Guest WhatsApp Communication",
    desc: "Keep guests informed with booking-related and trip-related updates through automated and templated WhatsApp messages.",
    highlight: "No app install needed · WhatsApp",
    sub: "Driver phone numbers, boarding details, and route notes delivered instantly.",
    preview: (
      <div className="rounded-xl border border-emerald-500/30 bg-[#EFEAE2]/60 p-2.5 space-y-1 text-xs">
        <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-800">
          <Icon name="chat" className="text-xs" />
          <span>StayCabs Concierge WhatsApp</span>
        </div>
        <p className="text-[10px] text-slate-800 leading-snug">
          &ldquo;Namaste! Driver Tenzing is assigned. Car: WB 74 ••••. Boarding PIN: 4892.&rdquo;
        </p>
      </div>
    ),
  },
  {
    id: "devices",
    icon: "devices",
    title: "6. Manage From Anywhere",
    desc: "Access your homestay information and manage daily operations through a fast, convenient online dashboard on mobile or desktop.",
    highlight: "Fast & responsive · Cloud-synced",
    sub: "Works smoothly even on mountain mobile data networks (4G/5G).",
    preview: (
      <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Icon name="cloud_done" className="text-primary text-base" />
          <span className="text-[11px] font-medium text-on-surface">Cloud Synced &amp; Backed Up</span>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
          Auto Sync
        </span>
      </div>
    ),
  },
];

export function FeaturesBentoShowcase() {
  const [filter, setFilter] = useState<string>("all");

  const visibleFeatures = filter === "all"
    ? FEATURES_DATA
    : FEATURES_DATA.filter((f) => f.id === filter);

  return (
    <div className="space-y-4">
      {/* Category Pills for Quick Exploration on Mobile */}
      <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 px-1">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`liquid-btn shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
            filter === "all"
              ? "bg-primary text-on-primary shadow-xs"
              : "bg-surface-container-low text-on-surface-variant border border-outline-variant/60"
          }`}
        >
          All 6 Features
        </button>
        {FEATURES_DATA.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`liquid-btn shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
              filter === f.id
                ? "bg-primary text-on-primary shadow-xs"
                : "bg-surface-container-low text-on-surface-variant border border-outline-variant/60"
            }`}
          >
            {f.title.split(". ")[1]}
          </button>
        ))}
      </div>

      {/* Responsive Grid: Horizontal Snap Carousel on Mobile, 3x2 Bento on Desktop */}
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 pt-1 px-4 -mx-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6 no-scrollbar">
        {visibleFeatures.map((f) => (
          <div
            key={f.id}
            className="w-[84vw] max-w-[320px] shrink-0 snap-center sm:w-auto rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 sm:p-6 space-y-3.5 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
                  <Icon name={f.icon} className="text-xl" />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-outline bg-surface-container-low px-2 py-0.5 rounded-md border border-outline-variant/40">
                  Included Free
                </span>
              </div>

              <div className="space-y-1.5">
                <h3 className="font-display text-base sm:text-lg font-semibold text-on-surface leading-snug">
                  {f.title}
                </h3>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1 border-t border-outline-variant/40">
              {/* Live Mini Preview Artifact */}
              {f.preview}

              <div className="rounded-lg bg-surface-container-low p-2 text-[11px] text-outline space-y-0.5">
                <div className="flex justify-between font-medium text-on-surface text-[10px]">
                  <span>{f.highlight.split(" · ")[0]}</span>
                  <span className="text-primary font-semibold">{f.highlight.split(" · ")[1]}</span>
                </div>
                <p className="text-[10px] leading-tight text-on-surface-variant">{f.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Swipe Hint */}
      <div className="flex sm:hidden items-center justify-center gap-1.5 text-[11px] text-outline pt-1">
        <span>Swipe horizontally to view all features</span>
        <Icon name="arrow_forward" className="text-xs text-primary" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2b. Interactive Step Stepper & Showcase for Section 4 (Clean Shadcn Stepper)
// ---------------------------------------------------------------------------
const PROCESS_STEPS = [
  {
    step: 1,
    tag: "Step One",
    badge: "Under 30s Setup",
    title: "Register your homestay",
    description:
      "Share your property name, location, and WhatsApp number. Your online host profile is created in less than 30 seconds.",
    bullets: [
      "Zero onboarding fee or credit card required",
      "Instant WhatsApp access & direct guest link",
      "Free forever for authentic homestay owners",
    ],
  },
  {
    step: 2,
    tag: "Step Two",
    badge: "Visual Calendar & CRM",
    title: "Manage your property",
    description:
      "Add your rooms, track bookings on a clean visual calendar, manage guest records, and monitor monthly occupancy effortlessly.",
    bullets: [
      "Visual room inventory & avoid double bookings",
      "Digital guest records, check-ins & ID history",
      "Live occupancy tracking and revenue visibility",
    ],
  },
  {
    step: 3,
    tag: "Step Three",
    badge: "Direct Mountain Cabs",
    title: "Arrange cabs for your guests",
    description:
      "Connect guests with verified mountain drivers for NJP/Bagdogra airport transfers, local sightseeing, and return journeys.",
    bullets: [
      "Verified local hill drivers with ghat experience",
      "High-clearance mountain vehicles (4WD / SUVs)",
      "100% cash paid directly to driver with ₹0 fee",
    ],
  },
];

export function StepProcessShowcase() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const currStep = PROCESS_STEPS[activeStep - 1];

  return (
    <div className="space-y-6">
      {/* Desktop & Tablet View: Clean 3-Column Progression with connecting accents */}
      <div className="hidden md:grid md:grid-cols-3 gap-6 lg:gap-8">
        {PROCESS_STEPS.map((s) => (
          <div
            key={s.step}
            className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-6 lg:p-7 space-y-4 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-base font-bold text-on-primary shadow-md shadow-primary/25">
                  {s.step}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary-fixed/60 px-2.5 py-0.5 rounded-full">
                  {s.tag}
                </span>
              </div>
              <h3 className="font-display text-lg lg:text-xl font-bold text-on-surface">
                {s.title}
              </h3>
              <p className="text-xs lg:text-sm font-normal text-on-surface-variant leading-relaxed">
                {s.description}
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-outline-variant/50">
              {s.bullets.map((bullet, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile View: High-End Interactive Stepper (Zero fake inputs / forms) */}
      <div className="md:hidden space-y-3.5">
        {/* Segmented Stepper Pill Controller */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-container p-1 border border-outline-variant/60">
          {PROCESS_STEPS.map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => setActiveStep(s.step)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                activeStep === s.step
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                Step {s.step}
              </span>
              <span className="text-xs font-semibold truncate w-full">
                {s.step === 1 ? "Register" : s.step === 2 ? "Manage" : "Cabs"}
              </span>
            </button>
          ))}
        </div>

        {/* Morphing Interactive Card without fake inputs */}
        <div className="rounded-2xl border border-primary/25 bg-surface-container-lowest p-4.5 space-y-3.5 shadow-xl shadow-primary/10 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary-fixed px-2.5 py-0.5 text-[10px] font-bold text-primary">
              <Zap className="h-3 w-3" />
              <span>{currStep.badge}</span>
            </span>
            <span className="text-[11px] font-semibold text-emerald-700">₹0 Free Forever</span>
          </div>

          <div>
            <h3 className="font-display text-base font-bold text-on-surface">
              {currStep.step}. {currStep.title}
            </h3>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              {currStep.description}
            </p>
          </div>

          {/* Clean high-value checkmarks */}
          <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-3 space-y-2 text-xs">
            {currStep.bullets.map((bullet, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[11px] text-on-surface">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>

          {/* Stepper Navigation Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-outline-variant/40">
            <div className="flex items-center gap-1.5">
              {PROCESS_STEPS.map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setActiveStep(s.step)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    activeStep === s.step ? "w-6 bg-primary" : "w-2 bg-outline-variant"
                  }`}
                  aria-label={`Go to step ${s.step}`}
                />
              ))}
            </div>
            {activeStep < 3 ? (
              <button
                type="button"
                onClick={() => setActiveStep(activeStep + 1)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                <span>Next: Step {activeStep + 1}</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <a
                href="#register"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <span>Start Free</span>
                <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2c. Mountain Transit Showcase for Section 5 (Clean 2-Pillar Network)
// ---------------------------------------------------------------------------
export function MountainTransitShowcase() {
  const [audience, setAudience] = useState<"hosts" | "drivers">("hosts");

  return (
    <div>
      {/* Desktop View: Full 2-Column High-End Layout */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-8 items-stretch">
        {/* Left: Corridors & Mountain Transit */}
        <div className="rounded-3xl border border-outline-variant/70 bg-surface-container-lowest p-8 space-y-6 shadow-xl hover:shadow-2xl transition-all duration-200 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-3 py-1 text-xs font-medium text-primary shadow-2xs">
              <MountainSnow className="h-4 w-4" />
              <span>High-Altitude Corridors</span>
            </div>
            <h3 className="font-display text-2xl font-semibold text-on-surface">
              Purpose-built for mountain roads.
            </h3>
            <p className="text-sm font-normal text-on-surface-variant leading-relaxed">
              Steep hairpin curves, monsoon fog, and altitude require experienced ghat drivers and high-ground-clearance vehicles (Innova, Scorpio, Bolero, Sumo).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm font-medium text-on-surface">
            <div className="flex items-center gap-2.5 rounded-xl bg-surface-container-low p-3.5 border border-outline-variant/60 shadow-xs hover:border-primary/40 transition-colors">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span>Darjeeling &amp; Ghum</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-surface-container-low p-3.5 border border-outline-variant/60 shadow-xs hover:border-primary/40 transition-colors">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span>Kalimpong &amp; Lava</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-surface-container-low p-3.5 border border-outline-variant/60 shadow-xs hover:border-primary/40 transition-colors">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span>Gangtok &amp; Sikkim</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-surface-container-low p-3.5 border border-outline-variant/60 shadow-xs hover:border-primary/40 transition-colors">
              <Navigation className="h-4 w-4 text-primary shrink-0" />
              <span>Bagdogra &amp; NJP</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/cab-request"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <span>Open Public Cab Booking Desk</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Right: Driver Partner Card */}
        <div className="rounded-3xl border border-primary/25 bg-primary p-8 text-on-primary shadow-2xl shadow-primary/25 flex flex-col justify-between space-y-6 hover:-translate-y-0.5 transition-all duration-200">
          <div className="space-y-3">
            <span className="inline-block rounded-full bg-primary-container px-3 py-1 text-xs font-semibold text-on-primary-container shadow-2xs">
              For Local Hill Drivers
            </span>
            <h3 className="font-display text-3xl font-semibold">
              Drive with StayCabs. Keep 100% of your trip cash.
            </h3>
            <p className="text-sm font-normal opacity-90 leading-relaxed">
              Connect directly with verified homestay guests across Darjeeling, Kalimpong, and Sikkim. Submit direct trip bids and collect 100% cash with zero platform deductions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/join-driver"
              className="liquid-btn inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-primary shadow-md shadow-black/10 hover:bg-slate-100"
            >
              Join as a Driver
            </Link>
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent("Hi StayCabs, I am a local mountain driver and want to register my vehicle.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="liquid-btn inline-flex h-12 items-center justify-center rounded-xl border border-white/40 bg-primary/20 px-5 text-sm font-medium text-white hover:bg-primary-container shadow-xs"
            >
              Driver Support Desk
            </a>
          </div>
        </div>
      </div>

      {/* Mobile View: High-End 2-Pillar Switcher (Clean, informative, zero fake inputs) */}
      <div className="lg:hidden space-y-3.5">
        {/* Audience Segment Switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-container p-1 border border-outline-variant/60">
          <button
            type="button"
            onClick={() => setAudience("hosts")}
            className={`py-2 px-1.5 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer ${
              audience === "hosts"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            For Homestays &amp; Guests
          </button>
          <button
            type="button"
            onClick={() => setAudience("drivers")}
            className={`py-2 px-1.5 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer ${
              audience === "drivers"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            For Local Hill Drivers
          </button>
        </div>

        {/* Tab 1: Hosts & Guests Hill Transit Overview */}
        {audience === "hosts" && (
          <div className="rounded-2xl border border-primary/25 bg-surface-container-lowest p-4.5 space-y-3.5 shadow-xl shadow-primary/10">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                <MountainSnow className="h-3 w-3" />
                <span>High-Altitude Corridors</span>
              </div>
              <h3 className="font-display text-base font-bold text-on-surface">
                Purpose-built for mountain roads.
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Steep hairpin curves, monsoon fog, and altitude require experienced ghat drivers and high-ground-clearance vehicles.
              </p>
            </div>

            {/* 3 Pillar highlights (Zero fake inputs) */}
            <div className="space-y-2 rounded-xl border border-outline-variant/60 bg-surface-container-low p-3 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <div>
                  <span className="font-semibold text-on-surface block text-[11px]">Verified Ghat Drivers</span>
                  <span className="text-[10px] text-on-surface-variant">Police-verified local drivers with 5+ years mountain road experience.</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
                  <Car className="h-3.5 w-3.5" />
                </div>
                <div>
                  <span className="font-semibold text-on-surface block text-[11px]">High-Clearance Vehicles</span>
                  <span className="text-[10px] text-on-surface-variant">Innova Crysta, Scorpio, Bolero, and Sumo 4WD suited for steep mountain terrain.</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div>
                  <span className="font-semibold text-on-surface block text-[11px]">100% Cash to Driver</span>
                  <span className="text-[10px] text-on-surface-variant">Zero platform deductions or hidden booking markups. Direct cash in hand.</span>
                </div>
              </div>
            </div>

            {/* Corridors micro-pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="rounded-lg bg-surface-container-lowest px-2 py-1 text-[10px] font-medium text-on-surface border border-outline-variant/60">
                Darjeeling &amp; Ghum
              </span>
              <span className="rounded-lg bg-surface-container-lowest px-2 py-1 text-[10px] font-medium text-on-surface border border-outline-variant/60">
                Kalimpong &amp; Lava
              </span>
              <span className="rounded-lg bg-surface-container-lowest px-2 py-1 text-[10px] font-medium text-on-surface border border-outline-variant/60">
                Gangtok &amp; Sikkim
              </span>
              <span className="rounded-lg bg-surface-container-lowest px-2 py-1 text-[10px] font-medium text-on-surface border border-outline-variant/60">
                Bagdogra &amp; NJP
              </span>
            </div>

            {/* Direct Action */}
            <div className="pt-1">
              <Link
                href="/cab-request"
                className="liquid-btn w-full inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-on-primary shadow-md shadow-primary/20 hover:bg-primary-container"
              >
                <span>Open Public Cab Booking Desk</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Tab 2: For Local Hill Drivers */}
        {audience === "drivers" && (
          <div className="rounded-2xl border border-primary/25 bg-primary p-4.5 text-on-primary shadow-xl shadow-primary/20 space-y-3.5">
            <div className="space-y-1.5">
              <span className="inline-block rounded-full bg-primary-container px-2.5 py-0.5 text-[10px] font-bold text-on-primary-container">
                For Local Hill Drivers
              </span>
              <h3 className="font-display text-base font-bold leading-snug">
                Drive with StayCabs. Keep 100% of your trip cash.
              </h3>
              <p className="text-xs opacity-90 leading-relaxed">
                Connect directly with verified homestay guests across Darjeeling, Kalimpong, and Sikkim. Submit direct trip bids and collect 100% cash with zero platform deductions.
              </p>
            </div>

            <div className="space-y-2 rounded-xl bg-white/10 p-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Zap className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-[11px] text-white">Zero Commission</span>
                  <span className="text-[10px] text-white/80">Keep every rupee your guests pay. ₹0 platform cut.</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MessageSquare className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-[11px] text-white">Direct WhatsApp Connection</span>
                  <span className="text-[10px] text-white/80">Coordinate directly with guests via WhatsApp and phone.</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-[11px] text-white">Priority Homestay Bookings</span>
                  <span className="text-[10px] text-white/80">Get priority trips from partner homestay operators.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <Link
                href="/join-driver"
                className="liquid-btn flex-1 inline-flex h-9.5 items-center justify-center rounded-xl bg-white text-xs font-semibold text-primary shadow-sm hover:bg-slate-100"
              >
                Join as a Driver
              </Link>
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent("Hi StayCabs, I am a local mountain driver and want to register my vehicle.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="liquid-btn flex-1 inline-flex h-9.5 items-center justify-center rounded-xl border border-white/40 bg-white/15 text-xs font-medium text-white hover:bg-white/25"
              >
                Driver Desk
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Liquid Animated FAQ Accordion with Category Filters
// ---------------------------------------------------------------------------
const FAQ_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "pricing", label: "Pricing & Fees" },
  { id: "cabs", label: "Cabs & Drivers" },
  { id: "setup", label: "Homestay Setup" },
];

const FAQ_ITEMS = [
  {
    category: "pricing",
    q: "Is StayCabs really free for homestay owners?",
    a: "Yes, 100% free forever. Homestay hosts can register, manage unlimited rooms, track guests, and arrange hill cabs without any subscription fees, setup fees, or hidden commission on your room earnings.",
  },
  {
    category: "setup",
    q: "How do I register my homestay?",
    a: "Enter your homestay name, hill region (Darjeeling, Kalimpong, or Sikkim), and WhatsApp number in the form below. Your profile is generated in 30 seconds and our regional team completes instant setup.",
  },
  {
    category: "cabs",
    q: "Can I add my own trusted local drivers?",
    a: "Absolutely. StayCabs lets you add your own trusted drivers to your private fleet. When your guests need a ride, your drivers receive first priority before requests go to the wider hill network.",
  },
  {
    category: "cabs",
    q: "How do guest cab pickups work?",
    a: "You or your guests can request Bagdogra (IXB), NJP Station, or sightseeing cabs. Verified local drivers submit live fare quotes, and the 4-digit boarding PIN is sent straight to guest WhatsApp. Guests pay drivers 100% cash directly.",
  },
  {
    category: "setup",
    q: "Which hill regions are supported?",
    a: "We support Darjeeling, Kalimpong, Kurseong, Mirik, Gangtok, Pelling, and North Sikkim, connecting directly with NJP Railway Station and Bagdogra International Airport (IXB).",
  },
  {
    category: "setup",
    q: "Do I or my guests need to install an app?",
    a: "No app download is required. StayCabs works instantly in any phone, iPad, or desktop browser. Guests receive all updates directly via WhatsApp.",
  },
  {
    category: "cabs",
    q: "How can hill drivers join the network?",
    a: "Hill drivers with commercial vehicles (Innova, Scorpio, Bolero, Sedan) can submit their phone and car details on our 'Join as a Driver' page for verification within 24 hours.",
  },
];

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredItems = activeCategory === "all"
    ? FAQ_ITEMS
    : FAQ_ITEMS.filter((item) => item.category === activeCategory);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      {/* Category Filter Chips */}
      <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {FAQ_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setActiveCategory(cat.id);
              setOpenIndex(0);
            }}
            className={`liquid-btn rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat.id
                ? "bg-primary text-on-primary shadow-xs"
                : "bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/60"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Animated Accordion List */}
      <div className="space-y-2">
        {filteredItems.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={item.q}
              className={`rounded-2xl border transition-all duration-200 ${
                isOpen
                  ? "border-primary/40 bg-surface-container-low shadow-md"
                  : "border-outline-variant/60 bg-surface-container-lowest hover:border-primary/40 shadow-sm hover:shadow-md hover:-translate-y-0.5"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="flex w-full items-center justify-between gap-3 p-3.5 sm:p-4 text-left text-xs sm:text-sm font-semibold text-on-surface cursor-pointer"
                aria-expanded={isOpen}
              >
                <span>{item.q}</span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform duration-200 ${
                    isOpen ? "rotate-180 bg-primary text-on-primary" : "bg-surface-container text-outline"
                  }`}
                >
                  <Icon name="expand_more" className="text-base" />
                </span>
              </button>
              <div className="accordion-grid" data-open={isOpen}>
                <div className="accordion-inner">
                  <div className="border-t border-outline-variant/30 px-3.5 pb-3.5 pt-2 sm:px-4 sm:pb-4 text-xs text-on-surface-variant leading-relaxed">
                    {item.a}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Luxury Homestay Registration Component (#register)
// ---------------------------------------------------------------------------
const REGIONS = [
  "Darjeeling",
  "Kalimpong",
  "Sikkim",
  "Kurseong",
  "Mirik",
  "Dooars",
];

const ROOM_OPTIONS = [
  { id: "2", label: "1–2 Rooms" },
  { id: "3", label: "3–4 Rooms" },
  { id: "5", label: "5–8 Rooms" },
  { id: "10", label: "9+ Cottages" },
];

export function QuickRegisterForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("Darjeeling");
  const [rooms, setRooms] = useState("3");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (!name.trim() || name.trim().length < 2) {
      setError("Please enter your homestay name (at least 2 characters).");
      return;
    }
    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit WhatsApp number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiFetch(API_ENDPOINTS.homestayLead(), {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          location,
          rooms: parseInt(rooms, 10) || 3,
        }),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(
        typeof err?.message === "string" && err.message
          ? err.message
          : "Registration could not be completed right now. Please chat with us on WhatsApp."
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-3xl border border-emerald-300 bg-emerald-50/95 p-6 sm:p-8 text-center space-y-4 shadow-elevated">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
          <Icon name="check" className="text-2xl" />
        </div>
        <div>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-emerald-950">Welcome to StayCabs!</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-emerald-900 leading-relaxed max-w-lg mx-auto">
            Your homestay profile for <strong>{name}</strong> ({location}) is recorded. Our regional team will connect via WhatsApp ({phone}) shortly.
          </p>
        </div>
        <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href="/cab-request"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-container"
          >
            <span>Cab Booking Desk</span>
            <Icon name="arrow_forward" className="text-xs" />
          </Link>
          <a
            href={`https://wa.me/${waNumber(siteConfig.supportPhone || "+91 9239842574")}?text=${encodeURIComponent(`Hi StayCabs, I just registered my homestay "${name}" in ${location}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
          >
            <Icon name="chat" className="text-xs" />
            <span>Connect on WhatsApp</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      id="register"
      onSubmit={handleSubmit}
      className="rounded-2xl border border-primary/25 bg-surface-container-lowest p-6 sm:p-8 shadow-2xl shadow-primary/15 space-y-4"
    >
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary shadow-2xs">
          <Icon name="bolt" filled className="text-sm" />
          <span>Instant Host Onboarding · ₹0 Setup Fee</span>
        </div>
        <h3 className="font-display text-xl sm:text-2xl font-bold text-on-surface">
          Register your homestay in 30 seconds
        </h3>
        <p className="text-xs sm:text-sm text-on-surface-variant">
          Join Himalayan homestay owners using StayCabs completely free.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700 flex items-center gap-2">
          <Icon name="error" className="text-sm text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Homestay Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pine View Retreat"
            className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            WhatsApp Contact Number
          </label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98320 •••••"
            className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Region / Location *
          </label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
          >
            <option value="Darjeeling">Darjeeling &amp; Surrounds</option>
            <option value="Kalimpong">Kalimpong &amp; Lava/Rishyap</option>
            <option value="Sikkim">Gangtok &amp; Sikkim</option>
            <option value="Mirik">Mirik &amp; Kurseong</option>
            <option value="Dooars">Dooars Foothills</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Number of Guest Rooms
          </label>
          <select
            value={rooms}
            onChange={(e) => setRooms(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
          >
            <option value="1">1 Room / Studio</option>
            <option value="2">2 Rooms</option>
            <option value="3">3 - 4 Rooms</option>
            <option value="5">5 - 8 Rooms</option>
            <option value="10">9+ Rooms / Multiple Cottages</option>
          </select>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="liquid-btn w-full rounded-xl bg-primary py-3.5 px-6 text-sm font-semibold text-on-primary shadow-lg shadow-primary/25 hover:bg-primary-container disabled:opacity-50 transition-all cursor-pointer"
        >
          {loading ? "Creating your free profile..." : "Get Started for Free — No Fees Ever"}
        </button>
      </div>

      <p className="text-center text-[11px] text-outline">
        🔒 By registering, you agree to StayCabs terms. No credit card required. 100% free for homestay owners.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// 4. Floating WhatsApp Help Desk Button (Desktop & Tablet)
// ---------------------------------------------------------------------------
export function FloatingWhatsApp() {
  const phone = siteConfig.supportPhone || process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+91 9239842574";
  const num = waNumber(phone);

  return (
    <aside
      aria-label="Support chat"
      className="fixed bottom-6 right-6 z-30 hidden sm:flex items-center gap-2"
    >
      <a
        href={`https://wa.me/${num}?text=${encodeURIComponent("Hello StayCabs, I would like to know more about homestay management and cabs.")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2.5 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-elevated hover:bg-emerald-500 transition-all hover:scale-102 active:scale-98 border border-white/20"
        aria-label="Chat with StayCabs on WhatsApp"
      >
        <Icon name="chat" className="text-lg" />
        <span>WhatsApp Help</span>
      </a>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// 5. Smooth Infinite Scrolling Reviews Marquee (Auto Horizontal Animation)
// ---------------------------------------------------------------------------
const REVIEWS = [
  {
    name: "Norbu Lepcha",
    property: "Pine View Retreat · Kalimpong",
    role: "4 Rooms",
    stars: 5,
    quote: "Before StayCabs, we kept room bookings in paper diaries and panicked calling taxi drivers when guests landed at Bagdogra. Now everything is in one screen.",
  },
  {
    name: "Pema Sherpa",
    property: "Kanchenjunga Mist · Darjeeling",
    role: "6 Rooms",
    stars: 5,
    quote: "The best part is that it is truly free for homestay owners. We don't have to pay monthly commissions. Our local drivers get regular airport transfers.",
  },
  {
    name: "Bikash Pradhan",
    property: "Sikkim & Siliguri Transit",
    role: "Innova Commercial Driver",
    stars: 5,
    quote: "As a driver, StayCabs gives me genuine homestay trips to NJP and Nathu La. I quote my fare directly and collect 100% of my cash fare right after the trip.",
  },
  {
    name: "Tenzing Bhutia",
    property: "Hermitage Orchard · Kurseong",
    role: "Heritage Host",
    stars: 5,
    quote: "Our guests get verified driver details and their 4-digit boarding PIN on WhatsApp before landing. Zero pickup confusion at crowded Bagdogra arrivals.",
  },
  {
    name: "Sangeeta Chettri",
    property: "Cedar & Pine Homestay · Mirik",
    role: "Host & Tea Grower",
    stars: 5,
    quote: "Having multi-room calendars and on-demand hill cabs on one screen saved us hours of stress every single week during peak autumn season.",
  },
  {
    name: "Sonam Wangchuk",
    property: "Pelling Summit Retreat · West Sikkim",
    role: "5 Rooms",
    stars: 5,
    quote: "Direct Bagdogra pickups with verified drivers and 4-digit PINs eliminated guest arrival confusion completely. Our guests love it.",
  },
];

export function ReviewsMarquee() {
  return (
    <div className="relative w-full overflow-hidden py-1 marquee-mask">
      {/* Edge gradient mask for smooth fade */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 sm:w-20 z-10 bg-gradient-to-r from-surface-container-low to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-20 z-10 bg-gradient-to-l from-surface-container-low to-transparent" />

      {/* Marquee Track with hover/touch pause */}
      <div className="group flex w-max gap-3 sm:gap-4 animate-marquee-rtl hover:marquee-paused active:marquee-paused py-2 select-none">
        {/* Double the array for seamless infinite loop */}
        {[...REVIEWS, ...REVIEWS].map((r, idx) => (
          <div
            key={idx}
            className="w-[280px] sm:w-[340px] shrink-0 rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-4 sm:p-5 space-y-3 shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-primary/50 transition-all duration-200 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(r.stars)].map((_, i) => (
                  <Icon key={i} name="star" filled className="text-xs" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                &ldquo;{r.quote}&rdquo;
              </p>
            </div>
            <div className="pt-2.5 border-t border-outline-variant/40 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-on-surface">{r.name}</p>
                <p className="text-[10px] text-outline truncate max-w-[170px]">{r.property}</p>
              </div>
              <span className="rounded-md bg-primary-fixed/80 px-2 py-0.5 text-[10px] font-semibold text-primary shrink-0">
                {r.role}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
