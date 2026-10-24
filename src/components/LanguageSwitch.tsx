"use client";

import { useTransition } from "react";
import { LANGUAGES, type Lang } from "@/lib/i18n";
import { setLanguage } from "@/app/actions/language";

/**
 * Language is a cookie plus, for signed-in people, a saved preference. It is a
 * plain <select> that submits on change: a custom dropdown here would cost
 * keyboard and screen-reader support for no gain.
 */
export function LanguageSwitch({ lang, label }: { lang: Lang; label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <label htmlFor="lang-switch" className="shrink-0 text-sm text-[var(--color-muted)]">
        {label}
      </label>
      <select
        id="lang-switch"
        name="lang"
        defaultValue={lang}
        disabled={pending}
        className="field w-auto py-1.5 text-sm"
        onChange={(e) => {
          const next = e.target.value as Lang;
          startTransition(() => {
            void setLanguage(next);
          });
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
