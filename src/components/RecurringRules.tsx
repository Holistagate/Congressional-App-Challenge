"use client";

import { useActionState, useState } from "react";
import {
  createRecurringRule,
  setRulePaused,
  deleteRule,
  type RecurringState,
} from "@/app/actions/recurring";
import { DIETARY_TAGS, ALLERGEN_TAGS } from "@/lib/domain";
import { translator, type Lang } from "@/lib/i18n";

export type RuleSummary = {
  id: string;
  weekdays: string;
  start_minutes: number;
  end_minutes: number;
  template: string;
  paused: number;
  last_run_on: string | null;
};

const DAYS = [
  { iso: 1, en: "Mon", es: "Lun" },
  { iso: 2, en: "Tue", es: "Mar" },
  { iso: 3, en: "Wed", es: "Mié" },
  { iso: 4, en: "Thu", es: "Jue" },
  { iso: 5, en: "Fri", es: "Vie" },
  { iso: 6, en: "Sat", es: "Sáb" },
  { iso: 7, en: "Sun", es: "Dom" },
] as const;

/**
 * Standing schedules.
 *
 * Shown as a short list of existing rules plus a collapsed form, because for
 * most restaurants this is a once-ever setup — it should not take up the
 * dashboard every day once it's done.
 */
export function RecurringRules({ lang, rules }: { lang: Lang; rules: RuleSummary[] }) {
  const t = translator(lang);
  const [state, action, pending] = useActionState<RecurringState, FormData>(
    createRecurringRule,
    {},
  );
  const [open, setOpen] = useState(rules.length === 0);

  return (
    <section className="mt-9" aria-labelledby="recurring-heading">
      <h2 id="recurring-heading" className="text-lg">
        {lang === "es" ? "Publicaciones programadas" : "Repeat automatically"}
      </h2>
      <p className="measure mt-1 text-sm text-[var(--color-muted)]">
        {lang === "es"
          ? "Si das comida los mismos días a la misma hora, configúralo una vez y se publicará solo."
          : "If you give food away on the same days at the same time, set it once and it posts itself."}
      </p>

      {rules.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {rules.map((r) => (
            <li key={r.id}>
              <RuleRow rule={r} lang={lang} />
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <button type="button" className="btn btn-secondary mt-4" onClick={() => setOpen(true)}>
          {lang === "es" ? "Añadir un horario" : "Add a schedule"}
        </button>
      ) : (
        <form action={action} className="mt-5 grid gap-5 border-t border-[var(--color-edge)] pt-5">
          <fieldset>
            <legend className="label">{lang === "es" ? "¿Qué días?" : "Which days?"}</legend>
            <div className="choice-row">
              {DAYS.map((d) => (
                <label key={d.iso} className="choice">
                  <input type="checkbox" name="weekdays" value={d.iso} />
                  <span>{d[lang]}</span>
                </label>
              ))}
            </div>
            {state.errors?.weekdays && <p className="error-text mt-1">{state.errors.weekdays}</p>}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label text-sm" htmlFor="start_time">
                {t("post.from")}
              </label>
              <input
                id="start_time"
                name="start_time"
                type="time"
                className="field"
                required
                defaultValue="21:30"
              />
            </div>
            <div>
              <label className="label text-sm" htmlFor="end_time">
                {t("post.until")}
              </label>
              <input
                id="end_time"
                name="end_time"
                type="time"
                className="field"
                required
                defaultValue="22:30"
              />
              <p className="hint mt-1">
                {lang === "es"
                  ? "Si la hora de fin es antes que la de inicio, la ventana cruza la medianoche."
                  : "An end time before the start means the window runs past midnight."}
              </p>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="rec-description">
              {t("post.what")}
            </label>
            <textarea
              id="rec-description"
              name="description"
              className="field"
              rows={2}
              required
              minLength={10}
              maxLength={600}
              placeholder={
                lang === "es"
                  ? "Pan y bollería del día."
                  : "Unsold bread and pastries from the day."
              }
            />
            {state.errors?.["template.description"] && (
              <p className="error-text mt-1">{state.errors["template.description"]}</p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="rec-portions">
              {t("post.portions")}
            </label>
            <input
              id="rec-portions"
              name="portions"
              type="number"
              min={1}
              max={1000}
              defaultValue={15}
              required
              className="field tnum w-32"
            />
          </div>

          <fieldset>
            <legend className="label text-sm">{t("seeker.dietary")}</legend>
            <div className="choice-row">
              {DIETARY_TAGS.map((d) => (
                <label key={d.id} className="choice">
                  <input type="checkbox" name="dietary_tags" value={d.id} />
                  <span>{d[lang]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label text-sm">{lang === "es" ? "Alérgenos" : "Allergens"}</legend>
            <p className="hint mb-2">{t("post.allergenHint")}</p>
            <div className="choice-row">
              {ALLERGEN_TAGS.map((a) => (
                <label key={a.id} className="choice">
                  <input type="checkbox" name="allergen_tags" value={a.id} />
                  <span>{a[lang]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="label" htmlFor="rec-notes">
              {t("post.notes")}
            </label>
            <input id="rec-notes" name="notes" className="field" maxLength={400} />
          </div>

          <p className="hint">
            {lang === "es"
              ? "Confirmas la lista de seguridad alimentaria al guardar este horario, y se aplica a cada publicación que genere. Si un día la comida no cumple, pausa el horario."
              : "You confirm the food safety checklist when you save this schedule, and it stands for every post it creates. If the food doesn't meet it on a given day, pause the schedule."}
          </p>

          {state.error && (
            <p className="error-text" role="alert">
              {state.error}
            </p>
          )}
          {state.message && (
            <p className="text-sm font-medium text-[var(--color-pine)]" role="status">
              {state.message}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {lang === "es" ? "Guardar horario" : "Save schedule"}
            </button>
            {rules.length > 0 && (
              <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function RuleRow({ rule, lang }: { rule: RuleSummary; lang: Lang }) {
  const [pauseState, pauseAction, pausing] = useActionState<RecurringState, FormData>(
    setRulePaused,
    {},
  );
  const [removeState, removeAction, removing] = useActionState<RecurringState, FormData>(
    deleteRule,
    {},
  );

  if (removeState.ok) {
    return (
      <p className="rounded-[var(--radius-ticket)] border border-[var(--color-edge)] bg-[var(--color-mist)] px-4 py-3 text-sm" role="status">
        {removeState.message}
      </p>
    );
  }

  const days = rule.weekdays
    .split(",")
    .map((d) => DAYS.find((x) => x.iso === Number(d))?.[lang])
    .filter(Boolean)
    .join(" ");

  const template = safeTemplate(rule.template);
  const paused = rule.paused === 1;

  return (
    <div className="ticket !pl-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          <span className="tnum">{days}</span>
          {"  "}
          <span className="tnum font-normal text-[var(--color-muted)]">
            {clock(rule.start_minutes)} – {clock(rule.end_minutes)}
          </span>
        </p>
        {paused && (
          <span className="chip chip-allergen">{lang === "es" ? "En pausa" : "Paused"}</span>
        )}
      </div>

      <p className="mt-1 text-sm">{template.description}</p>
      <p className="mt-0.5 text-sm text-[var(--color-muted)] tnum">
        {template.portions} {lang === "es" ? "porciones" : "portions"}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <form action={pauseAction}>
          <input type="hidden" name="rule_id" value={rule.id} />
          <input type="hidden" name="paused" value={paused ? "0" : "1"} />
          <button type="submit" className="btn btn-quiet text-sm" disabled={pausing}>
            {paused
              ? lang === "es"
                ? "Reanudar"
                : "Resume"
              : lang === "es"
                ? "Pausar"
                : "Pause"}
          </button>
        </form>

        <form action={removeAction}>
          <input type="hidden" name="rule_id" value={rule.id} />
          <button type="submit" className="btn btn-danger text-sm" disabled={removing}>
            {lang === "es" ? "Eliminar" : "Remove"}
          </button>
        </form>
      </div>

      {pauseState.message && (
        <p className="mt-2 text-sm font-medium text-[var(--color-pine)]" role="status">
          {pauseState.message}
        </p>
      )}
      {(pauseState.error || removeState.error) && (
        <p className="error-text mt-2" role="alert">
          {pauseState.error ?? removeState.error}
        </p>
      )}
    </div>
  );
}

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function safeTemplate(json: string): { description: string; portions: number } {
  try {
    const t = JSON.parse(json);
    return { description: String(t.description ?? ""), portions: Number(t.portions ?? 0) };
  } catch {
    return { description: "", portions: 0 };
  }
}
