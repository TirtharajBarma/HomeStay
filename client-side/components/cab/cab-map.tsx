"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import type { CabPoint } from "@/lib/cabs";

import "leaflet/dist/leaflet.css";

/** Pins are drawn from the design system instead of Leaflet's default image,
 *  which would otherwise need a bundler asset workaround. */
function pinIcon(kind: "from" | "to", active: boolean, label: string): L.DivIcon {
  const head = kind === "from" ? "bg-primary" : "bg-secondary";
  const ring = active ? "ring-4 ring-on-surface/25" : "ring-0";
  const what = kind === "from" ? "Pickup" : "Drop";

  return L.divIcon({
    className: "",
    html: `<span class="flex flex-col items-center" title="${what}: ${label}">
      <span class="grid h-9 w-9 place-items-center rounded-full ${head} ${ring} shadow-[0_2px_6px_rgba(24,28,27,0.35)]">
        <span class="h-2.5 w-2.5 rounded-full bg-surface-container-lowest"></span>
      </span>
      <span class="h-3 w-[2px] bg-on-surface/70"></span>
    </span>`,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
  });
}

const round5 = (n: number) => Number(n.toFixed(5));

/** Keeps both pins in view whenever either one moves. */
function FitBounds({ from, to }: { from: CabPoint; to: CabPoint }) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([from.lat, from.lng], [to.lat, to.lng]);
    map.fitBounds(bounds, { padding: [64, 64], maxZoom: 14 });
  }, [map, from, to]);

  return null;
}

function ClickToPlace({ onPick }: { onPick: (point: CabPoint) => void }) {
  useMapEvents({
    click(event) {
      onPick({ label: "Dropped pin", lat: round5(event.latlng.lat), lng: round5(event.latlng.lng) });
    },
  });

  return null;
}

type Props = {
  from: CabPoint;
  to: CabPoint;
  editing: "from" | "to";
  onPickFrom: (point: CabPoint) => void;
  onPickTo: (point: CabPoint) => void;
};

export function CabMap({ from, to, editing, onPickFrom, onPickTo }: Props) {
  const centre = useMemo(
    () => [(from.lat + to.lat) / 2, (from.lng + to.lng) / 2] as [number, number],
    [from, to],
  );

  const dragFrom = (event: L.DragEndEvent) => {
    const { lat, lng } = event.target.getLatLng();
    onPickFrom({ label: "Dropped pin", lat: round5(lat), lng: round5(lng) });
  };

  const dragTo = (event: L.DragEndEvent) => {
    const { lat, lng } = event.target.getLatLng();
    onPickTo({ label: "Dropped pin", lat: round5(lat), lng: round5(lng) });
  };

  return (
    <MapContainer
      center={centre}
      zoom={12}
      zoomControl={false}
      scrollWheelZoom
      className="h-full w-full"
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      <Marker
        position={[from.lat, from.lng]}
        icon={pinIcon("from", editing === "from", from.label)}
        draggable
        eventHandlers={{ dragend: dragFrom }}
      />
      <Marker
        position={[to.lat, to.lng]}
        icon={pinIcon("to", editing === "to", to.label)}
        draggable
        eventHandlers={{ dragend: dragTo }}
      />

      <ClickToPlace onPick={editing === "from" ? onPickFrom : onPickTo} />
      <FitBounds from={from} to={to} />
    </MapContainer>
  );
}
