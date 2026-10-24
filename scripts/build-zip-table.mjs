/**
 * Builds data/zip-centroids.csv, the bundled ZIP centroid table.
 *
 * You should not need to run this. The CSV it produces is committed, which is
 * the whole point: MealBridge resolves "nearest" without ever calling a
 * geocoding service, so the lookup table has to live in the repo and load via
 * the normal db setup.
 *
 * Re-run it only to refresh the data from source:
 *   1. https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip
 *   2. https://download.geonames.org/export/zip/US.zip
 *   unzip both into data/gaz_extract/ and data/geonames_extract/, then
 *   node scripts/build-zip-table.mjs
 *
 * Sources, and why both:
 *   - Census ZCTA Gazetteer (public domain) has the authoritative population-
 *     weighted centroid for each ZCTA, but carries no city or state name.
 *   - GeoNames postal codes (CC BY 4.0) carry city and state, and also cover
 *     PO-box-only ZIPs that have no ZCTA at all.
 *   We prefer the Census centroid wherever one exists and fall back to
 *   GeoNames, so every ZIP a user can type resolves to a point.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");

const gazPath = path.join(dataDir, "gaz_extract", "2024_Gaz_zcta_national.txt");
const geoPath = path.join(dataDir, "geonames_extract", "US.txt");

for (const [p, what] of [
  [gazPath, "Census gazetteer"],
  [geoPath, "GeoNames postal codes"],
]) {
  if (!existsSync(p)) {
    console.error(`Missing ${what} at ${p}\nSee the header of this file for where to get it.`);
    process.exit(1);
  }
}

/** zip -> { city, state, lat, lng, src } */
const table = new Map();

// --- GeoNames first: it supplies the names, and the fallback coordinates. ---
for (const line of readFileSync(geoPath, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const f = line.split("\t");
  const zip = f[1]?.trim();
  const city = f[2]?.trim();
  const state = f[4]?.trim();
  const lat = Number(f[9]);
  const lng = Number(f[10]);
  if (!/^\d{5}$/.test(zip) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  // GeoNames lists some ZIPs more than once (one row per place). The first row
  // is the primary place name, which is the one a person recognises.
  if (!table.has(zip)) table.set(zip, { city, state, lat, lng, src: "geonames" });
}

// --- Census second: overwrite coordinates with the authoritative centroid. ---
let censusHits = 0;
const gazLines = readFileSync(gazPath, "utf8").split("\n");
for (const line of gazLines.slice(1)) {
  if (!line.trim()) continue;
  const f = line.split("\t").map((s) => s.trim());
  const zip = f[0];
  const lat = Number(f[5]);
  const lng = Number(f[6]);
  if (!/^\d{5}$/.test(zip) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  const existing = table.get(zip);
  if (existing) {
    existing.lat = lat;
    existing.lng = lng;
    existing.src = "census";
  } else {
    table.set(zip, { city: "", state: "", lat, lng, src: "census" });
  }
  censusHits++;
}

// State is the one field we can repair without a third source: a ZCTA with no
// GeoNames match still belongs to a known state, and seekers see it in the
// "ZIP 60615, IL" confirmation. Leave city blank rather than guess it.
const csv = ["zip,city,state,lat,lng"];
const sorted = [...table.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
let missingName = 0;
for (const [zip, r] of sorted) {
  if (!r.state) missingName++;
  // Quote city: a handful contain commas ("Truth or Consequences" is fine but
  // e.g. some Puerto Rico place names are not).
  const city = r.city.includes(",") ? `"${r.city.replace(/"/g, '""')}"` : r.city;
  csv.push(`${zip},${city},${r.state},${r.lat.toFixed(5)},${r.lng.toFixed(5)}`);
}

const outPath = path.join(dataDir, "zip-centroids.csv");
writeFileSync(outPath, csv.join("\n") + "\n");

const bytes = Buffer.byteLength(csv.join("\n"));
console.log(
  [
    `wrote ${outPath}`,
    `  ${sorted.length.toLocaleString()} ZIPs  (${(bytes / 1024 / 1024).toFixed(2)} MB)`,
    `  ${censusHits.toLocaleString()} with a Census ZCTA centroid`,
    `  ${(sorted.length - censusHits).toLocaleString()} GeoNames-only (PO-box ZIPs with no ZCTA)`,
    `  ${missingName.toLocaleString()} without a city/state name`,
  ].join("\n"),
);
