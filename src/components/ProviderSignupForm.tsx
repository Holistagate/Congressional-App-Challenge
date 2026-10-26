"use client";

import { useActionState } from "react";
import { registerProvider, type FormState } from "@/app/actions/auth";
import { translator, type Lang } from "@/lib/i18n";

/**
 * Business registration.
 *
 * Asks for what is needed to vet a business and to put an address in front of
 * a hungry person, and nothing else. The permit number is optional on purpose:
 * plenty of small kitchens with food to spare do not have one to hand, and
 * requiring it would quietly exclude exactly the neighbourhood places this
 * works best with.
 */
export function ProviderSignupForm({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const [state, action, pending] = useActionState<FormState, FormData>(registerProvider, {});

  const err = (field: string) => state.errors?.[field];
  const v = (field: string) => state.values?.[field];

  return (
    <form action={action} className="grid gap-5">
      <Field
        name="business_name"
        label={lang === "es" ? "Nombre del negocio" : "Business name"}
        error={err("business_name")}
        defaultValue={v("business_name")}
        required
        autoComplete="organization"
      />

      <Field
        name="street"
        label={lang === "es" ? "Dirección" : "Street address"}
        error={err("street")}
        defaultValue={v("street")}
        required
        autoComplete="street-address"
      />

      <div className="grid grid-cols-[1fr_5rem_7rem] gap-3">
        <Field
          name="city"
          label={lang === "es" ? "Ciudad" : "City"}
          error={err("city")}
          defaultValue={v("city")}
          required
          autoComplete="address-level2"
        />
        <Field
          name="state"
          label={lang === "es" ? "Estado" : "State"}
          error={err("state")}
          defaultValue={v("state")}
          required
          maxLength={2}
          placeholder="IL"
          autoComplete="address-level1"
        />
        <Field
          name="zip"
          label="ZIP"
          error={err("zip")}
          defaultValue={v("zip")}
          required
          inputMode="numeric"
          maxLength={10}
          autoComplete="postal-code"
          className="tnum"
        />
      </div>

      <hr className="rule my-0" />

      <Field
        name="contact_name"
        label={lang === "es" ? "Persona de contacto" : "Contact name"}
        error={err("contact_name")}
        defaultValue={v("contact_name")}
        autoComplete="name"
      />

      <Field
        name="identifier"
        label={t("auth.identifier")}
        hint={t("auth.identifierHint")}
        error={err("identifier")}
        defaultValue={v("identifier")}
        required
        autoComplete="email"
      />

      <Field
        name="password"
        type="password"
        label={t("auth.choosePassword")}
        hint={t("auth.passwordHint")}
        error={err("password")}
        required
        minLength={8}
        autoComplete="new-password"
      />

      <Field
        name="confirm"
        type="password"
        label={t("auth.confirmPassword")}
        error={err("confirm")}
        required
        autoComplete="new-password"
      />

      <Field
        name="phone"
        label={lang === "es" ? "Teléfono del negocio" : "Business phone"}
        hint={
          lang === "es"
            ? "Opcional. Solo se muestra a la gente si tú lo activas."
            : "Optional. Only shown to people if you choose to publish it."
        }
        error={err("phone")}
        defaultValue={v("phone")}
        autoComplete="tel"
      />

      <Field
        name="permit_number"
        label={lang === "es" ? "Número de permiso o licencia" : "Food permit or licence number"}
        hint={lang === "es" ? "Opcional. Acelera la revisión." : "Optional. It speeds up review."}
        error={err("permit_number")}
        defaultValue={v("permit_number")}
      />

      {state.error && (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      )}

      <div>
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending}>
          {pending ? t("common.loading") : lang === "es" ? "Registrar negocio" : "Register business"}
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  hint,
  error,
  className = "",
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={`field ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${name}-desc` : undefined}
        {...rest}
      />
      {(hint || error) && (
        <p id={`${name}-desc`} className={error ? "error-text mt-1" : "hint mt-1"}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
