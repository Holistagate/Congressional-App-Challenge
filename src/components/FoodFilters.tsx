import Link from "next/link";
import { DIETARY_TAGS } from "@/lib/domain";
import { RADIUS_OPTIONS } from "@/lib/geo";
import { translator, type Lang } from "@/lib/i18n";

/**
 * Filters as a plain GET form.
 *
 * No JavaScript involved: the form submits to the same page with query
 * parameters, which means filtering works on a phone where the bundle hasn't
 * finished downloading, and every filtered view is a shareable URL. The submit
 * button is always visible rather than filtering on change, because a list
 * that reshuffles under your thumb while you are still choosing is hostile.
 */
export function FoodFilters({
  lang,
  radius,
  when,
  dietary,
}: {
  lang: Lang;
  radius: number;
  when: "any" | "now" | "later";
  dietary: string[];
}) {
  const t = translator(lang);
  const active = dietary.length > 0 || when !== "any" || radius !== 10;

  return (
    <form method="get" action="/food" className="mt-5">
      <details className="filters" open={active}>
        <summary>
          {t("seeker.filters")}
          {active && <span className="filters-count">{countActive(radius, when, dietary)}</span>}
        </summary>

        <div className="filters-body">
          <fieldset>
            <legend className="label">{t("seeker.radius")}</legend>
            <div className="choice-row">
              {RADIUS_OPTIONS.map((r) => (
                <label key={r} className="choice">
                  <input type="radio" name="radius" value={r} defaultChecked={radius === r} />
                  <span>{t("seeker.miles", { n: r })}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="label">{t("seeker.when")}</legend>
            <div className="choice-row">
              {(
                [
                  ["any", t("seeker.whenAny")],
                  ["now", t("seeker.whenNow")],
                  ["later", t("seeker.whenLater")],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="choice">
                  <input type="radio" name="when" value={value} defaultChecked={when === value} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="label">{t("seeker.dietary")}</legend>
            <div className="choice-row">
              {DIETARY_TAGS.map((tag) => (
                <label key={tag.id} className="choice">
                  <input
                    type="checkbox"
                    name="diet"
                    value={tag.id}
                    defaultChecked={dietary.includes(tag.id)}
                  />
                  <span>{tag[lang]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary text-sm">
              {lang === "es" ? "Aplicar filtros" : "Apply filters"}
            </button>
            {active && (
              <Link href="/food" className="btn btn-quiet text-sm">
                {t("seeker.clearFilters")}
              </Link>
            )}
          </div>
        </div>
      </details>
    </form>
  );
}

function countActive(radius: number, when: string, dietary: string[]): number {
  return (radius !== 10 ? 1 : 0) + (when !== "any" ? 1 : 0) + dietary.length;
}
