"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icon";
import { Stars } from "@/components/stars";
import { API_ENDPOINTS } from "@/lib/api-config";
import {
  cabParams,
  formatDistance,
  formatEta,
  formatFare,
  seatCapacity,
  type CabDriver,
  type CabRequest,
} from "@/lib/cabs";

export function DriverCard({
  driver,
  request,
}: {
  driver: CabDriver;
  request: CabRequest;
}) {
  const router = useRouter();
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) {
      setFormError("Please enter the passenger's name.");
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setFormError("Please enter a valid phone number for driver contact.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setFormError("Please enter a valid email address for confirmation.");
      return;
    }

    try {
      setLoading(true);
      setFormError(null);
      const res = await fetch(API_ENDPOINTS.cabs.book(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: driver.id,
          guestName: guestName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          pickupName: request.source.label,
          pickupLat: request.source.lat,
          pickupLng: request.source.lng,
          dropoffName: request.destination.label,
          dropoffLat: request.destination.lat,
          dropoffLng: request.destination.lng,
          pickupDate: request.date,
          pickupTime: request.time,
          seats: seatCapacity(request.seats),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const reference = json.data?.reference || "";
        const query = `${cabParams(request)}&driver=${encodeURIComponent(driver.id)}&reference=${encodeURIComponent(reference)}&guest=${encodeURIComponent(guestName.trim())}&phone=${encodeURIComponent(phone.trim())}&email=${encodeURIComponent(email.trim())}`;
        router.push(`/cab/confirmed?${query}`);
      } else {
        setFormError(json.error || "Failed to confirm cab booking. Please try again.");
      }
    } catch (err: any) {
      setFormError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest sunlit-card-shadow">
        <div className="flex items-start gap-4 p-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-fixed/50 font-display text-headline-sm font-semibold text-primary">
            {driver.name
              .split(" ")
              .map((part) => part[0])
              .join("")}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="font-display text-headline-sm font-semibold text-primary">
                {driver.name}
              </h3>
              {driver.rating >= 4.9 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed/40 px-2 py-0.5 text-label-sm font-medium text-primary">
                  <Icon name="verified" filled className="text-sm" />
                  Top Rated
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2">
              <Stars rating={driver.rating} count={driver.reviews} />
            </div>

            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="directions_car" className="text-base text-primary" />
                {driver.vehicle}
              </span>
              <span aria-hidden="true">•</span>
              <span>{driver.colour}</span>
              <span aria-hidden="true">•</span>
              <span className="font-medium text-on-surface">{driver.plate}</span>
            </p>

            <p className="mt-2 text-body-sm text-on-surface-variant">{driver.note}</p>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-px border-y border-outline-variant/40 bg-outline-variant/40 min-[360px]:grid-cols-2 sm:grid-cols-4">
          <div className="bg-surface-container-lowest px-4 py-3">
            <dt className="text-label-sm uppercase tracking-wider text-outline">Arrives</dt>
            <dd className="text-title-md font-semibold text-primary">
              {formatEta(driver.etaMinutes)}
            </dd>
          </div>
          <div className="bg-surface-container-lowest px-4 py-3">
            <dt className="text-label-sm uppercase tracking-wider text-outline">Seats</dt>
            <dd className="text-title-md font-semibold text-primary">{driver.seats}</dd>
          </div>
          <div className="bg-surface-container-lowest px-4 py-3">
            <dt className="text-label-sm uppercase tracking-wider text-outline">Luggage</dt>
            <dd className="text-title-md font-semibold text-primary">{driver.luggage} cases</dd>
          </div>
          <div className="bg-surface-container-lowest px-4 py-3">
            <dt className="text-label-sm uppercase tracking-wider text-outline">Est. Fare</dt>
            <dd className="text-title-md font-semibold text-primary">{formatFare(driver.fare)}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-label-sm text-outline">
            {driver.languages} • {formatDistance(driver.distanceKm)} • Cash or UPI on arrival
          </p>
          <button
            type="button"
            onClick={() => setIsBookingOpen(true)}
            className="group flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-container px-6 text-label-md font-semibold text-on-primary transition-all duration-200 hover:bg-primary active:scale-[0.99]"
          >
            <span>Book Now</span>
            <Icon
              name="arrow_forward"
              className="text-sm transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </article>

      {/* Direct Traveler Details Booking Modal */}
      {isBookingOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-3xl border border-outline-variant/60 bg-surface p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
              <div>
                <h3 className="font-display text-headline-sm font-semibold text-primary">
                  Book with {driver.name}
                </h3>
                <p className="text-body-sm text-on-surface-variant">
                  {driver.vehicle} • {formatFare(driver.fare)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBookingOpen(false);
                  setFormError(null);
                }}
                className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="mt-5 space-y-4">
              {formError && (
                <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-body-sm text-error">
                  {formError}
                </div>
              )}

              <div className="rounded-xl bg-surface-container-low p-3.5 text-body-sm text-on-surface-variant space-y-1">
                <div className="flex justify-between">
                  <span className="text-outline">Route:</span>
                  <span className="font-semibold text-primary truncate max-w-[240px]">
                    {request.source.label} → {request.destination.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Date &amp; Time:</span>
                  <span className="font-semibold text-primary">
                    {request.date} at {request.time}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Estimated Fare:</span>
                  <span className="font-semibold text-emerald-600">
                    {formatFare(driver.fare)} (Pay Driver Directly)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-label-md font-semibold text-on-surface mb-1">
                  Passenger Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-4 py-2.5 text-body-md text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-label-md font-semibold text-on-surface mb-1">
                  WhatsApp / Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-4 py-2.5 text-body-md text-on-surface outline-none focus:border-primary"
                />
                <span className="text-xs text-outline mt-1 block">
                  Driver will WhatsApp or call this number upon arrival.
                </span>
              </div>

              <div>
                <label className="block text-label-md font-semibold text-on-surface mb-1">
                  Confirmation Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rahul@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-4 py-2.5 text-body-md text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div className="mt-6 flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBookingOpen(false)}
                  disabled={loading}
                  className="flex-1 rounded-xl border border-outline-variant/60 py-3 text-label-md font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-primary-container py-3 text-label-md font-semibold text-on-primary hover:bg-primary transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Icon name="progress_activity" className="animate-spin text-base" />
                      <span>Booking...</span>
                    </>
                  ) : (
                    <span>Confirm &amp; Book</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
