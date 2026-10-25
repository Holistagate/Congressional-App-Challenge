"use client";

import { useRef } from "react";
import { useScrollProgress, usePrefersReducedMotion } from "@/lib/use-scroll-progress";

/**
 * The opening sequence.
 *
 * A shop with its lights on and our name over the door. You walk toward it,
 * the door opens as you reach it, and you step through into the dark — where
 * the page finally says something.
 *
 *   hold → push in, door opens → black → "The world starves." →
 *   "We have a solution." → (the chooser fades up underneath)
 *
 * The shot is used once and never returns, so it has to carry the whole first
 * impression on its own.
 *
 * The push-in is scaled about the doorway rather than the frame's centre,
 * which is what makes it read as walking toward a door instead of a picture
 * being enlarged. The scale ends past 1.9x, where a 1328px source is soft —
 * but by then the frame is nearly black, so the softest moment is the one
 * nobody sees.
 */

/* Measured off design/source/storefront-sage.webp (1632x963), as percentages.
   The handle sits on the left again, so the hinges are on the right. */
const DOOR = { left: 48.71, top: 37.17, width: 9.62, height: 41.74 };

/* The plain band of fascia above the windows — where a shop's name goes. */
const SIGN = { left: 7.1, top: 16.1, width: 85.4, height: 9.3 };

/* The point the camera moves toward: the middle of the doorway. */
const FOCUS = {
  x: DOOR.left + DOOR.width / 2,
  y: DOOR.top + DOOR.height / 2,
};

/* Shows the door's own slice of the photograph inside the door element, so
   what swings open is the real door and not a drawn rectangle. Derived from
   DOOR so the two can never drift apart. */
const doorBox = {
  left: `${DOOR.left}%`,
  top: `${DOOR.top}%`,
  width: `${DOOR.width}%`,
  height: `${DOOR.height}%`,
};

const signBox = {
  left: `${SIGN.left}%`,
  top: `${SIGN.top}%`,
  width: `${SIGN.width}%`,
  height: `${SIGN.height}%`,
};

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
  const still = usePrefersReducedMotion();

  useScrollProgress(stageRef, { trackRef, enabled: !still });

  return (
    <div
      ref={trackRef}
      className="opening-track on-dark"
      data-still={still ? "true" : undefined}
      aria-label={`${act1} ${act2}`}
    >
      <div
        ref={stageRef}
        className="opening-stage"
        style={{ "--focus-x": `${FOCUS.x}%`, "--focus-y": `${FOCUS.y}%` } as React.CSSProperties}
      >
        <div className="scene" aria-hidden="true">
          <div className="scene-zoom">
            <div className="scene-photo" />
            <div className="doorway" style={doorBox} />
            <div className="door" style={{ ...doorBox, ...doorSlice }} />

            {/* The sign is lit from the first frame: this is the shop already
                carrying our name, not a reveal. */}
            <div className="sign" style={signBox}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/mark-192.png" alt="" className="sign-mark" width={96} height={96} />
              <span className="sign-word">MealBridge</span>
            </div>
          </div>

          {/* Closes the frame down as the camera pushes in, so the edges of
              the photograph never show their softness. */}
          <div className="vignette" />
        </div>

        {/* Grounds the type along the bottom edge. The graded shot is bright
            white along the shopfront's base, and off-white text on it is
            unreadable without something to sit against. Anchored to the
            viewport rather than the scene, so it does not scale with the
            push-in. */}
        <div className="base-scrim" aria-hidden="true" />

        <div className="blackout" aria-hidden="true" />

        {/* Over the shot: one quiet line, so the opening frame says what this
            is without competing with it. */}
        <div className="act act-1">
          <p className="act-eyebrow">{eyebrow}</p>
        </div>

        {/* The two lines in the dark, one after the other. The problem, then
            the answer — which is the only reason the second one lands. */}
        <div className="act act-2">
          <h1 className="act-title">
            {act1}
            <span className="act-dot">.</span>
          </h1>
        </div>

        <div className="act act-3">
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
