import Link from "next/link";
import { translator, type Lang } from "@/lib/i18n";
import { LanguageSwitch } from "./LanguageSwitch";

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = translator(lang);

  return (
    <footer className="mt-auto border-t border-[var(--color-edge)] bg-[var(--color-mist)]">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-pine)]">
              {t("app.name")}
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{t("app.tagline")}</p>
          </div>

          <LanguageSwitch lang={lang} label={t("nav.language")} />
        </div>

        <nav
          aria-label="Legal and help"
          className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--color-edge)] pt-6 text-sm"
        >
          <Link className="text-[var(--color-pine)]" href="/legal/terms">
            Terms of service
          </Link>
          <Link className="text-[var(--color-pine)]" href="/legal/privacy">
            Privacy
          </Link>
          <Link className="text-[var(--color-pine)]" href="/legal/food-safety">
            Food safety
          </Link>
          <Link className="text-[var(--color-pine)]" href="/help">
            Other help near you
          </Link>
        </nav>

        <p className="mt-6 max-w-[60ch] text-xs leading-relaxed text-[var(--color-muted)]">
          MealBridge connects people to food that restaurants already have. We don&apos;t
          prepare, store, transport or inspect it. Distances are approximate and measured
          between ZIP code centres.
        </p>
      </div>
    </footer>
  );
}
