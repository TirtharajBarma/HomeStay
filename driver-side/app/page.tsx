"use client";

import { useEffect, useState } from "react";
import { useDriverAuth } from "@/components/auth-context";
import { API_ENDPOINTS } from "@/lib/api-config";

type Trip = {
  id: string;
  reference: string;
  passengerName: string;
  passengerPhone: string;
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
  distanceKm: number;
  grossFare: number;
  netPayout: number;
  commission: number;
  status: "Assigned" | "En Route" | "Arrived" | "Completed";
};

const INITIAL_TRIPS: Trip[] = [
  {
    id: "trip-1",
    reference: "TRP-8402",
    passengerName: "Anik Sen",
    passengerPhone: "+91 98301 23456",
    pickup: "Tiger Hill View Suite (Ging Lodge Gate)",
    dropoff: "New Jalpaiguri (NJP) Railway Station, Platform 1",
    date: "Today",
    time: "10:30 AM",
    distanceKm: 78,
    grossFare: 3400,
    netPayout: 2788,
    commission: 612,
    status: "Assigned",
  },
  {
    id: "trip-2",
    reference: "TRP-8403",
    passengerName: "Dr. Rohini Das",
    passengerPhone: "+91 98322 99887",
    pickup: "Misty Pine Homestay, Upper Lebong",
    dropoff: "Bagdogra Airport (IXB) Departures",
    date: "Today",
    time: "02:00 PM",
    distanceKm: 72,
    grossFare: 3200,
    netPayout: 2624,
    commission: 576,
    status: "Assigned",
  },
];

export default function DriverDashboard() {
  const { driver, logout, updateStatus } = useDriverAuth();
  const [trips, setTrips] = useState<Trip[]>(INITIAL_TRIPS);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Sync driver availability status with server backend
  async function handleStatusToggle(newStatus: "Active" | "On a trip" | "Inactive") {
    if (!driver?.id) return;
    setUpdatingStatus(true);
    try {
      await fetch(API_ENDPOINTS.updateStatus(driver.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      updateStatus(newStatus);
    } catch (e) {
      console.warn("Status update notice:", e);
      updateStatus(newStatus);
    } finally {
      setUpdatingStatus(false);
    }
  }

  useEffect(() => {
    const driverId = driver?.id;
    if (!driverId) return;
    const activeDriverId: string = driverId;
    async function fetchTrips() {
      try {
        const res = await fetch(API_ENDPOINTS.driverTrips(activeDriverId));
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            const mapped: Trip[] = json.data.map((t: any) => ({
              id: t._id || t.reference,
              reference: t.reference,
              passengerName: t.guestName || "Guest Passenger",
              passengerPhone: t.phone || "+91 98300 00000",
              pickup: t.pickupName || "Darjeeling",
              dropoff: t.dropoffName || "NJP Railway Station",
              time: `${t.pickupDate || "Today"} • ${t.pickupTime || "10:00 AM"}`,
              distance: `${t.distanceKm || 65} km`,
              seats: `${t.seats || 4} Seats`,
              fare: t.fareAmount || 3200,
              netPayout: t.driverPayout || Math.round((t.fareAmount || 3200) * 0.82),
              commission: t.estateCommission || Math.round((t.fareAmount || 3200) * 0.18),
              status:
                t.status === "completed"
                  ? "Completed"
                  : t.status === "en_route"
                    ? "En Route"
                    : t.status === "arrived"
                      ? "Arrived"
                      : "Assigned",
            }));
            setTrips(mapped);
          }
        }
      } catch (err) {
        console.warn("Could not load backend trips:", err);
      }
    }
    fetchTrips();
  }, [driver?.id]);

  async function advanceTripStatus(tripId: string) {
    let nextBackendStatus = "scheduled";
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t;
        if (t.status === "Assigned") {
          nextBackendStatus = "en_route";
          return { ...t, status: "En Route" };
        }
        if (t.status === "En Route") {
          nextBackendStatus = "arrived";
          return { ...t, status: "Arrived" };
        }
        if (t.status === "Arrived") {
          nextBackendStatus = "completed";
          return { ...t, status: "Completed" };
        }
        return t;
      })
    );

    try {
      await fetch(API_ENDPOINTS.updateTripStatus(tripId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextBackendStatus }),
      });
    } catch (e) {
      console.warn("Trip status sync notice:", e);
    }
  }

  // Earnings calculation
  const totalCompleted = trips.filter((t) => t.status === "Completed").length;
  const totalEarned = trips
    .filter((t) => t.status === "Completed")
    .reduce((sum, t) => sum + t.netPayout, 0);
  const totalCommission = trips
    .filter((t) => t.status === "Completed")
    .reduce((sum, t) => sum + t.commission, 0);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[#f4f7f4] pb-24">
      {/* 1. TOP APP BAR */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1e3a2b] font-bold text-white shadow-sm">
            {driver?.name
              ? driver.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
              : "DR"}
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-[#1e3a2b]">
              {driver?.name || "Sonam Lama"}
            </h1>
            <p className="text-xs font-medium text-neutral-500">
              {driver?.vehicle || "Toyota Innova"} • {driver?.plate || "WB 06 D 1158"}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
          title="Sign Out"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
        </button>
      </header>

      <main className="p-4 space-y-4">
        {/* 2. LIVE DUTY STATUS TOGGLE */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Duty &amp; Dispatch Status
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <button
              onClick={() => handleStatusToggle("Active")}
              disabled={updatingStatus}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                driver?.status === "Active"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "border border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>Available</span>
            </button>

            <button
              onClick={() => handleStatusToggle("On a trip")}
              disabled={updatingStatus}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                driver?.status === "On a trip"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                  : "border border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <span className="material-symbols-outlined text-sm">navigation</span>
              <span>On a Trip</span>
            </button>

            <button
              onClick={() => handleStatusToggle("Inactive")}
              disabled={updatingStatus}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                driver?.status === "Inactive"
                  ? "bg-neutral-800 text-white shadow-md"
                  : "border border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <span className="material-symbols-outlined text-sm">power_settings_new</span>
              <span>Offline</span>
            </button>
          </div>
        </section>

        {/* 3. TODAY'S EARNINGS SUMMARY */}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Net Earnings (82%)
            </span>
            <p className="mt-1 font-mono text-2xl font-black text-emerald-900">
              ₹{totalEarned > 0 ? totalEarned.toLocaleString() : "5,412"}
            </p>
            <span className="text-[10px] text-emerald-700">Direct Cash / UPI</span>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Platform Fee (18%)
            </span>
            <p className="mt-1 font-mono text-2xl font-black text-neutral-800">
              ₹{totalCommission > 0 ? totalCommission.toLocaleString() : "1,188"}
            </p>
            <span className="text-[10px] text-neutral-500">Auto-settled weekly</span>
          </div>
        </section>

        {/* 4. ASSIGNED TRIPS LIST */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#1e3a2b]">
              Today&apos;s Assigned Hill Trips ({trips.length})
            </h2>
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              {totalCompleted} Completed
            </span>
          </div>

          {trips.map((trip) => {
            const isCompleted = trip.status === "Completed";
            return (
              <div
                key={trip.id}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                  isCompleted
                    ? "border-neutral-200 opacity-75"
                    : "border-[#1e3a2b]/30 shadow-md ring-1 ring-[#1e3a2b]/10"
                }`}
              >
                {/* Trip Header */}
                <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/70 px-4 py-2.5">
                  <span className="font-mono text-xs font-bold text-neutral-600">
                    #{trip.reference}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      trip.status === "Assigned"
                        ? "bg-blue-100 text-blue-800"
                        : trip.status === "En Route"
                          ? "bg-amber-100 text-amber-800"
                          : trip.status === "Arrived"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {trip.status}
                  </span>
                </div>

                {/* Trip Details */}
                <div className="p-4 space-y-3">
                  {/* Passenger Information */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-bold text-neutral-900">
                        {trip.passengerName}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Scheduled: {trip.time} • {trip.distanceKm} km
                      </p>
                    </div>

                    {/* Quick Call & WhatsApp Action Buttons */}
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${trip.passengerPhone}`}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow hover:bg-emerald-700"
                        title="Call Passenger"
                      >
                        <span className="material-symbols-outlined text-lg">call</span>
                      </a>
                      <a
                        href={`https://wa.me/${trip.passengerPhone.replace(/[^0-9]/g, "")}?text=Hello%20${encodeURIComponent(trip.passengerName)},%20I%20am%20your%20driver%20from%20the%20homestay.`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white shadow hover:opacity-90"
                        title="WhatsApp Passenger"
                      >
                        <span className="material-symbols-outlined text-lg">chat</span>
                      </a>
                    </div>
                  </div>

                  {/* Route Points */}
                  <div className="space-y-2 rounded-xl bg-neutral-50 p-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined mt-0.5 text-sm text-emerald-600">
                        trip_origin
                      </span>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-neutral-400">
                          Pickup
                        </span>
                        <p className="font-semibold text-neutral-800">{trip.pickup}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 border-t border-neutral-200/50 pt-2">
                      <span className="material-symbols-outlined mt-0.5 text-sm text-red-500">
                        location_on
                      </span>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-neutral-400">
                          Dropoff
                        </span>
                        <p className="font-semibold text-neutral-800">{trip.dropoff}</p>
                      </div>
                    </div>
                  </div>

                  {/* Fare & Net Split */}
                  <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-xs">
                    <div>
                      <span className="text-neutral-500">Total Fare:</span>{" "}
                      <span className="font-bold text-neutral-800">
                        ₹{trip.grossFare.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-700">Your Take-home:</span>{" "}
                      <span className="font-mono text-sm font-black text-emerald-800">
                        ₹{trip.netPayout.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Action Progress Button */}
                  {!isCompleted ? (
                    <button
                      onClick={() => advanceTripStatus(trip.id)}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e3a2b] py-3 text-sm font-bold text-white shadow transition hover:opacity-95 active:scale-[0.99]"
                    >
                      {trip.status === "Assigned" && (
                        <>
                          <span className="material-symbols-outlined text-lg">
                            directions_car
                          </span>
                          <span>Start Trip → En Route</span>
                        </>
                      )}
                      {trip.status === "En Route" && (
                        <>
                          <span className="material-symbols-outlined text-lg">
                            where_to_vote
                          </span>
                          <span>Arrived at Pickup Gate</span>
                        </>
                      )}
                      {trip.status === "Arrived" && (
                        <>
                          <span className="material-symbols-outlined text-lg">
                            task_alt
                          </span>
                          <span>Complete Trip &amp; Collect Fare</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-1 rounded-xl bg-emerald-50 py-2.5 text-xs font-bold text-emerald-800">
                      <span className="material-symbols-outlined text-base">
                        verified
                      </span>
                      <span>Trip Completed &amp; Settled</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
