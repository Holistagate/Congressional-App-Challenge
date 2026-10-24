"use client";

import { useEffect, useState } from "react";
import { translator, type Lang } from "@/lib/i18n";

/**
 * When this list was fetched, and whether the device is still online.
 *
 * The service worker will happily show a cached list to someone standing
 * outside with no signal. That is the right behaviour — an hour-old list beats
 * an error page — but only if the page is honest that it is old. Portions run
 * out; a stale "12 left" could send someone across town for nothing.
 */
export function LastUpdated({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const [loadedAt] = useState(() => Date.now());
  const [online, setOnline] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);

    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);

    // Re-render each minute so the relative time stays true while the page
    // sits open on a locked phone.
    const id = setInterval(() => setTick((n) => n + 1), 60_000);

    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      clearInterval(id);
    };
  }, []);

  const minutes = Math.floor((Date.now() - loadedAt) / 60_000);
  const when =
    minutes < 1
      ? lang === "es"
        ? "ahora mismo"
        : "just now"
      : lang === "es"
        ? `hace ${minutes} min`
        : `${minutes} min ago`;

  if (!online) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-[var(--radius-ticket)] border border-[var(--color-edge)] bg-[#fdf6e8] px-3 py-2 text-sm text-[var(--color-amber)]">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 11.5v.01M8 4.5v4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {t("seeker.offline")}
      </p>
    );
  }

  return (
    <p className="mt-3 text-xs text-[var(--color-muted)]">{t("seeker.lastUpdated", { time: when })}</p>
  );
}
