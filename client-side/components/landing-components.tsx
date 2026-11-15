"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "./icon";

// ---------------------------------------------------------------------------
// 1. Interactive Dashboard Mockup for Hero & Product Showcase
// ---------------------------------------------------------------------------
export function DashboardMockup() {
  const [activeTab, setActiveTab] = useState<"rooms" | "guests" | "cabs">("rooms");

  return (
    <div className="relative mx-auto w-full max-w-5xl rounded-2xl border border-primary/20 bg-surface-container-lowest p-3 sm:p-5 shadow-drawer backdrop-blur-md">
      {/* Top window chrome */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <span className="ml-2 rounded-md bg-primary-fixed px-2.5 py-0.5 text-label-sm font-semibold text-primary">
            Pine View Retreat · Kalimpong
          </span>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center rounded-xl bg-surface-container p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("rooms")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === "rooms"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <Icon name="bed" className="text-[16px]" />
            <span>Rooms &amp; Bookings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("guests")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === "guests"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <Icon name="groups" className="text-[16px]" />
            <span>Guest Records</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cabs")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === "cabs"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <Icon name="local_taxi" className="text-[16px]" />
            <span>Cab Requests</span>
            <span className="rounded-full bg-amber-400/90 px-1.5 py-0.2 text-[10px] font-bold text-slate-900">
              3
            </span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-label-sm text-outline">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Sync Active</span>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-3">
          <p className="text-label-sm text-outline">Monthly Occupancy</p>
          <p className="font-display text-headline-sm font-bold text-primary">88.4%</p>
          <p className="text-[11px] text-emerald-600 font-medium">+12% vs last month</p>
        </div>
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-3">
          <p className="text-label-sm text-outline">Active Guests</p>
          <p className="font-display text-headline-sm font-bold text-on-surface">6 Guests</p>
          <p className="text-[11px] text-primary font-medium">3 checked in today</p>
        </div>
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-3">
          <p className="text-label-sm text-outline">Guest Cabs Arranged</p>
          <p className="font-display text-headline-sm font-bold text-primary">14 Trips</p>
          <p className="text-[11px] text-outline font-medium">NJP &amp; Sightseeing</p>
        </div>
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-3">
          <p className="text-label-sm text-outline">Software Cost</p>
          <p className="font-display text-headline-sm font-bold text-emerald-600">₹0</p>
          <p className="text-[11px] text-emerald-700 font-medium">Always Free Forever</p>
        </div>
      </div>

      {/* Tab 1: Rooms & Bookings */}
      {activeTab === "rooms" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-on-surface">Room Availability &amp; Calendar</span>
            <span className="text-label-sm text-outline">Showing 3 Rooms · Nov 2026</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-on-surface">Deluxe Kanchenjunga View</span>
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">Occupied</span>
              </div>
              <p className="text-xs text-outline">Guest: Tushar Sen (2 pax) · 3 nights</p>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-emerald-200/50">
                <span className="text-outline">Check-out: Tomorrow</span>
                <span className="font-bold text-primary">₹3,200 / night</span>
              </div>
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary-fixed/50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-on-surface">Attic Pine Suite</span>
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">Arriving Today</span>
              </div>
              <p className="text-xs text-outline">Guest: Ananya Roy (3 pax) · Bagdogra cab booked</p>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-primary/15">
                <span className="text-outline">ETA: 03:30 PM</span>
                <span className="font-bold text-primary">₹4,000 / night</span>
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-on-surface">Cozy Garden Room</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">Available</span>
              </div>
              <p className="text-xs text-outline">Ready for instant direct reservation</p>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-outline-variant/40">
                <span className="text-emerald-600 font-medium">Clean &amp; Prepared</span>
                <span className="font-bold text-primary">₹2,400 / night</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Guest Records */}
      {activeTab === "guests" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-on-surface">Recent Guest Records &amp; WhatsApp Updates</span>
            <span className="text-label-sm text-outline">Auto-saved to Guest CRM</span>
          </div>

          <div className="divide-y divide-outline-variant/50 rounded-xl border border-outline-variant/60 bg-surface-container-low text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary font-bold text-xs">
                  AR
                </div>
                <div>
                  <p className="font-semibold text-on-surface">Ananya Roy (Kolkata)</p>
                  <p className="text-[11px] text-outline">+91 98310 ••••• · Deluxe Kanchenjunga</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  <Icon name="chat" className="text-[12px]" /> WhatsApp Sent
                </span>
                <span className="text-outline text-[11px]">Check-in Nov 18</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-on-secondary font-bold text-xs">
                  DK
                </div>
                <div>
                  <p className="font-semibold text-on-surface">Deepak Kulkarni (Pune)</p>
                  <p className="text-[11px] text-outline">+91 94220 ••••• · Attic Pine Suite</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-primary-fixed px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <Icon name="local_taxi" className="text-[12px]" /> Cab: NJP ➔ Homestay
                </span>
                <span className="text-outline text-[11px]">Check-in Nov 20</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Cab Requests */}
      {activeTab === "cabs" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-on-surface">Live Driver Bidding &amp; Transit Network</span>
            <span className="text-label-sm text-outline">Connected to 30+ Hill Drivers</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="rounded-xl border border-primary/30 bg-primary-fixed/40 p-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">REQ-792B8</span>
                  <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">Driver Assigned</span>
                </div>
                <p className="text-xs text-on-surface font-medium mt-0.5">Bagdogra Airport (IXB) ➔ Pine View Retreat</p>
                <p className="text-[11px] text-outline">Driver: Tenzing Bhutia · Innova Crysta (WB 74 ••••)</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-sm text-primary">₹3,200</span>
                <p className="text-[10px] text-emerald-700 font-semibold">100% Cash Direct to Driver</p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-400/40 bg-amber-50/50 p-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-900">REQ-841A2</span>
                  <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-900">Receiving Driver Quotes</span>
                </div>
                <p className="text-xs text-on-surface font-medium mt-0.5">Day Sightseeing: Lava, Rishyap &amp; Delo Park</p>
                <p className="text-[11px] text-outline">2 local hill drivers submitted quotes (₹2,400 - ₹2,700)</p>
              </div>
              <div className="text-right">
                <span className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white">
                  Review &amp; Confirm
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer hint */}
      <div className="mt-3 flex items-center justify-between border-t border-outline-variant/40 pt-2.5 text-[11px] text-outline">
        <span>✨ Works seamlessly on phone, tablet, and desktop browser.</span>
        <span className="font-semibold text-primary">Zero commissions on homestay bookings.</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Interactive FAQ Accordion
// ---------------------------------------------------------------------------
const FAQ_ITEMS = [
  {
    q: "Is StayCabs really free for homestay owners?",
    a: "Yes, 100% free. Homestay owners can register, manage unlimited rooms, record guest stays, and request cabs without any subscription fees, setup fees, or hidden charges. We built this platform to empower hill hosts without recurring software costs.",
  },
  {
    q: "How do I register my homestay?",
    a: "Click 'Get Started for Free', enter your homestay name, primary location (e.g., Darjeeling, Kalimpong, or Sikkim), phone number, and number of rooms. Your profile is generated instantly, and you can immediately start adding room inventory.",
  },
  {
    q: "Can I add my own drivers?",
    a: "Absolutely! StayCabs lets you add your own trusted local drivers to your own private fleet. When your guests need a ride, your drivers receive first priority before requests are broadcast to the wider verified hill network.",
  },
  {
    q: "Can my guests book cabs through StayCabs?",
    a: "Yes. You can create cab requests for your guests right from your dashboard, or share your personalized homestay guest link. Guests can request NJP/Bagdogra pickups, local sightseeing, or return drops directly with live driver quotes.",
  },
  {
    q: "Which locations are supported?",
    a: "We are built specifically for the Eastern Himalayas. We actively support homestays and cab transfers across Darjeeling, Kalimpong, Kurseong, Mirik, Gangtok, Pelling, and throughout Sikkim, connecting directly with NJP Station and Bagdogra Airport (IXB).",
  },
  {
    q: "Can I manage multiple rooms?",
    a: "Yes! You can configure as many rooms as your property offers (standard, deluxe, family suites, cottages), set distinct nightly rates, and track room-by-room calendar occupancy with zero conflict.",
  },
  {
    q: "Do I need to install an app?",
    a: "No installation is required. StayCabs is a fast, responsive web application that runs smoothly on any smartphone, iPad, or desktop browser. We also have a lightweight Expo mobile app for hosts who prefer push notifications.",
  },
  {
    q: "How can local drivers join?",
    a: "Local drivers with commercial vehicles (SUV, Sedan, 7-seater, or 9-seater) can visit our 'Join as a Driver' page, submit their name, phone number, vehicle type, and preferred routes, and get verified within 24 hours.",
  },
];

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      {FAQ_ITEMS.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={item.q}
            className={`rounded-2xl border transition-all duration-200 ${
              isOpen
                ? "border-primary/40 bg-surface-container-low shadow-sm"
                : "border-outline-variant/60 bg-surface-container-lowest hover:border-primary/30"
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="flex w-full items-center justify-between gap-4 p-4 sm:p-5 text-left text-sm sm:text-base font-semibold text-on-surface"
              aria-expanded={isOpen}
            >
              <span>{item.q}</span>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform duration-200 ${
                  isOpen ? "rotate-180 bg-primary text-on-primary" : "bg-surface-container text-outline"
                }`}
              >
                <Icon name="expand_more" className="text-[18px]" />
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-outline-variant/30 px-4 pb-5 pt-3 sm:px-5 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Quick Homestay Registration Form / Modal (#register)
// ---------------------------------------------------------------------------
export function QuickRegisterForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("Darjeeling");
  const [rooms, setRooms] = useState("3");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setLoading(true);
    // Simulate instant onboarding success
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 700);
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-6 sm:p-8 text-center space-y-4 shadow-elevated">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
          <Icon name="check" className="text-3xl" />
        </div>
        <div>
          <h3 className="font-display text-xl font-bold text-emerald-950">Welcome to StayCabs!</h3>
          <p className="mt-1 text-sm text-emerald-800">
            Your homestay profile for <strong>{name}</strong> ({location}) is ready. Our local team will connect with you via WhatsApp ({phone}) to complete instant verification.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/cab-request"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-primary-container"
          >
            <span>Explore Cab Request Desk</span>
            <Icon name="arrow_forward" className="text-sm" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      id="register"
      onSubmit={handleSubmit}
      className="rounded-2xl border border-primary/20 bg-surface-container-lowest p-6 sm:p-8 shadow-elevated space-y-4"
    >
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1 text-label-sm font-semibold text-primary">
          <Icon name="bolt" filled className="text-sm" />
          <span>Instant Host Onboarding · ₹0 Setup Fee</span>
        </div>
        <h3 className="font-display text-xl sm:text-2xl font-bold text-on-surface">
          Register your homestay in 30 seconds
        </h3>
        <p className="text-xs sm:text-sm text-on-surface-variant">
          Join 15+ Himalayan homestay owners using StayCabs completely free.
        </p>
      </div>

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
            className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            WhatsApp Contact Number *
          </label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98320 •••••"
            className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Region / Location *
          </label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
            className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
          className="w-full rounded-xl bg-primary py-3 px-6 text-sm font-semibold text-on-primary shadow-md shadow-primary/20 hover:bg-primary-container disabled:opacity-50 transition-all cursor-pointer"
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
// 4. Floating WhatsApp Help Desk Button
// ---------------------------------------------------------------------------
export function FloatingWhatsApp() {
  return (
    <aside aria-label="Support chat" className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
      <a
        href="https://wa.me/919832012345?text=Hello%20StayCabs%2C%20I%20am%20a%20homestay%20owner%20and%20would%20like%20to%20know%20more."
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2.5 rounded-full bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-drawer hover:bg-emerald-500 transition-all hover:scale-105 active:scale-95"
        aria-label="Chat with StayCabs on WhatsApp"
      >
        <Icon name="chat" className="text-lg" />
        <span className="hidden sm:inline">Questions? Chat on WhatsApp</span>
        <span className="sm:hidden">WhatsApp</span>
      </a>
    </aside>
  );
}
