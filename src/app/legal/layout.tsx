import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { currentUser } from "@/lib/session";
import { getLang } from "@/lib/i18n-server";

/**
 * Legal pages share one narrow, high-contrast reading column. They are written
 * to be read, not to be scrolled past — short sentences, plain words, and no
 * block capitals.
 */
export default async function LegalLayout({ children }: LayoutProps<"/legal">) {
  const user = await currentUser();
  const lang = await getLang(user?.language);

  return (
    <>
      <AppHeader lang={lang} />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <div className="legal">{children}</div>
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
