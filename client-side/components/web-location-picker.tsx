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

// Default center: Darjeeling town center (27.0410° N, 88.2663° E)
const DEFAULT_CENTER = { latitude: 27.041, longitude: 88.2663 };

interface LeafletMap {
  setView: (coords: [number, number], zoom?: number, options?: { animate?: boolean }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  getCenter: () => { lat: number; lng: number };
  off: () => void;
  remove: () => void;
}

export function WebLocationPicker({
  isOpen,
  title = "Pin Location on Map",
  initialCoords,
  initialAddress,
  onConfirm,
  onClose,
}: WebLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const startCoords =
    initialCoords && initialCoords.latitude && initialCoords.longitude
      ? initialCoords
      : DEFAULT_CENTER;

  const [center, setCenter] = useState<{ latitude: number; longitude: number }>(startCoords);
  const [address, setAddress] = useState<string>(initialAddress || "");
  const [areaName, setAreaName] = useState<string>(initialAddress || "");
  const [loadingAddress, setLoadingAddress] = useState<boolean>(false);
  const [locating, setLocating] = useState<boolean>(false);

  // Real-time Autosuggestion state (Uber/Rapido style)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string>("");

  // Refs for instances & state control
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const addressCacheRef = useRef<Map<string, { full: string; area: string }>>(new Map());
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const isLockingSuggestionRef = useRef<boolean>(false);

  // Adjust state during render when initialCoords or initialAddress changes
  const [prevInit, setPrevInit] = useState({ initialCoords, initialAddress });
  if (
    initialCoords?.latitude !== prevInit.initialCoords?.latitude ||
    initialCoords?.longitude !== prevInit.initialCoords?.longitude ||
    initialAddress !== prevInit.initialAddress
  ) {
    setPrevInit({ initialCoords, initialAddress });
    if (initialCoords && initialCoords.latitude && initialCoords.longitude) {
      setCenter(initialCoords);
    }
    if (initialAddress) {
      setAddress(initialAddress);
      setAreaName(initialAddress);
    }
  }

  // Fast Client-Side Reverse Geocoding via BigDataCloud (instant ~150ms response, no rate-limit hangs)
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (isLockingSuggestionRef.current) {
      isLockingSuggestionRef.current = false;
      return;
    }

    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (addressCacheRef.current.has(key)) {
      const cached = addressCacheRef.current.get(key)!;
      setAddress(cached.full);
      setAreaName(cached.area);
      setLoadingAddress(false);
      return;
    }

    setLoadingAddress(true);
    setStatusNotice("");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      // 1. BigDataCloud client reverse API: Returns locality, city, district, state in JSON without rate limits
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const primaryArea =
          data.locality ||
          data.principalSubdivisionDistrict ||
          data.city ||
          "Selected Location";

        const parts = [
          data.locality,
          data.locality && data.city && data.locality !== data.city ? data.city : null,
          data.principalSubdivisionDistrict && data.principalSubdivisionDistrict !== data.city ? data.principalSubdivisionDistrict : null,
          data.principalSubdivision,
          data.countryName || "India",
        ].filter(Boolean);

        const fullDisplay = parts.length > 0 ? parts.join(", ") : primaryArea;

        addressCacheRef.current.set(key, { full: fullDisplay, area: primaryArea });
        setAddress(fullDisplay);
        setAreaName(primaryArea);
        setLoadingAddress(false);
        return;
      }
    } catch {
      // Timeout or abort - try fallback
    } finally {
      clearTimeout(timeoutId);
    }

    // 2. Nominatim fallback with strict 2.5s timeout
    try {
      const nomController = new AbortController();
      const nomTimeout = setTimeout(() => nomController.abort(), 2500);

      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en" }, signal: nomController.signal }
      );
      clearTimeout(nomTimeout);

      if (nomRes.ok) {
        const nomData = await nomRes.json();
        const main = nomData.name || nomData.address?.road || nomData.address?.suburb || nomData.address?.town || "Selected Spot";
        const full = nomData.display_name || main;

        addressCacheRef.current.set(key, { full, area: main });
        setAddress(full);
        setAreaName(main);
      } else {
        const fallbackText = `Near ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
        setAddress(fallbackText);
        setAreaName(fallbackText);
      }
    } catch {
      const fallbackText = `Near ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
      setAddress(fallbackText);
      setAreaName(fallbackText);
    } finally {
      setLoadingAddress(false);
    }
  }, []);

  // Debounced reverse geocoding on pin pan/drag
  const handleMapMoved = useCallback(
    (lat: number, lng: number) => {
      setCenter({ latitude: lat, longitude: lng });

      if (isLockingSuggestionRef.current) {
        isLockingSuggestionRef.current = false;
        return;
      }

      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
      geocodeTimeoutRef.current = setTimeout(() => {
        reverseGeocode(lat, lng);
      }, 300);
    },
    [reverseGeocode]
  );

  // Smoothly fly map to coordinates
  const flyToCoordinates = useCallback(
    (lat: number, lng: number, zoom = 16) => {
      setCenter({ latitude: lat, longitude: lng });

      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.setView([lat, lng], zoom, { animate: true });
        } catch {}
      }

      handleMapMoved(lat, lng);
    },
    [handleMapMoved]
  );

  // Initialize Leaflet Map ONCE when modal opens (NO center dependency to prevent _leaflet_pos crash)
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let isSubscribed = true;

    import("leaflet").then((L) => {
      if (!isSubscribed || !mapContainerRef.current) return;

      // Clean up previous instance and container ID
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.off();
          leafletMapRef.current.remove();
        } catch {}
        leafletMapRef.current = null;
      }

      const container = mapContainerRef.current as unknown as Record<string, unknown>;
      if (container?._leaflet_id) {
        delete container._leaflet_id;
      }

      // Add Leaflet CSS if missing
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const initialLat = center.latitude;
      const initialLng = center.longitude;

      // Initialize Leaflet Map (no default zoom control to prevent overlap with Locate Me button)
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      // Standard OpenStreetMap tiles (100% free, zero watermarks, no API key required)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        subdomains: "abc",
      }).addTo(map);

      map.on("dragstart", () => {
        isLockingSuggestionRef.current = false;
      });

      map.on("moveend", () => {
        if (!isSubscribed) return;
        try {
          const c = map.getCenter();
          if (c && typeof c.lat === "number" && typeof c.lng === "number") {
            handleMapMoved(c.lat, c.lng);
          }
        } catch {}
      });

      leafletMapRef.current = map;

      // Invalidate size to ensure full-container rendering inside dynamic modal
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {}
      }, 150);

      // Initial reverse geocode if no address provided
      if (!initialAddress) {
        reverseGeocode(initialLat, initialLng);
      }
    });

    return () => {
      isSubscribed = false;
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.off();
          leafletMapRef.current.remove();
        } catch {}
        leafletMapRef.current = null;
      }
      const container = mapContainerRef.current as unknown as Record<string, unknown>;
      if (container?._leaflet_id) {
        delete container._leaflet_id;
      }
    };
  }, [isOpen]); // <-- ONLY [isOpen]! Never center coordinates, preventing re-mount loops

  // Real-Time Autosuggestion Fetcher (pan-India, no viewbox restrictions)
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

    // 1. Photon API (Komoot OSM Geocoder, pan-India, highly responsive)
    try {
      const photonRes = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`
      );
      if (photonRes.ok) {
        const pData = await photonRes.json();
        if (pData?.features && Array.isArray(pData.features)) {
          pData.features.forEach((f: { geometry?: { coordinates?: [number, number] }; properties?: Record<string, string | undefined> }, idx: number) => {
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

    // 2. Nominatim pan-India fallback
    if (results.length < 3) {
      try {
        const osmRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=5`,
          { headers: { "Accept-Language": "en" } }
        );
        if (osmRes.ok) {
          const osmData = await osmRes.json();
          if (Array.isArray(osmData)) {
            osmData.forEach((item: { lat: string; lon: string; display_name?: string; name?: string }, idx: number) => {
              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);
              if (!isNaN(lat) && !isNaN(lon)) {
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
    }, 250);
  };

  // Select a suggestion (Uber/Rapido 1-tap UX)
  const handleSelectSuggestion = (s: LocationSuggestion) => {
    const full = s.secondaryText ? `${s.mainText}, ${s.secondaryText}` : s.mainText;
    setSearchQuery(s.mainText);
    setAddress(full);
    setAreaName(s.mainText);
    setShowSuggestions(false);

    // Lock suggestion name so map flyTo does not overwrite it with raw coords
    isLockingSuggestionRef.current = true;
    flyToCoordinates(s.latitude, s.longitude, 16);
  };

  // Submit search (Enter key or Search button)
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0]);
      return;
    }

    setSearching(true);
    setStatusNotice("");

    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=en`);
      if (res.ok) {
        const pData = await res.json();
        const f = pData?.features?.[0];
        if (f?.geometry?.coordinates) {
          const [lon, lat] = f.geometry.coordinates;
          const label = f.properties?.name || q;
          setAddress(label);
          setAreaName(label);
          isLockingSuggestionRef.current = true;
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
        isLockingSuggestionRef.current = false;
        flyToCoordinates(latitude, longitude, 17);
      },
      (err) => {
        setLocating(false);
        setStatusNotice(
          err.code === 1
            ? "Location permission denied. You can pan the map or search."
            : "Could not retrieve GPS location. Please pan the map."
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  // Custom Zoom Handlers
  const handleZoomIn = () => {
    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.zoomIn();
      } catch {}
    }
  };
  const handleZoomOut = () => {
    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.zoomOut();
      } catch {}
    }
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
    const finalAddress = address || areaName || `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`;
    onConfirm({
      address: finalAddress,
      latitude: center.latitude,
      longitude: center.longitude,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs antialiased">
      <div className="relative flex flex-col w-full max-w-xl h-[88vh] max-h-[660px] rounded-2xl bg-surface-container-lowest shadow-2xl border border-outline-variant overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/60 bg-surface-container-lowest z-30 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Icon name="explore" className="text-lg text-primary" />
            </span>
            <div>
              <h3 className="font-display font-medium text-body-md text-on-surface">{title}</h3>
              <p className="text-label-sm text-outline">Pan map to place pin at your exact spot</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-outline hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer"
            aria-label="Close"
          >
            <Icon name="close" className="text-sm" />
          </button>
        </div>

        {/* Top Search Bar with Autosuggestions */}
        <div ref={searchContainerRef} className="relative p-3.5 bg-surface-variant border-b border-outline-variant/60 shrink-0 z-30">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Icon name="search" className="absolute left-3.5 text-base text-outline pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Search area, landmark or town (e.g. Hauz Khas, Darjeeling Mall, Bagdogra Airport)"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-10 pr-24 py-2.5 text-body-sm text-on-surface font-medium focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none shadow-xs transition-all placeholder:text-outline"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                className="absolute right-20 text-outline hover:text-on-surface p-1 cursor-pointer"
              >
                <Icon name="close" className="text-xs" />
              </button>
            )}
            <button
              type="submit"
              disabled={searching}
              className="absolute right-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-label-sm font-medium text-on-primary hover:bg-primary-container transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>

          {/* Elevated Dynamic Suggestions Popover */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-3.5 right-3.5 top-full mt-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl p-1.5 space-y-0.5 max-h-64 overflow-y-auto z-50">
              <div className="px-3 py-1 text-label-sm font-medium text-outline border-b border-outline-variant/40">
                Matching places &amp; landmarks
              </div>
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(s);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-body-sm hover:bg-primary/8 flex items-start gap-3 transition-colors cursor-pointer group"
                >
                  <div className="h-7 w-7 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/15 transition-colors">
                    <Icon name="location_on" className="text-sm text-primary" />
                  </div>
                  <div className="flex-1 truncate">
                    <span className="font-medium text-on-surface block truncate group-hover:text-primary">
                      {s.mainText}
                    </span>
                    <span className="text-label-sm text-outline block truncate">
                      {s.secondaryText}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {loadingSuggestions && (
            <div className="absolute right-28 top-5 text-label-sm text-outline flex items-center gap-1 font-medium">
              <span className="h-2.5 w-2.5 animate-spin rounded-full border border-primary border-t-transparent" />
              <span>Matching…</span>
            </div>
          )}

          {statusNotice && (
            <p className="mt-1.5 text-label-sm text-secondary font-medium px-1 flex items-center gap-1">
              <Icon name="info" className="text-xs text-secondary shrink-0" />
              <span>{statusNotice}</span>
            </p>
          )}
        </div>

        {/* Map Viewport Area */}
        <div className="relative flex-1 bg-surface-variant overflow-hidden">
          {/* Map Container */}
          <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full" />

          {/* Stationary Center Pin */}
          <div
            className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center pb-9 transition-opacity duration-200 ${
              showSuggestions && suggestions.length > 0 ? "opacity-0" : "opacity-100"
            }`}
          >
            <div className="flex flex-col items-center animate-bounce-short">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-2xl ring-4 ring-white/95">
                <Icon name="location_on" className="text-2xl" />
              </div>
              <div className="h-2 w-5 rounded-full bg-black/40 blur-[1px] mt-0.5" />
            </div>
          </div>

          {/* Custom Zoom Controls */}
          <div className="absolute top-4 right-4 z-20 flex flex-col rounded-xl bg-surface-container-lowest shadow-md border border-outline-variant overflow-hidden">
            <button
              type="button"
              onClick={handleZoomIn}
              className="flex h-9 w-9 items-center justify-center text-on-surface hover:bg-surface-container-low border-b border-outline-variant transition-colors cursor-pointer"
              title="Zoom in"
            >
              <Icon name="add" className="text-sm font-medium" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="flex h-9 w-9 items-center justify-center text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              title="Zoom out"
            >
              <Icon name="remove" className="text-sm font-medium" />
            </button>
          </div>

          {/* Floating GPS Locate Button */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="absolute bottom-4 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-lowest text-primary shadow-lg border border-outline-variant hover:bg-surface-container-low transition-colors cursor-pointer active:opacity-85 disabled:opacity-50"
            title="Use current GPS location"
          >
            {locating ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Icon name="my_location" className="text-xl text-primary" />
            )}
          </button>
        </div>

        {/* Bottom Address Confirmation Sheet */}
        <div className="p-4 sm:p-5 bg-surface-container-lowest border-t border-outline-variant/60 space-y-3 z-30 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-label-sm font-medium text-outline">
                Location under pin
              </span>
              <span className="font-mono text-label-sm text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20 font-medium">
                {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
              </span>
            </div>
            <div className="min-h-[42px] flex flex-col justify-center">
              {loadingAddress ? (
                <div className="inline-flex items-center gap-2 text-body-sm font-medium text-outline">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Locating nearest landmark…</span>
                </div>
              ) : (
                <>
                  <p className="font-display font-medium text-body-md text-on-surface leading-tight truncate">
                    {areaName || address || "Selected location"}
                  </p>
                  <p className="text-label-sm text-outline truncate leading-normal">
                    {address || `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2.5 pt-0.5">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-label-md font-medium text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="w-2/3 py-3 rounded-xl bg-primary text-label-md font-medium text-on-primary hover:bg-primary-container transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <Icon name="check" className="text-sm font-medium" />
              <span>Confirm location</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
