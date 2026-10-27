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
  const [unionName, setUnionName] = useState(MOUNTAIN_UNIONS[0]);
  const [customUnion, setCustomUnion] = useState("");
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

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const cleanPlate = vehicleNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const effectiveUnion = driverCategory === "UNION" ? (unionName === "Other Local Syndicate / Stand" ? customUnion.trim() : unionName) : "";

    if (name.trim().length < 2) {
      setError("Please enter your full name as shown on your Driving License.");
      return;
    }
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit WhatsApp mobile number.");
      return;
    }
    if (cleanPlate.length < 5) {
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
          vehicleType,
          vehicleNumber: cleanPlate,
          vehicleModel: vehicleModel.trim(),
          drivingLicense: drivingLicense.trim(),
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
    <main className="min-h-screen bg-[#F6F8FA] py-8 px-4 sm:px-6 font-sans text-[#1F2328]">
      <div className="mx-auto max-w-xl">
        {/* Brand Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800 hover:text-emerald-900">
            <Icon name="arrow_back" className="text-base" />
            <span>{siteConfig.appName} Mountain Network</span>
          </Link>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
            <Icon name="verified" className="text-xs text-emerald-700" /> Driver Onboarding
          </span>
        </div>

        {/* Hero Card */}
        <div className="rounded-2xl border border-[#D0D7DE] bg-white p-6 shadow-xs sm:p-8 mb-6">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1F2328]">
            Drive with {siteConfig.appName}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-[#57606A] leading-relaxed">
            Get door-to-door hill trip requests from verified homestays in Darjeeling, Kalimpong, Siliguri, and Sikkim. Direct in-hand cash from passengers, WhatsApp trip broadcasts, no heavy app required.
          </p>

          {/* 3 Core Trust Pillars */}
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <Icon name="payments" className="text-sm text-emerald-700" />
                <span>100% Cash In-Hand</span>
              </div>
              <p className="mt-1 text-[11px] text-[#57606A] leading-tight">
                Passenger pays your full cash fare at destination. No payout waiting.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <Icon name="chat" className="text-sm text-emerald-700" />
                <span>WhatsApp Quotes</span>
              </div>
              <p className="mt-1 text-[11px] text-[#57606A] leading-tight">
                Receive trip alerts and quote your price in 2 taps via WhatsApp.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <Icon name="verified_user" className="text-sm text-emerald-700" />
                <span>Zero Monthly Fee</span>
              </div>
              <p className="mt-1 text-[11px] text-[#57606A] leading-tight">
                Free registration. No subscription or hidden deductions.
              </p>
            </div>
          </div>
        </div>

        {/* Success View */}
        {success ? (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-6 sm:p-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow">
              <Icon name="check_circle" className="text-3xl" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-emerald-950">Registration Submitted</h2>
              <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                {success.message}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-white p-4 text-left text-xs space-y-2 text-[#24292F]">
              <div className="flex justify-between border-b border-[#E1E4E8] pb-1.5">
                <span className="text-[#57606A]">Driver Name:</span>
                <strong className="font-semibold">{success.driver.name}</strong>
              </div>
              <div className="flex justify-between border-b border-[#E1E4E8] pb-1.5">
                <span className="text-[#57606A]">WhatsApp Number:</span>
                <strong className="font-semibold">+91 {success.driver.phone}</strong>
              </div>
              <div className="flex justify-between border-b border-[#E1E4E8] pb-1.5">
                <span className="text-[#57606A]">Vehicle Plate:</span>
                <strong className="font-semibold font-mono">{success.driver.plate}</strong>
              </div>
              <div className="flex justify-between border-b border-[#E1E4E8] pb-1.5">
                <span className="text-[#57606A]">Vehicle Class:</span>
                <strong className="font-semibold">{success.driver.vehicleType}</strong>
              </div>
              <div className="flex justify-between border-b border-[#E1E4E8] pb-1.5">
                <span className="text-[#57606A]">Affiliation:</span>
                <strong className="font-semibold">
                  {success.driver.driverCategory === "UNION" ? `Taxi Union (${success.driver.unionName})` : "Independent Driver"}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#57606A]">Operating Base:</span>
                <strong className="font-semibold">{success.driver.area}</strong>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-100/70 p-3 text-xs text-emerald-900 text-left space-y-1">
              <p className="font-bold">Next Steps:</p>
              <p className="text-[11px] leading-relaxed">
                1. Our operations team verifies your vehicle registration.
                <br />
                2. You will receive an automated WhatsApp confirmation message.
                <br />
                3. Trip requests from homestays in {success.driver.area} will arrive on WhatsApp with a 1-tap quote link.
              </p>
            </div>

            <Link
              href="/"
              className="inline-block rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 transition"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          /* Registration Form */
          <form onSubmit={handleSubmit} className="rounded-2xl border border-[#D0D7DE] bg-white p-6 shadow-xs sm:p-8 space-y-5">
            <h2 className="text-base font-bold text-[#1F2328] border-b border-[#E1E4E8] pb-3">
              Driver &amp; Vehicle Registration
            </h2>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {error}
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="text-xs font-semibold text-[#57606A] block mb-1">
                Full Name (as on Driving License) *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Subba"
                className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs font-medium text-[#1F2328] focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* WhatsApp Phone */}
            <div>
              <label className="text-xs font-semibold text-[#57606A] block mb-1">
                WhatsApp Mobile Number *
              </label>
              <div className="flex gap-2">
                <span className="flex items-center rounded-xl bg-[#F6F8FA] border border-[#D0D7DE] px-3 text-xs font-bold text-[#57606A]">
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
                  className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs font-medium text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <span className="mt-1 block text-[10px] text-[#57606A]">
                Trip broadcast links and passenger details are sent to this WhatsApp number.
              </span>
            </div>

            {/* Base Operating Town */}
            <div>
              <label className="text-xs font-semibold text-[#57606A] block mb-1">
                Operating Base Town *
              </label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs font-medium text-[#1F2328] focus:border-emerald-600 focus:outline-none bg-white"
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
              <label className="text-xs font-semibold text-[#57606A] block mb-1.5">
                Driver Affiliation *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDriverCategory("INDIVIDUAL")}
                  className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                    driverCategory === "INDIVIDUAL"
                      ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600"
                      : "border-[#D0D7DE] bg-white hover:bg-[#F6F8FA]"
                  }`}
                >
                  <span className="block text-xs font-bold text-[#1F2328]">Independent</span>
                  <span className="text-[10px] text-[#57606A]">Own taxi / individual</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDriverCategory("UNION")}
                  className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                    driverCategory === "UNION"
                      ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600"
                      : "border-[#D0D7DE] bg-white hover:bg-[#F6F8FA]"
                  }`}
                >
                  <span className="block text-xs font-bold text-[#1F2328]">Taxi Union</span>
                  <span className="text-[10px] text-[#57606A]">Syndicate / Stand</span>
                </button>
              </div>

              {driverCategory === "UNION" && (
                <div className="mt-3 space-y-2 rounded-xl bg-[#F6F8FA] border border-[#D0D7DE] p-3">
                  <label className="text-[11px] font-semibold text-[#1F2328] block">
                    Select Your Taxi Union or Stand *
                  </label>
                  <select
                    value={unionName}
                    onChange={(e) => setUnionName(e.target.value)}
                    className="w-full rounded-xl border border-[#D0D7DE] px-3 py-2 text-xs font-medium text-[#1F2328] bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    {MOUNTAIN_UNIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  {unionName === "Other Local Syndicate / Stand" && (
                    <input
                      type="text"
                      required
                      value={customUnion}
                      onChange={(e) => setCustomUnion(e.target.value)}
                      placeholder="Enter Union / Stand Name"
                      className="w-full rounded-xl border border-[#D0D7DE] px-3 py-2 text-xs font-medium text-[#1F2328] bg-white focus:border-emerald-600 focus:outline-none"
                    />
                  )}
                  <p className="text-[10px] text-[#57606A]">
                    Guests will see your syndicate badge for added confidence when assigned.
                  </p>
                </div>
              )}
            </div>

            {/* Vehicle Tier Selection */}
            <div>
              <label className="text-xs font-semibold text-[#57606A] block mb-1.5">
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
                      className={`text-left p-3 rounded-xl border transition cursor-pointer ${
                        selected
                          ? "border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600"
                          : "border-[#D0D7DE] bg-white hover:bg-[#F6F8FA]"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#1F2328]">{tier.label}</span>
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                          {tier.seats} seats
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-[#57606A]">{tier.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vehicle Plate & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#57606A] block mb-1">
                  Registration Number Plate *
                </label>
                <input
                  type="text"
                  required
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. WB 74 AB 1234"
                  className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs font-bold font-mono text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#57606A] block mb-1">
                  Vehicle Model (Optional)
                </label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="e.g. Bolero 4WD, Innova"
                  className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs font-medium text-[#1F2328] focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Driving License Number */}
            <div>
              <label className="text-xs font-semibold text-[#57606A] block mb-1">
                Driving License Number (DL) *
              </label>
              <input
                type="text"
                required
                value={drivingLicense}
                onChange={(e) => setDrivingLicense(e.target.value.toUpperCase())}
                placeholder="e.g. WB74 20180001234 or SK01 20200005678"
                className="w-full rounded-xl border border-[#D0D7DE] px-3.5 py-2.5 text-xs font-bold font-mono text-[#1F2328] focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Terms Consent */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 text-xs text-[#57606A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 rounded border-[#D0D7DE] text-emerald-600 focus:ring-emerald-500"
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
              className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
            >
              {busy ? "Registering Vehicle…" : "Submit Driver Registration"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
