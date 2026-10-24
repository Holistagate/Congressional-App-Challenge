import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TicketClock } from "@/components/TicketClock";
import { CopyAddress } from "@/components/CopyAddress";
import { addressElementId } from "@/lib/dom-ids";
import { SaveListing } from "@/components/SaveListing";
import { ReportDialog } from "@/components/ReportDialog";
import { currentUser } from "@/lib/session";
import { getLang } from "@/lib/i18n-server";
import { translator } from "@/lib/i18n";
import { getListing, lookupZip, parseJsonArray } from "@/db/queries";
import { get } from "@/db/index";
import { DIETARY_TAGS, ALLERGEN_TAGS, labelFor, portionsLabel, liveState } from "@/lib/domain";
import { haversineMiles, formatDistance, formatDistanceEs } from "@/lib/geo";
import { readZip } from "@/lib/zip-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/food/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const listing = getListing(id);
  return { title: listing ? listing.description.slice(0, 60) : "Listing" };
}

export default async function ListingPage(props: PageProps<"/food/[id]">) {
  const { id } = await props.params;
  const listing = getListing(id);
  if (!listing) notFound();

  const user = await currentUser();
  const lang = await getLang(user?.language);
  const t = translator(lang);

  const zip = await readZip();
  const origin = zip ? lookupZip(zip) : null;
  const dest = lookupZip(listing.zip);

  const miles = origin && dest ? haversineMiles(origin, dest) : null;
  const sameZip = origin?.zip === listing.zip;
  const distance =
    miles === null
      ? null
      : lang === "es"
        ? formatDistanceEs(miles, sameZip)
        : formatDistance(miles, sameZip);

  const state = liveState(listing);
  const dietary = parseJsonArray(listing.dietary_tags);
  const allergens = parseJsonArray(listing.allergen_tags);
  const address = `${listing.street}, ${listing.city}, ${listing.state} ${listing.zip}`;

  const saved = user
    ? !!get("SELECT 1 AS ok FROM saved_listings WHERE seeker_id = ? AND listing_id = ?", [
        user.id,
        listing.id,
      ])
    : false;

  return (
    <>
      <AppHeader lang={lang} />

      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <Link href="/food" className="text-sm text-[var(--color-pine)]">
          {t("listing.back")}
        </Link>

        {/* The window first, large. Everything else on this page is only
            useful if the answer to "am I in time?" is yes. */}
        <div className="relative mt-4 border-b border-[var(--color-edge)] pb-5">
          <TicketClock
            status={listing.status}
            pickupStart={listing.pickup_start}
            pickupEnd={listing.pickup_end}
            portionsRemaining={listing.portions_remaining}
            lang={lang}
            size="detail"
          />
        </div>

        {state !== "open" && state !== "soon" && (
          <p
            className={
              state === "later"
                ? "mt-4 rounded-[var(--radius-ticket)] border border-[var(--color-edge)] bg-[var(--color-mist)] px-4 py-3 font-semibold"
                : "mt-4 rounded-[var(--radius-ticket)] border border-[var(--color-stop)] bg-[#fdf3f2] px-4 py-3 font-semibold text-[var(--color-stop)]"
            }
          >
            {state === "gone"
              ? t("listing.allGone")
              : state === "cancelled"
                ? t("listing.cancelled")
                : state === "later"
                  ? t("listing.opensAt", {
                      time: new Date(listing.pickup_start).toLocaleTimeString(
                        lang === "es" ? "es-US" : "en-US",
                        { hour: "numeric", minute: "2-digit" },
                      ),
                    })
                  : t("listing.ended")}
          </p>
        )}

        <h1 className="mt-5">{listing.description}</h1>

        <p className="mt-2 text-[var(--color-muted)]">
          {listing.business_name}
        </p>

        <p className="mt-1 font-semibold tnum">
          {portionsLabel(listing.portions_remaining, lang)}
        </p>

        {(dietary.length > 0 || allergens.length > 0) && (
          <div className="mt-5">
            {dietary.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {dietary.map((d) => (
                  <li key={d} className="chip">
                    {labelFor(DIETARY_TAGS, d, lang)}
                  </li>
                ))}
              </ul>
            )}

            {allergens.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-semibold">
                  {lang === "es" ? "Contiene" : "Contains"}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {allergens.map((a) => (
                    <li key={a} className="chip chip-allergen">
                      {labelFor(ALLERGEN_TAGS, a, lang)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Address as plain text, with no directions link anywhere near it. */}
        <section className="mt-6 rounded-[var(--radius-ticket)] border border-[var(--color-edge)] bg-[var(--color-mist)] p-4">
          <h2 className="text-base font-semibold">{t("listing.pickupAt")}</h2>

          <address id={addressElementId(address)} className="mt-2 not-italic text-lg leading-relaxed">
            {listing.street}
            <br />
            {listing.city}, {listing.state} {listing.zip}
          </address>

          {distance && (
            <p className="mt-1 text-sm font-medium text-[var(--color-pine)]">{distance}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <CopyAddress
              address={address}
              label={t("listing.copyAddress")}
              copiedLabel={t("listing.copied")}
            />
            {listing.provider_phone && (
              <a href={`tel:${listing.provider_phone}`} className="btn btn-secondary text-sm">
                {t("listing.callBusiness")}
              </a>
            )}
          </div>
        </section>

        {listing.notes && (
          <section className="mt-5">
            <h2 className="text-base font-semibold">{t("listing.handoff")}</h2>
            <p className="measure mt-1.5 leading-relaxed">{listing.notes}</p>
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[var(--color-edge)] pt-5">
          <SaveListing listingId={listing.id} saved={saved} signedIn={!!user} lang={lang} />
          <ReportDialog listingId={listing.id} lang={lang} />
        </div>

        <p className="mt-6 text-sm text-[var(--color-muted)]">{t("seeker.approximate")}</p>
      </main>

      <SiteFooter lang={lang} />
    </>
  );
}
