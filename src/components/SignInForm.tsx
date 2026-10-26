"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type FormState } from "@/app/actions/auth";
import { translator, type Lang } from "@/lib/i18n";

/**
 * Sign-in: an address and a password.
 *
 * The password fields only appear in the "choose one" state, so a returning
 * user sees two fields and a button, and a first-time user is asked to pick
 * a password on the second step rather than being confronted with three
 * boxes before they know whether they even have an account.
 *
 * Nothing on the seeker path requires any of this. Someone who needs food
 * tonight types a ZIP code on /food and never comes near this page.
 */
export function SignInForm({ lang, role }: { lang: Lang; role?: "seeker" | "provider" }) {
  const t = translator(lang);
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});

  return (
    <form action={action}>
      {role && <input type="hidden" name="role" value={role} />}

      {state.notice && (
        <p className="notice mb-4" role="status">
          {state.notice}
        </p>
      )}

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

      <label className="label mt-5" htmlFor="password">
        {state.needsPassword ? t("auth.choosePassword") : t("auth.password")}
      </label>
      <input
        id="password"
        name="password"
        className="field"
        type="password"
        autoComplete={state.needsPassword ? "new-password" : "current-password"}
        required
        minLength={state.needsPassword ? 8 : undefined}
        aria-describedby={state.needsPassword ? "password-hint password-error" : "password-error"}
        aria-invalid={state.errors?.password ? true : undefined}
      />
      {state.errors?.password && (
        <p id="password-error" className="error-text mt-1" role="alert">
          {state.errors.password}
        </p>
      )}
      {state.needsPassword && (
        <p id="password-hint" className="hint mt-1">
          {t("auth.passwordHint")}
        </p>
      )}

      {state.needsPassword && (
        <>
          <label className="label mt-4" htmlFor="confirm">
            {t("auth.confirmPassword")}
          </label>
          <input
            id="confirm"
            name="confirm"
            className="field"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={state.errors?.confirm ? true : undefined}
          />
          {state.errors?.confirm && (
            <p className="error-text mt-1" role="alert">
              {state.errors.confirm}
            </p>
          )}
        </>
      )}

      <button type="submit" className="btn btn-primary mt-5 w-full sm:w-auto" disabled={pending}>
        {pending ? t("common.loading") : state.needsPassword ? t("auth.createAccount") : t("auth.continue")}
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
