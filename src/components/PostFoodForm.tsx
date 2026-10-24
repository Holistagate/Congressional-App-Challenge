"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { postListing, type ActionState } from "@/app/actions/listings";
import {
  FOOD_CATEGORIES,
  DIETARY_TAGS,
  ALLERGEN_TAGS,
  SAFETY_CHECKLIST,
} from "@/lib/domain";
import { translator, type Lang } from "@/lib/i18n";
import type { ProviderRecord } from "@/lib/session";

/**
 * Posting food.
 *
 * The whole form is built around a ninety-second window at closing time. The
 * address is prefilled from the business, the times default to "now until two
 * hours from now", and the only genuinely required thinking is what the food
 * is and how many portions. Everything else can be left alone.
 */
export function PostFoodForm({ provider, lang }: { provider: ProviderRecord; lang: Lang }) {
  const t = translator(lang);
  const [state, action, pending] = useActionState<ActionState, FormData>(postListing, {});
  const [useBusinessAddress, setUseBusinessAddress] = useState(true);

  // Starts now, not at the next quarter hour: a kitchen posting at closing
  // has the food on the pass already, and a window that opens in nine
  // minutes would show as "not open yet" to everyone it just notified.
  const now = new Date();
  const start = now;
  const end = roundToQuarter(new Date(now.getTime() + 2 * 60 * 60 * 1000));

  if (state.ok) {
    return (
      <div>
        <h2 className="text-2xl">{state.message}</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/provider" className="btn btn-primary">
            {t("nav.dashboard")}
          </Link>
          <Link href="/provider/post" className="btn btn-secondary">
            {lang === "es" ? "Publicar algo más" : "Post something else"}
          </Link>
        </div>
      </div>
    );
  }

  const err = (f: string) => state.errors?.[f];

  return (
    <form action={action} className="grid gap-7">
      {/* --- what ------------------------------------------------------- */}
      <section>
        <label className="label text-base" htmlFor="description">
          {t("post.what")}
        </label>
        <p className="hint mb-2">{t("post.whatHint")}</p>
        <textarea
          id="description"
          name="description"
          className="field"
          rows={3}
          required
          minLength={10}
          maxLength={600}
          autoFocus
          placeholder={
            lang === "es"
              ? "Tamales vegetarianos y una olla de pozole verde."
              : "Roast chicken, rice and beans, and a tray of roasted vegetables."
          }
          aria-invalid={err("description") ? true : undefined}
        />
        {err("description") && <p className="error-text mt-1">{err("description")}</p>}

        <fieldset className="mt-4">
          <legend className="label">{t("post.categories")}</legend>
          <div className="choice-row">
            {FOOD_CATEGORIES.map((c) => (
              <label key={c.id} className="choice">
                <input type="checkbox" name="categories" value={c.id} />
                <span>{c[lang]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/* --- how much --------------------------------------------------- */}
      <section>
        <label className="label text-base" htmlFor="portions">
          {t("post.portions")}
        </label>
        <p className="hint mb-2">{t("post.portionsHint")}</p>
        <input
          id="portions"
          name="portions"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          defaultValue={12}
          required
          className="field tnum w-32 text-xl"
          aria-invalid={err("portions") ? true : undefined}
        />
        {err("portions") && <p className="error-text mt-1">{err("portions")}</p>}
      </section>

      {/* --- when ------------------------------------------------------- */}
      <section>
        <h2 className="label text-base">{t("post.when")}</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label text-sm" htmlFor="pickup_start">
              {t("post.from")}
            </label>
            <input
              id="pickup_start"
              name="pickup_start"
              type="datetime-local"
              className="field"
              required
              defaultValue={localValue(start)}
            />
          </div>
          <div>
            <label className="label text-sm" htmlFor="pickup_end">
              {t("post.until")}
            </label>
            <input
              id="pickup_end"
              name="pickup_end"
              type="datetime-local"
              className="field"
              required
              defaultValue={localValue(end)}
              aria-invalid={err("pickup_end") ? true : undefined}
            />
            {err("pickup_end") && <p className="error-text mt-1">{err("pickup_end")}</p>}
          </div>
        </div>
      </section>

      {/* --- where ------------------------------------------------------ */}
      <section>
        <h2 className="label text-base">{t("post.where")}</h2>
        <p className="hint">{t("post.whereHint")}</p>

        <label className="choice-stacked mt-3">
          <input
            type="checkbox"
            checked={useBusinessAddress}
            onChange={(e) => setUseBusinessAddress(e.target.checked)}
          />
          <span>{t("post.useBusinessAddress")}</span>
        </label>

        {useBusinessAddress ? (
          <>
            <address className="mt-3 not-italic leading-relaxed">
              {provider.street}
              <br />
              {provider.city}, {provider.state} {provider.zip}
            </address>
            <input type="hidden" name="street" value={provider.street} />
            <input type="hidden" name="city" value={provider.city} />
            <input type="hidden" name="state" value={provider.state} />
            <input type="hidden" name="zip" value={provider.zip} />
          </>
        ) : (
          <div className="mt-3 grid gap-3">
            <div>
              <label className="label text-sm" htmlFor="street">
                {lang === "es" ? "Dirección" : "Street address"}
              </label>
              <input id="street" name="street" className="field" required defaultValue={provider.street} />
            </div>
            <div className="grid grid-cols-[1fr_5rem_7rem] gap-3">
              <div>
                <label className="label text-sm" htmlFor="city">
                  {lang === "es" ? "Ciudad" : "City"}
                </label>
                <input id="city" name="city" className="field" required defaultValue={provider.city} />
              </div>
              <div>
                <label className="label text-sm" htmlFor="state">
                  {lang === "es" ? "Estado" : "State"}
                </label>
                <input id="state" name="state" className="field" required maxLength={2} defaultValue={provider.state} />
              </div>
              <div>
                <label className="label text-sm" htmlFor="zip">
                  ZIP
                </label>
                <input
                  id="zip"
                  name="zip"
                  className="field tnum"
                  required
                  inputMode="numeric"
                  maxLength={10}
                  defaultValue={provider.zip}
                  aria-invalid={err("zip") ? true : undefined}
                />
              </div>
            </div>
            {err("zip") && <p className="error-text">{err("zip")}</p>}
          </div>
        )}
      </section>

      {/* --- tags ------------------------------------------------------- */}
      <section>
        <h2 className="label text-base">{t("post.tags")}</h2>

        <fieldset className="mt-2">
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

        <fieldset className="mt-4">
          <legend className="label text-sm">
            {lang === "es" ? "Alérgenos" : "Allergens"}
          </legend>
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
      </section>

      {/* --- handoff ---------------------------------------------------- */}
      <section>
        <label className="label text-base" htmlFor="notes">
          {t("post.notes")}
        </label>
        <p className="hint mb-2">{t("post.notesHint")}</p>
        <textarea
          id="notes"
          name="notes"
          className="field"
          rows={2}
          maxLength={400}
          placeholder={
            lang === "es"
              ? "Toca la puerta de atrás y pregunta por María."
              : "Knock at the back door and ask for Maria."
          }
        />
      </section>

      {/* --- safety ----------------------------------------------------- */}
      <section className="rounded-[var(--radius-ticket)] border border-[var(--color-edge)] bg-[var(--color-mist)] p-4">
        <h2 className="text-base font-semibold">{t("post.safety")}</h2>
        <p className="hint mt-1">{t("post.safetyIntro")}</p>

        <div className="mt-3 grid gap-2">
          {SAFETY_CHECKLIST.map((item) => (
            <label key={item.id} className="choice-stacked">
              <input type="checkbox" name="safety_ack" value={item.id} required />
              <span className="text-sm">{item[lang]}</span>
            </label>
          ))}
        </div>

        {err("safety_ack") && <p className="error-text mt-2">{err("safety_ack")}</p>}

        <p className="hint mt-3">
          {lang === "es"
            ? "La Ley Bill Emerson de Buen Samaritano protege de responsabilidad a quienes donan alimentos de buena fe. No es asesoría legal: consulta las normas de tu localidad."
            : "The Bill Emerson Good Samaritan Act protects people who donate food in good faith from liability. This isn't legal advice — check your local rules."}{" "}
          <Link href="/legal/food-safety" className="text-[var(--color-pine)]">
            {lang === "es" ? "Más información" : "Read more"}
          </Link>
        </p>
      </section>

      {state.error && (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      )}

      <div>
        <button type="submit" className="btn btn-primary w-full text-lg sm:w-auto" disabled={pending}>
          {pending ? t("post.posting") : t("post.submit")}
        </button>
      </div>
    </form>
  );
}

/** Nobody closes at 9:03. Round the default end up to the next quarter hour. */
function roundToQuarter(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  out.setMinutes(Math.ceil(out.getMinutes() / 15) * 15);
  return out;
}

/** `datetime-local` wants local wall-clock, not an ISO instant. */
function localValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
