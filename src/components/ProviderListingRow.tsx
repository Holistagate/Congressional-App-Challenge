"use client";

import { useActionState } from "react";
import { updatePortions, cancelListing } from "@/app/actions/listings";
import { TicketClock } from "./TicketClock";
import type { ListingRow } from "@/db/queries";
import { translator, type Lang } from "@/lib/i18n";

/**
 * A live listing as its owner sees it.
 *
 * The controls are sized for the actual moment they get used: someone at the
 * pass, at closing, with one hand free and a queue at the door. Decrementing
 * is one tap, and "all gone" is always one tap away — never buried behind an
 * edit screen, because the cost of a stale listing is a person walking across
 * town for food that is not there.
 */
export function ProviderListingRow({
  listing,
  lang,
  interested,
}: {
  listing: ListingRow;
  lang: Lang;
  interested: number | null;
}) {
  const t = translator(lang);
  const [portionState, portionAction, savingPortions] = useActionState(updatePortions, {});
  const [cancelState, cancelAction, cancelling] = useActionState(cancelListing, {});

  return (
    <article className="ticket">
      <div className="ticket-head">
        <TicketClock
          status={listing.status}
          pickupStart={listing.pickup_start}
          pickupEnd={listing.pickup_end}
          portionsRemaining={listing.portions_remaining}
          lang={lang}
        />
        <p className="portions tnum">
          {listing.portions_remaining}/{listing.portions_total}
        </p>
      </div>

      <h3 className="mt-2.5 text-base font-semibold leading-snug">{listing.description}</h3>

      {interested !== null && interested > 0 && (
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {t("provider.interested", { n: interested })}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <form action={portionAction} className="flex items-end gap-2">
          <input type="hidden" name="listing_id" value={listing.id} />
          <div>
            <label className="label text-sm" htmlFor={`rem-${listing.id}`}>
              {t("provider.updatePortions")}
            </label>
            <input
              id={`rem-${listing.id}`}
              name="remaining"
              type="number"
              inputMode="numeric"
              min={0}
              max={listing.portions_total}
              defaultValue={listing.portions_remaining}
              className="field tnum w-24"
            />
          </div>
          <button type="submit" className="btn btn-secondary" disabled={savingPortions}>
            {t("common.save")}
          </button>
        </form>

        {/* Separate form so "all gone" cannot be confused with the number
            field next to it — and so it posts 0 regardless of what is typed. */}
        <form action={portionAction}>
          <input type="hidden" name="listing_id" value={listing.id} />
          <input type="hidden" name="remaining" value="0" />
          <button type="submit" className="btn btn-danger" disabled={savingPortions}>
            {t("provider.markGone")}
          </button>
        </form>

        <form action={cancelAction}>
          <input type="hidden" name="listing_id" value={listing.id} />
          <button type="submit" className="btn btn-quiet" disabled={cancelling}>
            {t("provider.cancel")}
          </button>
        </form>
      </div>

      {(portionState.message || cancelState.message) && (
        <p className="mt-2 text-sm font-medium text-[var(--color-pine)]" role="status">
          {portionState.message ?? cancelState.message}
        </p>
      )}

      {(portionState.error || cancelState.error) && (
        <p className="error-text mt-2" role="alert">
          {portionState.error ?? cancelState.error}
        </p>
      )}
    </article>
  );
}
