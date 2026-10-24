/**
 * Cookie names, in one place.
 *
 * Separate from the action files that use them because a `"use server"` module
 * may only export async functions — a plain `export const` in one is a build
 * error, and the reason is worth knowing: everything exported from such a file
 * becomes a callable server endpoint.
 */

/** The seeker's remembered ZIP. Device-only; never mirrored to the server. */
export const ZIP_COOKIE = "mb_zip";

/** Session token. Value is random; only its hash is stored. */
export const SESSION_COOKIE = "mb_session";

/** Language preference for signed-out readers. */
export const LANG_COOKIE = "mb_lang";

/** Carries an in-progress sign-in between the two steps. */
export const PENDING_COOKIE = "mb_pending";
