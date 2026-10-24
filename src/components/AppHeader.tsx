import Link from "next/link";
import { currentUser } from "@/lib/session";
import { translator, type Lang } from "@/lib/i18n";
import { signOut } from "@/app/actions/auth";

/**
 * The app bar. Deliberately plain: a mark, a name, and only the links the
 * person signed in can actually use. A seeker never sees provider navigation,
 * and nobody sees admin links they cannot open.
 */
export async function AppHeader({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const user = await currentUser();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-edge)] bg-[var(--color-paper)]">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <Link href="/" className="flex items-center gap-2 no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/mark-64.png" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-[var(--color-pine)] sm:text-lg">
            {t("app.name")}
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto flex items-center gap-0.5 text-sm sm:gap-1">
          <Link href="/food" className="nav-link">
            {t("nav.findFood")}
          </Link>

          {user?.role === "seeker" && (
            <Link href="/alerts" className="nav-link">
              {t("nav.alerts")}
            </Link>
          )}

          {user?.role === "provider" && (
            <Link href="/provider" className="nav-link">
              {t("nav.dashboard")}
            </Link>
          )}

          {user?.role === "admin" && (
            <Link href="/admin" className="nav-link">
              {t("nav.admin")}
            </Link>
          )}

          {user ? (
            <form action={signOut}>
              <button type="submit" className="nav-link">
                {t("nav.signOut")}
              </button>
            </form>
          ) : (
            <Link href="/login" className="nav-link nav-link-strong">
              {t("nav.signIn")}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
