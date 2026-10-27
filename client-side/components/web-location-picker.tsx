"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Icon } from "./icon";

export interface PickedLocation {
  address: string;
  latitude: number;
  longitude: number;
}

interface WebLocationPickerProps {
  isOpen: boolean;
  title?: string;
  initialCoords?: { latitude: number; longitude: number } | null;
  initialAddress?: string;
  onConfirm: (location: PickedLocation) => void;
  onClose: () => void;
}

// Default center: Darjeeling town center
const DEFAULT_CENTER = { latitude: 27.041, longitude: 88.2663 };

export function WebLocationPicker({
  isOpen,
  title = "Move map to set pickup pin",
  initialCoords,
  initialAddress,
  onConfirm,
  onClose,
}: WebLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState<{ latitude: number; longitude: number }>(
    initialCoords && initialCoords.latitude && initialCoords.longitude
      ? initialCoords
      : DEFAULT_CENTER
  );
  const [address, setAddress] = useState<string>(initialAddress || "");
  const [loadingAddress, setLoadingAddress] = useState<boolean>(false);
  const [locating, setLocating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);
  const [mapEngine, setMapEngine] = useState<"google" | "leaflet" | "none">("none");
  const [statusNotice, setStatusNotice] = useState<string>("");

  // Refs for map instances
  const googleMapRef = useRef<any>(null);
  const leafletMapRef = useRef<any>(null);
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const addressCacheRef = useRef<Map<string, string>>(new Map());

  // Reverse geocoding helper (Google Geocoder or OpenStreetMap Nominatim)
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (addressCacheRef.current.has(key)) {
      setAddress(addressCacheRef.current.get(key) || "");
      setLoadingAddress(false);
      return;
    }

    setLoadingAddress(true);
    setStatusNotice("");

    // Try Google Geocoding if available
    const gKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (gKey && typeof window !== "undefined" && (window as any).google?.maps?.Geocoder) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
          setLoadingAddress(false);
          if (status === "OK" && results && results[0]) {
            const formatted = results[0].formatted_address;
            addressCacheRef.current.set(key, formatted);
            setAddress(formatted);
          } else {
            fallbackNominatim(lat, lng, key);
          }
        });
        return;
      } catch {
        // Fall through to Nominatim
      }
    }

    // Fallback: OpenStreetMap Nominatim
    fallbackNominatim(lat, lng, key);
  }, []);

  const fallbackNominatim = async (lat: number, lng: number, cacheKey: string) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (res.ok) {
        const data = await res.json();
        const display =
          data.display_name ||
          [data.address?.road, data.address?.suburb, data.address?.city || data.address?.town, data.address?.state]
            .filter(Boolean)
            .join(", ") ||
          `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        addressCacheRef.current.set(cacheKey, display);
        setAddress(display);
      } else {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setLoadingAddress(false);
    }
  };

  // Debounced reverse geocoding on pin move
  const handleMapMoved = useCallback(
    (lat: number, lng: number) => {
      setCenter({ latitude: lat, longitude: lng });
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
      geocodeTimeoutRef.current = setTimeout(() => {
        reverseGeocode(lat, lng);
      }, 400);
    },
    [reverseGeocode]
  );

  // Initialize Map Engine (Google Maps if key present, else Leaflet)
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let isSubscribed = true;
    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

    if (googleKey) {
      // Check if google maps script is already on page
      const existingScript = document.getElementById("google-maps-script");
      const initGoogle = () => {
        if (!isSubscribed || !mapContainerRef.current) return;
        try {
          const map = new (window as any).google.maps.Map(mapContainerRef.current, {
            center: { lat: center.latitude, lng: center.longitude },
            zoom: 16,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
            clickableIcons: false,
          });

          map.addListener("idle", () => {
            const c = map.getCenter();
            if (c) {
              handleMapMoved(c.lat(), c.lng());
            }
          });

          googleMapRef.current = map;
          setMapEngine("google");
          reverseGeocode(center.latitude, center.longitude);
        } catch {
          initLeaflet();
        }
      };

      if ((window as any).google?.maps) {
        initGoogle();
      } else if (!existingScript) {
        const script = document.createElement("script");
        script.id = "google-maps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = initGoogle;
        script.onerror = () => {
          if (isSubscribed) initLeaflet();
        };
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener("load", initGoogle);
      }
    } else {
      initLeaflet();
    }

    // Leaflet fallback initialization
    function initLeaflet() {
      if (!isSubscribed || !mapContainerRef.current) return;
      import("leaflet").then((L) => {
        if (!isSubscribed || !mapContainerRef.current) return;

        // Clean up previous instance if any
        if (leafletMapRef.current) {
          try {
            leafletMapRef.current.remove();
          } catch {}
        }

        // Add Leaflet CSS link if missing
        if (!document.getElementById("leaflet-css")) {
          const link = document.createElement("link");
          link.id = "leaflet-css";
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
        }

        const map = L.map(mapContainerRef.current, {
          center: [center.latitude, center.longitude],
          zoom: 16,
          zoomControl: false,
          attributionControl: false,
        });

        // Crisp OpenStreetMap tiles with fast caching
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: "topright" }).addTo(map);

        map.on("moveend", () => {
          const c = map.getCenter();
          handleMapMoved(c.lat, c.lng);
        });

        leafletMapRef.current = map;
        setMapEngine("leaflet");
        reverseGeocode(center.latitude, center.longitude);
      });
    }

    return () => {
      isSubscribed = false;
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        } catch {}
      }
      googleMapRef.current = null;
    };
  }, [isOpen]);

  // GPS "Locate Me" button
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setStatusNotice("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    setStatusNotice("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        setCenter({ latitude, longitude });

        if (mapEngine === "google" && googleMapRef.current) {
          googleMapRef.current.panTo({ lat: latitude, lng: longitude });
          googleMapRef.current.setZoom(17);
        } else if (mapEngine === "leaflet" && leafletMapRef.current) {
          leafletMapRef.current.flyTo([latitude, longitude], 17);
        }

        reverseGeocode(latitude, longitude);
      },
      (err) => {
        setLocating(false);
        setStatusNotice(
          err.code === 1
            ? "Location permission denied. You can still drag the map or search."
            : "Could not retrieve GPS location. Please drag the map."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // Search input handler
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setStatusNotice("");

    try {
      // If Google Places/Geocoder is loaded:
      if (mapEngine === "google" && (window as any).google?.maps?.Geocoder) {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ address: q }, (results: any, status: string) => {
          setSearching(false);
          if (status === "OK" && results?.[0]?.geometry?.location) {
            const loc = results[0].geometry.location;
            const lat = loc.lat();
            const lng = loc.lng();
            googleMapRef.current?.panTo({ lat, lng });
            googleMapRef.current?.setZoom(16);
            handleMapMoved(lat, lng);
          } else {
            setStatusNotice("Location not found. Try entering a nearby landmark or town.");
          }
        });
        return;
      }

      // Nominatim search fallback
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data[0]) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          setCenter({ latitude: lat, longitude: lng });

          if (mapEngine === "leaflet" && leafletMapRef.current) {
            leafletMapRef.current.flyTo([lat, lng], 16);
          }
          handleMapMoved(lat, lng);
        } else {
          setStatusNotice("Place not found. Try a nearby landmark or town.");
        }
      } else {
        setStatusNotice("Search unavailable. Please pan the map directly.");
      }
    } catch {
      setStatusNotice("Search unavailable. Please pan the map directly.");
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = () => {
    onConfirm({
      address: address || `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`,
      latitude: center.latitude,
      longitude: center.longitude,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs antialiased">
      <div className="relative flex flex-col w-full max-w-xl h-[88vh] max-h-[680px] rounded-3xl bg-white shadow-2xl border border-[#D0D7DE] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E1E4E8] bg-white z-10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Icon name="explore" className="text-base text-emerald-700" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-[#1F2328]">{title}</h3>
              <p className="text-[10px] text-[#57606A]">Pan map so the center pin marks your exact spot</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#57606A] hover:bg-[#F6F8FA] hover:text-[#1F2328] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <Icon name="close" className="text-sm" />
          </button>
        </div>

        {/* Top Search Bar */}
        <div className="p-3 bg-[#F6F8FA] border-b border-[#E1E4E8] shrink-0 z-10">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Icon name="search" className="absolute left-3 text-sm text-[#8C959F] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area, town, or landmark (e.g. Ghoom Station, Darjeeling Mall)"
              className="w-full rounded-xl border border-[#D0D7DE] bg-white pl-9 pr-20 py-2 text-xs text-[#1F2328] focus:border-emerald-600 focus:outline-none shadow-2xs"
            />
            <button
              type="submit"
              disabled={searching}
              className="absolute right-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-[11px] font-bold text-white hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {statusNotice && (
            <p className="mt-1 text-[11px] text-amber-800 font-medium px-1 flex items-center gap-1">
              <Icon name="info" className="text-xs text-amber-700 shrink-0" />
              <span>{statusNotice}</span>
            </p>
          )}
        </div>

        {/* Map Viewport Area with Stationary Blinkit/Zepto Center Pin */}
        <div className="relative flex-1 bg-slate-100 overflow-hidden">
          {/* Map Container */}
          <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full" />

          {/* Stationary Blinkit / Zepto Center Pin (Map moves beneath this pin) */}
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center pb-9">
            <div className="flex flex-col items-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl ring-4 ring-white/90">
                <Icon name="location_on" className="text-2xl" />
              </div>
              <div className="h-1.5 w-4 rounded-full bg-black/40 blur-[1px] mt-0.5" />
            </div>
          </div>

          {/* Floating GPS "Locate Me" Button */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="absolute bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-800 shadow-lg border border-[#D0D7DE] hover:bg-[#F6F8FA] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Use current GPS location"
          >
            {locating ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            ) : (
              <Icon name="my_location" className="text-lg text-emerald-700" />
            )}
          </button>

          {/* Map Engine Badge (Subtle info) */}
          <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded bg-white/80 backdrop-blur-xs text-[9px] font-semibold text-[#57606A] border border-black/5 pointer-events-none">
            {mapEngine === "google" ? "Google Maps" : "Interactive Hill Map"}
          </div>
        </div>

        {/* Bottom Address Confirmation Sheet */}
        <div className="p-4 bg-white border-t border-[#E1E4E8] space-y-3 z-10 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#57606A]">
                Location Under Pin
              </span>
              <span className="font-mono text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
              </span>
            </div>
            <p className="text-xs font-semibold text-[#1F2328] leading-snug line-clamp-2 min-h-[32px]">
              {loadingAddress ? (
                <span className="inline-flex items-center gap-1.5 text-[#57606A]">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  Resolving landmark…
                </span>
              ) : (
                address || `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 rounded-xl border border-[#D0D7DE] bg-white text-xs font-bold text-[#24292F] hover:bg-[#F6F8FA] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="w-2/3 py-2.5 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Icon name="check" className="text-sm font-bold" />
              <span>Confirm Location</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
