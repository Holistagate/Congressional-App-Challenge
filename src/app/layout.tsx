import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { currentUser } from "@/lib/session";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { ServiceWorker } from "@/components/ServiceWorker";

/**
 * One typeface, everywhere.
 *
 * The page used to run three: a slab for the opening, a civic grotesque for
 * the app, and Montserrat for the role chooser. Three voices in one product
 * is two too many, and the chooser's was the one that fit — geometric, calm,
 * legible small, and the right register for a page about food.
 *
 * Weight and tracking do the work instead of family. The opening sets it
 * large and tight for drama; the chooser tracks it apart to stay calm; the
 * app runs it plain at 400 and 600. 500 is loaded for the display sizes,
 * where 600 is too dense and 400 too thin.
 */
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang={lang} className={`${montserrat.variable} h-full`}>
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
