import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy</h1>
      <p className="updated">Last updated 24 October 2026</p>

      <p>
        This policy is short because MealBridge collects very little. The guiding rule is
        that looking for free food should never create a record that can be used against
        you.
      </p>

      <h2>We never ask where you are</h2>
      <p>
        MealBridge does not use GPS, does not ask for browser location permission, and does
        not use any maps, geocoding or places service. The site sends a{" "}
        <code>Permissions-Policy</code> header that switches location access off entirely,
        so it cannot be turned on later by accident.
      </p>
      <p>
        Distance is worked out from a table of ZIP code centre points that ships with the
        app. That table is the whole of our location data, and it was published by the US
        Census Bureau — it says nothing about you.
      </p>

      <h2>If you are looking for food</h2>
      <ul>
        <li>
          You do not need an account. Type a ZIP code and you can use the whole thing.
        </li>
        <li>
          Your ZIP code is kept in a cookie on your own device so you do not have to type it
          again. It is not sent to us for storage.
        </li>
        <li>
          If you create an alert, that alert row holds the ZIP you chose. It is the only
          copy on our servers. Delete the alert and the ZIP goes with it — the row is
          deleted, not hidden.
        </li>
        <li>
          Restaurants never learn who you are. A restaurant can see how many people saved a
          listing, if it has that turned on, and nothing else. Not names, not how many
          times you looked, not whether you came.
        </li>
        <li>We never ask for an ID, proof of income, address or payment method.</li>
      </ul>

      <h2>What we keep, and why</h2>
      <ul>
        <li>
          <strong>Your email or phone number</strong>, if you made an account — it is how we
          sign you in and how an alert reaches you. There is no password to store.
        </li>
        <li>
          <strong>Sign-in codes</strong>, hashed, for ten minutes. We cannot read them back.
        </li>
        <li>
          <strong>Your session</strong>, as a hash. The random token in your cookie is never
          stored, so our database cannot be used to sign in as you.
        </li>
        <li>
          <strong>Rate-limit counters</strong>, keyed by a hash of your IP address when you
          are signed out. We do not store the address itself.
        </li>
        <li>
          <strong>Reports you send</strong>, so we can act on them. You can report a problem
          without an account.
        </li>
      </ul>

      <h2>If you run a restaurant</h2>
      <p>
        Your business name and pickup address are public — that is the point of a listing.
        Your phone number is shown only if you switch it on. Your contact name, email and
        any permit number are visible to admins for review, and are not shown to the public.
      </p>

      <h2>Who else sees this</h2>
      <p>
        No advertising, no analytics trackers, no data brokers, no third-party embeds.
        Outbound services are limited to sending the messages you asked for: a text message
        provider for SMS codes and alerts, and an email provider for email. They see only
        the message and the address it goes to.
      </p>

      <h2>Deleting your account</h2>
      <p>
        Ask and we will delete it. Removing your account removes your alerts, your saved
        listings and your sessions along with it. Reports you filed stay, with your name
        detached from them, because they may still be protecting someone.
      </p>

      <p>
        Questions about any of this, or a request to delete your data:{" "}
        <a href="mailto:privacy@mealbridge.example">privacy@mealbridge.example</a>.
      </p>

      <p>
        See also the <Link href="/legal/terms">terms of service</Link> and the{" "}
        <Link href="/legal/food-safety">food safety notice</Link>.
      </p>
    </>
  );
}
