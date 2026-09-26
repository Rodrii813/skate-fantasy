import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import NavBar from "./nav-bar";
import { getLocale } from "@/lib/i18n/getLocale";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";

export const metadata: Metadata = {
  title: "Rollart Fantasy — World Skate Games",
  description: "Elige a tus patinadores para cada elemento y compite en el ranking global.",
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
      <body className="font-body min-h-screen">
        <LocaleProvider initialLocale={locale}>
          <Providers>
            <NavBar />
            <main className="mx-auto max-w-5xl px-4 pb-24 pt-8">{children}</main>
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
