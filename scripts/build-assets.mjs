/**
 * Turns the original art in ../ into the small files the app actually ships.
 *
 * The originals are 1-7 MB each. MealBridge is built for a cheap phone on a
 * weak connection, so nothing here is allowed near the critical path at full
 * size. Run with: npm run assets
 */
import sharp from "sharp";
import { mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => path.join(root, "design", "source", f);
const out = (...p) => path.join(root, "public", ...p);

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

await mkdir(out("media"), { recursive: true });
await mkdir(out("icons"), { recursive: true });

/* ---------------------------------------------------------------- logo ---
 * The original sits on a cream field. Cream on our white surfaces reads as a
 * dirty rectangle, so we trim the field away and punch a circular alpha mask
 * so the mark can sit on the storefront sign, on white, and on pine.
 */
const MARK = 1024;

// Trim the cream field, then mask to a circle just inside the ring. Threshold
// 20 is high enough to catch the anti-aliased edge of the cream.
const trimmed = await sharp(src("logo.png"))
  .trim({ threshold: 20 })
  .resize(MARK, MARK, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  // The mark's interior is cream (#F7F4EE), which reads as a dirty disc on our
  // white surfaces. This curve maps 247 -> 255 while leaving the darkest greens
  // where they are (20 -> 20), so the field goes white and the art doesn't move.
  .linear(1.035, -0.7)
  .png()
  .toBuffer();

// Sits just inside the ring's outer edge so no cream survives at the rim.
const R = MARK / 2 - MARK * 0.022;
const circle = Buffer.from(
  `<svg width="${MARK}" height="${MARK}"><circle cx="${MARK / 2}" cy="${MARK / 2}" r="${R}" fill="#fff"/></svg>`,
);

const mark = await sharp(trimmed)
  .composite([{ input: circle, blend: "dest-in" }])
  .png({ compressionLevel: 9 })
  .toBuffer();

await sharp(mark).toFile(out("icons", "mark-1024.png"));
for (const size of [512, 192, 180, 64, 32]) {
  await sharp(mark).resize(size, size).png({ compressionLevel: 9 }).toFile(out("icons", `mark-${size}.png`));
}

// Maskable icon: Android crops to a circle/squircle, so the mark gets a 20%
// safe-area inset on a pine field rather than bleeding to the edge.
const PINE = { r: 0x14, g: 0x53, b: 0x2a, alpha: 1 };
for (const size of [512, 192]) {
  const inner = Math.round(size * 0.62);
  await sharp({ create: { width: size, height: size, channels: 4, background: PINE } })
    .composite([{ input: await sharp(mark).resize(inner, inner).png().toBuffer(), gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toFile(out("icons", `maskable-${size}.png`));
}

/* -------------------------------------------------------------- plates ---
 * The role chooser. On wide screens the photo is used whole: the two plates
 * in the shot are the two choices. On a phone that composition collapses, so
 * we also cut each plate out as its own crop and stack them.
 */
const plates = sharp(src("plates.png"));
const pm = await plates.metadata();

await sharp(src("plates.png"))
  .resize(1600, null, { withoutEnlargement: true })
  .webp({ quality: 74 })
  .toFile(out("media", "plates-1600.webp"));

await sharp(src("plates.png"))
  .resize(900, null, { withoutEnlargement: true })
  .webp({ quality: 72 })
  .toFile(out("media", "plates-900.webp"));

const half = (name, left) =>
  sharp(src("plates.png"))
    .extract({
      left: Math.round(pm.width * left),
      top: Math.round(pm.height * 0.17),
      width: Math.round(pm.width * 0.47),
      height: Math.round(pm.height * 0.62),
    })
    .resize(760, null, { withoutEnlargement: true })
    .webp({ quality: 74 })
    .toFile(out("media", name));

await half("plate-seeker.webp", 0.02);
await half("plate-provider.webp", 0.5);

/* ---------------------------------------------------------- storefront ---
 * Act III of the opening. The sign board in the shot is blank, which is where
 * the mark lands once the door opens.
 */
for (const w of [1600, 900]) {
  await sharp(src("storefront.png"))
    .resize(w, null, { withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(out("media", `storefront-${w}.webp`));
}


/* ------------------------------------------------------------ manifest ---- */
const report = [];
for (const f of [
  "icons/mark-512.png",
  "icons/maskable-512.png",
  "media/plates-1600.webp",
  "media/plate-seeker.webp",
  "media/plate-provider.webp",
  "media/storefront-1600.webp",
]) {
  if (await exists(out(f))) {
    const { size } = await sharp(out(f))
      .metadata()
      .then((m) => ({ size: m.size }))
      .catch(() => ({ size: 0 }));
    report.push(`  ${f}${size ? ` (${Math.round(size / 1024)} KB)` : ""}`);
  }
}
console.log("built assets:\n" + report.join("\n"));
