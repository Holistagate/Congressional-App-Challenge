import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SignInForm } from "@/components/SignInForm";
import { ProviderSignupForm } from "@/components/ProviderSignupForm";
import { currentUser } from "@/lib/session";
import { getLang } from "@/lib/i18n-server";
import { translator } from "@/lib/i18n";

export const metadata: Metadata = { title: "Create an account" };
export const dynamic = "force-dynamic";

export default async function SignupPage(props: PageProps<"/signup">) {
  const user = await currentUser();
  if (user) {
    redirect(user.role === "provider" ? "/provider" : user.role === "admin" ? "/admin" : "/food");
  }

  const params = await props.searchParams;
  const role = params.role === "provider" ? "provider" : "seeker";
  const lang = await getLang();
  const t = translator(lang);

  return (
    <>
      <AppHeader lang={lang} />

      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-5 py-10">
        {role === "provider" ? (
          <>
            <h1>{lang === "es" ? "Registra tu negocio" : "Register your business"}</h1>
            <p className="measure mt-2 text-[var(--color-muted)]">
              {lang === "es"
                ? "Revisamos cada negocio antes de que pueda publicar. Normalmente toma menos de un día."
                : "We check each business before it can post. That usually takes less than a day."}
            </p>
            <div className="mt-7">
              <ProviderSignupForm lang={lang} />
            </div>
          </>
        ) : (
          <>
            <h1>{t("auth.signUp")}</h1>
            <p className="measure mt-2 text-[var(--color-muted)]">
              {lang === "es"
                ? "Con una cuenta puedes recibir avisos cuando haya comida cerca y guardar lo que te interese."
                : "An account lets you get alerted when food is posted near you, and save listings you're interested in."}
            </p>
            <div className="mt-7">
              <SignInForm lang={lang} role="seeker" />
            </div>
          </>
        )}

        <p className="mt-8 border-t border-[var(--color-edge)] pt-5 text-sm text-[var(--color-muted)]">
          {role === "provider" ? (
            <>
              {lang === "es" ? "¿Buscas comida?" : "Looking for food?"}{" "}
              <Link href="/food" className="text-[var(--color-pine)]">
                {t("auth.browseInstead")}
              </Link>
            </>
          ) : (
            <>
              {lang === "es" ? "¿Tienes un restaurante?" : "Run a restaurant?"}{" "}
              <Link href="/signup?role=provider" className="text-[var(--color-pine)]">
                {lang === "es" ? "Registra tu negocio" : "Register your business"}
              </Link>
            </>
          )}
        </p>
      </main>

      <SiteFooter lang={lang} />
    </>
  );
}
