"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The opening sequence.
 *
 * One continuous shot of one shopfront, in three acts: the street is dark and
 * the shop is shut under "The world starves"; everything goes to black for
 * "We have a solution"; then the lights come up on the *same frame*, the sign
 * lights with our mark, and the door opens.
 *
 * Holding a single photograph throughout is the whole point. Cutting to a
 * different image would just be two pictures; staying put means the viewer
 * watches a closed shop become an open one, which is the product in miniature.
 *
 * Mechanically: a tall track with a sticky stage. A scroll listener writes one
 * 0..1 progress value to `--p` and every layer derives its own opacity and
 * transform from it in CSS. One rAF-throttled write per frame, no per-layer
 * JavaScript, which is what keeps it smooth on a cheap phone.
 */

/* Measured off design/source/storefront.png (1328x744), as percentages. */
const DOOR = { left: 44.43, top: 37.63, width: 11.3, height: 45.7 };

/* Shows the door's own slice of the photograph inside the door element, so
   what swings open is the real door and not a drawn rectangle. Derived from
   DOOR so the two can never drift apart. */
const doorSlice = {
  backgroundSize: `${(100 / DOOR.width) * 100}% ${(100 / DOOR.height) * 100}%`,
  backgroundPosition: `${(DOOR.left / (100 - DOOR.width)) * 100}% ${
    (DOOR.top / (100 - DOOR.height)) * 100
  }%`,
};

type Props = {
  eyebrow: string;
  act1: string;
  act2: string;
  scrollLabel: string;
  signAlt: string;
};

export function Opening({ eyebrow, act1, act2, scrollLabel, signAlt }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setStill(reduced.matches);
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
      aria-label={`${act1} ${act2}`}
    >
      <div ref={stageRef} className="opening-stage">
        {/* One scene, lit by scroll position. */}
        <div className="scene" aria-hidden="true">
          <div className="scene-photo" />
          {/* Night. Lifts in Act III, which is how the lights "come on". */}
          <div className="scene-night" />
          <div className="doorway" />
          <div className="door" style={doorSlice} />
          <div className="door-spill" />
          <div className="sign">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/mark-192.png" alt="" className="sign-mark" width={96} height={96} />
            <span className="sign-word">MealBridge</span>
          </div>
        </div>

        <div className="blackout" aria-hidden="true" />

        <div className="act act-1">
          <p className="act-eyebrow">{eyebrow}</p>
          <h1 className="act-title">
            {act1}
            <span className="act-dot">.</span>
          </h1>
        </div>

        <div className="act act-2">
          <p className="act-title">
            {act2}
            <span className="act-dot">.</span>
          </p>
        </div>

        <span className="sr-only">{signAlt}</span>

        <div className="scroll-cue" aria-hidden="true">
          <span className="scroll-cue-rule" />
          <span>{scrollLabel}</span>
        </div>
      </div>
    </div>
  );
}
