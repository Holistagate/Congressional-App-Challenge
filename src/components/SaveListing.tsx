"use client";

import { useActionState } from "react";
import Link from "next/link";
import { toggleSave } from "@/app/actions/listings";
import { translator, type Lang } from "@/lib/i18n";

/**
 * Saving a listing does two things: it puts it somewhere a person can find it
 * again, and it opts them into being told if the food goes or the pickup is
 * cancelled — which is the part that saves a wasted journey.
 */
export function SaveListing({
  listingId,
  saved,
  signedIn,
  lang,
}: {
  listingId: string;
  saved: boolean;
  signedIn: boolean;
  lang: Lang;
}) {
  const t = translator(lang);
  const [state, action, pending] = useActionState(toggleSave, {});

  if (!signedIn) {
    return (
      <Link href="/signup?role=seeker" className="btn btn-secondary text-sm">
        {t("listing.save")}
      </Link>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="listing_id" value={listingId} />
      <button
        type="submit"
        className={saved ? "btn btn-primary text-sm" : "btn btn-secondary text-sm"}
        disabled={pending}
        aria-pressed={saved}
      >
        {saved ? t("listing.saved") : t("listing.save")}
      </button>
      {state?.error && (
        <p className="error-text mt-1" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
