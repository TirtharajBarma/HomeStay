"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useMemo, useState } from "react";

import { Icon } from "@/components/icon";
import {
  ESTATE,
  distanceKm,
  formatDistance,
  searchPlaces,
  type CabPlace,
  type CabPoint,
} from "@/lib/cabs";

/** Leaflet reads the DOM at import time, so the map is loaded client-side only. */
const CabMap = dynamic(
  () => import("@/components/cab/cab-map").then((mod) => mod.CabMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-64 w-full place-items-center text-label-sm text-on-surface-variant/70 sm:h-80">
        Loading map…
      </div>
    ),
  },
);

const fieldBase =
  "w-full rounded-2xl border border-outline-variant/70 bg-surface-container-lowest px-11 py-3 text-body-md text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/60 focus:border-primary/60 focus:bg-surface-container-lowest";

type Props = {
  from: CabPoint;
  to: CabPoint;
  onChange: (next: { from: CabPoint; to: CabPoint }) => void;
  errors?: Record<string, string>;
};

export function LocationPicker({ from, to, onChange, errors = {} }: Props) {
  const [editing, setEditing] = useState<"from" | "to">("to");
  const [mapOpen, setMapOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();

  const editingIsFrom = editing === "from";
  const active = editingIsFrom ? from : to;
  const [draft, setDraft] = useState(active.label);

  // The typed field mirrors the active pin. Resetting during render (rather than
  // in an effect) means swapping pins never leaves a stale frame behind.
  const activeKey = `${editing}:${active.label}`;
  const [lastActiveKey, setLastActiveKey] = useState(activeKey);

  if (lastActiveKey !== activeKey) {
    setLastActiveKey(activeKey);
    setDraft(active.label);
    setQuery("");
  }

  useEffect(() => {
    if (!mapOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [mapOpen]);

  const suggestions = useMemo(() => searchPlaces(query, 6), [query]);
  const showSuggestions = mapOpen && query.trim().length > 0;

  const km = distanceKm(from, to);
  const sameSpot = km < 0.05;

  const setPoint = (next: CabPoint) => {
    if (editingIsFrom) onChange({ from: next, to });
    else onChange({ from, to: next });
  };

  const chooseSuggestion = (place: CabPlace) => {
    setPoint({ label: place.name, lat: place.lat, lng: place.lng });
    setMapOpen(false);
    setEditing(editingIsFrom ? "to" : "from");
  };

  const handleTextChange = (value: string) => {
    setDraft(value);
    setQuery(value);
    setMapOpen(true);
  };

  const swap = () => {
    onChange({ from: to, to: from });
    setEditing(editingIsFrom ? "to" : "from");
  };

  const focusField = (which: "from" | "to") => {
    setEditing(which);
    setMapOpen(true);
  };

  return (
    <div className="space-y-3">
      <p aria-live="polite" className="sr-only">
        Pickup {from.label}. Drop {to.label}. {sameSpot ? "Same point." : `${formatDistance(km)} apart.`}
      </p>
      <div className="relative">
        <div className="flex items-stretch gap-2">
          <div className="relative min-w-0 flex-1">
            <span
              aria-hidden
              className="absolute left-4 top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary ring-4 ring-primary/15"
            />
            <label className="sr-only" htmlFor={`${listId}-from`}>
              Pickup point
            </label>
            <input
              id={`${listId}-from`}
              value={editingIsFrom ? draft : from.label}
              onChange={(event) => {
                setEditing("from");
                handleTextChange(event.target.value);
              }}
              onFocus={() => setEditing("from")}
              placeholder="Pickup point"
              autoComplete="off"
              className={`${fieldBase} ${
                errors.source ? "border-error" : ""
              } ${editingIsFrom ? "bg-surface-container-lowest" : ""}`}
            />
          </div>

          <button
            type="button"
            onClick={swap}
            aria-label="Swap pickup and drop"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-outline-variant/70 bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          >
            <Icon name="swap_vert" className="text-[20px]" />
          </button>

          <div className="relative min-w-0 flex-1">
            <span
              aria-hidden
              className="absolute left-4 top-1/2 z-10 grid h-2.5 w-2.5 -translate-y-1/2 place-items-center rounded-full bg-secondary"
            >
              <span className="h-1 w-1 rounded-full bg-surface-container-lowest" />
            </span>
            <label className="sr-only" htmlFor={`${listId}-to`}>
              Drop point
            </label>
            <input
              id={`${listId}-to`}
              value={editingIsFrom ? to.label : draft}
              onChange={(event) => {
                setEditing("to");
                handleTextChange(event.target.value);
              }}
              onFocus={() => setEditing("to")}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const match = searchPlaces(draft, 1)[0];
                  if (match) chooseSuggestion(match);
                }
              }}
              placeholder="Where to?"
              autoComplete="off"
              className={`${fieldBase} ${
                errors.destination ? "border-error" : ""
              } ${editingIsFrom ? "" : "bg-surface-container-lowest"}`}
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMapOpen((open) => !open)}
            aria-expanded={mapOpen}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant/70 bg-surface-container-low px-3 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-highest"
          >
            <Icon name="map" className="text-[16px]" />
            {mapOpen ? "Hide map" : "Show map"}
          </button>
          <button
            type="button"
            onClick={() => focusField("from")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant/70 bg-surface-container-low px-3 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-highest"
          >
            <Icon name="my_location" className="text-[16px]" />
            Edit pickup
          </button>
          <button
            type="button"
            onClick={() => focusField("to")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant/70 bg-surface-container-low px-3 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-highest"
          >
            <Icon name="add_location_alt" className="text-[16px]" />
            Edit drop
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing("to");
              setPoint({ label: ESTATE.name, lat: ESTATE.lat, lng: ESTATE.lng });
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant/70 bg-surface-container-low px-3 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-highest"
          >
            <Icon name="home" className="text-[16px]" />
            Estate gate
          </button>
        </div>

        {showSuggestions && (
          <ul className="mt-2 overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-lowest shadow-[0_12px_30px_rgba(24,28,27,0.10)]">
            {suggestions.length > 0 ? (
              suggestions.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => chooseSuggestion(place)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-high/50"
                  >
                    <Icon
                      name="location_on"
                      className="mt-0.5 text-[18px] text-on-surface-variant/70"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-body-sm font-medium text-on-surface">
                        {place.name}
                      </span>
                      <span className="block truncate text-label-sm text-on-surface-variant/80">
                        {place.note}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-label-sm text-on-surface-variant/80">
                No match in Darjeeling — tap the map to drop a pin instead.
              </li>
            )}
          </ul>
        )}
      </div>

      {mapOpen && (
        <div className="overflow-hidden rounded-3xl border border-outline-variant/70 bg-surface-container-low">
          <div className="flex items-center justify-between gap-2 border-b border-outline-variant/50 bg-surface-container-lowest/95 px-4 py-2">
            <p className="text-label-sm text-on-surface-variant">
              {editingIsFrom ? "Drag the pickup pin" : "Drag the drop pin"} · tap the map to
              move it
            </p>
          </div>
          <div className="h-64 w-full sm:h-80">
            <CabMap
              from={from}
              to={to}
              editing={editing}
              onPickFrom={(point) => {
                setEditing("from");
                onChange({ from: point, to });
              }}
              onPickTo={(point) => {
                setEditing("to");
                onChange({ from, to: point });
              }}
            />
          </div>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-label-sm text-on-surface-variant/90">
        <Icon name="straighten" className="text-[15px]" />
        {sameSpot
          ? "Pickup and drop are the same point"
          : `${formatDistance(km)} between the two points`}
      </p>
    </div>
  );
}
