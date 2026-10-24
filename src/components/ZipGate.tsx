"use client";

import { useActionState } from "react";
import Link from "next/link";
import { setZip } from "@/app/actions/zip";
import { translator, type Lang } from "@/lib/i18n";

/**
 * The only thing we ask a seeker for.
 *
 * Not a sign-up, not a location permission, not a reason. Five digits, and
 * only so the list can be sorted by distance. The note under the field says
 * exactly that, because a person who has been asked to justify themselves at
 * every other door deserves to know what this one wants.
 */
export function ZipGate({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const [state, action, pending] = useActionState(setZip, undefined);

  return (
    <div>
      <h1>{t("seeker.title")}</h1>

      <form action={action} className="mt-6">
        <label className="label" htmlFor="zip">
          {t("seeker.zipLabel")}
        </label>

        <input
          id="zip"
          name="zip"
          className="field tnum max-w-[12rem] text-2xl tracking-[0.12em]"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="[0-9]{5}"
          maxLength={10}
          required
          autoFocus
          placeholder="60615"
          aria-describedby="zip-hint zip-error"
          aria-invalid={state?.error ? true : undefined}
        />

        {state?.error && (
          <p id="zip-error" className="error-text mt-2" role="alert">
            {state.error}
          </p>
        )}

        <p id="zip-hint" className="hint mt-2 max-w-[46ch]">
          {t("seeker.zipHint")}
        </p>

        <button type="submit" className="btn btn-primary mt-5 w-full sm:w-auto" disabled={pending}>
          {pending ? t("common.loading") : t("seeker.zipAction")}
        </button>
      </form>

      <p className="mt-8 border-t border-[var(--color-edge)] pt-5 text-sm text-[var(--color-muted)]">
        {t("auth.noAccountNeeded")}{" "}
        <Link href="/signup?role=seeker" className="text-[var(--color-pine)]">
          {lang === "es"
            ? "Crea una cuenta para recibir avisos."
            : "Create one to get alerts."}
        </Link>
      </p>
    </div>
  );
}
