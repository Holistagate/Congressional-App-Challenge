import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProviderReview, ReportReview } from "@/components/AdminControls";
import { currentUser } from "@/lib/session";
import { getLang } from "@/lib/i18n-server";
import { all, get } from "@/db/index";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/food");

  const lang = await getLang(user.language);

  const pending = await all<ProviderSummary>(
    `SELECT id, business_name, street, city, state, zip, contact_name, phone, email,
            permit_number, status, created_at
     FROM providers WHERE status = 'pending' ORDER BY created_at ASC`,
  );

  const others = await all<ProviderSummary>(
    `SELECT id, business_name, street, city, state, zip, contact_name, phone, email,
            permit_number, status, created_at
     FROM providers WHERE status != 'pending' ORDER by business_name ASC`,
  );

  const reports = await all<ReportSummary>(
    `SELECT r.id, r.reason, r.details, r.created_at,
            l.id AS listing_id, l.description, l.status AS listing_status,
            p.business_name
     FROM reports r
     JOIN listings l ON l.id = r.listing_id
     JOIN providers p ON p.id = l.provider_id
     WHERE r.status = 'open'
     ORDER BY r.created_at DESC`,
  );

  const stats = {
    activeListings:
      (await get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM listings WHERE status = 'active' AND pickup_end > ?",
        [Date.now()],
      ))?.n ?? 0,
    portionsShared:
      (await get<{ n: number }>(
        "SELECT COALESCE(SUM(portions_total - portions_remaining), 0) AS n FROM listings",
      ))?.n ?? 0,
    approvedProviders:
      (await get<{ n: number }>("SELECT COUNT(*) AS n FROM providers WHERE status = 'approved'")')?.n ?? 0,
    seekers: (await get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'seeker'")')?.n ?? 0,
    activeAlerts: (await get<{ n: number }>("SELECT COUNT(*) AS n FROM alerts WHERE active = 1"))?.n ?? 0,
  };

  return (
    <>
      <AppHeader lang={lang} />

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        <h1>Moderation</h1>

        {/* Counts, not a chart. There is nothing here a sparkline would make
            clearer, and an admin screen is a tool, not a presentation. */}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-[var(--color-edge)] py-4 sm:grid-cols-5">
          <Stat label="Live listings" value={stats.activeListings} />
          <Stat label="Portions shared" value={stats.portionsShared} />
          <Stat label="Approved businesses" value={stats.approvedProviders} />
          <Stat label="People signed up" value={stats.seekers} />
          <Stat label="Active alerts" value={stats.activeAlerts} />
        </dl>

        <section className="mt-9" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="text-lg">
            Waiting for review{" "}
            {pending.length > 0 && <span className="tnum">({pending.length})</span>}
          </h2>

          {pending.length === 0 ? (
            <p className="mt-2 text-[var(--color-muted)]">
              Nothing waiting. New businesses appear here when they register.
            </p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {pending.map((p) => (
                <li key={p.id}>
                  <ProviderReview provider={p} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-9" aria-labelledby="reports-heading">
          <h2 id="reports-heading" className="text-lg">
            Open reports {reports.length > 0 && <span className="tnum">({reports.length})</span>}
          </h2>

          {reports.length === 0 ? (
            <p className="mt-2 text-[var(--color-muted)]">No open reports.</p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {reports.map((r) => (
                <li key={r.id}>
                  <ReportReview report={r} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-9" aria-labelledby="all-heading">
          <h2 id="all-heading" className="text-lg">
            All businesses
          </h2>
          <ul className="mt-3 grid gap-3">
            {others.map((p) => (
              <li key={p.id}>
                <ProviderReview provider={p} />
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-9 border-t border-[var(--color-edge)] pt-5 text-sm text-[var(--color-muted)]">
          Every approval, suspension and removal is recorded with the admin who made it.{" "}
          <Link href="/admin/log" className="text-[var(--color-pine)]">
            See the log
          </Link>
        </p>
      </main>

      <SiteFooter lang={lang} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm text-[var(--color-muted)]">{label}</dt>
      <dd className="tnum font-[family-name:var(--font-display)] text-2xl font-semibold">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

export type ProviderSummary = {
  id: string;
  business_name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  contact_name: string;
  phone: string;
  email: string;
  permit_number: string;
  status: "pending" | "approved" | "suspended";
  created_at: number;
};

export type ReportSummary = {
  id: string;
  reason: string;
  details: string;
  created_at: number;
  listing_id: string;
  description: string;
  listing_status: string;
  business_name: string;
};
