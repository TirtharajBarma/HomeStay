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

const VEHICLE_TIERS = [
  { value: "SUV", label: "SUV / Mountain MUV", seats: 6, desc: "Bolero, Scorpio, Xylo", icon: "directions_car" },
  { value: "7-seater", label: "7-Seater Premium", seats: 7, desc: "Innova, Crysta, Carens", icon: "airport_shuttle" },
  { value: "Sedan", label: "Sedan / Hatchback", seats: 4, desc: "Dzire, Etios, WagonR", icon: "local_taxi" },
  { value: "9-seater", label: "9-Seater Maxi", seats: 9, desc: "Sumo, Trax, Cruiser", icon: "commute" },
];

export default function JoinDriverPage() {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Driver Profile
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("Darjeeling");
  const [driverCategory, setDriverCategory] = useState<"INDIVIDUAL" | "UNION">("INDIVIDUAL");
  const [unionNameInput, setUnionNameInput] = useState("");

  // Step 2: Vehicle & Credentials
  const [vehicleType, setVehicleType] = useState("SUV");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [drivingLicense, setDrivingLicense] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    message: string;
    driver: { name: string; phone: string; vehicleType: string; plate: string; area: string; driverCategory?: string; unionName?: string };
  } | null>(null);

  const validateStep1 = () => {
    setError("");
    const isUnion = driverCategory === "UNION";
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const effectiveUnion = isUnion ? unionNameInput.trim() : "";

    if (name.trim().length < 2) {
      setError(isUnion ? "Please enter contact person name." : "Please enter your full name as shown on your Driving License.");
      return false;
    }
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit WhatsApp mobile number.");
      return false;
    }
    if (isUnion && !effectiveUnion) {
      setError("Please enter your Taxi Union / Syndicate name.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateStep1()) {
      setStep(1);
      return;
    }

    const isUnion = driverCategory === "UNION";
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const cleanPlate = isUnion ? "UNION-FLEET" : vehicleNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const effectiveUnion = isUnion ? unionNameInput.trim() : "";

    if (!isUnion && cleanPlate.length < 5) {
      setError("Please enter a valid vehicle number plate (e.g. WB 74 AB 1234).");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the driver safety & service terms to proceed.");
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
          message: res.message || "Driver registration submitted successfully!",
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
    <main className="min-h-screen bg-[#F7FAF7] py-6 sm:py-10 px-4 sm:px-6 font-sans text-[#181C1B] antialiased">
      <div className="mx-auto max-w-6xl">
        {/* Top Header Bar */}
        <header className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-xs font-bold text-[#14422D] hover:text-[#0B2519] bg-white border border-[#D8DBD7] px-3.5 py-2 rounded-2xl shadow-2xs hover:shadow-xs active:scale-95 transition-all"
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
            <span>Back to {siteConfig.appName}</span>
          </Link>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#14422D]/8 border border-[#14422D]/15 px-3 py-1 text-xs font-bold text-[#14422D]">
            <span className="h-2 w-2 rounded-full bg-[#14422D] animate-pulse" />
            <span>Driver Onboarding · Zero Daily Recharges</span>
          </span>
        </header>

        {/* Success View */}
        {success ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-[#14422D]/20 bg-white p-6 sm:p-8 text-center space-y-6 shadow-[0_12px_40px_-6px_rgba(20,66,45,0.06)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#14422D] text-white shadow-md">
              <Icon name="check_circle" className="text-3xl" />
            </div>

            <div>
              <h2 className="text-2xl font-bold font-display text-[#14422D]">Registration Submitted</h2>
              <p className="mt-1 text-xs text-[#717973] leading-relaxed">
                {success.message}
              </p>
            </div>

            <div className="rounded-2xl border border-[#E5E8E5] bg-[#F7FAF7] p-5 text-left text-xs space-y-2.5 shadow-2xs">
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
                  {success.driver.driverCategory === "UNION" ? `Taxi Union (${success.driver.unionName})` : "Independent Driver"}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#717973]">Operating Base:</span>
                <strong className="font-bold text-[#181C1B]">{success.driver.area}</strong>
              </div>
            </div>

            <div className="rounded-2xl bg-[#14422D]/5 border border-[#14422D]/15 p-4 text-xs text-[#14422D] text-left space-y-1.5 shadow-2xs">
              <p className="font-bold text-xs flex items-center gap-1.5">
                <Icon name="info" className="text-sm text-[#14422D]" />
                <span>What Happens Next:</span>
              </p>
              <p className="text-[11px] text-[#414943] leading-relaxed">
                1. Our operations team verifies your details.
                <br />
                2. You will receive an automated WhatsApp confirmation message.
                <br />
                3. Trip requests from homestays in {success.driver.area} will arrive directly on your WhatsApp with 1-tap quote links.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#14422D] px-6 py-3.5 text-xs font-bold text-white hover:bg-[#0B2519] shadow-[0_8px_20px_-4px_rgba(20,66,45,0.25)] transition-all cursor-pointer"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          /* Split 2-Column Responsive Layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* LEFT COLUMN: Value Proposition, WhatsApp Alert Mockup & Honest Pillars (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Headline */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#14422D] bg-[#14422D]/8 px-3 py-1 rounded-full border border-[#14422D]/15 inline-block">
                  Verified Mountain Cab Network
                </span>
                <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#14422D] leading-[1.15]">
                  Direct Homestay Trips. Your Fare. 100% Cash In-Hand.
                </h1>
                <p className="text-sm text-[#717973] leading-relaxed max-w-xl">
                  Connect directly with verified tourists staying at partner homestays in Darjeeling, Kalimpong, Kurseong, Siliguri, and Sikkim. Quote your own rate, get accepted, and collect cash directly from the guest.
                </p>
              </div>

              {/* Realistic WhatsApp Ride Request Mockup */}
              <div className="rounded-3xl border border-[#14422D]/20 bg-white p-5 sm:p-6 shadow-[0_8px_30px_-4px_rgba(20,66,45,0.06)] space-y-3.5">
                <div className="flex items-center justify-between border-b border-[#ECEFEB] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      💬
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#181C1B]">StayRide Trip Broadcast</p>
                      <p className="text-[10px] text-[#717973]">Instant WhatsApp Alert · Sample Request</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 text-[#14422D] border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                    Direct Quote
                  </span>
                </div>

                {/* WhatsApp Chat Bubble */}
                <div className="rounded-2xl bg-[#E7F8ED] border border-[#BCEECF] p-4 text-xs space-y-2 text-[#181C1B]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-[#14422D] uppercase tracking-wide">
                      🏔️ New Homestay Trip Available
                    </span>
                    <span className="text-[10px] text-[#717973]">Just now</span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <p>
                      <strong className="text-[#14422D]">Pickup:</strong> Cedar Inn Homestay, Jalapahar, Darjeeling
                    </p>
                    <p>
                      <strong className="text-[#14422D]">Destination:</strong> Bagdogra Airport (IXB)
                    </p>
                    <p>
                      <strong className="text-[#14422D]">Schedule:</strong> Tomorrow at 07:30 AM (4 Passengers)
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#BCEECF] flex items-center justify-between">
                    <span className="text-[11px] text-[#717973] font-medium">Guest awaiting your fare</span>
                    <span className="inline-flex items-center gap-1 rounded-xl bg-[#14422D] text-white px-3 py-1 text-[11px] font-bold">
                      <span>Quote Your Rate</span>
                      <Icon name="arrow_forward" className="text-[10px]" />
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[#717973] italic">
                  💡 No battery-draining GPS tracking app running all day. Ride requests arrive directly on your phone via WhatsApp.
                </p>
              </div>

              {/* 4 Truthful Operational Pillars (No fake claims) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="rounded-2xl border border-[#E5E8E5] bg-white p-4 space-y-1 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#14422D]">
                    <Icon name="tune" className="text-base text-[#14422D]" />
                    <span>You Set The Fare</span>
                  </div>
                  <p className="text-[11px] text-[#717973] leading-relaxed">
                    You know hill road conditions, ghat timing, and weather. Submit your price directly for each trip.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E5E8E5] bg-white p-4 space-y-1 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#14422D]">
                    <Icon name="payments" className="text-base text-[#14422D]" />
                    <span>100% Cash At Destination</span>
                  </div>
                  <p className="text-[11px] text-[#717973] leading-relaxed">
                    Passenger pays you full agreed cash upon reaching their drop. Zero 7-day payout waiting.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E5E8E5] bg-white p-4 space-y-1 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#14422D]">
                    <Icon name="block" className="text-base text-[#14422D]" />
                    <span>Zero Daily Recharges</span>
                  </div>
                  <p className="text-[11px] text-[#717973] leading-relaxed">
                    No compulsory daily app balance recharge or subscription deductions to keep receiving ride alerts.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E5E8E5] bg-white p-4 space-y-1 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#14422D]">
                    <Icon name="groups" className="text-base text-[#14422D]" />
                    <span>Taxi Stand Friendly</span>
                  </div>
                  <p className="text-[11px] text-[#717973] leading-relaxed">
                    Individual taxi owners and Syndicate / Stand fleets (Clubside, Motor Syndicate, SNT) can both register.
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Progressive 2-Step Onboarding Form (5 Cols) */}
            <div className="lg:col-span-5">
              <div className="sticky top-6 rounded-3xl border border-[#E5E8E5] bg-white p-6 sm:p-7 shadow-[0_12px_40px_-6px_rgba(20,66,45,0.06)] space-y-5">
                {/* Stepper Progress Pill */}
                <div className="flex items-center justify-between border-b border-[#ECEFEB] pb-4">
                  {step === 2 ? (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="group inline-flex items-center gap-1.5 text-xs font-bold text-[#717973] hover:text-[#14422D] transition-colors cursor-pointer"
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
                      <span>Back to Profile</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#14422D] text-white flex items-center justify-center font-bold text-xs">
                        1
                      </div>
                      <span className="font-bold text-xs text-[#14422D]">Step 1 of 2: Driver Info</span>
                    </div>
                  )}

                  <span className="rounded-full bg-[#14422D]/8 border border-[#14422D]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#14422D]">
                    {step === 1 ? "Driver Profile" : "Step 2: Vehicle"}
                  </span>
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-semibold">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* STEP 1: DRIVER PROFILE */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="font-display text-lg font-bold text-[#14422D]">Your Contact Details</h2>
                        <p className="text-xs text-[#717973]">Takes only 30 seconds · No payment required</p>
                      </div>

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
                          placeholder="e.g. Ramesh Subba"
                          className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-xs font-semibold text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none bg-white shadow-2xs transition-all"
                        />
                      </div>

                      {/* WhatsApp Phone */}
                      <div>
                        <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                          WhatsApp Mobile Number *
                        </label>
                        <div className="flex gap-2">
                          <span className="flex items-center rounded-2xl bg-[#F7FAF7] border border-[#D8DBD7] px-3.5 text-xs font-bold text-[#414943]">
                            +91
                          </span>
                          <input
                            type="tel"
                            required
                            inputMode="numeric"
                            maxLength={10}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                            placeholder="10-digit mobile number"
                            className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-xs font-semibold text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none bg-white shadow-2xs transition-all"
                          />
                        </div>
                        <span className="mt-1.5 block text-[11px] text-[#717973]">
                          Homestay ride requests will arrive on this WhatsApp number.
                        </span>
                      </div>

                      {/* Operating Base Town */}
                      <div>
                        <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                          Operating Base Town *
                        </label>
                        <select
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                          className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-xs font-semibold text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none bg-white shadow-2xs transition-all"
                        >
                          {BASE_TOWNS.map((town) => (
                            <option key={town} value={town}>
                              {town}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Driver Affiliation */}
                      <div>
                        <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                          Driver Affiliation *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setDriverCategory("INDIVIDUAL")}
                            className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                              driverCategory === "INDIVIDUAL"
                                ? "border-[#14422D] bg-[#14422D]/5 shadow-xs ring-1 ring-[#14422D]"
                                : "border-[#D8DBD7] bg-white hover:bg-[#F7FAF7]"
                            }`}
                          >
                            <span className="block text-xs font-bold text-[#181C1B]">Independent</span>
                            <span className="text-[10px] text-[#717973] mt-0.5 block">Own single taxi</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDriverCategory("UNION")}
                            className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                              driverCategory === "UNION"
                                ? "border-[#14422D] bg-[#14422D]/5 shadow-xs ring-1 ring-[#14422D]"
                                : "border-[#D8DBD7] bg-white hover:bg-[#F7FAF7]"
                            }`}
                          >
                            <span className="block text-xs font-bold text-[#181C1B]">Taxi Stand / Union</span>
                            <span className="text-[10px] text-[#717973] mt-0.5 block">Syndicate fleet</span>
                          </button>
                        </div>

                        {driverCategory === "UNION" && (
                          <div className="mt-3 space-y-2 rounded-2xl bg-[#F7FAF7] border border-[#D8DBD7] p-3.5">
                            <label className="text-[11px] font-bold text-[#181C1B] block">
                              Taxi Union or Syndicate Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={unionNameInput}
                              onChange={(e) => setUnionNameInput(e.target.value)}
                              placeholder="e.g. Darjeeling Motor Syndicate / Clubside Stand"
                              className="w-full rounded-xl border border-[#D8DBD7] px-3.5 py-2.5 text-xs font-semibold text-[#181C1B] bg-white focus:border-[#14422D] focus:outline-none"
                            />
                            <p className="text-[10px] text-[#717973]">
                              Fleet coverage: Stand drivers can take bookings across your stand without single-vehicle registration.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Step 1 Next Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (validateStep1()) {
                            setStep(2);
                          }
                        }}
                        className="w-full rounded-2xl bg-[#14422D] py-3.5 text-xs font-bold text-white shadow-[0_8px_20px_-4px_rgba(20,66,45,0.25)] hover:bg-[#0B2519] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Continue to Vehicle Details</span>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* STEP 2: VEHICLE & VERIFICATION */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="font-display text-lg font-bold text-[#14422D]">Vehicle &amp; Verification</h2>
                        <p className="text-xs text-[#717973]">Enter vehicle specs to match appropriate guest groups</p>
                      </div>

                      {driverCategory === "INDIVIDUAL" ? (
                        <>
                          {/* Vehicle Tier Selection */}
                          <div>
                            <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                              Vehicle Class *
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {VEHICLE_TIERS.map((tier) => {
                                const selected = vehicleType === tier.value;
                                return (
                                  <button
                                    key={tier.value}
                                    type="button"
                                    onClick={() => setVehicleType(tier.value)}
                                    className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                                      selected
                                        ? "border-[#14422D] bg-[#14422D]/5 shadow-xs ring-1 ring-[#14422D]"
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

                          {/* Vehicle Plate & Model */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                                Registration Plate *
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                                placeholder="e.g. WB 74 AB 1234"
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
                                placeholder="e.g. Bolero 4WD, Innova"
                                className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-xs font-semibold text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none bg-white shadow-2xs transition-all"
                              />
                            </div>
                          </div>

                          {/* Driving License Number */}
                          <div>
                            <label className="text-xs font-bold text-[#181C1B] block mb-1.5">
                              Driving License Number (DL) *
                            </label>
                            <input
                              type="text"
                              required
                              value={drivingLicense}
                              onChange={(e) => setDrivingLicense(e.target.value.toUpperCase())}
                              placeholder="e.g. WB74 20180001234 or SK01 20200005678"
                              className="w-full rounded-2xl border border-[#D8DBD7] px-4 py-3 text-xs font-bold font-mono text-[#181C1B] focus:border-[#14422D] focus:ring-4 focus:ring-[#14422D]/10 focus:outline-none bg-white shadow-2xs transition-all uppercase tracking-wider"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-[#14422D]/20 bg-[#14422D]/5 p-4 space-y-2 text-xs text-[#14422D]">
                          <p className="font-bold">Stand Fleet Profile</p>
                          <p className="text-[11px] text-[#414943] leading-relaxed">
                            Your taxi syndicate ({unionNameInput || "Registered Stand"}) will be verified as an approved fleet. Drivers at your stand can accept trips under your union umbrella.
                          </p>
                        </div>
                      )}

                      {/* Terms Consent */}
                      <div className="pt-2">
                        <label className="flex items-start gap-2.5 text-xs text-[#717973] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="mt-0.5 rounded border-[#D8DBD7] text-[#14422D] focus:ring-[#14422D] cursor-pointer h-4 w-4"
                          />
                          <span className="leading-tight text-[11px]">
                            I agree to operate under {siteConfig.appName} hill safety guidelines, collect only agreed cash fares, and provide clean, punctual service to homestay guests.
                          </span>
                        </label>
                      </div>

                      {/* Navigation Buttons */}
                      <div className="flex gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="w-1/3 rounded-2xl border border-[#D8DBD7] bg-white py-3.5 text-xs font-bold text-[#181C1B] hover:bg-[#F1F4F1] cursor-pointer transition-colors"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={busy || !acceptedTerms}
                          className="w-2/3 rounded-2xl bg-[#14422D] py-3.5 text-xs font-bold text-white shadow-[0_8px_20px_-4px_rgba(20,66,45,0.25)] hover:bg-[#0B2519] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                        >
                          {busy ? "Submitting Registration…" : "Complete Driver Registration"}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
