"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The opening film.
 *
 * Three acts over one scroll track: the camera pushes into a dark storefront
 * under "The world starves", everything goes to black for "We have a
 * solution", and then the shop is lit, the sign carries our name, and the door
 * swings open. Below it the two plates are the actual choice.
 *
 * This is the one place in MealBridge where motion is allowed to be
 * expressive. Everything past this screen moves only in answer to a tap.
 *
 * How it works: a tall track with a sticky stage inside it. A scroll listener
 * writes a single 0..1 progress value to `--p` on the stage, and every layer
 * derives its own opacity and transform from that in CSS. One variable, one
 * rAF-throttled write per frame, no per-layer JS — which is what keeps it
 * smooth on the cheap phone this product is built for.
 *
 * The door panel is a slice of the storefront photograph itself rather than a
 * drawn rectangle, so what swings open is the real door.
 */

/* Measured off design/source/storefront.png (1328x744), as percentages. */
const DOOR = { left: 44.43, top: 37.63, width: 11.3, height: 45.7 };
const SIGN = { left: 13.93, top: 15.86, width: 69.65, height: 15.73 };

/* Background values that show the door's own slice of the photo inside the
   door element. Derived from DOOR so the two can never drift apart. */
const doorSlice = {
  backgroundSize: `${(100 / DOOR.width) * 100}% ${(100 / DOOR.height) * 100}%`,
  backgroundPosition: `${(DOOR.left / (100 - DOOR.width)) * 100}% ${
    (DOOR.top / (100 - DOOR.height)) * 100
  }%`,
};

type Props = {
  act1: string;
  act2: string;
  scrollLabel: string;
  signAlt: string;
};

export function Opening({ act1, act2, scrollLabel, signAlt }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [still, setStill] = useState(false);
  const [playVideo, setPlayVideo] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Save-Data is a real signal from people on metered connections. A 1.7 MB
    // film is not worth someone's data allowance; the poster frame says the
    // same thing for 7 KB.
    const conn = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    const thrifty = conn?.saveData === true || /^(slow-)?2g$/.test(conn?.effectiveType ?? "");

    const apply = () => {
      setStill(reduced.matches);
      setPlayVideo(!reduced.matches && !thrifty);
    };
    apply();
    reduced.addEventListener("change", apply);
    return () => reduced.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (still) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const track = trackRef.current;
      const stage = stageRef.current;
      if (!track || !stage) return;

      const rect = track.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = travel <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / travel));
      stage.style.setProperty("--p", p.toFixed(4));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [still]);

  return (
    <div
      ref={trackRef}
      className="opening-track on-dark"
      data-still={still ? "true" : undefined}
      aria-label={`${act1}. ${act2}.`}
    >
      <div ref={stageRef} className="opening-stage">
        {/* --- Act I: the camera pushes in --------------------------------- */}
        <div className="layer layer-film">
          {playVideo ? (
            <video
              className="film"
              src="/media/opening.mp4"
              poster="/media/opening-poster.webp"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
            />
          ) : (
            <div
              className="film"
              style={{ backgroundImage: "url(/media/opening-poster.webp)" }}
              aria-hidden="true"
            />
          )}
          <div className="film-scrim" aria-hidden="true" />
        </div>

        <h1 className="line line-1">{act1}</h1>

        {/* --- Act II: black ----------------------------------------------- */}
        <div className="layer layer-black" aria-hidden="true" />
        <p className="line line-2">{act2}</p>

        {/* --- Act III: the shop is lit and the door opens ------------------ */}
        <div className="layer layer-shop" aria-hidden="true">
          <div className="scene">
            <div className="scene-photo" />
            <div className="doorway" />
            <div className="door" style={doorSlice} />
            <div className="door-spill" />
            <div className="sign">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/mark-192.png" alt="" className="sign-mark" width={96} height={96} />
              <span className="sign-word">MealBridge</span>
            </div>
          </div>
        </div>
        <span className="sr-only">{signAlt}</span>

        <div className="scroll-cue" aria-hidden="true">
          <span>{scrollLabel}</span>
          <svg width="16" height="22" viewBox="0 0 16 22" fill="none" aria-hidden="true">
            <path
              d="M8 1v19M1 13l7 7 7-7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
