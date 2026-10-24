import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Food safety" };

export default function FoodSafetyPage() {
  return (
    <>
      <h1>Food safety</h1>
      <p className="updated">Last updated 24 October 2026</p>

      <p>
        MealBridge is a noticeboard. We connect people to food that a restaurant already
        has. We do not prepare it, store it, transport it, inspect it or handle it at any
        point, and we are not able to verify what is in it.
      </p>

      <h2>If you are collecting food</h2>
      <ul>
        <li>
          Allergen tags come from the restaurant, not from us or from a laboratory. If an
          allergy is serious, ask the staff directly before you eat.
        </li>
        <li>
          Use your own judgement. If food looks, smells or feels wrong, do not eat it — and{" "}
          please use <em>Report a problem</em> on the listing so the next person knows.
        </li>
        <li>Eat it or refrigerate it promptly. Hot food should still be hot when you get it.</li>
        <li>Pickup windows are set by the restaurant. Arriving after one closes may mean the door is shut.</li>
      </ul>

      <h2>If you are giving food away</h2>
      <p>
        Before each post you confirm a short checklist. It mirrors the ordinary holding
        rules in the FDA Food Code:
      </p>
      <ul>
        <li>Hot food held at or above 135&deg;F, cold food at or below 41&deg;F.</li>
        <li>Everything packaged in clean, closed containers.</li>
        <li>Prepared the same day, or held safely since it was made.</li>
        <li>Allergens labelled as accurately as you can manage.</li>
      </ul>
      <p>
        Do not post food that has been on a buffet or table service, that has been out of
        temperature control for more than four hours, or that you would not serve to a
        paying customer.
      </p>

      <h2>Good Samaritan protection</h2>
      <p>
        The federal Bill Emerson Good Samaritan Food Donation Act (42 U.S.C. &sect; 1791)
        protects people and businesses who donate apparently wholesome food in good faith to
        needy individuals from civil and criminal liability, except in cases of gross
        negligence or intentional misconduct. The Food Donation Improvement Act of 2022
        widened that protection to cover donations made directly to individuals, which is
        what happens here.
      </p>
      <p>
        This is a plain-language summary, not legal advice. State and local rules differ,
        and some add their own requirements for food businesses. Check your local health
        department, and talk to a lawyer if you need certainty.
      </p>

      <h2>Our part</h2>
      <p>
        Businesses are reviewed before they can post. Anyone can report a listing, and
        reports are read. A listing reported as gone is hidden straight away. We can pause a
        business from posting at any time.
      </p>
      <p>
        None of that makes us a food safety authority. If you believe food from a listing
        made someone ill, contact your local health department — and tell us as well, so we
        can act on it.
      </p>

      <p>
        See also the <Link href="/legal/terms">terms of service</Link> and{" "}
        <Link href="/legal/privacy">privacy</Link>.
      </p>
    </>
  );
}
