// Conversión de zonas horarias usando solo la API Intl nativa (sin
// librerías como date-fns-tz o moment-timezone).
//
// La sede de la competición (Paraguay) es la zona horaria "de referencia":
// cuando el admin escribe una hora en el formulario, se entiende que la
// escribe en esa zona, y así es como hay que interpretarla para guardarla
// correctamente en UTC. De cara al público, cada persona ve la hora
// convertida a su propia zona (o a la que elija manualmente).

export const VENUE_TIMEZONE = "America/Asuncion";

/**
 * Convierte el valor de un <input type="datetime-local"> ("YYYY-MM-DDTHH:mm",
 * sin información de zona) interpretado como hora local de `timeZone`, a un
 * Date que representa el instante UTC correcto.
 *
 * Técnica estándar sin dependencias: se interpreta el texto como si ya
 * fuera UTC, se formatea ese instante en la zona de destino para ver cuánto
 * se desvía, y se corrige por esa diferencia.
 */
export function zonedTimeToUtc(dateTimeLocal: string, timeZone: string): Date {
  const naiveUtc = new Date(`${dateTimeLocal}Z`);
  if (Number.isNaN(naiveUtc.getTime())) return naiveUtc;

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(naiveUtc).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});

  const asUtcAgain = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  // Cuánto se adelanta (o atrasa) el reloj de `timeZone` respecto a UTC para
  // ese instante concreto (tiene en cuenta el horario de verano si aplica).
  const offsetMs = asUtcAgain - naiveUtc.getTime();

  return new Date(naiveUtc.getTime() - offsetMs);
}

/**
 * Convierte un instante (Date o ISO string) al valor equivalente para un
 * <input type="datetime-local"> mostrando la hora local de `timeZone`
 * ("YYYY-MM-DDTHH:mm").
 */
export function utcToZonedInputValue(value: Date | string, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Zona horaria del dispositivo, tal como la detecta el propio navegador/runtime. */
export function detectDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Formatea un instante en una zona horaria concreta, en español. */
export function formatInTimeZone(
  value: Date | string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", { ...options, timeZone }).format(date);
}

/** Lista de zonas horarias soportadas por el runtime, si el motor la expone. */
export function listSupportedTimeZones(): string[] {
  const intlWithSupportedValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  try {
    if (typeof intlWithSupportedValues.supportedValuesOf === "function") {
      return intlWithSupportedValues.supportedValuesOf("timeZone");
    }
  } catch {
    // el runtime no soporta supportedValuesOf; se usa el fallback curado
  }
  return [];
}

// Fallback curado para runtimes sin Intl.supportedValuesOf (algunos
// navegadores/engines más antiguos), con las zonas más relevantes para
// esta competición y para el público hispanohablante/internacional.
export const COMMON_TIMEZONES = [
  VENUE_TIMEZONE,
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "America/Santiago",
  "America/Bogota",
  "America/Lima",
  "America/Mexico_City",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "Europe/Rome",
  "UTC",
];
