import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of service</h1>
      <p className="updated">Last updated 24 October 2026</p>

      <p>
        These terms cover using MealBridge. They are written to be read once and understood.
      </p>

      <h2>What MealBridge is</h2>
      <p>
        A noticeboard. Restaurants and food businesses post food they are giving away, and
        people nearby can see it. We are not a party to anything that happens between you
        and a restaurant, and nothing here is a sale — the food is free.
      </p>

      <h2>Using it to find food</h2>
      <ul>
        <li>It is free, and it stays free. You will never be asked to pay or to prove anything about yourself.</li>
        <li>Take what you need. Leave what you do not.</li>
        <li>Turn up inside the pickup window, and follow whatever the listing says about how to collect.</li>
        <li>Treat the staff well. They did not have to do this.</li>
        <li>
          If something is wrong — the food is gone, the door is locked, the details do not
          match — use <em>Report a problem</em>. It helps the next person.
        </li>
      </ul>

      <h2>Using it to give food away</h2>
      <ul>
        <li>A business is reviewed before it can post. We may ask about a permit or licence.</li>
        <li>
          Post only food you believe is safe to eat, and confirm the{" "}
          <Link href="/legal/food-safety">food safety checklist</Link> honestly each time.
        </li>
        <li>Keep listings accurate. Update what is left, and mark it as gone when it is gone.</li>
        <li>Label allergens as carefully as you can. Someone will rely on it.</li>
        <li>Do not ask anyone to prove they need food, to pay, to buy something, or to give anything in return.</li>
        <li>Do not use listings to advertise.</li>
      </ul>

      <h2>What we can do</h2>
      <p>
        We can remove a listing or pause a business from posting if it breaks these terms or
        puts people at risk. Every such action is recorded with the admin who took it, and
        the business is told. If you think we got it wrong, write to us and we will look
        again.
      </p>

      <h2>What we do not promise</h2>
      <p>
        We do not promise that food in a listing is still there, that a business is open,
        that details are accurate, or that the service is available at any given moment.
        Distances are approximate and measured between ZIP code centre points, so the real
        distance to a door may differ. Listings are written by businesses, not by us.
      </p>
      <p>
        MealBridge is provided as it is. To the extent the law allows, we are not liable for
        loss arising from using it, from food obtained through it, or from a journey made to
        collect food that was no longer there.
      </p>

      <h2>Accounts</h2>
      <p>
        Signing in uses a one-time code sent to your email or phone. There is no password.
        Keep access to that email or phone, because whoever has it can sign in. Ask us and
        we will delete your account.
      </p>

      <h2>Changes</h2>
      <p>
        If these terms change in a way that matters, we will say so in the app rather than
        quietly updating the date at the top.
      </p>

      <p>
        Questions: <a href="mailto:hello@mealbridge.example">hello@mealbridge.example</a>.
        See also <Link href="/legal/privacy">privacy</Link> and{" "}
        <Link href="/legal/food-safety">food safety</Link>.
      </p>
    </>
  );
}
