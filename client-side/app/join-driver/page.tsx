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
  { value: "SUV", label: "Mountain SUV", seats: 6, desc: "Bolero, Scorpio, Xylo", icon: "directions_car" },
  { value: "7-seater", label: "7-seater premium", seats: 7, desc: "Innova, Crysta, Carens", icon: "airport_shuttle" },
  { value: "Sedan", label: "Sedan / hatchback", seats: 4, desc: "Dzire, Etios, WagonR", icon: "local_taxi" },
  { value: "9-seater", label: "9-seater maxi", seats: 9, desc: "Sumo, Trax, Cruiser", icon: "commute" },
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
      setError(isUnion ? "Please enter contact person name." : "Please enter your full name as shown on your driving license.");
      return false;
    }
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit WhatsApp mobile number.");
      return false;
    }
    if (isUnion && !effectiveUnion) {
      setError("Please enter your taxi union or syndicate name.");
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
      setError("Please enter a valid vehicle registration plate (e.g. WB 74 AB 1234).");
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
          message: res.message || "Driver registration submitted successfully.",
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
    <main className="min-h-screen bg-surface pt-8 pb-16 sm:pt-12 sm:pb-20 px-4 sm:px-6 font-body text-on-surface antialiased">
      <div className="mx-auto max-w-6xl">
        {/* Top Header Bar */}
        <header className="mb-6 sm:mb-10 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-label-sm font-medium text-primary hover:text-primary-container bg-surface-container-lowest border border-outline-variant px-3.5 py-2 sm:px-4 sm:py-2 rounded-full shadow-ambient transition-colors"
          >
            <svg
              className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>Back</span>
          </Link>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-label-sm font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="hidden xs:inline">Driver onboarding · </span>Zero daily fee
          </span>
        </header>

        {/* Success View */}
        {success ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-outline-variant/80 bg-surface-container-lowest p-6 sm:p-8 text-center space-y-6 shadow-ambient">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-sm">
              <Icon name="check_circle" className="text-3xl" />
            </div>

            <div>
              <h2 className="text-headline-md font-medium font-display text-primary">Registration submitted</h2>
              <p className="mt-1 text-body-sm text-on-surface-variant leading-relaxed">
                {success.message}
              </p>
            </div>

            <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-5 text-left text-body-sm space-y-2.5">
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant">Driver name:</span>
                <strong className="font-medium text-on-surface">{success.driver.name}</strong>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant">WhatsApp number:</span>
                <strong className="font-medium text-on-surface tabular-nums">+91 {success.driver.phone}</strong>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant">Vehicle plate:</span>
                <strong className="font-medium font-mono text-on-surface">{success.driver.plate}</strong>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant">Vehicle class:</span>
                <strong className="font-medium text-on-surface">{success.driver.vehicleType}</strong>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant">Affiliation:</span>
                <strong className="font-medium text-on-surface">
                  {success.driver.driverCategory === "UNION" ? `Taxi Union (${success.driver.unionName})` : "Independent driver"}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Operating base:</span>
                <strong className="font-medium text-on-surface">{success.driver.area}</strong>
              </div>
            </div>

            <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 text-body-sm text-primary text-left space-y-1.5">
              <p className="font-medium text-label-md flex items-center gap-1.5">
                <Icon name="info" className="text-sm text-primary" />
                <span>What happens next</span>
              </p>
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                1. Operations verifies your credentials.
                <br />
                2. You receive an automated WhatsApp confirmation message.
                <br />
                3. Trip requests from homestays in {success.driver.area} arrive on your WhatsApp with direct quote links.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-label-md font-medium text-on-primary hover:bg-primary-container transition-colors cursor-pointer"
            >
              Back to home
            </Link>
          </div>
        ) : (
          /* Split 2-Column Responsive Layout: Vertically balanced on desktop, Form FIRST on mobile */
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 lg:gap-14 lg:items-center">
            {/* Mobile-only Intro Header */}
            <div className="lg:hidden space-y-2 mb-3 pt-1">
              <span className="text-label-sm font-medium text-outline">
                Verified mountain cab network
              </span>
              <h1 className="font-display text-2xl font-medium tracking-tight text-primary leading-tight">
                Direct homestay trips · Fixed cash fares
              </h1>
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Connect directly with tourists staying at partner homestays in Darjeeling, Kalimpong, Kurseong, Siliguri, and Sikkim.
              </p>
            </div>

            {/* LEFT COLUMN: Value Proposition, WhatsApp Alert Mockup & Honest Pillars */}
            <div className="order-2 lg:order-1 lg:col-span-7 space-y-6">
              {/* Desktop Headline */}
              <div className="hidden lg:block space-y-2">
                <span className="text-label-sm font-medium text-outline">
                  Verified mountain cab network
                </span>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-[38px] font-medium tracking-tight text-primary leading-[1.2]">
                  <span>Direct homestay trips.</span>
                  <span className="block mt-1 text-primary">Your fare, cash in hand.</span>
                </h1>
                <p className="text-body-md text-on-surface-variant leading-relaxed max-w-xl">
                  Connect directly with verified tourists staying at partner homestays in Darjeeling, Kalimpong, Kurseong, Siliguri, and Sikkim. Quote your rate and collect cash directly from the guest.
                </p>
              </div>

              {/* Realistic WhatsApp Ride Request Mockup */}
              <div className="hidden lg:block rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 sm:p-6 shadow-ambient space-y-3.5">
                <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-medium text-sm shadow-sm">
                      <Icon name="chat" className="text-base" />
                    </div>
                    <div>
                      <p className="text-label-md font-medium text-primary">StayRide trip broadcast</p>
                      <p className="text-label-sm text-outline">Instant WhatsApp alert · Sample request</p>
                    </div>
                  </div>
                  <span className="rounded-md bg-surface-container px-2 py-0.5 text-label-sm text-primary">
                    Direct quote
                  </span>
                </div>

                {/* WhatsApp Chat Bubble */}
                <div className="rounded-lg bg-surface-container-low border border-outline-variant/40 p-4 text-body-sm space-y-2.5 text-on-surface">
                  <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
                    <span className="text-label-sm font-medium text-primary">
                      New trip request
                    </span>
                    <span className="text-label-sm text-outline">Just now</span>
                  </div>

                  <div className="space-y-1 text-body-sm">
                    <p>
                      <span className="font-medium">From:</span> Cedar Inn, Darjeeling
                    </p>
                    <p>
                      <span className="font-medium">Route:</span> Cedar Inn → Bagdogra Airport (IXB)
                    </p>
                    <p>
                      <span className="font-medium">Pickup:</span> Tomorrow at 07:30 AM
                    </p>
                    <p>
                      <span className="font-medium">Vehicle:</span> Mountain SUV (4 passengers)
                    </p>
                  </div>

                  <div className="pt-2 border-t border-primary/20 flex items-center justify-between">
                    <span className="text-label-sm text-on-surface-variant font-medium">Guest awaiting your quote</span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-on-primary px-3 py-1.5 text-label-sm font-medium">
                      <span>Submit fare quote</span>
                      <Icon name="arrow_forward" className="text-xs" />
                    </span>
                  </div>
                </div>

                <p className="text-label-sm text-outline">
                  No battery-draining GPS tracking app required. Ride requests arrive directly on your phone via WhatsApp.
                </p>
              </div>

              {/* 4 Truthful Operational Pillars */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
                <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3.5 sm:p-4 space-y-1 shadow-ambient">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-label-md font-medium text-primary">
                    <Icon name="tune" className="text-sm sm:text-base text-primary" />
                    <span className="truncate">You set fare</span>
                  </div>
                  <p className="text-label-sm text-on-surface-variant leading-relaxed line-clamp-2 sm:line-clamp-none">
                    You know hill conditions &amp; road timing. Submit your price directly for each trip.
                  </p>
                </div>

                <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3.5 sm:p-4 space-y-1 shadow-ambient">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-label-md font-medium text-primary">
                    <Icon name="payments" className="text-sm sm:text-base text-primary" />
                    <span className="truncate">100% cash</span>
                  </div>
                  <p className="text-label-sm text-on-surface-variant leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Passenger pays full cash upon reaching drop. Zero 7-day payout waiting.
                  </p>
                </div>

                <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3.5 sm:p-4 space-y-1 shadow-ambient">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-label-md font-medium text-primary">
                    <Icon name="block" className="text-sm sm:text-base text-primary" />
                    <span className="truncate">Zero daily recharges</span>
                  </div>
                  <p className="text-label-sm text-on-surface-variant leading-relaxed line-clamp-2 sm:line-clamp-none">
                    No compulsory daily balance recharge or deductions to keep receiving ride alerts.
                  </p>
                </div>

                <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3.5 sm:p-4 space-y-1 shadow-ambient">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-label-md font-medium text-primary">
                    <Icon name="groups" className="text-sm sm:text-base text-primary" />
                    <span className="truncate">Taxi stand friendly</span>
                  </div>
                  <p className="text-label-sm text-on-surface-variant leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Individual taxi owners and syndicate stand fleets can both register.
                  </p>
                </div>
              </div>
            </div>

            {/* FORM COLUMN: Order 1 on mobile, 5 cols on desktop */}
            <div className="order-1 lg:order-2 lg:col-span-5 w-full lg:self-center lg:mt-4">
              <div className="rounded-2xl border border-outline-variant/80 bg-surface-container-lowest p-5 sm:p-7 shadow-ambient space-y-4 sm:space-y-5">
                {/* Stepper Progress */}
                <div className="flex items-center justify-between border-b border-outline-variant/40 pb-4">
                  {step === 2 ? (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="group inline-flex items-center gap-1.5 text-label-sm font-medium text-outline hover:text-primary transition-colors cursor-pointer"
                    >
                      <svg
                        className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                      </svg>
                      <span>Back to profile</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-medium text-label-sm">
                        1
                      </div>
                      <span className="font-medium text-label-sm text-primary">Step 1 of 2: Driver info</span>
                    </div>
                  )}

                  <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-label-sm font-medium text-primary">
                    {step === 1 ? "Driver profile" : "Step 2: Vehicle"}
                  </span>
                </div>

                {error && (
                  <div className="rounded-xl border border-error/30 bg-error-container/30 p-3.5 text-body-sm text-error font-medium">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* STEP 1: DRIVER PROFILE */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="font-display text-headline-sm font-medium text-primary">Your contact details</h2>
                        <p className="text-body-sm text-on-surface-variant">Takes 30 seconds · No fee required</p>
                      </div>

                      {/* Full Name */}
                      <div>
                        <label className="text-label-sm font-medium text-on-surface block mb-1.5">
                          Full name (as on driving license) *
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Ramesh Subba"
                          className="w-full rounded-xl border border-outline-variant px-4 py-3 text-body-sm text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none bg-surface-container-lowest transition-colors"
                        />
                      </div>

                      {/* WhatsApp Phone */}
                      <div>
                        <label className="text-label-sm font-medium text-on-surface block mb-1.5">
                          WhatsApp mobile number *
                        </label>
                        <div className="flex gap-2">
                          <span className="flex items-center rounded-xl bg-surface-container-low border border-outline-variant px-3.5 text-body-sm font-medium text-on-surface-variant">
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
                            className="w-full rounded-xl border border-outline-variant px-4 py-3 text-body-sm text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none bg-surface-container-lowest transition-colors tabular-nums"
                          />
                        </div>
                        <span className="mt-1.5 block text-label-sm text-outline">
                          Homestay ride requests will arrive on this WhatsApp number.
                        </span>
                      </div>

                      {/* Operating Base Town */}
                      <div>
                        <label className="text-label-sm font-medium text-on-surface block mb-1.5">
                          Operating base town *
                        </label>
                        <select
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                          className="w-full rounded-xl border border-outline-variant px-4 py-3 text-body-sm text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none bg-surface-container-lowest transition-colors cursor-pointer"
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
                        <label className="text-label-sm font-medium text-on-surface block mb-1.5">
                          Driver affiliation *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setDriverCategory("INDIVIDUAL")}
                            className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                              driverCategory === "INDIVIDUAL"
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low"
                            }`}
                          >
                            <span className="block text-label-md font-medium text-on-surface">Independent</span>
                            <span className="text-label-sm text-outline mt-0.5 block">Own single taxi</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDriverCategory("UNION")}
                            className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                              driverCategory === "UNION"
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low"
                            }`}
                          >
                            <span className="block text-label-md font-medium text-on-surface">Taxi stand / union</span>
                            <span className="text-label-sm text-outline mt-0.5 block">Syndicate fleet</span>
                          </button>
                        </div>

                        {driverCategory === "UNION" && (
                          <div className="mt-3 space-y-2 rounded-xl bg-surface-container-low border border-outline-variant p-3.5">
                            <label className="text-label-sm font-medium text-on-surface block">
                              Taxi union or syndicate name *
                            </label>
                            <input
                              type="text"
                              required
                              value={unionNameInput}
                              onChange={(e) => setUnionNameInput(e.target.value)}
                              placeholder="e.g. Darjeeling Motor Syndicate / Clubside Stand"
                              className="w-full rounded-lg border border-outline-variant px-3.5 py-2.5 text-body-sm text-on-surface bg-surface-container-lowest focus:border-primary focus:outline-none"
                            />
                            <p className="text-label-sm text-outline">
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
                        className="w-full rounded-xl bg-primary py-3.5 text-label-md font-medium text-on-primary hover:bg-primary-container active:opacity-90 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Continue to vehicle details</span>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* STEP 2: VEHICLE & VERIFICATION */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="font-display text-headline-sm font-medium text-primary">Vehicle &amp; verification</h2>
                        <p className="text-body-sm text-on-surface-variant">Enter vehicle specs to match appropriate guest groups</p>
                      </div>

                      {driverCategory === "INDIVIDUAL" ? (
                        <>
                          {/* Vehicle Tier Selection */}
                          <div>
                            <label className="text-label-sm font-medium text-on-surface block mb-1.5">
                              Vehicle class *
                            </label>
                            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                              {VEHICLE_TIERS.map((tier) => {
                                const selected = vehicleType === tier.value;
                                return (
                                  <button
                                    key={tier.value}
                                    type="button"
                                    onClick={() => setVehicleType(tier.value)}
                                    className={`text-left p-2.5 sm:p-3.5 rounded-xl border transition-colors cursor-pointer relative ${
                                      selected
                                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                                        : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-0.5 sm:mb-1">
                                      <span className="text-label-sm font-medium text-on-surface truncate">{tier.label}</span>
                                      <span className="shrink-0 whitespace-nowrap text-label-sm font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                                        {tier.seats} seats
                                      </span>
                                    </div>
                                    <p className="text-label-sm text-outline truncate">{tier.desc}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Vehicle Plate & Model */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-label-sm font-medium text-on-surface block mb-1.5">
                                Registration plate *
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                                placeholder="e.g. WB 74 AB 1234"
                                className="w-full rounded-xl border border-outline-variant px-4 py-3 text-body-sm font-mono text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none bg-surface-container-lowest transition-colors uppercase"
                              />
                            </div>

                            <div>
                              <label className="text-label-sm font-medium text-on-surface block mb-1.5">
                                Vehicle model (optional)
                              </label>
                              <input
                                type="text"
                                value={vehicleModel}
                                onChange={(e) => setVehicleModel(e.target.value)}
                                placeholder="e.g. Bolero 4WD, Innova"
                                className="w-full rounded-xl border border-outline-variant px-4 py-3 text-body-sm text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none bg-surface-container-lowest transition-colors"
                              />
                            </div>
                          </div>

                          {/* Driving License Number */}
                          <div>
                            <label className="text-label-sm font-medium text-on-surface block mb-1.5">
                              Driving license number (DL) *
                            </label>
                            <input
                              type="text"
                              required
                              value={drivingLicense}
                              onChange={(e) => setDrivingLicense(e.target.value.toUpperCase())}
                              placeholder="e.g. WB74 20180001234 or SK01 20200005678"
                              className="w-full rounded-xl border border-outline-variant px-4 py-3 text-body-sm font-mono text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none bg-surface-container-lowest transition-colors uppercase"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-body-sm text-primary">
                          <p className="font-medium text-label-md">Stand fleet profile</p>
                          <p className="text-body-sm text-on-surface-variant leading-relaxed">
                            Your taxi syndicate ({unionNameInput || "Registered Stand"}) will be verified as an approved fleet. Drivers at your stand can accept trips under your union umbrella.
                          </p>
                        </div>
                      )}

                      {/* Terms Consent */}
                      <div className="pt-2">
                        <label className="flex items-start gap-2.5 text-label-sm text-on-surface-variant cursor-pointer">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="mt-0.5 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer h-4 w-4"
                          />
                          <span className="leading-tight text-label-sm">
                            I agree to operate under {siteConfig.appName} hill safety guidelines, collect only agreed cash fares, and provide clean, punctual service to homestay guests.
                          </span>
                        </label>
                      </div>

                      {/* Navigation Buttons */}
                      <div className="flex gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="w-1/3 rounded-xl border border-outline-variant bg-surface-container-lowest py-3.5 text-label-md font-medium text-on-surface hover:bg-surface-container-low cursor-pointer transition-colors"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={busy || !acceptedTerms}
                          className="w-2/3 rounded-xl bg-primary py-3.5 text-label-md font-medium text-on-primary hover:bg-primary-container active:opacity-90 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {busy ? "Submitting registration…" : "Complete driver registration"}
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
