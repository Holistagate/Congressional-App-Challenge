import "server-only";
import { all, run, newId, now } from "@/db/index";
import { notifyMatchingSeekers } from "./notify";

/**
 * Recurring posts.
 *
 * A bakery that gives away the same trays every weeknight should not have to
 * fill in the same form every weeknight. A rule stores the template and the
 * schedule; the cron route materialises it into a real listing on each day it
 * applies.
 *
 * `last_run_on` holds a local calendar date, which is what stops a rule
 * producing two listings if the cron fires twice in the same minute — or
 * thirty, if it runs every minute of the window.
 */

type RuleRow = {
  id: string;
  provider_id: string;
  weekdays: string;
  start_minutes: number;
  end_minutes: number;
  template: string;
  timezone: string;
  last_run_on: string | null;
  business_name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
};

type Template = {
  description: string;
  portions: number;
  categories?: string[];
  dietary_tags?: string[];
  allergen_tags?: string[];
  notes?: string;
};

/** 'YYYY-MM-DD' for a given instant, in server local time. */
function localDate(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO weekday, Monday = 1 ... Sunday = 7. */
function isoWeekday(at: number): number {
  const day = new Date(at).getDay();
  return day === 0 ? 7 : day;
}

function instantAt(at: number, minutesPastMidnight: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + minutesPastMidnight * 60_000;
}

/**
 * Posts every rule that is due today and has not run today. Returns how many
 * listings were created.
 */
export async function runDueRecurringRules(at: number = now()): Promise<number> {
  const today = localDate(at);
  const weekday = isoWeekday(at);

  const rules = all<RuleRow>(
    `SELECT r.*, p.business_name, p.street, p.city, p.state, p.zip
     FROM recurring_rules r
     JOIN providers p ON p.id = r.provider_id
     WHERE r.paused = 0
       AND p.status = 'approved'
       AND (r.last_run_on IS NULL OR r.last_run_on != ?)`,
    [today],
  );

  let created = 0;

  for (const rule of rules) {
    const days = rule.weekdays.split(",").map((d) => Number(d.trim()));
    if (!days.includes(weekday)) continue;

    const start = instantAt(at, rule.start_minutes);
    // An end before the start means the window runs past midnight, which is
    // exactly the case this exists for: a kitchen closing at 11pm for 1am.
    const end =
      rule.end_minutes > rule.start_minutes
        ? instantAt(at, rule.end_minutes)
        : instantAt(at, rule.end_minutes) + 86_400_000;

    // Don't post a window that has already closed — if the cron was down all
    // evening, yesterday's dinner is not worth announcing now.
    if (end <= at) {
      run("UPDATE recurring_rules SET last_run_on = ? WHERE id = ?", [today, rule.id]);
      continue;
    }

    let tpl: Template;
    try {
      tpl = JSON.parse(rule.template);
    } catch {
      continue;
    }

    const id = newId("lst");
    run(
      `INSERT INTO listings (id, provider_id, description, categories, dietary_tags, allergen_tags,
         portions_total, portions_remaining, street, city, state, zip,
         pickup_start, pickup_end, notes, photo_url, status, recurring_rule_id,
         safety_ack_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,'active',?,?,?,?)`,
      [
        id,
        rule.provider_id,
        tpl.description,
        JSON.stringify(tpl.categories ?? []),
        JSON.stringify(tpl.dietary_tags ?? []),
        JSON.stringify(tpl.allergen_tags ?? []),
        tpl.portions,
        tpl.portions,
        rule.street,
        rule.city,
        rule.state,
        rule.zip,
        start,
        end,
        tpl.notes ?? "",
        rule.id,
        // The safety checklist was acknowledged when the rule was created. The
        // README flags this as a deliberate tradeoff worth revisiting.
        at,
        at,
        at,
      ],
    );

    run("UPDATE recurring_rules SET last_run_on = ? WHERE id = ?", [today, rule.id]);

    await notifyMatchingSeekers({
      id,
      zip: rule.zip,
      city: rule.city,
      state: rule.state,
      business_name: rule.business_name,
      dietary_tags: JSON.stringify(tpl.dietary_tags ?? []),
      portions_remaining: tpl.portions,
    });

    created++;
  }

  return created;
}
