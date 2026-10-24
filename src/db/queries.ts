import "server-only";
import { all, get, run, newId, now } from "./index";
import { boundingBox, haversineMiles, type ZipRecord } from "@/lib/geo";
import { liveState, isListable, type ListingStatus } from "@/lib/domain";

/* ------------------------------------------------------------------- zips - */

export function lookupZip(zip: string): ZipRecord | undefined {
  return get<ZipRecord>("SELECT zip, city, state, lat, lng FROM zip_codes WHERE zip = ?", [zip]);
}

export function zipExists(zip: string): boolean {
  return !!get("SELECT 1 AS ok FROM zip_codes WHERE zip = ?", [zip]);
}

/* --------------------------------------------------------------- listings - */

export type ListingRow = {
  id: string;
  provider_id: string;
  business_name: string;
  provider_phone: string | null;
  description: string;
  categories: string;
  dietary_tags: string;
  allergen_tags: string;
  portions_total: number;
  portions_remaining: number;
  street: string;
  city: string;
  state: string;
  zip: string;
  pickup_start: number;
  pickup_end: number;
  notes: string;
  photo_url: string | null;
  status: ListingStatus;
  created_at: number;
  distance_miles: number;
  same_zip: number;
};

/**
 * The Haversine distance between the seeker's ZIP centroid and a listing's, in
 * miles, as a SQL fragment. `:lat` / `:lng` are the seeker's centroid.
 *
 * This is the whole of "nearest" in MealBridge. No PostGIS, no geocoder, no
 * browser location prompt — one join against the bundled centroid table.
 */
const DISTANCE_SQL = `
  (2 * 3958.7613 * ASIN(MIN(1.0, SQRT(
      POWER(SIN(RADIANS(z.lat - :lat) / 2), 2)
    + POWER(SIN(RADIANS(z.lng - :lng) / 2), 2)
      * COS(RADIANS(:lat)) * COS(RADIANS(z.lat))
  ))))
`;

export type NearbyOptions = {
  lat: number;
  lng: number;
  zip: string;
  radiusMiles: number;
  dietary?: string[];
  /** "now" shows only what is collectable this minute; "later" what opens today. */
  when?: "any" | "now" | "later";
  at?: number;
  limit?: number;
};

/**
 * Listings near a ZIP, nearest first.
 *
 * Two-stage on purpose: a bounding box over the indexed lat/lng columns cuts
 * 41k ZIPs down to a few hundred before any trigonometry runs, then Haversine
 * gives the true great-circle distance and the HAVING clause trims the corners
 * of the box back to a circle.
 *
 * Ordering is distance first, then whichever window shuts soonest. That second
 * key is the one that matters at 8pm: among equally close options, the one
 * about to disappear should be read first.
 */
export function listNearby(opts: NearbyOptions): ListingRow[] {
  const at = opts.at ?? now();
  const box = boundingBox({ lat: opts.lat, lng: opts.lng }, opts.radiusMiles);

  const rows = all<ListingRow>(
    `
    WITH candidates AS (
      SELECT
        l.id, l.provider_id, p.business_name,
        CASE WHEN p.show_phone = 1 THEN p.phone ELSE NULL END AS provider_phone,
        l.description, l.categories, l.dietary_tags, l.allergen_tags,
        l.portions_total, l.portions_remaining,
        l.street, l.city, l.state, l.zip,
        l.pickup_start, l.pickup_end, l.notes, l.photo_url, l.status, l.created_at,
        ${DISTANCE_SQL} AS distance_miles,
        CASE WHEN l.zip = :zip THEN 1 ELSE 0 END AS same_zip
      FROM listings l
      JOIN providers p ON p.id = l.provider_id
      JOIN zip_codes z ON z.zip = l.zip
      WHERE l.status = 'active'
        AND p.status = 'approved'
        AND l.portions_remaining > 0
        AND l.pickup_end > :at
        AND z.lat BETWEEN :minLat AND :maxLat
        AND z.lng BETWEEN :minLng AND :maxLng
    )
    SELECT * FROM candidates
    WHERE distance_miles <= :radius
    ORDER BY same_zip DESC, distance_miles ASC, pickup_end ASC
    LIMIT :limit
    `,
    {
      lat: opts.lat,
      lng: opts.lng,
      zip: opts.zip,
      at,
      minLat: box.minLat,
      maxLat: box.maxLat,
      minLng: box.minLng,
      maxLng: box.maxLng,
      radius: opts.radiusMiles,
      limit: opts.limit ?? 100,
    },
  );

  return rows.filter((r) => {
    const state = liveState(r, at);
    if (!isListable(state)) return false;
    if (opts.when === "now" && state === "later") return false;
    if (opts.when === "later" && state !== "later") return false;
    if (opts.dietary?.length) {
      const tags = parseJsonArray(r.dietary_tags);
      // Every requested need must be met, not merely one of them. Someone
      // filtering for both halal and nut-free needs both to be true.
      if (!opts.dietary.every((d) => tags.includes(d))) return false;
    }
    return true;
  });
}

export function getListing(id: string): ListingRow | undefined {
  return get<ListingRow>(
    `
    SELECT
      l.*, p.business_name,
      CASE WHEN p.show_phone = 1 THEN p.phone ELSE NULL END AS provider_phone,
      0 AS distance_miles, 0 AS same_zip
    FROM listings l
    JOIN providers p ON p.id = l.provider_id
    WHERE l.id = ?
    `,
    [id],
  );
}

/** The same row, with distance measured from a seeker's ZIP. */
export function getListingFrom(id: string, origin: ZipRecord): ListingRow | undefined {
  const row = getListing(id);
  if (!row) return undefined;
  const dest = lookupZip(row.zip);
  if (!dest) return row;
  return {
    ...row,
    distance_miles: haversineMiles(origin, dest),
    same_zip: row.zip === origin.zip ? 1 : 0,
  };
}

export function listingsForProvider(providerId: string, limit = 100): ListingRow[] {
  return all<ListingRow>(
    `SELECT l.*, p.business_name, NULL AS provider_phone, 0 AS distance_miles, 0 AS same_zip
     FROM listings l JOIN providers p ON p.id = l.provider_id
     WHERE l.provider_id = ? ORDER BY l.created_at DESC LIMIT ?`,
    [providerId, limit],
  );
}

/**
 * How many people saved this listing. The provider sees this number and
 * nothing else — never who, never when, never whether they came. A restaurant
 * finding out which of its neighbours is hungry would be a betrayal of the
 * only thing a seeker is asked to trust us with.
 */
export function interestCount(listingId: string): number {
  const row = get<{ n: number }>("SELECT COUNT(*) AS n FROM saved_listings WHERE listing_id = ?", [
    listingId,
  ]);
  return row?.n ?? 0;
}

/* --------------------------------------------------------------- matching - */

export type AlertMatch = {
  alert_id: string;
  seeker_id: string;
  channel: string;
  dietary_filters: string;
  distance_miles: number;
  language: string;
};

/**
 * Seekers to notify about a new listing: an active alert whose ZIP centroid is
 * inside the radius *they* chose, and whose dietary filters the food satisfies.
 *
 * Note the radius comparison is against `a.radius_miles`, the seeker's own
 * setting, not a constant — one person's "10 miles" is a bus ride and
 * another's is a walk, and we respect whichever they picked.
 */
export function matchAlertsForListing(listingZip: string, dietaryTags: string[]): AlertMatch[] {
  const origin = lookupZip(listingZip);
  if (!origin) return [];

  // 25 miles is the largest radius the UI offers, so it bounds the scan.
  const box = boundingBox(origin, 25);

  const rows = all<AlertMatch>(
    `
    WITH candidates AS (
      SELECT a.id AS alert_id, a.seeker_id, a.channel, a.dietary_filters,
             a.radius_miles, u.language,
             ${DISTANCE_SQL} AS distance_miles
      FROM alerts a
      JOIN zip_codes z ON z.zip = a.zip
      JOIN users u ON u.id = a.seeker_id
      WHERE a.active = 1
        AND z.lat BETWEEN :minLat AND :maxLat
        AND z.lng BETWEEN :minLng AND :maxLng
    )
    SELECT alert_id, seeker_id, channel, dietary_filters, language, distance_miles
    FROM candidates
    WHERE distance_miles <= radius_miles
    `,
    {
      lat: origin.lat,
      lng: origin.lng,
      minLat: box.minLat,
      maxLat: box.maxLat,
      minLng: box.minLng,
      maxLng: box.maxLng,
    },
  );

  return rows.filter((r) => {
    const wanted = parseJsonArray(r.dietary_filters);
    return wanted.every((w) => dietaryTags.includes(w));
  });
}

/* ------------------------------------------------------------------ sweep - */

/**
 * Closes out listings the clock has overtaken. Read paths already hide these,
 * so this only makes the stored status agree with reality — which keeps
 * provider history, counts and the admin view honest.
 */
export function expireStaleListings(at: number = now()): { expired: number; gone: number } {
  const expired = run(
    "UPDATE listings SET status = 'expired', updated_at = ? WHERE status = 'active' AND pickup_end <= ?",
    [at, at],
  );
  const gone = run(
    "UPDATE listings SET status = 'gone', updated_at = ? WHERE status = 'active' AND portions_remaining <= 0",
    [at],
  );
  return { expired: Number(expired.changes ?? 0), gone: Number(gone.changes ?? 0) };
}

/* ----------------------------------------------------------------- utils -- */

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export { newId, now };
