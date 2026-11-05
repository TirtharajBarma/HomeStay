"use client";

import React, { useState } from "react";
import Link from "next/link";
import { API_ENDPOINTS, apiFetch } from "@/lib/api-config";
import { siteConfig } from "@/lib/site-config";
import { Icon } from "@/components/icon";
import { getRecaptchaToken } from "@/lib/recaptcha";

const BASE_TOWNS = [
  "Darjeeling",
  "Kalimpong",
  "Kurseong",
  "Siliguri",
  "Gangtok",
  "Mirik",
  "Pelling",
  "Ravangla",
  "Other Sikkim / North Bengal",
];

const MOUNTAIN_UNIONS = [
  "Darjeeling Motor Syndicate",
  "Clubside Taxi Stand",
  "Ghum Taxi Stand",
  "Siliguri Junction Taxi Union",
  "Kalimpong Drivers Association",
  "Kurseong Motor Union",
  "Gangtok Main Stand (SNT)",
  "Other Local Syndicate / Stand",
];

const VEHICLE_TIERS = [
  { value: "Sedan", label: "Sedan", seats: 4, desc: "Dzire, Etios, Amaze" },
  { value: "SUV", label: "SUV (Standard)", seats: 6, desc: "Bolero, Scorpio, Xylo" },
  { value: "7-seater", label: "7-Seater Premium", seats: 7, desc: "Innova, Marazzo, Carens" },
  { value: "9-seater", label: "9-Seater Maxi", seats: 9, desc: "Sumo, Trax, Cruiser" },
];

export default function JoinDriverPage() {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("Darjeeling");
  const [vehicleType, setVehicleType] = useState("SUV");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [drivingLicense, setDrivingLicense] = useState("");
  const [driverCategory, setDriverCategory] = useState<"INDIVIDUAL" | "UNION">("INDIVIDUAL");
  const [unionNameInput, setUnionNameInput] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    message: string;
    driver: { name: string; phone: string; vehicleType: string; plate: string; area: string; driverCategory?: string; unionName?: string };
  } | null>(null);

  const validateStep1 = () => {
    const isUnion = driverCategory === "UNION";
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

    if (name.trim().length < 2) {
      setError(isUnion ? "Please enter contact person name." : "Please enter your full name as shown on your Driving License.");
      return false;
    }
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit WhatsApp mobile number.");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }

    const isUnion = driverCategory === "UNION";
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const cleanPlate = isUnion ? "UNION-FLEET" : vehicleNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const effectiveUnion = isUnion ? unionNameInput.trim() : "";

    if (isUnion && !effectiveUnion) {
      setError("Please select or enter your Taxi Union / Syndicate stand name.");
      return;
    }
    if (!isUnion && cleanPlate.length < 5) {
      setError("Please enter a valid vehicle registration number plate (e.g. WB74AB1234).");
      return;
    }
    if (!isUnion && !drivingLicense.trim()) {
      setError("Please enter your Driving License (DL) number.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the driver terms and hill safety guidelines to proceed.");
      return;
    }

    setBusy(true);
    try {
      interface SignupResponse {
        success: boolean;
        message?: string;
        driver?: { name: string; phone: string; vehicleType: string; plate: string; area: string };
        error?: { message: string };
      }
      const recaptchaToken = await getRecaptchaToken("driver_signup");
      const res = await apiFetch<SignupResponse>(API_ENDPOINTS.driverSignup(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          area,
          vehicleType: isUnion ? "Fleet" : vehicleType,
          vehicleNumber: cleanPlate,
          vehicleModel: isUnion ? effectiveUnion : vehicleModel.trim(),
          drivingLicense: isUnion ? "UNION-FLEET" : drivingLicense.trim(),
          driverCategory,
          unionName: effectiveUnion,
          recaptchaToken,
        }),
      });

      if (res && res.success) {
        setSuccess({
          message: res.message || "Registration submitted successfully!",
          driver: res.driver || {
            name: name.trim(),
            phone: cleanPhone,
            vehicleType,
            plate: cleanPlate,
            area,
            driverCategory,
            unionName: effectiveUnion,
          },
        });
      } else {
        setError(res?.error?.message || "Could not complete registration. Please try again.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error. Please check your connection and retry.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7FAF7] py-6 sm:py-10 px-4 sm:px-6 lg:px-8 font-sans text-[#181C1B]">
      {/* Top Navbar */}
      <header className="mx-auto max-w-6xl mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-xs font-bold text-[#14422D] hover:text-[#0B2519] bg-white border border-[#D8DBD7] px-3.5 py-2 rounded-2xl shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
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
          <span>Back to StayRide</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#14422D]/8 border border-[#14422D]/15 px-3 py-1 text-xs font-bold text-[#14422D]">
            <span className="h-2 w-2 rounded-full bg-[#14422D] animate-pulse" />
            <span>Driver Portal · Zero Commission</span>
          </span>
          <Link
            href="/cab-request"
            className="text-xs font-semibold text-[#717973] hover:text-[#14422D] px-2 py-1 transition-colors"
          >
            Looking for a Cab?
          </Link>
        </div>
      </header>

      {/* Main 2-Column Responsive Layout */}
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Value Proposition & Earnings Showcase */}
          <section className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#14422D]/8 border border-[#14422D]/15 px-3 py-1 text-[11px] font-bold text-[#14422D]">
                🌿 Verified Mountain Fleet Network
              </span>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#14422D] leading-[1.15]">
                Earn more on every hill transfer.
              </h1>
              <p className="text-xs sm:text-sm text-[#717973] leading-relaxed">
                Connect directly with premium homestays across Darjeeling, Kalimpong, Kurseong, Siliguri, and Sikkim. Direct cash in your hand, zero app commissions, and zero battery drain.
              </p>
            </div>

            {/* 3 Core Trust Cards */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-[#E5E8E5] bg-white p-4 shadow-2xs flex items-start gap-3.5 transition-all hover:border-[#14422D]/30">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#14422D]/10 text-[#14422D]">
                  <Icon name="payments" className="text-xl" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#181C1B]">100% Cash In-Hand</h3>
                  <p className="mt-0.5 text-[11px] text-[#717973] leading-relaxed">
                    Collect the full cash fare directly from the guest at destination. No 15-day platform withholding.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E8E5] bg-white p-4 shadow-2xs flex items-start gap-3.5 transition-all hover:border-[#14422D]/30">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#14422D]/10 text-[#14422D]">
                  <Icon name="chat" className="text-xl" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#181C1B]">WhatsApp Dispatch · No Heavy App</h3>
                  <p className="mt-0.5 text-[11px] text-[#717973] leading-relaxed">
                    Trip alerts arrive instantly on WhatsApp with pickup, drop, and pax count. Quote your fare in 2 taps without draining your phone battery.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E8E5] bg-white p-4 shadow-2xs flex items-start gap-3.5 transition-all hover:border-[#14422D]/30">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#14422D]/10 text-[#14422D]">
                  <Icon name="handshake" className="text-xl" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#181C1B]">Union &amp; Syndicate Friendly</h3>
                  <p className="mt-0.5 text-[11px] text-[#717973] leading-relaxed">
                    Full support for Darjeeling Motor Syndicate, Clubside, Ghum, and local stands. Fleet owners can register stands with one verification.
                  </p>
                </div>
              </div>
            </div>

            {/* Popular Hill Route Rates Showcase */}
            <div className="rounded-2xl border border-[#E5E8E5] bg-white p-5 space-y-3 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#717973] block">
                Typical Homestay Transfer Rates
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#ECEFEB]">
                  <span className="font-semibold text-[#181C1B]">Bagdogra Airport ⇄ Darjeeling</span>
                  <span className="font-bold text-[#14422D]">₹2,800 – ₹4,200</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-[#ECEFEB]">
                  <span className="font-semibold text-[#181C1B]">NJP Railway ⇄ Kalimpong / Kurseong</span>
                  <span className="font-bold text-[#14422D]">₹2,500 – ₹3,600</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-[#ECEFEB]">
                  <span className="font-semibold text-[#181C1B]">Tiger Hill Sunrise Excursion</span>
                  <span className="font-bold text-[#14422D]">₹1,800 – ₹2,600</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#181C1B]">Darjeeling ⇄ Gangtok Intercity</span>
                  <span className="font-bold text-[#14422D]">₹3,800 – ₹5,500</span>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Progressive 2-Step Onboarding Form */}
          <section className="lg:col-span-7">
            {success ? (
              <div className="rounded-3xl border border-[#14422D]/20 bg-[#14422D]/5 p-6 sm:p-8 text-center space-y-5 shadow-[0_10px_35px_-4px_rgba(20,66,45,0.05)]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14422D] text-white shadow-md">
                  <Icon name="check_circle" className="text-3xl" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold font-display text-[#14422D]">Registration Submitted!</h2>
                  <p className="mt-1 text-xs text-[#717973] leading-relaxed">
                    {success.message}
                  </p>
                </div>

                {/* Driver Credentials Card */}
                <div className="rounded-2xl border border-[#E5E8E5] bg-white p-5 text-left text-xs space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[#ECEFEB] pb-2">
                    <span className="font-display font-bold text-[#14422D]">Driver Profile</span>
                    <span className="rounded-full bg-[#14422D]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#14422D]">
                      Verification Pending
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#ECEFEB] pb-2">
                    <span className="text-[#717973]">Driver Name:</span>
                    <strong className="font-bold text-[#181C1B]">{success.driver.name}</strong>
                  </div>
                  <div className="flex justify-between border-b border-[#ECEFEB] pb-2">
                    <span className="text-[#717973]">WhatsApp Number:</span>
                    <strong className="font-bold text-[#181C1B]">+91 {success.driver.phone}</strong>
                  </div>
                  <div className="flex justify-between border-b border-[#ECEFEB] pb-2">
                    <span className="text-[#717973]">Vehicle Plate:</span>
                    <strong className="font-bold font-mono text-[#181C1B]">{success.driver.plate}</strong>
                  </div>
                  <div className="flex justify-between border-b border-[#ECEFEB] pb-2">
                    <span className="text-[#717973]">Vehicle Class:</span>
                    <strong className="font-bold text-[#181C1B]">{success.driver.vehicleType}</strong>
                  </div>
                  <div className="flex justify-between border-b border-[#ECEFEB] pb-2">
                    <span className="text-[#717973]">Affiliation:</span>
                    <strong className="font-bold text-[#181C1B]">
                      {success.driver.driverCategory === "UNION" ? `Taxi Stand Fleet (${success.driver.unionName})` : "Independent Driver"}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#717973]">Operating Base:</span>
                    <strong className="font-bold text-[#181C1B]">{success.driver.area}</strong>
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-[#14422D]/15 p-4 text-xs text-[#14422D] text-left space-y-2 shadow-2xs">
                  <p className="font-bold text-xs">What happens next?</p>
                  <p className="text-[11px] text-[#414943] leading-relaxed">
                    1. Our hill operations team confirms your vehicle registration and operating base.
                    <br />
                    2. You will receive an automated WhatsApp confirmation message.
                    <br />
                    3. Door-to-door trip requests from homestays in {success.driver.area} will arrive directly on your WhatsApp with instant 1-tap quote links.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Link
                    href="/"
                    className="flex-1 inline-flex items-center justify-center rounded-2xl bg-white border border-[#D8DBD7] py-3.5 text-xs font-bold text-[#181C1B] hover:bg-[#F1F4F1] transition-all cursor-pointer"
                  >
                    Back to Home
                  </Link>
                  <Link
                    href="/cab-request"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#14422D] py-3.5 text-xs font-bold text-white hover:bg-[#0B2519] shadow-[0_8px_20px_-4px_rgba(20,66,45,0.25)] transition-all cursor-pointer"
                  >
                    <span>View Cab Requests</span>
                    <Icon name="arrow_forward" className="text-sm" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-[#E5E8E5] bg-white p-6 sm:p-8 shadow-[0_10px_35px_-4px_rgba(20,66,45,0.06)] space-y-6">
                {/* Progressive Stepper Header */}
                <div className="space-y-3 border-b border-[#ECEFEB] pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-xl font-bold text-[#14422D]">
                        {currentStep === 1 ? "Step 1: Driver & Contact" : "Step 2: Vehicle & Stand Details"}
                      </h2>
                      <p className="text-xs text-[#717973] mt-0.5">
                        {currentStep === 1
                          ? "Basic personal details to link your WhatsApp dispatch"
                          : "Vehicle specifications and taxi union stand affiliation"}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#14422D]/8 border border-[#14422D]/15 px-3 py-1 text-xs font-bold text-[#14422D]">
                      Step {currentStep} of 2
                    </span>
                  </div>

                  {/* Visual Step Progress Bar */}
                  <div className="h-1.5 w-full bg-[#ECEFEB] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#14422D] transition-all duration-300 rounded-full"
                      style={{ width: currentStep === 1 ? "50%" : "100%" }}
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 font-semibold flex items-center gap-2">
                    <Icon name="error" className="text-base text-red-700 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Form Steps */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* STEP 1: PERSONAL & CONTACT */}
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      {/* Full Name */}
                      <div>
                        <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                          Full Name (as on Driving License) *
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Ramesh Subba or Pemba Sherpa"
                          className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-sm font-semibold text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none bg-white shadow-2xs transition-all placeholder:text-[#717973]/60"
                        />
                      </div>

                      {/* WhatsApp Mobile */}
                      <div>
                        <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                          WhatsApp Mobile Number *
                        </label>
                        <div className="flex gap-2">
                          <span className="flex items-center rounded-2xl bg-[#F7FAF7] border border-[#D8DBD7] px-4 text-xs font-bold text-[#414943]">
                            +91
                          </span>
                          <input
                            type="tel"
                            required
                            inputMode="numeric"
                            maxLength={10}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                            placeholder="10-digit WhatsApp number"
                            className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-sm font-semibold text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none bg-white shadow-2xs transition-all placeholder:text-[#717973]/60"
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-[#717973]">
                          Homestay ride broadcasts and guest pickup details will be sent directly to this WhatsApp number.
                        </p>
                      </div>

                      {/* Operating Base Town */}
                      <div>
                        <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                          Primary Operating Base Town *
                        </label>
                        <div className="relative">
                          <select
                            value={area}
                            onChange={(e) => setArea(e.target.value)}
                            className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-sm font-semibold text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none bg-white shadow-2xs transition-all appearance-none cursor-pointer"
                          >
                            {BASE_TOWNS.map((town) => (
                              <option key={town} value={town}>
                                {town}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-[#717973]">
                            <Icon name="unfold_more" className="text-base" />
                          </div>
                        </div>
                        <p className="mt-1.5 text-[11px] text-[#717973]">
                          You will receive dispatch alerts from homestays in this region and intercity drops.
                        </p>
                      </div>

                      {/* Next Step Button */}
                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (validateStep1()) {
                              setCurrentStep(2);
                            }
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14422D] py-4 text-sm font-bold text-white shadow-[0_8px_20px_-4px_rgba(20,66,45,0.25)] hover:bg-[#0B2519] active:scale-[0.99] transition-all cursor-pointer"
                        >
                          <span>Continue to Vehicle Details</span>
                          <Icon name="arrow_forward" className="text-base" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: VEHICLE & AFFILIATION */}
                  {currentStep === 2 && (
                    <div className="space-y-5">
                      {/* Driver Affiliation Segment */}
                      <div>
                        <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                          Driver Affiliation *
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setDriverCategory("INDIVIDUAL")}
                            className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                              driverCategory === "INDIVIDUAL"
                                ? "border-[#14422D] bg-[#14422D]/5 shadow-xs ring-2 ring-[#14422D]"
                                : "border-[#D8DBD7] bg-white hover:bg-[#F7FAF7]"
                            }`}
                          >
                            <span className="block text-xs font-bold text-[#181C1B]">Independent Driver</span>
                            <span className="text-[10px] text-[#717973] mt-0.5 block leading-tight">
                              Own car / private commercial taxi
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDriverCategory("UNION")}
                            className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                              driverCategory === "UNION"
                                ? "border-[#14422D] bg-[#14422D]/5 shadow-xs ring-2 ring-[#14422D]"
                                : "border-[#D8DBD7] bg-white hover:bg-[#F7FAF7]"
                            }`}
                          >
                            <span className="block text-xs font-bold text-[#181C1B]">Taxi Stand / Union</span>
                            <span className="text-[10px] text-[#717973] mt-0.5 block leading-tight">
                              Syndicate / Stand fleet operator
                            </span>
                          </button>
                        </div>

                        {/* Union Stand Selector */}
                        {driverCategory === "UNION" && (
                          <div className="mt-3.5 space-y-2 rounded-2xl bg-[#F7FAF7] border border-[#D8DBD7] p-4">
                            <label className="text-xs font-bold text-[#181C1B] block">
                              Select or Enter Taxi Union / Stand Name *
                            </label>
                            <div className="space-y-2">
                              <select
                                value={unionNameInput}
                                onChange={(e) => setUnionNameInput(e.target.value)}
                                className="w-full rounded-xl border border-[#D8DBD7] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#181C1B] focus:border-[#14422D] focus:outline-none"
                              >
                                <option value="">-- Choose your local taxi stand --</option>
                                {MOUNTAIN_UNIONS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={unionNameInput}
                                onChange={(e) => setUnionNameInput(e.target.value)}
                                placeholder="Or type custom stand name (e.g. Clubside Stand)"
                                className="w-full rounded-xl border border-[#D8DBD7] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#181C1B] focus:border-[#14422D] focus:outline-none"
                              />
                            </div>
                            <p className="text-[10px] text-[#717973] leading-relaxed">
                              Affiliated taxi stand fleets can distribute homestay requests among stand members with centralized dispatch.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Independent Driver Vehicle Details */}
                      {driverCategory === "INDIVIDUAL" && (
                        <div className="space-y-4">
                          {/* Vehicle Class Grid */}
                          <div>
                            <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                              Vehicle Class &amp; Seating Capacity *
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {VEHICLE_TIERS.map((tier) => {
                                const selected = vehicleType === tier.value;
                                return (
                                  <button
                                    key={tier.value}
                                    type="button"
                                    onClick={() => setVehicleType(tier.value)}
                                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                      selected
                                        ? "border-[#14422D] bg-[#14422D]/5 shadow-xs ring-2 ring-[#14422D]"
                                        : "border-[#D8DBD7] bg-white hover:bg-[#F7FAF7]"
                                    }`}
                                  >
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-[#181C1B]">{tier.label}</span>
                                      <span className="text-[10px] font-bold text-[#14422D] bg-[#14422D]/10 px-2 py-0.5 rounded-full">
                                        {tier.seats} seats
                                      </span>
                                    </div>
                                    <p className="mt-1 text-[10px] text-[#717973]">{tier.desc}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Plate & Vehicle Model */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                                Registration Plate Number *
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                                placeholder="WB 74 AB 1234"
                                className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-xs font-bold font-mono text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none bg-white shadow-2xs transition-all uppercase tracking-wider"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                                Vehicle Model (Optional)
                              </label>
                              <input
                                type="text"
                                value={vehicleModel}
                                onChange={(e) => setVehicleModel(e.target.value)}
                                placeholder="e.g. Bolero 4WD, Innova Crysta"
                                className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-xs font-semibold text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none bg-white shadow-2xs transition-all"
                              />
                            </div>
                          </div>

                          {/* DL Number */}
                          <div>
                            <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                              Driving License Number (DL) *
                            </label>
                            <input
                              type="text"
                              required
                              value={drivingLicense}
                              onChange={(e) => setDrivingLicense(e.target.value.toUpperCase())}
                              placeholder="WB74 20180001234 or SK01 20200005678"
                              className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-xs font-bold font-mono text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none bg-white shadow-2xs transition-all uppercase tracking-wider"
                            />
                          </div>
                        </div>
                      )}

                      {/* Safety & Terms Consent */}
                      <div className="pt-2">
                        <label className="flex items-start gap-2.5 text-xs text-[#717973] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="mt-0.5 rounded border-[#D8DBD7] text-[#14422D] focus:ring-[#14422D] cursor-pointer h-4 w-4"
                          />
                          <span className="leading-tight">
                            I agree to operate under StayRide hill safety guidelines, collect only agreed cash fares, and provide clean, punctual door-to-door service to homestay guests.
                          </span>
                        </label>
                      </div>

                      {/* Step 2 Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="w-1/3 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#D8DBD7] bg-white py-3.5 text-xs font-bold text-[#181C1B] hover:bg-[#F1F4F1] active:scale-[0.98] cursor-pointer transition-all"
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
                          type="submit"
                          disabled={busy || !acceptedTerms}
                          className="w-2/3 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14422D] py-3.5 text-xs font-bold text-white shadow-[0_8px_20px_-4px_rgba(20,66,45,0.25)] hover:bg-[#0B2519] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                        >
                          {busy ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              <span>Registering Vehicle…</span>
                            </span>
                          ) : (
                            <>
                              <Icon name="local_taxi" className="text-base" />
                              <span>Submit Driver Registration</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
