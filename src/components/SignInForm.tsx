"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestCode, submitCode, type FormState } from "@/app/actions/auth";
import { translator, type Lang } from "@/lib/i18n";

/**
 * Sign-in, in two steps on one screen.
 *
 * Step two replaces step one rather than appearing on a new page, so the code
 * someone just received is entered in the context they asked for it — and
 * going back is just not typing, rather than a navigation that loses state.
 */
export function SignInForm({ lang, role }: { lang: Lang; role?: "seeker" | "provider" }) {
  const t = translator(lang);
  const [sent, requestAction, requesting] = useActionState<FormState, FormData>(requestCode, {});
  const [verify, verifyAction, verifying] = useActionState<FormState, FormData>(submitCode, {});

  if (sent.ok) {
    return (
      <form action={verifyAction}>
        <p className="measure">{t("auth.codeSent", { masked: sent.masked ?? "" })}</p>

        <label className="label mt-5" htmlFor="code">
          {t("auth.code")}
        </label>
        <input
          id="code"
          name="code"
          className="field tnum max-w-[12rem] text-2xl tracking-[0.3em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          aria-invalid={verify.error ? true : undefined}
          aria-describedby="code-error"
        />

        {verify.error && (
          <p id="code-error" className="error-text mt-2" role="alert">
            {verify.error}
          </p>
        )}

        <button type="submit" className="btn btn-primary mt-5 w-full sm:w-auto" disabled={verifying}>
          {verifying ? t("common.loading") : t("auth.verify")}
        </button>

        <p className="mt-6 text-sm text-[var(--color-muted)]">
          {lang === "es" ? "¿No llegó?" : "Didn't get it?"}{" "}
          <button
            type="button"
            className="text-[var(--color-pine)] underline underline-offset-2"
            onClick={() => window.location.reload()}
          >
            {t("auth.resend")}
          </button>
        </p>
      </form>
    );
  }

  return (
    <form action={requestAction}>
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
        defaultValue={sent.values?.identifier}
        aria-describedby="identifier-hint identifier-error"
        aria-invalid={sent.error ? true : undefined}
      />

      {sent.error && (
        <p id="identifier-error" className="error-text mt-2" role="alert">
          {sent.error}
        </p>
      )}

      <p id="identifier-hint" className="hint mt-2">
        {t("auth.identifierHint")}
      </p>

      <button type="submit" className="btn btn-primary mt-5 w-full sm:w-auto" disabled={requesting}>
        {requesting ? t("common.loading") : t("auth.sendCode")}
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
