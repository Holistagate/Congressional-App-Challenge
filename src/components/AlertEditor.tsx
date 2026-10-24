"use client";

import { useActionState } from "react";
import { saveAlert, deleteAlert, type AlertState } from "@/app/actions/alerts";
import { DIETARY_TAGS } from "@/lib/domain";
import { RADIUS_OPTIONS } from "@/lib/geo";
import { translator, type Lang } from "@/lib/i18n";

type AlertRow = {
  id: string;
  zip: string;
  radius_miles: number;
  dietary_filters: string;
  channel: "push" | "sms" | "both";
  active: number;
};

export function AlertEditor({
  lang,
  alert,
  defaultZip = "",
}: {
  lang: Lang;
  alert?: AlertRow;
  defaultZip?: string;
}) {
  const t = translator(lang);
  const [state, action, saving] = useActionState<AlertState, FormData>(saveAlert, {});
  const [removed, removeAction, removing] = useActionState<AlertState, FormData>(deleteAlert, {});

  if (removed.ok) {
    return (
      <p className="rounded-[var(--radius-ticket)] border border-[var(--color-edge)] bg-[var(--color-mist)] px-4 py-3 text-sm" role="status">
        {removed.message}
      </p>
    );
  }

  const selected: string[] = alert ? safeParse(alert.dietary_filters) : [];

  return (
    <form action={action} className="grid gap-4">
      {alert && <input type="hidden" name="alert_id" value={alert.id} />}

      <div>
        <label className="label" htmlFor={`zip-${alert?.id ?? "new"}`}>
          {t("seeker.zipLabel")}
        </label>
        <input
          id={`zip-${alert?.id ?? "new"}`}
          name="zip"
          className="field tnum max-w-[10rem] text-lg tracking-[0.1em]"
          inputMode="numeric"
          maxLength={10}
          required
          defaultValue={alert?.zip ?? defaultZip}
          aria-invalid={state.errors?.zip ? true : undefined}
        />
        {state.errors?.zip && <p className="error-text mt-1">{state.errors.zip}</p>}
      </div>

      <fieldset>
        <legend className="label">{t("alerts.radius")}</legend>
        <div className="choice-row">
          {RADIUS_OPTIONS.map((r) => (
            <label key={r} className="choice">
              <input
                type="radio"
                name="radius_miles"
                value={r}
                defaultChecked={(alert?.radius_miles ?? 10) === r}
              />
              <span>{t("seeker.miles", { n: r })}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">{t("seeker.dietary")}</legend>
        <div className="choice-row">
          {DIETARY_TAGS.map((d) => (
            <label key={d.id} className="choice">
              <input
                type="checkbox"
                name="dietary_filters"
                value={d.id}
                defaultChecked={selected.includes(d.id)}
              />
              <span>{d[lang]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">{t("alerts.channel")}</legend>
        <div className="choice-row">
          {(
            [
              ["push", t("alerts.channelPush")],
              ["sms", t("alerts.channelSms")],
              ["both", t("alerts.channelBoth")],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="choice">
              <input
                type="radio"
                name="channel"
                value={value}
                defaultChecked={(alert?.channel ?? "push") === value}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="choice-stacked">
        <input type="checkbox" name="active" defaultChecked={alert ? alert.active === 1 : true} />
        <span>{lang === "es" ? "Este aviso está activo" : "This alert is on"}</span>
      </label>

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
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {t("alerts.save")}
        </button>

        {alert && (
          <button
            type="submit"
            formAction={removeAction}
            className="btn btn-danger"
            disabled={removing}
          >
            {t("alerts.delete")}
          </button>
        )}
      </div>
    </form>
  );
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
