/**
 * MealBridge service worker.
 *
 * The goal is narrow and deliberate: if someone opens the app with no signal,
 * they should still see the last list of food that loaded, clearly marked as
 * old, rather than a browser error page. Food that was there an hour ago is
 * often still there; a dinosaur game never is.
 *
 * Strategy by request type:
 *   - the shell and static assets: cache-first, they rarely change
 *   - the food list and listing pages: network-first with a cache fallback,
 *     because fresh beats fast when portions are running out
 *   - everything that writes: never cached, never queued
 */

const VERSION = "v1";
const SHELL_CACHE = `mealbridge-shell-${VERSION}`;
const PAGE_CACHE = `mealbridge-pages-${VERSION}`;

const SHELL = [
  "/offline",
  "/icons/mark-192.png",
  "/icons/mark-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("mealbridge-") && !k.endsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const isPage = (url) =>
  url.pathname === "/food" ||
  url.pathname.startsWith("/food/") ||
  url.pathname === "/alerts" ||
  url.pathname === "/help";

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname.startsWith("/media/") ||
  url.pathname === "/manifest.webmanifest";

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever interfere with plain reads of our own origin.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (isPage(url) && request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          // Prefer the exact page; fall back to the last food list; failing
          // both, the offline page, which explains what is going on.
          return (
            (await caches.match(request)) ||
            (await caches.match("/food")) ||
            (await caches.match("/offline")) ||
            new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          );
        }),
    );
  }
});

/* ------------------------------------------------------------------ push -- */

self.addEventListener("push", (event) => {
  let payload = { title: "Free food near you", body: "Tap to see what's available.", url: "/food" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // A bodiless push still deserves to reach someone — see notify.ts.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/mark-192.png",
      badge: "/icons/mark-192.png",
      tag: payload.tag || "mealbridge",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/food";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
