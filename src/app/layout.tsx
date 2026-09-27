import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import Providers from "./providers";
import NavBar from "./nav-bar";
import Footer from "./_components/Footer";
import { getLocale } from "@/lib/i18n/getLocale";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";

const BASE_URL = process.env.NEXTAUTH_URL || "https://rollartfantasy.com";
const SITE_TITLE = "Rollart Fantasy — World Skate Games";
const SITE_DESCRIPTION =
  "Elige a tus patinadores para cada elemento y compite en el ranking global.";

// metadataBase + openGraph/twitter: sin esto, cuando alguien comparte un
// enlace de la web en WhatsApp/Twitter/Facebook no aparece ninguna tarjeta
// (ni imagen, ni título, ni descripción) — solo la URL pelada. La imagen
// referenciada (opengraph-image.png, junto a este archivo) la detecta Next
// automáticamente por convención de nombre.
export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: { default: SITE_TITLE, template: `%s — Rollart Fantasy` },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: BASE_URL,
    siteName: "Rollart Fantasy",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Idioma elegido por el visitante (cookie "locale", por defecto español) —
  // se lee aquí para que tanto el <html lang> como todos los componentes
  // cliente de más abajo (NavBar, formularios...) arranquen ya en el idioma
  // correcto, sin parpadeo. Ver src/lib/i18n/.
  const locale = getLocale();

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;900&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body flex min-h-screen flex-col">
        <LocaleProvider initialLocale={locale}>
          <Providers>
            <NavBar />
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-8">{children}</main>
            <Footer />
          </Providers>
        </LocaleProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
