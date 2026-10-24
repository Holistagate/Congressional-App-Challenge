import type { Metadata, Viewport } from "next";
import { Zilla_Slab, Public_Sans } from "next/font/google";
import "./globals.css";
import { currentUser } from "@/lib/session";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { ServiceWorker } from "@/components/ServiceWorker";

/**
 * Zilla Slab carries the voice: blunt slab terminals that read like menu-board
 * and produce-crate lettering rather than a tech product.
 *
 * Public Sans does the work. It is the typeface of the US Web Design System —
 * for a civic app about the food safety net that is a motivated choice, not a
 * default — and it has the tabular figures every countdown in here depends on.
 */
const zilla = Zilla_Slab({
  variable: "--font-zilla",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MealBridge — free food near you",
    template: "%s · MealBridge",
  },
  description:
    "Restaurants post food they have to give away. People nearby see what's free, where to collect it, and how long they have.",
  manifest: "/manifest.webmanifest",
  applicationName: "MealBridge",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MealBridge" },
  icons: {
    icon: [
      { url: "/icons/mark-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/mark-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/mark-180.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#14532A",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  const lang = await getLang(user?.language);
  const t = translator(lang);

  return (
    <html lang={lang} className={`${zilla.variable} ${publicSans.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <a href="#main" className="skip-link">
          {t("nav.skip")}
        </a>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
