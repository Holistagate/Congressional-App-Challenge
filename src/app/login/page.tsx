import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SignInForm } from "@/components/SignInForm";
import { currentUser } from "@/lib/session";
import { getLang } from "@/lib/i18n-server";
import { translator } from "@/lib/i18n";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) {
    redirect(user.role === "provider" ? "/provider" : user.role === "admin" ? "/admin" : "/food");
  }

  const lang = await getLang();
  const t = translator(lang);

  return (
    <>
      <AppHeader lang={lang} />
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <h1>{t("auth.signIn")}</h1>
        <div className="mt-6">
          <SignInForm lang={lang} />
        </div>
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
