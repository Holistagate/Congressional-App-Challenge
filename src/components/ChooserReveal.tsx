"use client";

import { useRef, type ReactNode } from "react";
import { useScrollProgress, usePrefersReducedMotion } from "@/lib/use-scroll-progress";

/**
 * The chooser, surfacing out of the dark the opening ends in.
 *
 * This section's background is the same near-black the sequence fades to, so
 * there is no visible seam where one ends and the other begins — the page
 * stays black and the table simply arrives in it. That is what makes the
 * handover read as a dissolve rather than as scrolling onto a new screen.
 *
 * It measures its own approach instead of continuing the opening's progress,
 * because it sits outside that sticky track and has to keep working as an
 * ordinary, stable screen once it has arrived.
 */
export function ChooserReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const still = usePrefersReducedMotion();

  useScrollProgress(ref, { mode: "enter", enabled: !still });

  return (
    <section
      ref={ref}
      className="chooser"
      data-still={still ? "true" : undefined}
      aria-labelledby="chooser-heading"
    >
      {children}
    </section>
  );
}
