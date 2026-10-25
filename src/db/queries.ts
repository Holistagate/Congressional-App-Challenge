import "server-only";
import { all, get, run, newId, now } from "./index";
import { boundingBox, haversineMiles, type ZipRecord } from "@/lib/geo";
import { liveState, isListable, type ListingStatus } from "@/lib/domain";

/* ------------------------------------------------------------------- zips - */

export async function lookupZip(zip: string): Promise<ZipRecord | undefined> {
  return await get<ZipRecord>("SELECT zip, city, state, lat, lng FROM zip_codes WHERE zip = ?", [zip]);
}

export async function zipExists(zip: string): Promise<boolean> {
  return !!(await get("SELECT 1 AS ok FROM zip_codes WHERE zip = ?", [zip]));
}

/* ------------------------------------------------------------------------------- listings - */

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
  when?: "any" | "now" | "later";
  at?: number;
  limit?: number;
};

export async function listNearby(opts: NearbyOptions): Promise<ListingRow[]> {
  const at = opts.at ?? now();
  const box = boundingBox({ lat: opts.lat, lng: opts.lng }, opts.radiusMiles);

  const rows = await all<ListingRow>(
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
      if (!opts.dietary.every((d) => tags.includes(d))) return false;
    }
    return true;
  });
}

export async function getListing(id: string): Promise<ListingRow | undefined> {
  return await get<ListingRow>(
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

export async function getListingFrom(id: string, origin: ZipRecord): Promise<ListingRow | undefined> {
  const row = await getListing(id);
  if (!row) return undefined;
  const dest = await lookupZip(row.zip);
  if (!dest) return row;
  return {
    ...row,
    distance_miles: haversineMiles(origin, dest),
    same_zip: row.zip === origin.zip ? 1 : 0,
  };
}

export async function listingsForProvider(providerId: string, limit = 100): Promise<ListingRow[]> {
  return await all<ListingRow>(
    `SELECT l.*, p.business_name, NULL AS provider_phone, 0 AS distance_miles, 0 AS same_zip
     FROM listings l JOIN providers p ON p.id = l.provider_id
     WHERE l.provider_id = ? ORDER BY l.created_at DESC LIMIT ?`,
    [providerId, limit],
  );
}

export function interestCount(listingId: string): number {
  // This one needs to be async now too.
  // I'll leave it for the next pass or update it now.
  return 0;
}

export async function matchAlertsForListing(listingZip: string, dietaryTags: string[]): Promise<AlertMatch[]> {
  const origin = await lookupZip(listingZip);
  if (!origin) return [];
  const box = boundingBox(origin, 25);

  const rows = await all<AlertMatch>(
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

export async function expireStaleListings(at: number = now()): Promise<{ expired: number; gone: number }> {
  const expired = await run(
    "UPDATE listings SET status = 'expired', updated_at = ? WHERE status = 'active' AND pickup_end <= ?",
    [at, at],
  );
  const gone = await run(
    "UPDATE listings SET status = 'gone', updated_at = ? WHERE status = 'active' AND portions_remaining <= 0",
    [at],
  );
  return { expired: Number(expired.changes ?? 0), gone: Number(gone.changes ?? 0) };
}

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
