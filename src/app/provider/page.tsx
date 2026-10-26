import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProviderListingRow } from "@/components/ProviderListingRow";
import { RecurringRules, type RuleSummary } from "@/components/RecurringRules";
import { currentUser, currentProvider } from "@/lib/session";
import { getLang } from "@/lib/i18n-server";
import { translator } from "@/lib/i18n";
import { listingsForProvider, interestCount } from "@/db/queries";
import { all, get } from "@/db/index";
import { liveState, isListable } from "@/lib/domain";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function ProviderDashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "provider") redirect("/food");

  const provider = await currentProvider();
  if (!provider) redirect("/signup?role=provider");

  const lang = await getLang(user.language);
  const t = translator(lang);

  const listings = await listingsForProvider(provider.id, 200);
  const live = listings.filter((l) => isListable(liveState(l)));
  const past = listings.filter((l) => !isListable(liveState(l)));

  const impact = await get<{ portions: number; count: number }>(
    `SELECT COALESCE(SUM(portions_total - portions_remaining), 0) AS portions,
            COUNT(*) AS count
     FROM listings WHERE provider_id = ?`,
    [provider.id],
  );

  const rules = await all<RuleSummary>(
    `SELECT id, weekdays, start_minutes, end_minutes, template, paused, last_run_on
     FROM recurring_rules WHERE provider_id = ? ORDER BY created_at DESC`,
    [provider.id],
  );

  // Saved-counts are one query per live listing. Gathered up front and in
  // parallel: awaiting inside the render would serialise them into a chain of
  // round trips, which over a network database is the difference between one
  // slow page and a page that visibly crawls.
  const interest = provider.show_interest
    ? new Map(
        await Promise.all(
          live.map(async (l) => [l.id, await interestCount(l.id)] as const),
        ),
      )
    : null;

  const canPost = provider.status === "approved";

  return (
    <>
      <AppHeader lang={lang} />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>{provider.business_name}</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {provider.street}, {provider.city}, {provider.state} {provider.zip}
            </p>
          </div>

          {canPost && (
            <Link href="/provider/post" className="btn btn-primary">
              {t("provider.post")}
            </Link>
          )}
        </div>

        {/* A business that cannot post is told why, and what happens next.
            Silence here just makes a restaurant give up and bin the food. */}
        {provider.status === "pending" && (
          <div className="mt-5 rounded-[var(--radius-ticket)] border border-[var(--color-amber)] bg-[#fdf6e8] p-4">
            <h2 className="text-base font-semibold text-[var(--color-amber)]">
              {t("provider.pending")}
            </h2>
            <p className="measure mt-1 text-sm">{t("provider.pendingBody")}</p>
          </div>
        )}

        {provider.status === "suspended" && (
          <div className="mt-5 rounded-[var(--radius-ticket)] border border-[var(--color-stop)] bg-[#fdf3f2] p-4">
            <h2 className="text-base font-semibold text-[var(--color-stop)]">
              {t("provider.suspended")}
            </h2>
            <p className="measure mt-1 text-sm">
              {lang === "es"
                ? "Escríbenos para resolverlo."
                : "Get in touch and we'll sort it out."}
            </p>
          </div>
        )}

        {/* Impact, stated plainly and without celebration graphics. The number
            that matters to a kitchen is how many meals left the building. */}
        <p className="mt-6 border-y border-[var(--color-edge)] py-3 text-sm">
          <span className="tnum font-semibold">{impact?.portions ?? 0}</span>{" "}
          {lang === "es" ? "porciones compartidas en" : "portions shared across"}{" "}
          <span className="tnum font-semibold">{impact?.count ?? 0}</span>{" "}
          {lang === "es" ? "publicaciones" : "posts"}
        </p>

        <section className="mt-7" aria-labelledby="live-heading">
          <h2 id="live-heading" className="text-lg">
            {t("provider.live")}
          </h2>

          {live.length === 0 ? (
            <p className="mt-2 text-[var(--color-muted)]">{t("provider.noLive")}</p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {live.map((l) => (
                <li key={l.id}>
                  <ProviderListingRow
                    listing={l}
                    lang={lang}
                    interested={interest?.get(l.id) ?? null}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {canPost && <RecurringRules lang={lang} rules={rules} />}

        {past.length > 0 && (
          <section className="mt-9" aria-labelledby="past-heading">
            <h2 id="past-heading" className="text-lg">
              {t("provider.past")}
            </h2>
            <ul className="mt-3 grid gap-2">
              {past.slice(0, 20).map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-edge)] pb-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{l.description}</span>
                  <span className="tnum text-[var(--color-muted)]">
                    {l.portions_total - l.portions_remaining}/{l.portions_total}{" "}
                    {lang === "es" ? "entregadas" : "collected"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <SiteFooter lang={lang} />
    </>
  );
}
