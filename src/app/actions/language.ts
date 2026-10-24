"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { run } from "@/db/index";
import { currentUser } from "@/lib/session";
import { isLang, LANG_COOKIE, type Lang } from "@/lib/i18n";

export async function setLanguage(lang: Lang): Promise<void> {
  if (!isLang(lang)) return;

  const jar = await cookies();
  jar.set(LANG_COOKIE, lang, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
  });

  // Signed-in people get it remembered on the account too, so it follows them
  // to a new device and so notifications go out in the right language.
  const user = await currentUser();
  if (user) run("UPDATE users SET language = ? WHERE id = ?", [lang, user.id]);

  revalidatePath("/", "layout");
}
