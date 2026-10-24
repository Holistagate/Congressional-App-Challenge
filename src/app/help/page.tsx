import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { currentUser } from "@/lib/session";
import { getLang } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Other help near you" };

/**
 * Where the empty state sends people.
 *
 * On a night when no restaurant has posted, this page is the only useful thing
 * MealBridge can offer, so it is not a dead end: these are national services
 * that work everywhere in the US, reachable by phone, and they exist whether or
 * not anyone is using this app.
 */
export default async function HelpPage() {
  const user = await currentUser();
  const lang = await getLang(user?.language);
  const es = lang === "es";

  return (
    <>
      <AppHeader lang={lang} />

      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <h1>{es ? "Otra ayuda cerca de ti" : "Other help near you"}</h1>
        <p className="measure mt-2 text-[var(--color-muted)]">
          {es
            ? "Si no hay comida publicada ahora mismo, estos servicios funcionan en todo el país y están disponibles aunque MealBridge no tenga nada."
            : "If nothing is posted right now, these work everywhere in the US and are there whether or not MealBridge has anything tonight."}
        </p>

        <ul className="mt-7 grid gap-5">
          <Resource
            title="211"
            phone="211"
            href="https://www.211.org"
            body={
              es
                ? "Marca 211 desde cualquier teléfono en EE. UU. Te conectan con despensas de alimentos, comidas y otra ayuda en tu zona. Gratis, confidencial, y hay personas que hablan español."
                : "Dial 211 from any phone in the US. They connect you to food pantries, meals and other help in your area. Free, confidential, and available in many languages."
            }
          />

          <Resource
            title={es ? "Buscador de bancos de alimentos de Feeding America" : "Feeding America food bank finder"}
            href="https://www.feedingamerica.org/find-your-local-foodbank"
            body={
              es
                ? "Escribe tu código postal y encuentra el banco de alimentos de tu zona, con sus horarios y requisitos."
                : "Enter a ZIP code to find your local food bank, with its hours and what to bring."
            }
          />

          <Resource
            title={es ? "Línea Nacional contra el Hambre de USDA" : "USDA National Hunger Hotline"}
            phone="1-866-348-6479"
            body={
              es
                ? "Llama al 1-866-3-HUNGRY (1-866-348-6479) o al 1-877-8-HAMBRE (1-877-842-6273) para español. De lunes a viernes."
                : "Call 1-866-3-HUNGRY (1-866-348-6479), or 1-877-8-HAMBRE (1-877-842-6273) for Spanish. Monday to Friday."
            }
          />

          <Resource
            title={es ? "SNAP (cupones de alimentos)" : "SNAP (food stamps)"}
            href="https://www.fns.usda.gov/snap/state-directory"
            body={
              es
                ? "SNAP da dinero mensual para comprar comida. Solicitarlo no afecta tu situación migratoria en la mayoría de los casos; consulta la oficina de tu estado."
                : "SNAP gives monthly money for groceries. Applying does not affect immigration status in most cases — your state office can tell you."
            }
          />

          <Resource
            title={es ? "WIC, para familias con niños pequeños" : "WIC, for families with young children"}
            href="https://www.fns.usda.gov/wic"
            body={
              es
                ? "Para personas embarazadas y familias con niños menores de cinco años: comida, orientación nutricional y atención médica."
                : "For pregnant people and families with children under five: food, nutrition support and healthcare referrals."
            }
          />
        </ul>

        <p className="mt-9 border-t border-[var(--color-edge)] pt-5 text-sm text-[var(--color-muted)]">
          {es ? "Volver a " : "Back to "}
          <Link href="/food" className="text-[var(--color-pine)]">
            {es ? "comida cerca de ti" : "food near you"}
          </Link>
        </p>
      </main>

      <SiteFooter lang={lang} />
    </>
  );
}

function Resource({
  title,
  body,
  phone,
  href,
}: {
  title: string;
  body: string;
  phone?: string;
  href?: string;
}) {
  return (
    <li className="border-b border-[var(--color-edge)] pb-5 last:border-0">
      <h2 className="text-lg">{title}</h2>
      <p className="measure mt-1.5 leading-relaxed">{body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {phone && (
          <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="btn btn-primary text-sm">
            Call {phone}
          </a>
        )}
        {href && (
          <a
            href={href}
            className="btn btn-secondary text-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open website
          </a>
        )}
      </div>
    </li>
  );
}
