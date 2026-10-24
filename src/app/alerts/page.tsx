import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AlertEditor } from "@/components/AlertEditor";
import { currentUser } from "@/lib/session";
import { getLang } from "@/lib/i18n-server";
import { translator } from "@/lib/i18n";
import { all } from "@/db/index";
import { readZip } from "@/lib/zip-server";

export const metadata: Metadata = { title: "Alerts" };
export const dynamic = "force-dynamic";

type AlertRow = {
  id: string;
  zip: string;
  radius_miles: number;
  dietary_filters: string;
  channel: "push" | "sms" | "both";
  active: number;
};

export default async function AlertsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "seeker") redirect("/food");

  const lang = await getLang(user.language);
  const t = translator(lang);

  const alerts = all<AlertRow>(
    "SELECT id, zip, radius_miles, dietary_filters, channel, active FROM alerts WHERE seeker_id = ? ORDER BY created_at DESC",
    [user.id],
  );

  const defaultZip = (await readZip()) ?? user.home_zip ?? "";

  return (
    <>
      <AppHeader lang={lang} />

      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-5 py-6">
        <h1>{t("alerts.title")}</h1>
        <p className="measure mt-2 text-[var(--color-muted)]">{t("alerts.intro")}</p>

        {/* The privacy promise is stated where the ZIP is actually entered,
            not buried in a policy page nobody opens. */}
        <p className="measure mt-4 rounded-[var(--radius-ticket)] border border-[var(--color-edge)] bg-[var(--color-mist)] px-4 py-3 text-sm">
          {t("alerts.zipNote")}
        </p>

        <div className="mt-7 grid gap-7">
          {alerts.map((a) => (
            <AlertEditor key={a.id} lang={lang} alert={a} />
          ))}

          <div className={alerts.length ? "border-t border-[var(--color-edge)] pt-7" : ""}>
            {alerts.length > 0 && (
              <h2 className="mb-4 text-lg">
                {lang === "es" ? "Añadir otro aviso" : "Add another alert"}
              </h2>
            )}
            <AlertEditor lang={lang} defaultZip={defaultZip} />
          </div>
        </div>
      </main>

      <SiteFooter lang={lang} />
    </>
  );
}
