// Idiomas soportados por el selector ES/EN de la web. El texto que viene de
// la base de datos (nombres de competición, evento, disciplina, categoría,
// patinador...) NO se traduce aquí — solo el texto fijo de la interfaz.
// Traducir ese contenido dinámico requeriría guardar una versión en cada
// idioma en la propia base de datos, que queda fuera de este primer paso.
export type Locale = "es" | "en";

export const defaultLocale: Locale = "es";

export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "es" || value === "en";
}
