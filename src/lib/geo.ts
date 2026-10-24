/**
 * Distance without a location service.
 *
 * MealBridge never calls a geocoding, maps or places API and never asks the
 * browser for GPS. Everything spatial in this product is derived from one
 * bundled table of ZIP centroids (data/zip-centroids.csv) and the Haversine
 * formula below.
 *
 * The honest consequence is that every distance here is approximate: it is the
 * distance between the middle of two ZIP codes, not between two doorsteps. A
 * seeker standing at the edge of a large rural ZIP can be several miles off.
 * The UI says so in words wherever a number appears — see `formatDistance`,
 * which deliberately returns "about 2.3 miles", never "2.3 mi".
 */

export const EARTH_RADIUS_MILES = 3958.7613;

export type LatLng = { lat: number; lng: number };

export type ZipRecord = {
  zip: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in miles between two points. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Degree deltas that bound a radius, used to pre-filter candidate ZIPs with an
 * index range scan before doing the real trigonometry. Longitude degrees
 * shrink toward the poles, hence the cos(lat) term; the guard keeps it sane
 * near the poles, which for US ZIPs never actually triggers but costs nothing.
 */
export function boundingBox(center: LatLng, radiusMiles: number) {
  const latDelta = radiusMiles / 69.0;
  const cos = Math.cos(toRad(center.lat));
  const lngDelta = radiusMiles / (69.0 * Math.max(0.01, Math.abs(cos)));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/** True when two points are within `radiusMiles` of each other. */
export function withinRadius(a: LatLng, b: LatLng, radiusMiles: number): boolean {
  return haversineMiles(a, b) <= radiusMiles;
}

/* --------------------------------------------------------------- display -- */

/**
 * Distance as a person should read it.
 *
 * "Same ZIP code" rather than "0.0 miles": when the centroids match, the real
 * distance is unknown and small, and a decimal would imply a precision we do
 * not have. Above that we keep one decimal up to 10 miles and round beyond,
 * because nobody walking to a pickup needs a tenth of a mile at 24 miles out.
 */
export function formatDistance(miles: number, sameZip = false): string {
  if (sameZip) return "In your ZIP code";
  if (miles < 0.1) return "Less than a tenth of a mile away";
  if (miles < 10) return `About ${miles.toFixed(1)} miles away`;
  return `About ${Math.round(miles)} miles away`;
}

/** Spanish counterpart. Kept beside the English so they cannot drift apart. */
export function formatDistanceEs(miles: number, sameZip = false): string {
  if (sameZip) return "En tu código postal";
  if (miles < 0.1) return "A menos de un décimo de milla";
  if (miles < 10) return `A unas ${miles.toFixed(1)} millas`;
  return `A unas ${Math.round(miles)} millas`;
}

/* -------------------------------------------------------------- validation */

/** Five digits. We accept ZIP+4 and keep the first five, which is all we index. */
export function normalizeZip(input: string): string | null {
  const digits = String(input ?? "").trim();
  const match = digits.match(/^(\d{5})(?:-?\d{4})?$/);
  return match ? match[1] : null;
}

export const RADIUS_OPTIONS = [5, 10, 25] as const;
export type RadiusOption = (typeof RADIUS_OPTIONS)[number];

export function isRadiusOption(n: unknown): n is RadiusOption {
  return RADIUS_OPTIONS.includes(Number(n) as RadiusOption);
}
