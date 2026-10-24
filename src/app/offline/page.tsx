import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "You're offline" };

/**
 * Served by the service worker when a page is requested with no connection and
 * nothing cached. Deliberately static and tiny — it has to work from the cache
 * with no server, no fonts loaded and no JavaScript.
 */
export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <h1>You&apos;re offline</h1>

      <p className="measure mt-3 leading-relaxed">
        This page needs a connection. If you looked at food near you earlier, that list is
        still saved on this phone.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/food" className="btn btn-primary">
          See the last list
        </Link>
      </div>

      <p className="mt-8 border-t border-[var(--color-edge)] pt-5 text-sm text-[var(--color-muted)]">
        A saved list can be out of date. Portions run out, and pickup windows close — check
        the times before you set off.
      </p>
    </main>
  );
}
