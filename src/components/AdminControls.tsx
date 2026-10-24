"use client";

import { useActionState } from "react";
import Link from "next/link";
import { setProviderStatus, resolveReport, removeListing, type AdminState } from "@/app/actions/admin";
import type { ProviderSummary, ReportSummary } from "@/app/admin/page";

const REASON_LABELS: Record<string, string> = {
  gone: "Food was already gone",
  closed: "Place was closed",
  unsafe: "Something seemed unsafe",
  wrong_info: "Details were wrong",
  other: "Something else",
};

export function ProviderReview({ provider }: { provider: ProviderSummary }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(setProviderStatus, {});

  return (
    <div className="ticket !pl-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{provider.business_name}</h3>
          <address className="mt-1 not-italic text-sm leading-relaxed text-[var(--color-muted)]">
            {provider.street}
            <br />
            {provider.city}, {provider.state} {provider.zip}
          </address>
        </div>
        <StatusBadge status={provider.status} />
      </div>

      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <Row label="Contact" value={provider.contact_name || "—"} />
        <Row label="Email" value={provider.email || "—"} />
        <Row label="Phone" value={provider.phone || "—"} />
        <Row label="Permit" value={provider.permit_number || "Not provided"} />
      </dl>

      <form action={action} className="mt-4 grid gap-2">
        <input type="hidden" name="provider_id" value={provider.id} />

        <label className="sr-only" htmlFor={`note-${provider.id}`}>
          Note (sent to the business if you suspend)
        </label>
        <input
          id={`note-${provider.id}`}
          name="note"
          className="field text-sm"
          placeholder="Optional note — included if you pause posting"
          maxLength={500}
        />

        <div className="flex flex-wrap gap-2">
          {provider.status !== "approved" && (
            <button
              type="submit"
              name="status"
              value="approved"
              className="btn btn-primary text-sm"
              disabled={pending}
            >
              Approve
            </button>
          )}
          {provider.status !== "suspended" && (
            <button
              type="submit"
              name="status"
              value="suspended"
              className="btn btn-danger text-sm"
              disabled={pending}
            >
              Pause posting
            </button>
          )}
          {provider.status === "suspended" && (
            <button
              type="submit"
              name="status"
              value="pending"
              className="btn btn-quiet text-sm"
              disabled={pending}
            >
              Move back to review
            </button>
          )}
        </div>
      </form>

      <Feedback state={state} />
    </div>
  );
}

export function ReportReview({ report }: { report: ReportSummary }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(resolveReport, {});
  const [removal, removeAction, removing] = useActionState<AdminState, FormData>(removeListing, {});

  return (
    <div className="ticket !pl-4">
      <p className="text-sm font-semibold text-[var(--color-stop)]">
        {REASON_LABELS[report.reason] ?? report.reason}
      </p>

      <h3 className="mt-1 text-base font-semibold">
        <Link href={`/food/${report.listing_id}`} className="text-inherit">
          {report.description}
        </Link>
      </h3>

      <p className="mt-0.5 text-sm text-[var(--color-muted)]">{report.business_name}</p>

      {report.details && (
        <p className="measure mt-2 border-l-2 border-[var(--color-edge)] pl-3 text-sm">
          {report.details}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="report_id" value={report.id} />
          <button type="submit" name="outcome" value="reviewed" className="btn btn-secondary text-sm" disabled={pending}>
            Mark handled
          </button>
        </form>

        <form action={action}>
          <input type="hidden" name="report_id" value={report.id} />
          <button type="submit" name="outcome" value="dismissed" className="btn btn-quiet text-sm" disabled={pending}>
            Dismiss
          </button>
        </form>

        {report.listing_status === "active" && (
          <form action={removeAction}>
            <input type="hidden" name="listing_id" value={report.listing_id} />
            <input type="hidden" name="note" value={`Report: ${report.reason}`} />
            <button type="submit" className="btn btn-danger text-sm" disabled={removing}>
              Remove listing
            </button>
          </form>
        )}
      </div>

      <Feedback state={state} />
      <Feedback state={removal} />
    </div>
  );
}

function Feedback({ state }: { state: AdminState }) {
  if (state.error) {
    return (
      <p className="error-text mt-2" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p className="mt-2 text-sm font-medium text-[var(--color-pine)]" role="status">
        {state.message}
      </p>
    );
  }
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "border-[var(--color-leaf)] text-[var(--color-pine)] bg-[var(--color-mist)]"
      : status === "suspended"
        ? "border-[var(--color-stop)] text-[var(--color-stop)] bg-[#fdf3f2]"
        : "border-[var(--color-amber)] text-[var(--color-amber)] bg-[#fdf6e8]";

  return <span className={`chip border ${tone}`}>{status}</span>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-[var(--color-muted)]">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
