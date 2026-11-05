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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const isUnion = driverCategory === "UNION";
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const cleanPlate = isUnion ? "UNION-FLEET" : vehicleNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const effectiveUnion = isUnion ? unionNameInput.trim() : "";

    if (isUnion && !effectiveUnion) {
      setError("Please enter your Taxi Union / Syndicate name.");
      return;
    }
    if (name.trim().length < 2) {
      setError(isUnion ? "Please enter contact person name." : "Please enter your full name as shown on your Driving License.");
      return;
    }
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit WhatsApp mobile number.");
      return;
    }
    if (!isUnion && cleanPlate.length < 5) {
      setError("Please enter a valid vehicle number plate (e.g. WB74AB1234).");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the driver terms and conditions to proceed.");
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
    <main className="min-h-screen bg-[#F7FAF7] py-8 sm:py-12 px-4 sm:px-6 font-sans text-[#181C1B]">
      <div className="mx-auto max-w-xl">
        {/* Brand Header */}
        <div className="mb-6 flex items-center justify-between">
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
            <span>Driver Onboarding</span>
          </span>
        </div>

        {/* Hero Card */}
        <div className="rounded-3xl border border-[#E5E8E5] bg-white p-6 sm:p-8 shadow-[0_10px_35px_-4px_rgba(20,66,45,0.05)] mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#14422D]">
            Drive with {siteConfig.appName}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#717973] leading-relaxed">
            Get door-to-door hill trip requests from verified homestays across Darjeeling, Kalimpong, Kurseong, Siliguri, and Sikkim. Direct in-hand cash from passengers, WhatsApp trip broadcasts, no heavy app required.
          </p>

          {/* 3 Core Trust Pillars */}
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E5E8E5] bg-[#F7FAF7] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#14422D]">
                <Icon name="payments" className="text-base text-[#14422D]" />
                <span>100% Cash In-Hand</span>
              </div>
              <p className="mt-1 text-[11px] text-[#717973] leading-tight">
                Passenger pays your full cash fare at destination. No payout waiting.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E5E8E5] bg-[#F7FAF7] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#14422D]">
                <Icon name="chat" className="text-base text-[#14422D]" />
                <span>WhatsApp Quotes</span>
              </div>
              <p className="mt-1 text-[11px] text-[#717973] leading-tight">
                Receive trip alerts and quote your price in 2 taps via WhatsApp.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E5E8E5] bg-[#F7FAF7] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#14422D]">
                <Icon name="verified_user" className="text-base text-[#14422D]" />
                <span>Zero Monthly Fee</span>
              </div>
              <p className="mt-1 text-[11px] text-[#717973] leading-tight">
                Free registration. No subscription or hidden commission deductions.
              </p>
            </div>
          </div>
        </div>

        {/* Success View */}
        {success ? (
          <div className="rounded-3xl border border-[#14422D]/20 bg-[#14422D]/5 p-6 sm:p-8 text-center space-y-5 shadow-[0_10px_35px_-4px_rgba(20,66,45,0.05)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14422D] text-white shadow-md">
              <Icon name="check_circle" className="text-3xl" />
            </div>

            <div>
              <h2 className="text-xl font-bold font-display text-[#14422D]">Registration Submitted</h2>
              <p className="mt-1 text-xs text-[#717973] leading-relaxed">
                {success.message}
              </p>
            </div>

            <div className="rounded-2xl border border-[#E5E8E5] bg-white p-5 text-left text-xs space-y-2.5 shadow-2xs">
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

            <div className="rounded-2xl bg-white border border-[#14422D]/15 p-4 text-xs text-[#14422D] text-left space-y-1.5 shadow-2xs">
              <p className="font-bold text-xs">Next Steps:</p>
              <p className="text-[11px] text-[#414943] leading-relaxed">
                1. Our team verifies your vehicle registration.
                <br />
                2. You will receive an automated WhatsApp confirmation message.
                <br />
                3. Trip requests from homestays in {success.driver.area} will arrive on WhatsApp with a 1-tap quote link.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#14422D] px-6 py-3.5 text-xs font-bold text-white hover:bg-[#0B2519] shadow-[0_8px_20px_-4px_rgba(20,66,45,0.25)] transition-all"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          /* Registration Form */
          <form onSubmit={handleSubmit} className="rounded-3xl border border-[#E5E8E5] bg-white p-6 sm:p-8 shadow-[0_10px_35px_-4px_rgba(20,66,45,0.05)] space-y-5">
            <div className="border-b border-[#ECEFEB] pb-3">
              <h2 className="text-lg font-bold font-display text-[#14422D]">
                Driver &amp; Vehicle Registration
              </h2>
              <p className="text-xs text-[#717973] mt-0.5">Please provide accurate details to receive homestay trips</p>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-semibold">
                {error}
              </div>
            )}

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
                Trip broadcast links and passenger details are sent to this WhatsApp number.
              </span>
            </div>

            {/* Base Operating Town */}
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

            {/* Driver Category: Individual vs Taxi Union */}
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
                  <span className="text-[10px] text-[#717973] mt-0.5 block">Own taxi / single car</span>
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
                  <span className="block text-xs font-bold text-[#181C1B]">Taxi Union</span>
                  <span className="text-[10px] text-[#717973] mt-0.5 block">Syndicate / Stand fleet</span>
                </button>
              </div>

              {driverCategory === "UNION" && (
                <div className="mt-3 space-y-2 rounded-2xl bg-[#F7FAF7] border border-[#D8DBD7] p-4">
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
                    As a taxi union / syndicate fleet owner, your affiliated drivers can take bookings across your stand without single-vehicle registration.
                  </p>
                </div>
              )}
            </div>

            {/* Individual Driver Vehicle Details - hidden for Union Fleet */}
            {driverCategory === "INDIVIDUAL" && (
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
                          className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
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
                      Registration Number Plate *
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
                <span className="leading-tight">
                  I agree to operate under {siteConfig.appName} hill safety guidelines, collect only agreed cash fares, and provide clean, punctual service to homestay guests.
                </span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-[#14422D] py-4 text-sm font-bold text-white shadow-[0_8px_20px_-4px_rgba(20,66,45,0.25)] hover:bg-[#0B2519] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
            >
              {busy ? "Registering Vehicle…" : "Submit Driver Registration"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
