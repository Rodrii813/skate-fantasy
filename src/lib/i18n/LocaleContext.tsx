"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "./config";

const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({
  locale: "es",
  setLocale: () => {},
});

// Envuelve toda la app (ver layout.tsx) para que cualquier componente
// cliente pueda leer/cambiar el idioma sin tener que recibirlo por props
// desde cada página. El valor inicial viene del servidor (getLocale(), que
// lee la cookie) para que no haya parpadeo entre idiomas al cargar.
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
      // Las páginas del servidor leen el idioma de la cookie en cada
      // petición, así que hay que forzar que vuelvan a pedirse.
      router.refresh();
    },
    [router]
  );

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
