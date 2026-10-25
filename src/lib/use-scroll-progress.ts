"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Writes how far a tall element has travelled through the viewport to a CSS
 * custom property on it, as a number from 0 to 1.
 *
 * Everything that moves on the landing page reads that one value in CSS. The
 * alternative — animating properties from JavaScript — means touching the DOM
 * once per layer per frame; this touches it once per frame in total, and the
 * browser interpolates the rest off the main thread.
 *
 * Two values are written, because the sequence needs both:
 *   --p   linear, for anything that should track the scrollbar exactly
 *   --pe  eased, for the push-in, so the camera starts and settles gently
 *         instead of moving at a constant speed the whole way
 */
export type ProgressOptions = {
  /** Element whose scroll travel is measured. Defaults to the target. */
  trackRef?: RefObject<HTMLElement | null>;
  /**
   * How progress is measured:
   *  "pin"   0 when the element's top hits the viewport top, 1 when its bottom
   *          does — for a tall track holding a sticky stage.
   *  "enter" 0 when the element's top enters from below, 1 once it has risen a
   *          full viewport — for a section that reveals itself on approach.
   */
  mode?: "pin" | "enter";
  enabled?: boolean;
};

export function useScrollProgress(
  targetRef: RefObject<HTMLElement | null>,
  { trackRef, mode = "pin", enabled = true }: ProgressOptions = {},
): void {
  useEffect(() => {
    if (!enabled) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const target = targetRef.current;
      const track = trackRef?.current ?? target;
      if (!target || !track) return;

      const rect = track.getBoundingClientRect();
      const vh = window.innerHeight;

      let p: number;
      if (mode === "pin") {
        const travel = rect.height - vh;
        p = travel <= 0 ? 0 : -rect.top / travel;
      } else {
        // Starts the moment the section's top edge appears and completes once
        // it has risen one viewport further.
        p = (vh - rect.top) / vh;
      }

      p = Math.min(1, Math.max(0, p));
      target.style.setProperty("--p", p.toFixed(4));
      // easeInOutCubic
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      target.style.setProperty("--pe", e.toFixed(4));
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
  }, [targetRef, trackRef, mode, enabled]);
}

/**
 * True when the reader has asked for less motion.
 *
 * Starts false so the server and the first client render agree; the effect
 * corrects it on mount. The still version of the sequence is reached from the
 * same markup, so there is nothing to flash.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return reduced;
}
