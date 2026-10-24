import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PostFoodForm } from "@/components/PostFoodForm";
import { currentUser, currentProvider } from "@/lib/session";
import { getLang } from "@/lib/i18n-server";
import { translator } from "@/lib/i18n";

export const metadata: Metadata = { title: "Post food" };
export const dynamic = "force-dynamic";

export default async function PostFoodPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "provider") redirect("/food");

  const provider = await currentProvider();
  if (!provider) redirect("/signup?role=provider");

  const lang = await getLang(user.language);
  const t = translator(lang);

  // The form is not rendered at all for a business that cannot post. Hiding
  // the button alone would be theatre — the action re-checks this too.
  if (provider.status !== "approved") {
    return (
      <>
        <AppHeader lang={lang} />
        <main id="main" className="mx-auto w-full max-w-xl flex-1 px-5 py-10">
          <h1>{provider.status === "pending" ? t("provider.pending") : t("provider.suspended")}</h1>
          <p className="measure mt-3">
            {provider.status === "pending"
              ? t("provider.pendingBody")
              : lang === "es"
                ? "Escríbenos para resolverlo."
                : "Get in touch and we'll sort it out."}
          </p>
          <Link href="/provider" className="btn btn-secondary mt-6">
            {t("nav.dashboard")}
          </Link>
        </main>
        <SiteFooter lang={lang} />
      </>
    );
  }

  return (
    <>
      <AppHeader lang={lang} />

      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <Link href="/provider" className="text-sm text-[var(--color-pine)]">
          {t("nav.dashboard")}
        </Link>

        <h1 className="mt-3">{t("post.title")}</h1>

        <div className="mt-7">
          <PostFoodForm provider={provider} lang={lang} />
        </div>
      </main>

      <SiteFooter lang={lang} />
    </>
  );
}
