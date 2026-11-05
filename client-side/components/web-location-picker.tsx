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

export interface LocationSuggestion {
  id: string;
  mainText: string;
  secondaryText: string;
  latitude: number;
  longitude: number;
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

  // Search & Autosuggestion states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);

  const [mapEngine, setMapEngine] = useState<"google" | "leaflet" | "none">("none");
  const [statusNotice, setStatusNotice] = useState<string>("");

  // Refs for map instances
  const googleMapRef = useRef<any>(null);
  const leafletMapRef = useRef<any>(null);
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const addressCacheRef = useRef<Map<string, string>>(new Map());
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Reverse geocoding helper (OpenStreetMap Nominatim / Google Geocoder)
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (addressCacheRef.current.has(key)) {
      setAddress(addressCacheRef.current.get(key) || "");
      setLoadingAddress(false);
      return;
    }

    setLoadingAddress(true);
    setStatusNotice("");

    // Fast, reliable reverse geocoding via OpenStreetMap Nominatim
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
        addressCacheRef.current.set(cacheKey(lat, lng), display);
        setAddress(display);
      } else {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setLoadingAddress(false);
    }
  }, []);

  const cacheKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

  // Debounced reverse geocoding on pin move
  const handleMapMoved = useCallback(
    (lat: number, lng: number) => {
      setCenter({ latitude: lat, longitude: lng });
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
      geocodeTimeoutRef.current = setTimeout(() => {
        reverseGeocode(lat, lng);
      }, 350);
    },
    [reverseGeocode]
  );

  // Fly/pan map to given coordinates
  const flyToCoordinates = useCallback(
    (lat: number, lng: number, zoom = 16) => {
      setCenter({ latitude: lat, longitude: lng });

      if (mapEngine === "google" && googleMapRef.current) {
        try {
          googleMapRef.current.panTo({ lat, lng });
          googleMapRef.current.setZoom(zoom);
        } catch {}
      } else if (leafletMapRef.current) {
        try {
          leafletMapRef.current.flyTo([lat, lng], zoom, { duration: 1.2 });
        } catch {}
      }

      handleMapMoved(lat, lng);
    },
    [mapEngine, handleMapMoved]
  );

  // Fallback to Leaflet with Google Maps-like clean CartoDB Voyager tiles
  const initLeaflet = useCallback(() => {
    if (!mapContainerRef.current) return;
    import("leaflet").then((L) => {
      if (!mapContainerRef.current) return;

      // Clean up previous instance
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

      // CartoDB Voyager: Crisp, modern vector-style tiles designed like Google Maps
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 20,
        }
      ).addTo(map);

      // Zoom control in top right
      L.control.zoom({ position: "topright" }).addTo(map);

      map.on("moveend", () => {
        const c = map.getCenter();
        handleMapMoved(c.lat, c.lng);
      });

      leafletMapRef.current = map;
      setMapEngine("leaflet");
      reverseGeocode(center.latitude, center.longitude);
    });
  }, [center.latitude, center.longitude, handleMapMoved, reverseGeocode]);

  // Dual-Engine Map Initialization:
  // If Google key is present and authorized, use Google Maps.
  // If authorization fails or key is missing, seamlessly fall back to Leaflet (NO ERROR POPUPS).
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let isSubscribed = true;
    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

    // Hide any Google Maps error banners automatically
    if (!document.getElementById("hide-gmaps-err-style")) {
      const style = document.createElement("style");
      style.id = "hide-gmaps-err-style";
      style.innerHTML = `
        .gm-err-container, .gm-err-content, .gm-err-autocomplete, .gm-style-cc { display: none !important; }
      `;
      document.head.appendChild(style);
    }

    // Intercept Google auth failure to prevent error modal and silently switch engines
    (window as any).gm_authFailure = () => {
      if (googleMapRef.current) {
        googleMapRef.current = null;
      }
      if (isSubscribed) {
        initLeaflet();
      }
    };

    if (googleKey) {
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

    return () => {
      isSubscribed = false;
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        } catch {}
      }
      googleMapRef.current = null;
    };
  }, [isOpen, initLeaflet, center.latitude, center.longitude, handleMapMoved, reverseGeocode]);

  // Dual-Engine Real-Time Autosuggestion Fetcher (pan-India, no viewbox lockout)
  const fetchSuggestions = useCallback(async (query: string) => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    setStatusNotice("");

    const results: LocationSuggestion[] = [];

    // Engine 1: Photon API (Fast OSM Geocoder by Komoot, works across all Indian cities)
    try {
      const photonRes = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`
      );
      if (photonRes.ok) {
        const pData = await photonRes.json();
        if (pData?.features && Array.isArray(pData.features)) {
          pData.features.forEach((f: any, idx: number) => {
            const [lon, lat] = f.geometry?.coordinates || [];
            if (typeof lat === "number" && typeof lon === "number") {
              const props = f.properties || {};
              const mainText = props.name || q;
              const secondary = [
                props.street,
                props.locality,
                props.district,
                props.city,
                props.state,
                props.country || "India",
              ]
                .filter(Boolean)
                .join(", ");

              results.push({
                id: `photon-${idx}-${lat.toFixed(4)}`,
                mainText,
                secondaryText: secondary || "India",
                latitude: lat,
                longitude: lon,
              });
            }
          });
        }
      }
    } catch {}

    // Engine 2: OpenStreetMap Nominatim Fallback (if Photon returns fewer than 3 results)
    if (results.length < 3) {
      try {
        const osmRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=5`,
          { headers: { "Accept-Language": "en" } }
        );
        if (osmRes.ok) {
          const osmData = await osmRes.json();
          if (Array.isArray(osmData)) {
            osmData.forEach((item: any, idx: number) => {
              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);
              if (!isNaN(lat) && !isNaN(lon)) {
                // Deduplicate against existing results
                const exists = results.some(
                  (r) => Math.abs(r.latitude - lat) < 0.005 && Math.abs(r.longitude - lon) < 0.005
                );
                if (!exists) {
                  const parts = (item.display_name || "").split(",");
                  const mainText = parts[0]?.trim() || item.name || q;
                  const secondaryText = parts.slice(1, 4).join(",").trim() || "India";

                  results.push({
                    id: `osm-${idx}-${lat.toFixed(4)}`,
                    mainText,
                    secondaryText,
                    latitude: lat,
                    longitude: lon,
                  });
                }
              }
            });
          }
        }
      } catch {}
    }

    setSuggestions(results);
    setShowSuggestions(results.length > 0);
    setLoadingSuggestions(false);
  }, []);

  // Handle typing in search input
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
    suggestTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 280);
  };

  // Select a suggestion
  const handleSelectSuggestion = (s: LocationSuggestion) => {
    setSearchQuery(s.mainText);
    setShowSuggestions(false);
    setAddress(`${s.mainText}, ${s.secondaryText}`);
    flyToCoordinates(s.latitude, s.longitude, 16);
  };

  // Submit search (Enter key or Search button)
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    // If suggestions already have a match, pick the top one
    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0]);
      return;
    }

    setSearching(true);
    setStatusNotice("");

    try {
      // Direct Photon search
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=en`);
      if (res.ok) {
        const pData = await res.json();
        const f = pData?.features?.[0];
        if (f?.geometry?.coordinates) {
          const [lon, lat] = f.geometry.coordinates;
          const label = f.properties?.name || q;
          setAddress(label);
          flyToCoordinates(lat, lon, 16);
          setShowSuggestions(false);
          setSearching(false);
          return;
        }
      }

      // Nominatim search pan-India
      const osmRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (osmRes.ok) {
        const osmData = await osmRes.json();
        if (osmData?.[0]?.lat && osmData?.[0]?.lon) {
          const lat = parseFloat(osmData[0].lat);
          const lon = parseFloat(osmData[0].lon);
          setAddress(osmData[0].display_name || q);
          flyToCoordinates(lat, lon, 16);
          setShowSuggestions(false);
          setSearching(false);
          return;
        }
      }

      setStatusNotice("Location not found. Try entering a nearby town or landmark.");
    } catch {
      setStatusNotice("Search unavailable. Please pan the map directly to drop the pin.");
    } finally {
      setSearching(false);
    }
  };

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
        flyToCoordinates(latitude, longitude, 17);
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

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      <div className="relative flex flex-col w-full max-w-xl h-[88vh] max-h-[700px] rounded-3xl bg-white shadow-2xl border border-[#E5E8E5] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#ECEFEB] bg-white z-20 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#14422D]/10 text-[#14422D] border border-[#14422D]/15">
              <Icon name="explore" className="text-lg text-[#14422D]" />
            </span>
            <div>
              <h3 className="font-serif font-bold text-sm text-[#181C1B]">{title}</h3>
              <p className="text-[11px] text-[#717973]">Pan map so the center pin marks your exact spot</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#717973] hover:bg-[#ECEFEB] hover:text-[#181C1B] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <Icon name="close" className="text-sm" />
          </button>
        </div>

        {/* Top Dual-Engine Search Bar with Real-Time Autocomplete */}
        <div ref={searchContainerRef} className="relative p-3.5 bg-[#F7FAF7] border-b border-[#ECEFEB] shrink-0 z-20">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Icon name="search" className="absolute left-3.5 text-base text-[#717973] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Search area, landmark or town (e.g. Hauz Khas, Darjeeling Mall, Bagdogra Airport)"
              className="w-full rounded-2xl border border-[#E5E8E5] bg-white pl-10 pr-24 py-2.5 text-xs text-[#181C1B] font-medium focus:border-[#14422D] focus:ring-2 focus:ring-[#14422D]/15 focus:outline-none shadow-xs transition-all placeholder:text-[#717973]/70"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                className="absolute right-20 text-[#717973] hover:text-[#181C1B] p-1 cursor-pointer"
              >
                <Icon name="close" className="text-xs" />
              </button>
            )}
            <button
              type="submit"
              disabled={searching}
              className="absolute right-1.5 px-3.5 py-1.5 rounded-xl bg-[#14422D] text-[11px] font-bold text-white hover:bg-[#0B2519] transition-all cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>

          {/* Real-time Dynamic Autosuggestions Popover */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-3.5 right-3.5 top-full mt-1.5 rounded-2xl border border-[#E5E8E5] bg-white shadow-2xl p-1.5 space-y-0.5 max-h-60 overflow-y-auto z-50">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#717973] border-b border-[#ECEFEB]">
                Matching Places & Landmarks
              </div>
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(s);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#14422D]/8 flex items-start gap-2.5 transition-colors cursor-pointer group"
                >
                  <Icon name="location_on" className="text-sm text-[#14422D] mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="flex-1 truncate">
                    <span className="font-bold text-[#181C1B] block truncate group-hover:text-[#14422D]">
                      {s.mainText}
                    </span>
                    <span className="text-[10px] text-[#717973] block truncate">
                      {s.secondaryText}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {loadingSuggestions && (
            <div className="absolute right-28 top-5 text-[10px] text-[#717973] flex items-center gap-1 font-medium">
              <span className="h-2.5 w-2.5 animate-spin rounded-full border border-[#14422D] border-t-transparent" />
              <span>Matching…</span>
            </div>
          )}

          {statusNotice && (
            <p className="mt-1.5 text-[11px] text-amber-900 font-medium px-1 flex items-center gap-1">
              <Icon name="info" className="text-xs text-amber-700 shrink-0" />
              <span>{statusNotice}</span>
            </p>
          )}
        </div>

        {/* Map Viewport Area with Stationary Blinkit/Zepto Center Pin */}
        <div className="relative flex-1 bg-[#F7FAF7] overflow-hidden">
          {/* Map Container */}
          <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full" />

          {/* Stationary Center Pin (Map pans beneath this pin) */}
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center pb-9">
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#14422D] text-white shadow-2xl ring-4 ring-white/95">
                <Icon name="location_on" className="text-2xl" />
              </div>
              <div className="h-2 w-5 rounded-full bg-black/35 blur-[1px] mt-0.5" />
            </div>
          </div>

          {/* Floating GPS "Locate Me" Button */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="absolute bottom-4 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#14422D] shadow-lg border border-[#E5E8E5] hover:bg-[#ECEFEB] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Use current GPS location"
          >
            {locating ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#14422D] border-t-transparent" />
            ) : (
              <Icon name="my_location" className="text-xl text-[#14422D]" />
            )}
          </button>

          {/* Subtle Map Engine Indicator */}
          <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-semibold text-[#14422D] border border-[#E5E8E5] shadow-xs pointer-events-none flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{mapEngine === "google" ? "Google Maps Engine" : "Interactive Hill Map"}</span>
          </div>
        </div>

        {/* Bottom Address Confirmation Sheet */}
        <div className="p-4 sm:p-5 bg-white border-t border-[#ECEFEB] space-y-3.5 z-20 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#717973]">
                Location Under Pin
              </span>
              <span className="font-mono text-[10px] text-[#14422D] bg-[#14422D]/8 px-2.5 py-0.5 rounded-full border border-[#14422D]/15 font-bold">
                {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
              </span>
            </div>
            <p className="text-xs font-semibold text-[#181C1B] leading-snug line-clamp-2 min-h-[34px]">
              {loadingAddress ? (
                <span className="inline-flex items-center gap-1.5 text-[#717973]">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#14422D] border-t-transparent" />
                  Resolving landmark…
                </span>
              ) : (
                address || `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`
              )}
            </p>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-3 rounded-2xl border border-[#E5E8E5] bg-white text-xs font-bold text-[#181C1B] hover:bg-[#ECEFEB] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="w-2/3 py-3 rounded-2xl bg-[#14422D] text-xs font-bold text-white shadow-[0_8px_20px_-4px_rgba(20,66,45,0.25)] hover:bg-[#0B2519] transition-all cursor-pointer flex items-center justify-center gap-2"
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
