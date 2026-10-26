import Link from "next/link";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ListingTicket } from "@/components/ListingTicket";
import { ZipGate } from "@/components/ZipGate";
import { FoodFilters } from "@/components/FoodFilters";
import { LastUpdated } from "@/components/LastUpdated";
import { currentUser } from "@/lib/session";
import { getLang } from "@/lib/i18n-server";
import { translator } from "@/lib/i18n";
import { listNearby, lookupZip } from "@/db/queries";
import { DIETARY_IDS } from "@/lib/domain";
import { isRadiusOption, RADIUS_OPTIONS } from "@/lib/geo";
import { readZip } from "@/lib/zip-server";

export const metadata: Metadata = { title: "Free food near you" };

// Listings expire by the minute; nothing on this page may be cached.
export const dynamic = "force-dynamic";

export default async function FoodPage(props: PageProps<"/food">) {
  const user = await currentUser();
  const lang = await getLang(user?.language);
  const t = translator(lang);
  const zip = await readZip();

  if (!zip) {
    return (
      <>
        <AppHeader lang={lang} />
        <main id="main" className="mx-auto w-full max-w-xl flex-1 px-5 py-10">
          <ZipGate lang={lang} />
        </main>
        <SiteFooter lang={lang} />
      </>
    );
  }

  const params = await props.searchParams;
  // readZip() has already validated this against the table, so a row exists.
  const origin = (await lookupZip(zip))!;

  const radiusParam = Number(first(params.radius));
  const radius = isRadiusOption(radiusParam) ? radiusParam : 10;

  const when = (["any", "now", "later"] as const).includes(first(params.when) as never)
    ? (first(params.when) as "any" | "now" | "later")
    : "any";

  const dietary = (params.diet ? [params.diet].flat() : [])
    .map(String)
    .filter((d) => DIETARY_IDS.includes(d));

  const listings = await listNearby({
    lat: origin.lat,
    lng: origin.lng,
    zip,
    radiusMiles: radius,
    dietary,
    when,
  });

  const place = origin.city ? `${origin.city}, ${origin.state}` : zip;

  return (
    <>
      <AppHeader lang={lang} />

      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>{t("seeker.title")}</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {t("seeker.resultsIn", { zip: place })}
            </p>
          </div>
          <Link href="/food/zip" className="btn btn-quiet text-sm">
            {t("seeker.changeZip")}
          </Link>
        </div>

        <FoodFilters lang={lang} radius={radius} when={when} dietary={dietary} />

        <LastUpdated lang={lang} />

        {listings.length === 0 ? (
          <EmptyState lang={lang} place={place} radius={radius} />
        ) : (
          <>
            <ul className="mt-4 grid gap-3">
              {listings.map((l) => (
                <li key={l.id}>
                  <ListingTicket listing={l} lang={lang} />
                </li>
              ))}
            </ul>

            {/* The honesty note about ZIP-centroid distance. It sits under the
                results, where someone has just read a number and might take
                it literally. */}
            <p className="mt-5 border-t border-[var(--color-edge)] pt-4 text-sm text-[var(--color-muted)]">
              {t("seeker.approximate")}
            </p>
          </>
        )}
      </main>

      <SiteFooter lang={lang} />
    </>
  );
}

/**
 * Nothing nearby.
 *
 * An empty screen here is someone who is hungry and has just been told no, so
 * it does two useful things rather than apologising: widens the search, and
 * points at help that exists whether or not a restaurant posted tonight.
 */
function EmptyState({ lang, place, radius }: { lang: "en" | "es"; place: string; radius: number }) {
  const t = translator(lang);
  const wider = RADIUS_OPTIONS.filter((r) => r > radius);

  return (
    <div className="mt-6 rounded-[var(--radius-ticket)] border border-[var(--color-edge)] bg-[var(--color-mist)] p-5">
      <p className="font-[family-name:var(--font-display)] text-xl font-semibold">
        {t("seeker.empty", { zip: place })}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {wider.map((r) => (
          <Link key={r} href={`/food?radius=${r}`} className="btn btn-secondary text-sm">
            {t("seeker.miles", { n: r })}
          </Link>
        ))}
        <Link href="/help" className="btn btn-primary text-sm">
          {t("seeker.emptyHelp")}
        </Link>
      </div>
    </div>
  );
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
