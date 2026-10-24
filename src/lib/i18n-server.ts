import "server-only";
import { cookies } from "next/headers";
import { isLang, DEFAULT_LANG, LANG_COOKIE, type Lang } from "./i18n";

/**
 * Server-side language resolution.
 *
 * Kept apart from i18n.ts because that module is imported by client components
 * for its dictionaries and types, and anything touching `next/headers` cannot
 * cross that boundary.
 */
export async function getLang(userLanguage?: string | null): Promise<Lang> {
  if (isLang(userLanguage)) return userLanguage;
  const cookie = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(cookie) ? cookie : DEFAULT_LANG;
}
