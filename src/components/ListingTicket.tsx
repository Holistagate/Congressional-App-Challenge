import Link from "next/link";
import { TicketClock } from "./TicketClock";
import { CopyAddress } from "./CopyAddress";
import { addressElementId } from "@/lib/dom-ids";
import { parseJsonArray, type ListingRow } from "@/db/queries";
import { DIETARY_TAGS, ALLERGEN_TAGS, labelFor, portionsLabel } from "@/lib/domain";
import { formatDistance, formatDistanceEs } from "@/lib/geo";
import { translator, type Lang } from "@/lib/i18n";

/**
 * One listing, as a claim ticket.
 *
 * The reading order is the order the information actually matters in: when the
 * window closes, what the food is, where to go, how far that is. The
 * restaurant's name is present but it is not the headline — nobody choosing
 * between two free meals tonight is choosing a brand.
 */
export function ListingTicket({ listing, lang }: { listing: ListingRow; lang: Lang }) {
  const t = translator(lang);
  const dietary = parseJsonArray(listing.dietary_tags);
  const allergens = parseJsonArray(listing.allergen_tags);

  const address = `${listing.street}, ${listing.city}, ${listing.state} ${listing.zip}`;
  const distance =
    lang === "es"
      ? formatDistanceEs(listing.distance_miles, listing.same_zip === 1)
      : formatDistance(listing.distance_miles, listing.same_zip === 1);

  return (
    <article className="ticket">
      {/* Time left and food left sit together: they are the same question
          asked two ways, and together they decide whether it is worth going. */}
      <div className="ticket-head">
        <TicketClock
          status={listing.status}
          pickupStart={listing.pickup_start}
          pickupEnd={listing.pickup_end}
          portionsRemaining={listing.portions_remaining}
          lang={lang}
        />
        <p className="portions tnum">{portionsLabel(listing.portions_remaining, lang)}</p>
      </div>

      <h3 className="mt-2.5 text-base font-semibold leading-snug">
        <Link href={`/food/${listing.id}`} className="ticket-link">
          {listing.description}
        </Link>
      </h3>

      <p className="mt-1 text-sm text-[var(--color-muted)]">{listing.business_name}</p>

      <address
        id={addressElementId(address)}
        className="mt-3 not-italic text-sm leading-relaxed"
      >
        {listing.street}
        <br />
        {listing.city}, {listing.state} {listing.zip}
      </address>

      <p className="mt-1 text-sm font-medium text-[var(--color-pine)]">{distance}</p>

      {(dietary.length > 0 || allergens.length > 0) && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("post.tags")}>
          {dietary.map((id) => (
            <li key={id} className="chip">
              {labelFor(DIETARY_TAGS, id, lang)}
            </li>
          ))}
          {allergens.map((id) => (
            <li key={id} className="chip chip-allergen">
              {/* Lowercased because it reads as a sentence here — "Contains
                  milk" — rather than as a standalone label. */}
              {lang === "es" ? "Contiene" : "Contains"}{" "}
              {labelFor(ALLERGEN_TAGS, id, lang).toLocaleLowerCase(lang === "es" ? "es" : "en")}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <CopyAddress
          address={address}
          label={t("listing.copyAddress")}
          copiedLabel={t("listing.copied")}
        />
        <Link href={`/food/${listing.id}`} className="btn btn-secondary text-sm">
          {lang === "es" ? "Ver detalles" : "See details"}
        </Link>
      </div>
    </article>
  );
}
