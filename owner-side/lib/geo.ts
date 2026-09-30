/**
 * Web Mercator helpers for the slippy-map tile grid used by the location
 * picker. No mapping library — just the maths needed to place OSM raster tiles
 * and turn a click back into a latitude/longitude.
 */

export type LatLng = {
  lat: number;
  lng: number;
};

const TILE = 256;
const MAX_LAT = 85.05112878;

export const clampLat = (lat: number) => Math.min(MAX_LAT, Math.max(-MAX_LAT, lat));
export const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

export const formatLat = (lat: number) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}`;
export const formatLng = (lng: number) => `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`;

/** Fractional tile coordinates for a point at the given zoom. */
export function project(point: LatLng, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const lat = clampLat(point.lat);
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** The inverse of {@link project} — pixel position back to a coordinate. */
export function unproject(x: number, y: number, zoom: number): LatLng {
  const scale = TILE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return {
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    lng: wrapLng(lng),
  };
}

export type TileRef = {
  x: number;
  y: number;
  z: number;
  left: number;
  top: number;
};

/** Every tile needed to cover a `width` × `height` box centred on `center`. */
export function tilesForViewport(
  center: LatLng,
  zoom: number,
  width: number,
  height: number,
): TileRef[] {
  const anchor = project(center, zoom);
  const left = anchor.x - width / 2;
  const top = anchor.y - height / 2;
  const max = 2 ** zoom;

  const firstX = Math.floor(left / TILE);
  const firstY = Math.floor(top / TILE);
  const lastX = Math.floor((left + width) / TILE);
  const lastY = Math.floor((top + height) / TILE);

  const tiles: TileRef[] = [];
  for (let y = firstY; y <= lastY; y += 1) {
    for (let x = firstX; x <= lastX; x += 1) {
      if (y < 0 || y >= max) continue;
      tiles.push({
        x: ((x % max) + max) % max,
        y,
        z: zoom,
        left: x * TILE - left,
        top: y * TILE - top,
      });
    }
  }
  return tiles;
}

export const tileUrl = ({ x, y, z }: TileRef) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/** Rough ground distance in metres — good enough for a "how far" hint. */
export function distanceMetres(a: LatLng, b: LatLng) {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const formatDistance = (metres: number) =>
  metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
