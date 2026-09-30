"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { fieldClass, labelClass } from "@/components/owner/primitives";
import {
  clampLat,
  formatLat,
  formatLng,
  project,
  tileUrl,
  tilesForViewport,
  unproject,
  wrapLng,
  type LatLng,
} from "@/lib/geo";

const MIN_ZOOM = 4;
const MAX_ZOOM = 18;
/** Darjeeling, West Bengal — where the demo estate sits. */
const FALLBACK: LatLng = { lat: 27.03677, lng: 88.26302 };

type PickerProps = {
  value: LatLng | null;
  onChange: (next: LatLng | null) => void;
  /** Human-readable label for the dropped pin, e.g. an address. */
  label?: string;
  height?: number;
};

type SearchHit = { lat: number; lng: number; label: string };

/**
 * Drop a pin on a map, search for a place, or borrow the device's own position.
 * Coordinates are the source of truth — the tiles are only a backdrop, so the
 * picker keeps working with no network.
 */
export function LocationPicker({ value, onChange, label, height = 260 }: PickerProps) {
  const [zoom, setZoom] = useState(15);
  const [size, setSize] = useState({ width: 0, height });
  const [dragging, setDragging] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [tilesOk, setTilesOk] = useState(true);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const surface = useRef<HTMLDivElement>(null);

  const center = value ?? FALLBACK;

  // The tile grid needs a measured box, so watch the element rather than guess.
  useEffect(() => {
    const node = surface.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const centerLat = center.lat;
  const centerLng = center.lng;
  const tiles = useMemo(
    () => (size.width ? tilesForViewport({ lat: centerLat, lng: centerLng }, zoom, size.width, size.height) : []),
    [centerLat, centerLng, zoom, size.width, size.height],
  );

  const pin = useMemo(() => {
    if (!value || !size.width) return null;
    const anchor = project({ lat: centerLat, lng: centerLng }, zoom);
    return { x: anchor.x - size.width / 2, y: anchor.y - size.height / 2 };
  }, [value, centerLat, centerLng, zoom, size.width, size.height]);

  /** Turn a pointer position inside the map surface into a coordinate. */
  const place = (clientX: number, clientY: number) => {
    const node = surface.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const anchor = project(center, zoom);
    const next = unproject(
      anchor.x - rect.width / 2 + (clientX - rect.left),
      anchor.y - rect.height / 2 + (clientY - rect.top),
      zoom,
    );
    onChange({ lat: Number(clampLat(next.lat).toFixed(5)), lng: Number(wrapLng(next.lng).toFixed(5)) });
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("This browser cannot share a location.");
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5)),
        });
        setLocating(false);
      },
      () => {
        setGeoError("Could not read your location — pin it by tapping the map.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const search = async () => {
    const term = query.trim();
    if (term.length < 3) return;
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(term)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;
      setHits(
        data.map((row) => ({
          lat: Number(row.lat),
          lng: Number(row.lon),
          label: row.display_name,
        })),
      );
    } catch {
      setHits([]);
      setGeoError("Place search needs a connection. Tap the map to place the pin instead.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <label className={labelClass} htmlFor="geo-search">
            Search a place
          </label>
          <div className="flex gap-2">
            <input
              id="geo-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHits([]);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void search();
                }
              }}
              placeholder="Ging Tea Estate Road, Darjeeling"
              className={fieldClass}
            />
            <button
              type="button"
              onClick={() => void search()}
              disabled={searching}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 text-label-md text-label-md text-on-surface transition-colors hover:border-primary disabled:opacity-50"
            >
              <Icon name="search" className="text-[18px] text-outline" />
              {searching ? "…" : "Find"}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-label-md text-label-md text-on-surface transition-colors hover:border-primary disabled:opacity-50"
        >
          <Icon name="my_location" className="text-[18px] text-outline" />
          {locating ? "Locating…" : "Use my location"}
        </button>
      </div>

      {hits.length > 0 ? (
        <ul className="divide-y divide-outline-variant/20 overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
          {hits.map((hit) => (
            <li key={`${hit.lat},${hit.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onChange({ lat: hit.lat, lng: hit.lng });
                  setHits([]);
                  setQuery("");
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
              >
                <Icon name="location_on" className="mt-0.5 text-[16px] text-outline" />
                <span className="leading-snug">{hit.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        ref={surface}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          place(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (dragging) place(event.clientX, event.clientY);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        style={{ height }}
        className={`relative w-full touch-none overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container ${
          dragging ? "cursor-grabbing" : "cursor-crosshair"
        }`}
        role="application"
        aria-label="Map. Tap or drag to place the pin."
      >
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${tile.z}/${tile.x}/${tile.y}`}
            src={tileUrl(tile)}
            alt=""
            draggable={false}
            onError={() => setTilesOk(false)}
            className="pointer-events-none absolute select-none"
            style={{
              left: tile.left,
              top: tile.top,
              width: 256,
              height: 256,
            }}
          />
        ))}

        {!tilesOk ? (
          <span className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-on-surface/80 px-3 py-1 text-label-sm text-label-sm text-surface">
            Map tiles offline — tap to set coordinates
          </span>
        ) : null}

        {!tiles.length && tilesOk ? <div className="absolute inset-0 skeleton-shimmer" /> : null}

        {pin ? (
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
            style={{ left: pin.x, top: pin.y }}
          >
            <Icon name="location_on" className="text-[34px] text-primary drop-shadow" />
            <span className="mx-auto -mt-1 block h-1.5 w-1.5 rounded-full bg-primary/40" />
          </span>
        ) : null}

        <span className="absolute end-2 top-2 flex flex-col gap-1">
          <button
            type="button"
            aria-label="Zoom in"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
            disabled={zoom >= MAX_ZOOM}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface shadow-sm transition-colors hover:bg-surface-container disabled:opacity-40"
          >
            <Icon name="add" className="text-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
            disabled={zoom <= MIN_ZOOM}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface shadow-sm transition-colors hover:bg-surface-container disabled:opacity-40"
          >
            <Icon name="remove" className="text-[18px]" />
          </button>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="geo-lat">
            Latitude
          </label>
          <input
            id="geo-lat"
            type="number"
            step="0.00001"
            value={value ? value.lat : ""}
            onChange={(event) => {
              const lat = Number(event.target.value);
              if (Number.isFinite(lat)) onChange({ lat: clampLat(lat), lng: center.lng });
            }}
            placeholder="27.03677"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="geo-lng">
            Longitude
          </label>
          <input
            id="geo-lng"
            type="number"
            step="0.00001"
            value={value ? value.lng : ""}
            onChange={(event) => {
              const lng = Number(event.target.value);
              if (Number.isFinite(lng)) onChange({ lat: center.lat, lng: wrapLng(lng) });
            }}
            placeholder="88.26302"
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-label-sm text-label-sm text-outline">
          {value
            ? `${formatLat(value.lat)}, ${formatLng(value.lng)}${label ? ` · ${label}` : ""}`
            : "No pin yet — tap the map, search, or use your location."}
        </span>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-label-sm text-label-sm font-semibold uppercase text-outline transition-colors hover:text-error"
          >
            Clear pin
          </button>
        ) : null}
      </div>

      {geoError ? (
        <p className="text-label-sm text-label-sm text-error">{geoError}</p>
      ) : null}
    </div>
  );
}
