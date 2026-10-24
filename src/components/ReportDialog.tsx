"use client";

import { useActionState, useRef } from "react";
import { reportListing } from "@/app/actions/listings";
import { translator, type Lang } from "@/lib/i18n";

/**
 * "Report a problem", on every listing.
 *
 * A native <dialog>, so focus trapping, Escape and the backdrop all come from
 * the browser rather than from a few hundred lines of our own that would get
 * one of them subtly wrong.
 *
 * The reasons are written as things that happened, not accusations: "The place
 * was closed", not "The restaurant lied". Someone reporting is usually
 * standing outside, tired, and we are asking for a favour.
 */
export function ReportDialog({ listingId, lang }: { listingId: string; lang: Lang }) {
  const t = translator(lang);
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(reportListing, {});

  const reasons = [
    { id: "gone", label: t("report.gone") },
    { id: "closed", label: t("report.closed") },
    { id: "wrong_info", label: t("report.wrong_info") },
    { id: "unsafe", label: t("report.unsafe") },
    { id: "other", label: t("report.other") },
  ];

  return (
    <>
      <button type="button" className="btn btn-quiet text-sm" onClick={() => ref.current?.showModal()}>
        {t("listing.report")}
      </button>

      <dialog ref={ref} className="sheet" aria-labelledby="report-title">
        <form action={action} className="sheet-body">
          <h2 id="report-title" className="text-xl">
            {t("report.title")}
          </h2>
          <p className="hint mt-1">{t("report.intro")}</p>

          <input type="hidden" name="listing_id" value={listingId} />

          {state?.ok ? (
            <p className="mt-5 font-semibold text-[var(--color-pine)]" role="status">
              {t("report.sent")}
            </p>
          ) : (
            <>
              <fieldset className="mt-4">
                <legend className="sr-only">{t("report.title")}</legend>
                <div className="grid gap-2">
                  {reasons.map((r, i) => (
                    <label key={r.id} className="choice-stacked">
                      <input type="radio" name="reason" value={r.id} defaultChecked={i === 0} required />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="label mt-4" htmlFor="report-details">
                {t("report.details")}
              </label>
              <textarea
                id="report-details"
                name="details"
                className="field"
                rows={3}
                maxLength={600}
              />

              {state?.error && (
                <p className="error-text mt-2" role="alert">
                  {state.error}
                </p>
              )}
            </>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn btn-quiet" onClick={() => ref.current?.close()}>
              {state?.ok ? t("common.back") : t("common.cancel")}
            </button>
            {!state?.ok && (
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {t("report.submit")}
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
