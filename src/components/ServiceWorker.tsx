"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that makes the last-loaded list readable
 * offline. Registration is deferred until after load so it never competes with
 * the first paint on a slow connection.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration costs the offline list and nothing else, so
        // there is no reason to interrupt anyone about it.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
