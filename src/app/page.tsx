import Link from "next/link";
import type { Metadata } from "next";
import { Opening } from "@/components/Opening";
import { SiteFooter } from "@/components/SiteFooter";
import { currentUser } from "@/lib/session";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import "./opening.css";
import "./landing.css";

export const metadata: Metadata = {
  title: "MealBridge — free food near you",
};

export default async function LandingPage() {
  const user = await currentUser();
  const lang = await getLang(user?.language);
  const t = translator(lang);

  return (
    <>
      <Opening
        act1={t("landing.act1")}
        act2={t("landing.act2")}
        scrollLabel={t("landing.scroll")}
        signAlt={t("app.name")}
      />

      <main id="main">
        {/* The two plates in the photograph are the two choices. No icons, no
            cards — you are choosing a seat at the table. */}
        <section className="chooser" aria-labelledby="chooser-heading">
          <h2 id="chooser-heading" className="chooser-heading">
            {t("landing.choose")}
          </h2>

          <div className="chooser-table">
            <Link href="/food" className="plate plate-seeker">
              <span className="plate-face">
                <span className="plate-title">{t("landing.seeker")}</span>
                <span className="plate-sub">{t("landing.seekerSub")}</span>
              </span>
            </Link>

            <Link href="/signup?role=provider" className="plate plate-provider">
              <span className="plate-face">
                <span className="plate-title">{t("landing.provider")}</span>
                <span className="plate-sub">{t("landing.providerSub")}</span>
              </span>
            </Link>
          </div>
        </section>

        <section className="explainer" aria-labelledby="how-heading">
          <div className="explainer-inner">
            <h2 id="how-heading">{t("landing.how")}</h2>

            {/* Numbered because this genuinely is a sequence — three steps in
                order, not three features in a row. */}
            <ol className="steps">
              <li>
                <h3>A restaurant posts what&apos;s left</h3>
                <p>
                  At closing, somewhere near you, a kitchen has food that is still good and
                  nowhere for it to go. Posting it takes about a minute.
                </p>
              </li>
              <li>
                <h3>You see it, sorted by how close it is</h3>
                <p>
                  Type a ZIP code and you get a list: what the food is, the address in plain
                  text, and how long the pickup window stays open. We never ask for your
                  location.
                </p>
              </li>
              <li>
                <h3>You go and collect it</h3>
                <p>
                  No account, no questions, no explaining yourself. The food is free and it
                  is yours.
                </p>
              </li>
            </ol>

            <p className="explainer-note">
              MealBridge connects people to food that already exists. We don&apos;t prepare,
              store or inspect any of it — read the{" "}
              <Link href="/legal/food-safety">food safety notice</Link> for what that means.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} />
    </>
  );
}
