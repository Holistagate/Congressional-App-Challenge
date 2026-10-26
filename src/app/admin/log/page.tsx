import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { currentUser } from "@/lib/session";
import { getLang } from "@/lib/i18n-server";
import { all } from "@/db/index";

export const metadata: Metadata = { title: "Moderation log" };
export const dynamic = "force-dynamic";

export default async function AdminLogPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/food");

  const lang = await getLang(user.language);

  const entries = await all<{
    id: string;
    action: string;
    target_type: string;
    target_id: string;
    note: string;
    created_at: number;
    admin_name: string;
    admin_email: string | null;
  }>(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.note, a.created_at,
            u.name AS admin_name, u.email AS admin_email
     FROM admin_actions a
     LEFT JOIN users u ON u.id = a.admin_id
     ORDER BY a.created_at DESC
     LIMIT 200`,
  );

  return (
    <>
      <AppHeader lang={lang} />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
        <Link href="/admin" className="text-sm text-[var(--color-pine)]">
          Moderation
        </Link>

        <h1 className="mt-3">Moderation log</h1>
        <p className="measure mt-2 text-[var(--color-muted)]">
          Every approval, suspension and removal, with who made it. Suspending a business
          decides whether its food reaches anyone, so these decisions are not anonymous.
        </p>

        {entries.length === 0 ? (
          <p className="mt-6 text-[var(--color-muted)]">Nothing recorded yet.</p>
        ) : (
          <ul className="mt-6 grid gap-0">
            {entries.map((e) => (
              <li
                key={e.id}
                className="grid gap-1 border-b border-[var(--color-edge)] py-3 text-sm sm:grid-cols-[11rem_1fr]"
              >
                <time
                  className="tnum text-[var(--color-muted)]"
                  dateTime={new Date(e.created_at).toISOString()}
                >
                  {new Date(e.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>

                <div>
                  <p>
                    <span className="font-semibold">{e.action}</span>{" "}
                    <span className="text-[var(--color-muted)]">
                      {e.target_type} {e.target_id.slice(0, 12)}
                    </span>
                  </p>
                  <p className="text-[var(--color-muted)]">
                    {e.admin_name || e.admin_email || "deleted account"}
                  </p>
                  {e.note && <p className="mt-1">{e.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter lang={lang} />
    </>
  );
}
