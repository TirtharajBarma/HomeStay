"use client";

import { useState, useId, useEffect } from "react";
import Link from "next/link";
import {
  MountainSnow,
  Car,
  ShieldCheck,
  Zap,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  Sliders,
  Compass,
  MapPin,
  Sparkles,
  Search,
  X,
  Phone,
  Calendar,
  Bed,
} from "lucide-react";
import { siteConfig } from "@/lib/site-config";
import { waNumber } from "@/lib/whatsapp";

// ===========================================================================
// 1. TOPOGRAPHIC CONTOUR BACKGROUND (Himalayan Elevation Lines)
// ===========================================================================
export function TopographicPattern({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none overflow-hidden ${className}`}
    >
      <svg
        className="w-full h-full opacity-[0.06] text-primary"
        viewBox="0 0 1200 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Curving Elevation Contour Lines modeling Teesta & Kanchenjunga ridges */}
        <path
          d="M-50,150 C200,80 350,220 600,140 C850,60 1000,180 1250,120"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <path
          d="M-50,220 C180,160 320,300 580,210 C840,120 980,260 1250,190"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M-50,290 C150,230 300,380 560,280 C820,180 960,340 1250,260"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M-50,360 C120,300 280,450 540,350 C800,250 940,410 1250,330"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M-50,440 C100,380 250,520 520,420 C780,320 920,490 1250,400"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M-50,510 C80,450 230,590 500,490 C760,390 900,560 1250,470"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />

        {/* Survey Markers */}
        <g opacity="0.6">
          <text x="320" y="200" fill="currentColor" fontSize="10" fontFamily="sans-serif">
            2,042m · GHUM RIDGE
          </text>
          <text x="650" y="270" fill="currentColor" fontSize="10" fontFamily="sans-serif">
            1,250m · KALIMPONG
          </text>
          <text x="920" y="390" fill="currentColor" fontSize="10" fontFamily="sans-serif">
            150m · TEESTA GORGE
          </text>
        </g>
      </svg>
    </div>
  );
}

// ===========================================================================
// 2. PLAYABLE TOY: HIMALAYAN MOUNTAIN ELEVATION & GHAT PROFILE SIMULATOR
// ===========================================================================
export interface ElevationStop {
  id: string;
  name: string;
  region: string;
  altitude: number; // in meters
  xPercent: number; // 0 to 100 on the graph
  yPercent: number; // inverted SVG elevation (higher altitude = lower yPercent)
  distanceFromBase: string;
  ghatCondition: string;
  hairpins: number;
  monsoonSafe: boolean;
  vehicle: string;
  typicalDuration: string;
  driverFare: string;
  driverBadge: string;
}

const ELEVATION_STOPS: ElevationStop[] = [
  {
    id: "bagdogra",
    name: "Bagdogra Airport (IXB) / NJP",
    region: "Plains Base (Siliguri)",
    altitude: 120,
    xPercent: 8,
    yPercent: 88,
    distanceFromBase: "0 km (Plains Base)",
    ghatCondition: "Flat 4-lane highway corridor",
    hairpins: 0,
    monsoonSafe: true,
    vehicle: "Sedan / Hatchback / SUV",
    typicalDuration: "Base Station",
    driverFare: "Base Station",
    driverBadge: "Entry Terminal Pickup",
  },
  {
    id: "teesta",
    name: "Teesta Coronation Bridge",
    region: "River Gorge Corridor",
    altitude: 150,
    xPercent: 30,
    yPercent: 82,
    distanceFromBase: "38 km from IXB",
    ghatCondition: "NH10 Valley Road · Riverside Cliffs",
    hairpins: 12,
    monsoonSafe: true,
    vehicle: "Bolero / Innova / Sumo 4WD",
    typicalDuration: "1 hr 15 mins",
    driverFare: "₹1,800 – ₹2,200",
    driverBadge: "Teesta Valley Certified Driver",
  },
  {
    id: "kalimpong",
    name: "Kalimpong & Delo Ridge",
    region: "Pine Ridge",
    altitude: 1250,
    xPercent: 55,
    yPercent: 48,
    distanceFromBase: "72 km from IXB",
    ghatCondition: "Scenic Ghat Climb · 18 Hairpin Curves",
    hairpins: 18,
    monsoonSafe: true,
    vehicle: "Innova Crysta / Bolero / Sumo",
    typicalDuration: "2 hrs 30 mins",
    driverFare: "₹2,800 – ₹3,200",
    driverBadge: "Kalimpong Hill Specialist",
  },
  {
    id: "darjeeling",
    name: "Darjeeling & Ghum Summit",
    region: "Queen of the Hills",
    altitude: 2042,
    xPercent: 80,
    yPercent: 20,
    distanceFromBase: "68 km via Rohini",
    ghatCondition: "Rohini Ghat · 44 Hairpins · Heavy Fog Zone",
    hairpins: 44,
    monsoonSafe: true,
    vehicle: "Innova Crysta / Scorpio 4x4 (High Clearance)",
    typicalDuration: "2 hrs 45 mins",
    driverFare: "₹3,200 – ₹3,500",
    driverBadge: "Rohini Ghat Expert (5+ Yrs Exp)",
  },
  {
    id: "gangtok",
    name: "Gangtok & High Passes",
    region: "East Sikkim",
    altitude: 1650,
    xPercent: 95,
    yPercent: 32,
    distanceFromBase: "115 km from IXB",
    ghatCondition: "High Altitude NH10 · Checkpost Entry",
    hairpins: 36,
    monsoonSafe: true,
    vehicle: "Innova Crysta / Xylo / 4WD",
    typicalDuration: "3 hrs 45 mins",
    driverFare: "₹3,800 – ₹4,200",
    driverBadge: "Sikkim Permit Ready Driver",
  },
];

export function HimalayanElevationSimulator() {
  const [selectedIndex, setSelectedIndex] = useState<number>(3); // Default to Darjeeling (2,042m)
  const current = ELEVATION_STOPS[selectedIndex];
  const supportNum = waNumber(siteConfig.supportPhone);

  return (
    <div className="rounded-3xl border border-primary/20 bg-surface-container-lowest p-5 sm:p-7 shadow-xl shadow-primary/10 space-y-6">
      {/* Top Header & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/60 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-2.5 py-0.5 text-xs font-semibold text-primary mb-1">
            <MountainSnow className="h-3.5 w-3.5" />
            <span>Interactive Mountain Transit Simulator</span>
          </div>
          <h3 className="font-display text-lg sm:text-xl font-bold text-on-surface">
            Himalayan Altitude &amp; Ghat Elevation Profile
          </h3>
          <p className="text-xs text-on-surface-variant">
            Explore how road conditions, vehicle requirements, and fares scale from the plains to 2,042m peaks.
          </p>
        </div>

        {/* Live Elevation Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto rounded-2xl bg-primary text-on-primary px-3.5 py-2 shadow-sm">
          <Compass className="h-4 w-4 animate-spin-slow opacity-80" />
          <div className="text-left">
            <span className="text-[9px] uppercase tracking-wider block opacity-80">Current Altitude</span>
            <span className="font-bold text-base leading-none">{current.altitude.toLocaleString()}m</span>
          </div>
        </div>
      </div>

      {/* Interactive Mountain Cross-Section SVG Graph */}
      <div className="relative w-full rounded-2xl bg-gradient-to-b from-primary-fixed/40 via-surface-container-low to-surface-container p-4 sm:p-6 border border-outline-variant/50 overflow-hidden">
        {/* Subtle background peak watermark */}
        <div className="absolute right-4 bottom-2 text-primary/10 select-none pointer-events-none font-bold text-6xl sm:text-8xl font-display">
          {current.altitude}m
        </div>

        {/* Elevation Curve SVG */}
        <div className="relative h-44 sm:h-52 w-full">
          <svg
            className="w-full h-full overflow-visible"
            viewBox="0 0 1000 300"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="mountainGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6D45C5" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#6D45C5" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Shaded Area under mountain curve */}
            <path
              d="M 50,265 C 250,260 300,245 400,200 C 500,150 650,80 800,60 C 900,50 950,110 980,100 L 980,300 L 50,300 Z"
              fill="url(#mountainGradient)"
            />

            {/* Mountain Ridge Stroke Line */}
            <path
              d="M 50,265 C 250,260 300,245 400,200 C 500,150 650,80 800,60 C 900,50 950,110 980,100"
              fill="none"
              stroke="#6D45C5"
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            {/* Clickable Waypoints along the Ridge */}
            {ELEVATION_STOPS.map((stop, idx) => {
              const cx = stop.xPercent * 10;
              const cy = (stop.yPercent / 100) * 300;
              const isSelected = selectedIndex === idx;

              return (
                <g
                  key={stop.id}
                  onClick={() => setSelectedIndex(idx)}
                  className="cursor-pointer transition-all duration-300"
                >
                  {/* Outer Pulsing Halo when selected */}
                  {isSelected && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="16"
                      fill="#6D45C5"
                      fillOpacity="0.2"
                      className="animate-ping"
                    />
                  )}
                  {/* Outer Ring */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? "11" : "7"}
                    fill={isSelected ? "#6D45C5" : "#FAF8FE"}
                    stroke="#6D45C5"
                    strokeWidth={isSelected ? "3" : "2"}
                  />
                  {/* Center Dot */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill={isSelected ? "#FFFFFF" : "#6D45C5"}
                  />
                </g>
              );
            })}
          </svg>

          {/* Animated 4WD Mountain Car Marker glides along the graph */}
          <div
            className="absolute -translate-x-1/2 -translate-y-full transition-all duration-500 ease-out pointer-events-none"
            style={{
              left: `${current.xPercent}%`,
              top: `${current.yPercent}%`,
            }}
          >
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-white shadow-md shadow-primary/30 whitespace-nowrap">
                <Car className="h-3 w-3" />
                <span>{current.name.split(" ")[0]}</span>
              </div>
              <div className="h-2 w-0.5 bg-primary" />
            </div>
          </div>
        </div>

        {/* Waypoint Selector Chips (Mobile & Desktop Friendly) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 border-t border-outline-variant/40">
          {ELEVATION_STOPS.map((stop, idx) => (
            <button
              key={stop.id}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                selectedIndex === idx
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container-lowest text-on-surface-variant hover:text-primary border border-outline-variant/60"
              }`}
            >
              <span className="block text-[10px] opacity-75">{stop.altitude}m</span>
              <span>{stop.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Telemetry Dashboard for Selected Altitude: 2x2 Micro-Grid on Mobile, 4-Col on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 text-xs">
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2.5 sm:p-3.5 space-y-0.5 sm:space-y-1">
          <span className="text-outline text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block">
            Elevation &amp; Hairpins
          </span>
          <p className="font-bold text-on-surface text-xs sm:text-sm">{current.altitude} meters</p>
          <p className="text-[10px] sm:text-[11px] text-on-surface-variant truncate">{current.hairpins} mountain hairpins</p>
        </div>

        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2.5 sm:p-3.5 space-y-0.5 sm:space-y-1">
          <span className="text-outline text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block">
            Ghat Conditions
          </span>
          <p className="font-semibold text-on-surface text-[11px] sm:text-xs leading-snug truncate">{current.ghatCondition.split(" · ")[0]}</p>
          <p className="text-[9px] sm:text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 shrink-0" /> Verified Safe
          </p>
        </div>

        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2.5 sm:p-3.5 space-y-0.5 sm:space-y-1">
          <span className="text-outline text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block">
            Mountain Vehicle
          </span>
          <p className="font-bold text-primary text-[11px] sm:text-xs leading-snug truncate">{current.vehicle.split(" / ")[0]}</p>
          <p className="text-[9px] sm:text-[10px] text-on-surface-variant">High Clearance 4WD</p>
        </div>

        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-2.5 sm:p-3.5 space-y-0.5 sm:space-y-1">
          <span className="text-outline text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block">
            Direct Driver Rate
          </span>
          <p className="font-bold text-emerald-700 text-xs sm:text-sm">{current.driverFare}</p>
          <p className="text-[9px] sm:text-[10px] text-outline">Direct Payouts · Fair Rates</p>
        </div>
      </div>

      {/* Direct Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-outline-variant/40">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          <span>
            Assigned driver: <strong>{current.driverBadge}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/cab-request"
            className="liquid-btn inline-flex h-9.5 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-on-primary shadow-sm hover:bg-primary-container"
          >
            <span>Book Ride to {current.name.split(" ")[0]}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {supportNum ? (
            <a
              href={`https://wa.me/${supportNum}?text=Hi%20StayCabs,%20I%20need%20a%20verified%20hill%20cab%20for%20${encodeURIComponent(current.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="liquid-btn inline-flex h-9.5 items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 text-xs font-semibold text-on-surface hover:border-primary/40"
            >
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              <span>WhatsApp Query</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// 3. PLAYABLE TOY: HOMESTAY HOST SAVINGS & TIME CALCULATOR
// ===========================================================================
export function HostSavingsCalculator() {
  const [rooms, setRooms] = useState<number>(3);

  // Reasonable industry metrics for Darjeeling/Kalimpong homestays
  const hoursSavedPerWeek = (rooms * 3.5).toFixed(0);
  const avgMonthlyRoomRevenue = rooms * 32000;
  const otaCommissionLost = (avgMonthlyRoomRevenue * 0.18).toFixed(0); // 18% OTA cut
  const staycabsCost = 0;

  return (
    <div className="rounded-3xl border-2 border-primary/30 bg-surface-container-lowest p-6 sm:p-8 shadow-2xl shadow-primary/15 space-y-6">
      <div className="space-y-2 text-center max-w-xl mx-auto">
        <span className="inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
          Interactive Host ROI Calculator
        </span>
        <h3 className="font-display text-xl sm:text-2xl font-bold text-on-surface">
          See how much time and money you save.
        </h3>
        <p className="text-xs sm:text-sm text-on-surface-variant">
          Slide to match your homestay capacity and see the difference compared to traditional OTAs and paper registers.
        </p>
      </div>

      {/* Interactive Slider */}
      <div className="max-w-md mx-auto space-y-3 pt-2">
        <div className="flex items-center justify-between font-semibold text-sm">
          <span className="text-on-surface flex items-center gap-1.5">
            <Bed className="h-4 w-4 text-primary" />
            <span>Number of Homestay Rooms:</span>
          </span>
          <span className="flex h-8 w-12 items-center justify-center rounded-xl bg-primary text-base font-bold text-on-primary shadow-xs">
            {rooms}
          </span>
        </div>

        <input
          type="range"
          min={1}
          max={12}
          value={rooms}
          onChange={(e) => setRooms(Number(e.target.value))}
          className="w-full h-2.5 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary"
          aria-label="Number of Homestay Rooms"
        />

        <div className="flex items-center justify-between text-[11px] text-outline font-medium px-1">
          <span>1 Room (Cozy Attic)</span>
          <span>6 Rooms</span>
          <span>12 Rooms (Full Estate)</span>
        </div>
      </div>

      {/* Results Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-2xl mx-auto pt-2">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4 text-center space-y-1">
          <Clock className="h-5 w-5 text-primary mx-auto" />
          <span className="text-[11px] font-medium text-outline block">Time Saved</span>
          <p className="font-display text-2xl font-bold text-on-surface">
            ~{hoursSavedPerWeek} hrs<span className="text-xs font-normal text-outline">/wk</span>
          </p>
          <p className="text-[10px] text-on-surface-variant">Zero messy WhatsApp diary checking</p>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-emerald-300/80 bg-emerald-50/50 p-4 text-center space-y-1">
          <TrendingUp className="h-5 w-5 text-emerald-700 mx-auto" />
          <span className="text-[11px] font-medium text-emerald-800 block">OTA Fees Saved</span>
          <p className="font-display text-2xl font-bold text-emerald-900">
            ₹{Number(otaCommissionLost).toLocaleString("en-IN")}<span className="text-xs font-normal text-emerald-700">/mo</span>
          </p>
          <p className="text-[10px] text-emerald-800">18% saved vs big travel portals</p>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl border border-primary/40 bg-primary-fixed/50 p-4 text-center space-y-1">
          <Zap className="h-5 w-5 text-primary mx-auto" />
          <span className="text-[11px] font-medium text-primary block">StayCabs Cost</span>
          <p className="font-display text-2xl font-bold text-primary">₹0</p>
          <p className="text-[10px] text-primary font-semibold">Free Forever for Authentic Hosts</p>
        </div>
      </div>

      {/* Action CTA */}
      <div className="text-center pt-2">
        <a
          href="/#register"
          className="liquid-btn inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-xs sm:text-sm font-semibold text-on-primary shadow-md shadow-primary/25 hover:bg-primary-container"
        >
          <span>Register Your Homestay (Free)</span>
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

// ===========================================================================
// 4. SPOTLIGHT QUICK LAUNCHER (CMD+K / SEARCH PILL)
// ===========================================================================
export function QuickActionLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const supportNum = waNumber(siteConfig.supportPhone);
  const QUICK_LINKS = [
    { title: "Register Homestay (Free)", category: "Homestay Hosts", href: "/#register", icon: Bed, external: false },
    { title: "Guest Cab Concierge", category: "Transit", href: "/cab-request", icon: Car, external: false },
    { title: "Join Driver Partner Network", category: "Drivers", href: "/join-driver", icon: ShieldCheck, external: false },
    { title: "Himalayan Elevation & Route Simulator", category: "Transit", href: "/#transit", icon: MountainSnow, external: false },
    ...(supportNum
      ? [{ title: "Official WhatsApp Host Desk", category: "Support", href: `https://wa.me/${supportNum}`, icon: Phone, external: true }]
      : []),
  ];

  const filtered = QUICK_LINKS.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Floating Trigger Pill on Desktop & Mobile */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-5 z-40 hidden sm:inline-flex items-center gap-2 rounded-full border border-primary/25 bg-surface-container-lowest/95 px-3.5 py-2 text-xs font-medium text-on-surface shadow-xl backdrop-blur-md hover:border-primary/50 hover:bg-surface-container-low transition-all cursor-pointer"
        aria-label="Open Quick Command Bar (Cmd+K)"
      >
        <Search className="h-3.5 w-3.5 text-primary" />
        <span className="text-on-surface-variant">Quick Actions</span>
        <kbd className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold text-outline">
          ⌘K
        </kbd>
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl border border-primary/30 bg-surface-container-lowest shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Input Header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-outline-variant/60">
              <Search className="h-4 w-4 text-primary shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search actions, cabs, registration..."
                className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-outline hover:text-on-surface hover:bg-surface-container"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filtered.length > 0 ? (
                filtered.map((item, idx) => {
                  const ItemIcon = item.icon;
                  return (
                    <a
                      key={idx}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs hover:bg-primary-fixed/60 transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          <ItemIcon className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <p className="font-semibold text-on-surface">{item.title}</p>
                          <p className="text-[10px] text-outline">{item.category}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-outline group-hover:text-primary transition-colors" />
                    </a>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-outline">
                  No matching action found for &quot;{search}&quot;.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between bg-surface-container-low px-4 py-2 text-[10px] text-outline border-t border-outline-variant/40">
              <span>Navigate with mouse or tap</span>
              <span>ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===========================================================================
// 5. APPLE-STYLE FLOATING CHAPTER NAVIGATOR
// ===========================================================================
export function FloatingChapterNavigator() {
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    const sectionIds = ["hero", "story", "transit", "launchpad"];
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 250;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      if (window.__lenis) {
        window.__lenis.scrollTo(el, { offset: -70, duration: 1.2 });
      } else {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const chapters = [
    { id: "hero", label: "01 Overview" },
    { id: "story", label: "02 Homestay OS" },
    { id: "transit", label: "03 Mountain Cabs" },
    { id: "launchpad", label: "04 Host Launchpad" },
  ];

  return (
    <aside
      aria-label="Chapter Navigation"
      className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-2 p-1.5 rounded-full apple-glass shadow-xl"
    >
      {chapters.map((ch) => {
        const isActive = activeSection === ch.id;
        return (
          <button
            key={ch.id}
            type="button"
            onClick={() => scrollTo(ch.id)}
            className="group relative flex items-center justify-center h-7 w-7 rounded-full transition-all cursor-pointer"
            aria-label={`Jump to ${ch.label}`}
          >
            <span
              className={`h-2 rounded-full transition-all duration-300 ${
                isActive
                  ? "w-5 bg-primary shadow-xs shadow-primary"
                  : "w-2 bg-outline-variant hover:bg-primary/50"
              }`}
            />
            {/* Tooltip on Hover */}
            <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-surface-container-lowest px-2.5 py-1 text-[11px] font-semibold text-on-surface shadow-md border border-outline-variant/60 opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
              {ch.label}
            </span>
          </button>
        );
      })}
    </aside>
  );
}

// ===========================================================================
// 6. STICKY STORYTELLING STAGE: THE HIMALAYAN HOMESTAY OS
// ===========================================================================
export function HimalayanOSStoryStage() {
  const [activeChapter, setActiveChapter] = useState<"rooms" | "guests" | "cabs">("rooms");
  const supportNum = waNumber(siteConfig.supportPhone);

  return (
    <div className="space-y-6 sm:space-y-10">
      {/* -------------------------------------------------------------------
          MOBILE VIEW: Single Morphing Card with Top 3-Tab Segment Switcher
          (Completely eliminates the 4-card vertical stack and 800px scroll!)
          ------------------------------------------------------------------- */}
      <div className="lg:hidden space-y-4">
        {/* Segment Switcher */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-container p-1 border border-outline-variant/60 max-w-sm mx-auto">
          <button
            type="button"
            onClick={() => setActiveChapter("rooms")}
            className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeChapter === "rooms"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <Bed className="h-3.5 w-3.5" />
            <span>Rooms</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChapter("guests")}
            className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeChapter === "guests"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Guests</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChapter("cabs")}
            className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeChapter === "cabs"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <Car className="h-3.5 w-3.5" />
            <span>Cabs</span>
          </button>
        </div>

        {/* Single Morphing Glass Card */}
        <div className="apple-glass rounded-3xl p-4.5 sm:p-5 shadow-xl space-y-3.5 border border-white/80">
          <div className="flex items-center justify-between border-b border-outline-variant/50 pb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-primary">Pine View Retreat · Kalimpong</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary-fixed/70 px-2 py-0.5 rounded-full">
              {activeChapter === "rooms" ? "01 · Calendar" : activeChapter === "guests" ? "02 · Guest CRM" : "03 · Cabs"}
            </span>
          </div>

          {/* Tab 1: Rooms */}
          {activeChapter === "rooms" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-on-surface">Visual Room Inventory</h3>
                  <span className="text-xs font-bold text-emerald-700">88.4% Occupancy</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                  Zero double bookings. See occupied rooms and arrivals instantly.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-2.5 text-xs">
                  <div>
                    <span className="font-bold text-emerald-950 block text-[11px]">Deluxe Kanchenjunga View</span>
                    <span className="text-[10px] text-emerald-800">Guest: Arindam S. · 3 Nights</span>
                  </div>
                  <span className="rounded bg-emerald-600 px-2 py-0.5 text-[9px] font-bold text-white">Occupied</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary-fixed/50 p-2.5 text-xs">
                  <div>
                    <span className="font-bold text-on-surface block text-[11px]">Attic Pine Suite</span>
                    <span className="text-[10px] text-on-surface-variant">Arriving today · 3:00 PM</span>
                  </div>
                  <span className="rounded bg-primary px-2 py-0.5 text-[9px] font-bold text-white">Check-in Today</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-outline-variant/40 text-[10px] text-primary font-medium">
                <span>✓ WhatsApp Direct Guest Alerts</span>
                <span>✓ ₹0 Free Forever</span>
              </div>
            </div>
          )}

          {/* Tab 2: Guests */}
          {activeChapter === "guests" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-on-surface">Guest Records &amp; ID CRM</h3>
                  <span className="text-xs font-semibold text-emerald-700">Verified ID</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                  Guest preferences, arrival timings, and contact history in one card.
                </p>
              </div>

              <div className="rounded-xl border border-primary/25 bg-surface-container-lowest p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-on-surface block">Arindam S.</span>
                    <span className="text-[10px] text-outline">Kolkata, WB · 2 Guests · Deluxe Room</span>
                  </div>
                  <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[9px] font-bold">Checked In</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-outline-variant/40 text-[10px]">
                  <span className="text-outline">WhatsApp Direct Contact:</span>
                  <span className="font-bold text-primary">+91 98310 •••••</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-outline-variant/40 text-[10px] text-primary font-medium">
                <span>✓ 1-Tap WhatsApp Directions</span>
                <span>✓ Searchable Stay History</span>
              </div>
            </div>
          )}

          {/* Tab 3: Cabs */}
          {activeChapter === "cabs" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-on-surface">Mountain Cab Dispatch</h3>
                  <span className="text-xs font-bold text-emerald-700">100% Cash to Driver</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                  Connect guests with verified hill drivers for Bagdogra/NJP runs.
                </p>
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary-fixed/40 p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-primary">TRIP #STAY-9428</span>
                  <span className="rounded bg-emerald-600 px-1.5 py-0.2 text-[9px] font-bold text-white">Driver Assigned</span>
                </div>
                <p className="font-semibold text-on-surface text-[11px]">Bagdogra Airport (IXB) ➔ Kalimpong</p>
                <div className="flex items-center justify-between pt-1 border-t border-primary/20 text-[10px]">
                  <span className="text-outline">Tenzing B. (Innova 4WD)</span>
                  <strong className="text-emerald-700 font-bold">₹3,200 (100% Cash)</strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-outline-variant/40 text-[10px] text-primary font-medium">
                <span>✓ Verified Ghat Drivers</span>
                <span>✓ ₹0 Platform Commission</span>
              </div>
            </div>
          )}

          {/* Mobile Direct Action */}
          <div className="pt-0.5">
            <a
              href="#launchpad"
              className="liquid-btn w-full inline-flex h-9.5 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-on-primary shadow-sm hover:bg-primary-container"
            >
              <span>Start Managing for Free</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          DESKTOP VIEW: Full 2-Column Interactive Story Stage (Preserved 100%)
          ------------------------------------------------------------------- */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
        {/* Left Column: 3 Interactive Chapters (5 cols) */}
        <div className="lg:col-span-5 space-y-3.5 flex flex-col justify-between">
          {/* Chapter 1: Room Calendar */}
          <div
            onClick={() => setActiveChapter("rooms")}
            className={`rounded-2xl p-5 border transition-all cursor-pointer ${
              activeChapter === "rooms"
                ? "apple-glass-interactive border-primary/40 ring-2 ring-primary/15 shadow-xl"
                : "bg-surface-container-lowest/60 border-outline-variant/60 hover:bg-surface-container-lowest hover:border-primary/30"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary-fixed/70 px-2 py-0.5 rounded-full">
                Chapter 01 · Live Availability
              </span>
              <span className="text-xs font-bold text-emerald-700">88.4% Occupancy</span>
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-on-surface">
              Visual Room Inventory &amp; Calendar
            </h3>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Eliminate double-bookings caused by juggling phone calls, notebooks, and WhatsApp chats. One visual calendar shows occupied and arriving rooms instantly.
            </p>
            <div className="flex items-center gap-3 pt-3 text-[11px] font-medium text-primary">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>Zero Double Bookings</span>
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>Works on Any Mobile</span>
              </span>
            </div>
          </div>

          {/* Chapter 2: Guest CRM */}
          <div
            onClick={() => setActiveChapter("guests")}
            className={`rounded-2xl p-5 border transition-all cursor-pointer ${
              activeChapter === "guests"
                ? "apple-glass-interactive border-primary/40 ring-2 ring-primary/15 shadow-xl"
                : "bg-surface-container-lowest/60 border-outline-variant/60 hover:bg-surface-container-lowest hover:border-primary/30"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary-fixed/70 px-2 py-0.5 rounded-full">
                Chapter 02 · Guest Records
              </span>
              <span className="text-xs font-semibold text-primary">WhatsApp CRM</span>
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-on-surface">
              Guest Records &amp; ID Verification
            </h3>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Check-in timings, dietary preferences, ID copies, and contact history kept in one central, searchable card. Send arrival links in 1 tap.
            </p>
            <div className="flex items-center gap-3 pt-3 text-[11px] font-medium text-primary">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>1-Tap WhatsApp Alerts</span>
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>Instant Stay History</span>
              </span>
            </div>
          </div>

          {/* Chapter 3: Cabs & Transit */}
          <div
            onClick={() => setActiveChapter("cabs")}
            className={`rounded-2xl p-5 border transition-all cursor-pointer ${
              activeChapter === "cabs"
                ? "apple-glass-interactive border-primary/40 ring-2 ring-primary/15 shadow-xl"
                : "bg-surface-container-lowest/60 border-outline-variant/60 hover:bg-surface-container-lowest hover:border-primary/30"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary-fixed/70 px-2 py-0.5 rounded-full">
                Chapter 03 · Hill Transit
              </span>
              <span className="text-xs font-bold text-emerald-700">₹0 Commission</span>
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-on-surface">
              1-Tap Verified Mountain Cab Dispatch
            </h3>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              When guests ask for an airport pickup or Tiger Hill sunrise tour, dispatch a verified hill driver in seconds with 100% cash paid directly to the driver.
            </p>
            <div className="flex items-center gap-3 pt-3 text-[11px] font-medium text-primary">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>4WD / High Clearance</span>
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>Verified Hill Drivers</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Live Morphing Console (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="apple-glass rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 border border-white/80 h-full flex flex-col justify-between">
            {/* Top Chrome */}
            <div className="flex items-center justify-between border-b border-outline-variant/50 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs font-semibold text-primary pl-1">
                  Pine View Retreat · Kalimpong
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Cloud Sync</span>
              </div>
            </div>

            {/* View 1: Room Calendar Console */}
            {activeChapter === "rooms" && (
              <div className="space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface">Live Room Status &amp; Pricing</span>
                  <span className="text-[11px] font-semibold text-primary">3 Active Mountain Rooms</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-3 text-xs">
                    <div>
                      <span className="font-bold text-emerald-950 block">Deluxe Kanchenjunga View</span>
                      <span className="text-[10px] text-emerald-800">Guest: Arindam S. · 3 Nights</span>
                    </div>
                    <span className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white shadow-xs">
                      Occupied
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary-fixed/50 p-3 text-xs">
                    <div>
                      <span className="font-bold text-on-surface block">Attic Pine Suite</span>
                      <span className="text-[10px] text-on-surface-variant">Arriving today · 3:00 PM</span>
                    </div>
                    <span className="rounded-lg bg-primary px-2 py-1 text-[10px] font-bold text-white shadow-xs">
                      Check-in Today
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3 text-xs">
                    <div>
                      <span className="font-bold text-on-surface block">Garden Valley Cottage</span>
                      <span className="text-[10px] text-outline">Available for instant booking</span>
                    </div>
                    <span className="rounded-lg bg-surface-container px-2 py-1 text-[10px] font-bold text-primary border border-outline-variant/50">
                      Available (₹2,200)
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-surface-container-low p-3 text-[11px] text-on-surface-variant border border-outline-variant/50 flex items-center justify-between">
                  <span>Monthly Occupancy Rate:</span>
                  <strong className="text-primary font-bold text-xs">88.4% (Peak Season)</strong>
                </div>
              </div>
            )}

            {/* View 2: Guest CRM Console */}
            {activeChapter === "guests" && (
              <div className="space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface">Active Guest Stay Record</span>
                  <span className="text-[11px] font-semibold text-emerald-700">Verified ID Attached</span>
                </div>

                <div className="rounded-2xl border border-primary/25 bg-surface-container-lowest p-4 space-y-3 text-xs shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-on-surface">Arindam S.</h4>
                      <p className="text-[10px] text-outline">Kolkata, West Bengal · 2 Guests</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                      Checked In
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded-lg bg-surface-container-low p-2 border border-outline-variant/40">
                      <span className="text-outline block">Stay Period:</span>
                      <span className="font-semibold text-on-surface">Oct 24 – Oct 27 (3 Nights)</span>
                    </div>
                    <div className="rounded-lg bg-surface-container-low p-2 border border-outline-variant/40">
                      <span className="text-outline block">Allocated Room:</span>
                      <span className="font-semibold text-primary">Deluxe Kanchenjunga</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-outline-variant/40 text-[11px]">
                    <span className="text-outline">WhatsApp Direct Contact:</span>
                    {supportNum ? (
                      <a
                        href={`https://wa.me/${supportNum}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-primary flex items-center gap-1 hover:underline"
                      >
                        <Phone className="h-3 w-3 text-emerald-600" />
                        <span>{siteConfig.supportPhone}</span>
                      </a>
                    ) : (
                      <span className="font-bold text-primary flex items-center gap-1">
                        <Phone className="h-3 w-3 text-emerald-600" />
                        <span>Direct chat in app</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-surface-container-low p-3 text-[11px] text-on-surface-variant border border-outline-variant/50 flex items-center justify-between">
                  <span>Guest Preference Note:</span>
                  <span className="text-on-surface font-medium text-xs">Non-spicy hill breakfast</span>
                </div>
              </div>
            )}

            {/* View 3: Cabs & Transit Radar Console */}
            {activeChapter === "cabs" && (
              <div className="space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface">Live Mountain Transit Dispatch</span>
                  <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-primary">
                    100% Cash to Driver
                  </span>
                </div>

                <div className="rounded-2xl border border-primary/30 bg-primary-fixed/40 p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-primary">TRIP #STAY-9428</span>
                    <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      Driver Assigned
                    </span>
                  </div>

                  <p className="font-bold text-on-surface text-xs">
                    Bagdogra Airport (IXB) ➔ Pine View Retreat (Kalimpong)
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                    <div className="rounded-lg bg-surface-container-lowest p-2 border border-outline-variant/40">
                      <span className="text-outline block">Assigned Hill Driver:</span>
                      <span className="font-bold text-on-surface">Tenzing Bhutia (10+ Yrs)</span>
                    </div>
                    <div className="rounded-lg bg-surface-container-lowest p-2 border border-outline-variant/40">
                      <span className="text-outline block">Mountain Vehicle:</span>
                      <span className="font-bold text-primary">Innova Crysta 4WD</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-primary/20 text-[10px]">
                    <span className="text-outline">Direct Cash Fare:</span>
                    <strong className="text-emerald-700 font-bold text-xs">₹3,200 (100% Cash)</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href="/cab-request"
                    className="liquid-btn flex-1 inline-flex h-9.5 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-semibold text-on-primary shadow-sm hover:bg-primary-container"
                  >
                    <span>Open Cab Desk</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href="/join-driver"
                    className="liquid-btn inline-flex h-9.5 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-4 text-xs font-semibold text-on-surface hover:border-primary/40"
                  >
                    Driver Join
                  </Link>
                </div>
              </div>
            )}

            {/* Bottom Status Bar */}
            <div className="flex items-center justify-between text-[11px] text-outline pt-2 border-t border-outline-variant/40">
              <span>Platform Access: <strong>₹0 Free Forever</strong></span>
              <a href="#launchpad" className="text-primary font-semibold hover:underline">
                Start Managing Free ➔
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

