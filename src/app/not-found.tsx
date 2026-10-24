import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <h1>We couldn&apos;t find that</h1>

      <p className="measure mt-3 leading-relaxed">
        The link may be old, or the food may already have gone. Listings disappear when the
        pickup window closes.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/food" className="btn btn-primary">
          See food near you
        </Link>
        <Link href="/help" className="btn btn-secondary">
          Other help near you
        </Link>
      </div>
    </main>
  );
}
