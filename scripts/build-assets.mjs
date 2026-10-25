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


/* ---------------------------------------------------------- storefront ---
 * The whole opening, and the only time this shot is used.
 *
 * Kept at the source's own 1632px and barely touched: unlike the shot it
 * replaces, this one is already bright, warm and saturated, and its sage
 * facade is the same green the role chooser's field is painted in — the
 * landing page now opens and closes on one colour. All it gets is a little
 * contrast and a light sharpen to survive the push-in.
 */
await sharp(src("storefront-sage.webp"))
  .linear(1.04, -4)
  .sharpen({ sigma: 0.5 })
  .webp({ quality: 84 })
  .toFile(out("media", "storefront.webp"));


/* ------------------------------------------------------------ manifest ---- */
const report = [];
for (const f of [
  "icons/mark-512.png",
  "icons/maskable-512.png",
  "media/storefront.webp",
  "media/plate-a.png",
  "media/fork-cursor.png",
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

/* ------------------------------------------------------------ the table ---
 * The role chooser's two settings.
 *
 * The source is a portrait flat-lay: two plates stacked on a flat sage field.
 * That covers a phone beautifully and cannot fill a landscape screen at all,
 * so rather than crop it we lift each plate out and let the page supply the
 * field itself as a flat colour. The plates can then be laid out side by side
 * or stacked, at any aspect ratio, with no crop and no letterboxing.
 *
 * The cut is feathered rather than hard-edged: the field has a gentle vignette
 * (about #CEDEC7 to #D6E6D2), so a crisp circle would show a faint disc
 * wherever the crop's green met the page's. Fading the alpha out over the last
 * few per cent hides the join entirely.
 */
/* Centres and radii found by scanning the source for bright, low-saturation
 * pixels rather than by eye — the plates sit lower in the frame than they
 * look, and a crop off by thirty pixels puts the feather through the rim.
 * The china photographs as a slight ellipse (581 x 526), so the box is cut
 * wide enough for the mask to clear it on both axes. */
const PLATE = { size: 660, out: 560 };

const feather = (px) =>
  Buffer.from(
    `<svg width="${px}" height="${px}">
       <defs>
         <radialGradient id="f" cx="50%" cy="50%" r="50%">
           <stop offset="0%"  stop-color="#fff" stop-opacity="1"/>
           <stop offset="93%" stop-color="#fff" stop-opacity="1"/>
           <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
         </radialGradient>
       </defs>
       <rect width="${px}" height="${px}" fill="url(#f)"/>
     </svg>`,
  );

async function cutPlate(name, centreX, centreY) {
  const half = PLATE.size / 2;
  const cut = await sharp(src("plates-flatlay.png"))
    .extract({
      left: Math.round(centreX - half),
      top: Math.round(centreY - half),
      width: PLATE.size,
      height: PLATE.size,
    })
    .resize(PLATE.out, PLATE.out)
    .png()
    .toBuffer();

  await sharp(cut)
    .composite([{ input: feather(PLATE.out), blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toFile(out("media", name));
}

await cutPlate("plate-a.png", 510, 405);
await cutPlate("plate-b.png", 511, 1072);

/* ------------------------------------------------------------ the fork ----
 * The chooser's cursor.
 *
 * Rotated so the tines lead up and to the left, where a pointer's tip belongs,
 * and kept to 40px: browsers reject or mishandle larger cursors, and anything
 * bigger stops reading as a pointer and starts obscuring what it is pointing
 * at. The page pairs it with a hotspot at the tip and falls back to `pointer`.
 */
const forkRotated = await sharp(src("fork.png"))
  .rotate(-90, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

// Trim before fitting. Rotating a diagonal object leaves transparent corners,
// and scaling those into the box would shrink the fork to a sliver.
await sharp(forkRotated)
  .trim()
  .resize(44, 44, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(out("media", "fork-cursor.png"));

