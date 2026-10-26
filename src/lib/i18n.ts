/**
 * English and Spanish at launch.
 *
 * A flat key/value dictionary per language rather than a library: the whole
 * product is a few dozen screens, every string is server-rendered, and the
 * bundle cost of an i18n runtime would land on exactly the low-end phones this
 * app exists for. Adding a third language means adding one object below and
 * one entry in LANGUAGES — the call sites do not change.
 *
 * Copy rules, which matter more here than the mechanics:
 *   - Food is "free", never "donated", "charity" or "a handout".
 *   - A person looking for food is never described by their need. No "the
 *     needy", no "recipients", no "beneficiaries". They are just people.
 *   - Buttons say what happens: "Post food", not "Submit".
 *   - Errors say what to do next, and never apologise.
 */

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANG: Lang = "en";
export { LANG_COOKIE } from "./cookies";

const en = {
  /* chrome */
  "app.name": "MealBridge",
  "app.tagline": "Good food connects us",
  "nav.findFood": "Find food",
  "nav.alerts": "Alerts",
  "nav.dashboard": "Dashboard",
  "nav.admin": "Admin",
  "nav.signIn": "Sign in",
  "nav.signOut": "Sign out",
  "nav.skip": "Skip to main content",
  "nav.language": "Language",

  /* landing */
  "landing.eyebrow": "Free food, from restaurants near you",
  "landing.act1": "The world starves",
  "landing.act2": "We have a solution",
  "landing.scroll": "Scroll",
  "landing.chooseEyebrow": "Two ways in",
  "landing.choose": "Which brings you here?",
  "landing.seeker": "I need food",
  "landing.seekerSub": "See what's free near you right now. No account needed.",
  "landing.provider": "I have food to give",
  "landing.providerSub": "Post what's left at closing. It takes about a minute.",
  "landing.how": "How it works",

  /* seeker */
  "seeker.title": "Free food near you",
  "seeker.zipLabel": "Your ZIP code",
  "seeker.zipHint": "We use this to sort food by distance. We never ask for your location.",
  "seeker.zipAction": "Show food near me",
  "seeker.zipInvalid": "That isn't a ZIP code we know. Check the five digits.",
  "seeker.changeZip": "Change ZIP",
  "seeker.resultsIn": "Food near {zip}",
  "seeker.approximate": "Distances are approximate — they're measured between ZIP code centres.",
  "seeker.empty": "Nothing is being given away near {zip} right now.",
  "seeker.emptyWiden": "Try a wider radius",
  "seeker.emptyHelp": "Food banks and other help near you",
  "seeker.filters": "Filters",
  "seeker.radius": "Within",
  "seeker.miles": "{n} miles",
  "seeker.when": "When",
  "seeker.whenAny": "Any time today",
  "seeker.whenNow": "Available now",
  "seeker.whenLater": "Later today",
  "seeker.dietary": "Dietary needs",
  "seeker.clearFilters": "Clear filters",
  "seeker.lastUpdated": "Last updated {time}",
  "seeker.offline": "You're offline. This is the last list that loaded.",

  /* listing */
  "listing.portionsLeft": "{n} left",
  "listing.copyAddress": "Copy address",
  "listing.copied": "Address copied",
  "listing.pickupAt": "Pick up at",
  "listing.handoff": "When you get there",
  "listing.save": "Save this",
  "listing.saved": "Saved",
  "listing.unsave": "Remove from saved",
  "listing.report": "Report a problem",
  "listing.allGone": "All gone",
  "listing.ended": "This pickup window has ended",
  "listing.cancelled": "This listing was cancelled",
  "listing.opensAt": "Opens at {time}",
  "listing.callBusiness": "Call the restaurant",
  "listing.back": "Back to the list",

  /* alerts */
  "alerts.title": "Tell me when food is posted",
  "alerts.intro": "We'll message you when a restaurant near you posts food.",
  "alerts.radius": "Within",
  "alerts.channel": "Send it by",
  "alerts.channelPush": "Push notification",
  "alerts.channelSms": "Text message",
  "alerts.channelBoth": "Both",
  "alerts.save": "Save alert",
  "alerts.saved": "Alert saved",
  "alerts.delete": "Delete this alert",
  "alerts.deleted": "Alert deleted",
  "alerts.zipNote":
    "Your ZIP code is only stored as part of this alert. Delete the alert and it's gone with it.",
  "alerts.none": "You don't have any alerts yet.",

  /* provider */
  "provider.title": "Dashboard",
  "provider.post": "Post food",
  "provider.live": "Live now",
  "provider.scheduled": "Scheduled",
  "provider.past": "Past posts",
  "provider.noLive": "Nothing posted right now.",
  "provider.pending": "Your business is being reviewed",
  "provider.pendingBody":
    "We check each business before it can post. We'll email you when that's done — usually within a day.",
  "provider.suspended": "Posting is paused for this business",
  "provider.impact": "{portions} portions shared across {listings} posts",
  "provider.interested": "{n} people saved this",
  "provider.updatePortions": "Update what's left",
  "provider.markGone": "Mark as all gone",
  "provider.edit": "Edit",
  "provider.cancel": "Cancel this post",
  "provider.repeat": "Repeat this post",

  /* post form */
  "post.title": "Post food",
  "post.what": "What's available?",
  "post.whatHint": "Say what it is in plain words. People read this on a phone, quickly.",
  "post.categories": "Quick picks",
  "post.portions": "About how many portions?",
  "post.portionsHint": "A rough count is fine. You can update it as food goes.",
  "post.where": "Where do people pick it up?",
  "post.whereHint": "This shows as plain text. There's no map and no directions link.",
  "post.useBusinessAddress": "Use my business address",
  "post.when": "When can they come?",
  "post.date": "Date",
  "post.from": "From",
  "post.until": "Until",
  "post.tags": "Dietary and allergens",
  "post.allergenHint":
    "List every allergen you know of. Someone will read this before they eat.",
  "post.notes": "How should they find you?",
  "post.notesHint": "For example: knock at the back door and ask for Maria.",
  "post.safety": "Food safety",
  "post.safetyIntro": "Confirm each of these before posting.",
  "post.submit": "Post food",
  "post.posting": "Posting…",
  "post.posted": "Posted. {n} people nearby were told.",
  "post.postedNone": "Posted. Nobody has an alert set for this area yet.",

  /* report */
  "report.title": "Report a problem",
  "report.intro": "Thanks for telling us. This helps the next person.",
  "report.gone": "The food was already gone",
  "report.closed": "The place was closed",
  "report.unsafe": "Something seemed unsafe",
  "report.wrong_info": "The details were wrong",
  "report.other": "Something else",
  "report.details": "Anything else we should know?",
  "report.submit": "Send report",
  "report.sent": "Report sent. Thank you.",

  /* auth */
  "auth.signIn": "Sign in",
  "auth.signUp": "Create an account",
  "auth.identifier": "Email or phone number",
  "auth.identifierHint": "No password to remember.",
  "auth.continue": "Continue",
  "auth.sendCode": "Send me a code",
  "auth.codeSent": "We sent a code to {masked}",
  "auth.code": "6-digit code",
  "auth.verify": "Sign in",
  "auth.resend": "Send a new code",
  "auth.wrongCode": "That code isn't right. Check it and try again.",
  "auth.expiredCode": "That code has expired. Ask for a new one.",
  "auth.tooMany": "Too many tries. Ask for a new code.",
  "auth.name": "Your name",
  "auth.nameHint": "Optional. Only the restaurant sees it, and only if you contact them.",
  "auth.noAccountNeeded": "You don't need an account to find food.",
  "auth.browseInstead": "Just show me food near me",

  /* errors + system */
  "error.generic": "Something went wrong. Try that again.",
  "error.rateLimited": "That's a lot of tries.",
  "error.notFound": "We couldn't find that.",
  "error.notFoundBody": "The link may be old, or the food may already be gone.",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.back": "Back",
  "common.loading": "Loading…",
  "common.required": "Required",
  "common.optional": "Optional",
  "common.yes": "Yes",
  "common.no": "No",
} as const;

export type Key = keyof typeof en;

const es: Record<Key, string> = {
  "app.name": "MealBridge",
  "app.tagline": "La buena comida nos une",
  "nav.findFood": "Buscar comida",
  "nav.alerts": "Avisos",
  "nav.dashboard": "Panel",
  "nav.admin": "Administración",
  "nav.signIn": "Iniciar sesión",
  "nav.signOut": "Cerrar sesión",
  "nav.skip": "Saltar al contenido principal",
  "nav.language": "Idioma",

  "landing.eyebrow": "Comida gratis, de restaurantes cerca de ti",
  "landing.act1": "El mundo pasa hambre",
  "landing.act2": "Tenemos una solución",
  "landing.scroll": "Desplázate",
  "landing.chooseEyebrow": "Dos formas de entrar",
  "landing.choose": "¿Qué te trae por aquí?",
  "landing.seeker": "Necesito comida",
  "landing.seekerSub": "Mira qué hay gratis cerca de ti ahora. No hace falta cuenta.",
  "landing.provider": "Tengo comida para dar",
  "landing.providerSub": "Publica lo que sobra al cerrar. Toma como un minuto.",
  "landing.how": "Cómo funciona",

  "seeker.title": "Comida gratis cerca de ti",
  "seeker.zipLabel": "Tu código postal",
  "seeker.zipHint": "Lo usamos para ordenar la comida por distancia. Nunca pedimos tu ubicación.",
  "seeker.zipAction": "Ver comida cerca de mí",
  "seeker.zipInvalid": "No reconocemos ese código postal. Revisa los cinco dígitos.",
  "seeker.changeZip": "Cambiar código postal",
  "seeker.resultsIn": "Comida cerca de {zip}",
  "seeker.approximate":
    "Las distancias son aproximadas: se miden entre los centros de los códigos postales.",
  "seeker.empty": "Ahora mismo no hay comida disponible cerca de {zip}.",
  "seeker.emptyWiden": "Prueba con un radio más amplio",
  "seeker.emptyHelp": "Bancos de alimentos y otra ayuda cerca de ti",
  "seeker.filters": "Filtros",
  "seeker.radius": "Dentro de",
  "seeker.miles": "{n} millas",
  "seeker.when": "Cuándo",
  "seeker.whenAny": "En cualquier momento de hoy",
  "seeker.whenNow": "Disponible ahora",
  "seeker.whenLater": "Más tarde hoy",
  "seeker.dietary": "Necesidades alimentarias",
  "seeker.clearFilters": "Borrar filtros",
  "seeker.lastUpdated": "Actualizado {time}",
  "seeker.offline": "Estás sin conexión. Esta es la última lista que se cargó.",

  "listing.portionsLeft": "Quedan {n}",
  "listing.copyAddress": "Copiar dirección",
  "listing.copied": "Dirección copiada",
  "listing.pickupAt": "Recoger en",
  "listing.handoff": "Cuando llegues",
  "listing.save": "Guardar",
  "listing.saved": "Guardado",
  "listing.unsave": "Quitar de guardados",
  "listing.report": "Reportar un problema",
  "listing.allGone": "Se acabó",
  "listing.ended": "Esta ventana de recogida ya terminó",
  "listing.cancelled": "Esta publicación fue cancelada",
  "listing.opensAt": "Abre a las {time}",
  "listing.callBusiness": "Llamar al restaurante",
  "listing.back": "Volver a la lista",

  "alerts.title": "Avísame cuando haya comida",
  "alerts.intro": "Te enviaremos un mensaje cuando un restaurante cerca de ti publique comida.",
  "alerts.radius": "Dentro de",
  "alerts.channel": "Enviar por",
  "alerts.channelPush": "Notificación push",
  "alerts.channelSms": "Mensaje de texto",
  "alerts.channelBoth": "Ambos",
  "alerts.save": "Guardar aviso",
  "alerts.saved": "Aviso guardado",
  "alerts.delete": "Eliminar este aviso",
  "alerts.deleted": "Aviso eliminado",
  "alerts.zipNote":
    "Tu código postal solo se guarda como parte de este aviso. Si lo eliminas, se borra con él.",
  "alerts.none": "Todavía no tienes avisos.",

  "provider.title": "Panel",
  "provider.post": "Publicar comida",
  "provider.live": "Activo ahora",
  "provider.scheduled": "Programado",
  "provider.past": "Publicaciones anteriores",
  "provider.noLive": "No hay nada publicado ahora.",
  "provider.pending": "Tu negocio está en revisión",
  "provider.pendingBody":
    "Revisamos cada negocio antes de que pueda publicar. Te avisaremos por correo, normalmente en un día.",
  "provider.suspended": "La publicación está pausada para este negocio",
  "provider.impact": "{portions} porciones compartidas en {listings} publicaciones",
  "provider.interested": "{n} personas guardaron esto",
  "provider.updatePortions": "Actualizar lo que queda",
  "provider.markGone": "Marcar como agotado",
  "provider.edit": "Editar",
  "provider.cancel": "Cancelar esta publicación",
  "provider.repeat": "Repetir esta publicación",

  "post.title": "Publicar comida",
  "post.what": "¿Qué hay disponible?",
  "post.whatHint": "Dilo en palabras sencillas. La gente lo lee rápido en el teléfono.",
  "post.categories": "Opciones rápidas",
  "post.portions": "¿Más o menos cuántas porciones?",
  "post.portionsHint": "Un cálculo aproximado está bien. Puedes actualizarlo cuando salga comida.",
  "post.where": "¿Dónde se recoge?",
  "post.whereHint": "Se muestra como texto. No hay mapa ni enlace de direcciones.",
  "post.useBusinessAddress": "Usar la dirección de mi negocio",
  "post.when": "¿Cuándo pueden venir?",
  "post.date": "Fecha",
  "post.from": "Desde",
  "post.until": "Hasta",
  "post.tags": "Dieta y alérgenos",
  "post.allergenHint": "Indica todos los alérgenos que conozcas. Alguien lo leerá antes de comer.",
  "post.notes": "¿Cómo te encuentran?",
  "post.notesHint": "Por ejemplo: toca la puerta de atrás y pregunta por María.",
  "post.safety": "Seguridad alimentaria",
  "post.safetyIntro": "Confirma cada punto antes de publicar.",
  "post.submit": "Publicar comida",
  "post.posting": "Publicando…",
  "post.posted": "Publicado. Se avisó a {n} personas cerca.",
  "post.postedNone": "Publicado. Todavía nadie tiene avisos para esta zona.",

  "report.title": "Reportar un problema",
  "report.intro": "Gracias por avisarnos. Esto ayuda a la siguiente persona.",
  "report.gone": "La comida ya se había acabado",
  "report.closed": "El lugar estaba cerrado",
  "report.unsafe": "Algo parecía inseguro",
  "report.wrong_info": "Los datos estaban mal",
  "report.other": "Otra cosa",
  "report.details": "¿Algo más que debamos saber?",
  "report.submit": "Enviar reporte",
  "report.sent": "Reporte enviado. Gracias.",

  "auth.signIn": "Iniciar sesión",
  "auth.signUp": "Crear una cuenta",
  "auth.identifier": "Correo o teléfono",
  "auth.identifierHint": "Sin contraseñas.",
  "auth.continue": "Continuar",
  "auth.sendCode": "Enviarme un código",
  "auth.codeSent": "Enviamos un código a {masked}",
  "auth.code": "Código de 6 dígitos",
  "auth.verify": "Iniciar sesión",
  "auth.resend": "Enviar un código nuevo",
  "auth.wrongCode": "Ese código no es correcto. Revísalo e inténtalo otra vez.",
  "auth.expiredCode": "Ese código ya venció. Pide uno nuevo.",
  "auth.tooMany": "Demasiados intentos. Pide un código nuevo.",
  "auth.name": "Tu nombre",
  "auth.nameHint": "Opcional. Solo lo ve el restaurante, y solo si lo contactas.",
  "auth.noAccountNeeded": "No necesitas una cuenta para buscar comida.",
  "auth.browseInstead": "Solo muéstrame comida cerca de mí",

  "error.generic": "Algo salió mal. Inténtalo de nuevo.",
  "error.rateLimited": "Son muchos intentos.",
  "error.notFound": "No encontramos eso.",
  "error.notFoundBody": "Puede que el enlace sea viejo, o que la comida ya se haya acabado.",
  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.delete": "Eliminar",
  "common.back": "Atrás",
  "common.loading": "Cargando…",
  "common.required": "Obligatorio",
  "common.optional": "Opcional",
  "common.yes": "Sí",
  "common.no": "No",
};

const DICTIONARIES: Record<Lang, Record<Key, string>> = { en, es };

/**
 * Looks up a key and fills {placeholders}.
 *
 * Falls back to English rather than showing a raw key: a missing translation
 * should degrade to a language the reader may still understand, not to
 * "seeker.zipLabel".
 */
export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  const template = DICTIONARIES[lang]?.[key] ?? en[key] ?? String(key);
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

export type T = (key: Key, vars?: Record<string, string | number>) => string;

export function translator(lang: Lang): T {
  return (key, vars) => translate(lang, key, vars);
}

export function isLang(v: unknown): v is Lang {
  return LANGUAGES.some((l) => l.code === v);
}

