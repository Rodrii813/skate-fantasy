import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

// Lee el idioma elegido por el visitante desde la cookie "locale" (la pone
// LanguageSwitcher al pulsar ES/EN). Se usa en Server Components — cada
// página del servidor la llama por su cuenta, no hace falta pasarla como
// prop desde el layout.
export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}
