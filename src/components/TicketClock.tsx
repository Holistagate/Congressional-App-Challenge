"use client";

import { useEffect, useState } from "react";
import {
  countdown,
  liveState,
  windowRemaining,
  formatWindow,
  type LiveState,
  type ListingStatus,
} from "@/lib/domain";
import type { Lang } from "@/lib/i18n";

/**
 * The clock on a listing — and the only thing on it that moves.
 *
 * It owns both the pickup window and the rail that drains down the ticket's
 * left edge, because the two are the same fact shown twice: one for someone
 * reading a single listing, one for someone scanning twenty of them.
 *
 * It ticks every 20 seconds rather than every second. A second hand on a
 * forty-minute deadline is anxiety, not information, and on a cheap phone it
 * is also a wasted wake-up every second.
 */

const TICK_MS = 20_000;

type Props = {
  status: ListingStatus;
  pickupStart: number;
  pickupEnd: number;
  portionsRemaining: number;
  lang: Lang;
  /** The detail page gives the clock more room than a list row does. */
  size?: "row" | "detail";
};

export function TicketClock({
  status,
  pickupStart,
  pickupEnd,
  portionsRemaining,
  lang,
  size = "row",
}: Props) {
  // Start from the server's instant so the first paint matches the markup that
  // was streamed, then let the client take over once it has mounted.
  const [at, setAt] = useState<number | null>(null);

  useEffect(() => {
    setAt(Date.now());
    const id = setInterval(() => setAt(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const nowMs = at ?? pickupStart;
  const listing = {
    status,
    pickup_start: pickupStart,
    pickup_end: pickupEnd,
    portions_remaining: portionsRemaining,
  };

  const state = at === null ? initialState(listing) : liveState(listing, nowMs);
  const remaining = at === null ? 1 : windowRemaining(listing, nowMs);

  return (
    <>
      <span className="ticket-rail" data-state={railState(state)} aria-hidden="true">
        <span style={{ height: `${Math.round(remaining * 100)}%` }} />
      </span>

      <div className={size === "detail" ? "clock clock-detail" : "clock"}>
        <p className="clock-window tnum">{formatWindow(pickupStart, pickupEnd, lang)}</p>
        <p className="clock-status" data-state={state}>
          {statusText(state, listing, nowMs, lang)}
        </p>
      </div>
    </>
  );
}

/** Before hydration we only know what the server knew. */
function initialState(l: Parameters<typeof liveState>[0]): LiveState {
  return liveState(l, l.pickup_start);
}

function railState(state: LiveState): "open" | "soon" | "gone" {
  if (state === "soon") return "soon";
  if (state === "open" || state === "later") return "open";
  return "gone";
}

function statusText(
  state: LiveState,
  l: { pickup_start: number; pickup_end: number },
  at: number,
  lang: Lang,
): string {
  const es = lang === "es";
  switch (state) {
    case "later": {
      const opens = new Date(l.pickup_start).toLocaleTimeString(es ? "es-US" : "en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      return es ? `Abre a las ${opens}` : `Opens at ${opens}`;
    }
    case "gone":
      return es ? "Se acabó" : "All gone";
    case "cancelled":
      return es ? "Cancelado" : "Cancelled";
    case "ended":
      return es ? "Terminado" : "Ended";
    default:
      return countdown(l.pickup_end - at, lang);
  }
}
