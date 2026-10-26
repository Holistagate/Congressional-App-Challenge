"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type FormState } from "@/app/actions/auth";
import { translator, type Lang } from "@/lib/i18n";

/**
 * Sign-in: one field, one button.
 *
 * There is no password and no emailed code. Most of the people this is for
 * are looking for a meal tonight, often on a phone that is not theirs, and
 * every extra step between them and a list of addresses loses some of them.
 * See the note on `signIn` for what that costs and how to put a code back.
 */
export function SignInForm({ lang, role }: { lang: Lang; role?: "seeker" | "provider" }) {
  const t = translator(lang);
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});

  return (
    <form action={action}>
      {role && <input type="hidden" name="role" value={role} />}

      <label className="label" htmlFor="identifier">
        {t("auth.identifier")}
      </label>
      <input
        id="identifier"
        name="identifier"
        className="field"
        type="text"
        inputMode="email"
        autoComplete="email"
        required
        autoFocus
        defaultValue={state.values?.identifier}
        aria-describedby="identifier-hint identifier-error"
        aria-invalid={state.error ? true : undefined}
      />

      {state.error && (
        <p id="identifier-error" className="error-text mt-2" role="alert">
          {state.error}
        </p>
      )}

      <p id="identifier-hint" className="hint mt-2">
        {t("auth.identifierHint")}
      </p>

      <button type="submit" className="btn btn-primary mt-5 w-full sm:w-auto" disabled={pending}>
        {pending ? t("common.loading") : t("auth.continue")}
      </button>

      {role !== "provider" && (
        <p className="mt-8 border-t border-[var(--color-edge)] pt-5 text-sm text-[var(--color-muted)]">
          {t("auth.noAccountNeeded")}{" "}
          <Link href="/food" className="text-[var(--color-pine)]">
            {t("auth.browseInstead")}
          </Link>
        </p>
      )}
    </form>
  );
}
