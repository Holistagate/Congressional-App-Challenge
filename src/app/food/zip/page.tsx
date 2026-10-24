import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ZipGate } from "@/components/ZipGate";
import { currentUser } from "@/lib/session";
import { getLang } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Change your ZIP code" };

export default async function ChangeZipPage() {
  const user = await currentUser();
  const lang = await getLang(user?.language);

  return (
    <>
      <AppHeader lang={lang} />
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-5 py-10">
        <ZipGate lang={lang} />
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
