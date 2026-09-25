import { describe, it, expect } from "vitest";
import { zonedTimeToUtc, utcToZonedInputValue, VENUE_TIMEZONE, formatInTimeZone } from "./timezone";

describe("zonedTimeToUtc", () => {
  it("convierte una hora de Asunción (UTC-3) a UTC correctamente", () => {
    const utc = zonedTimeToUtc("2026-10-04T14:00", VENUE_TIMEZONE);
    expect(utc.toISOString()).toBe("2026-10-04T17:00:00.000Z");
  });

  it("convierte una hora de Madrid (UTC+2 en octubre, horario de verano) a UTC correctamente", () => {
    const utc = zonedTimeToUtc("2026-10-04T14:00", "Europe/Madrid");
    expect(utc.toISOString()).toBe("2026-10-04T12:00:00.000Z");
  });

  it("da el mismo instante que interpretar directamente como UTC cuando timeZone='UTC'", () => {
    const utc = zonedTimeToUtc("2026-10-04T14:00", "UTC");
    expect(utc.toISOString()).toBe("2026-10-04T14:00:00.000Z");
  });
});

describe("utcToZonedInputValue", () => {
  it("hace el viaje de ida y vuelta exacto para la zona de la sede", () => {
    const original = "2026-10-04T14:00";
    const utc = zonedTimeToUtc(original, VENUE_TIMEZONE);
    const back = utcToZonedInputValue(utc, VENUE_TIMEZONE);
    expect(back).toBe(original);
  });

  it("convierte un instante UTC conocido al valor local de Asunción", () => {
    const value = utcToZonedInputValue("2026-10-04T17:00:00.000Z", VENUE_TIMEZONE);
    expect(value).toBe("2026-10-04T14:00");
  });
});

describe("formatInTimeZone", () => {
  it("formatea el mismo instante de forma distinta según la zona elegida", () => {
    const instant = "2026-10-04T17:00:00.000Z";
    const paraguay = formatInTimeZone(instant, VENUE_TIMEZONE, { hour: "2-digit", minute: "2-digit" });
    const madrid = formatInTimeZone(instant, "Europe/Madrid", { hour: "2-digit", minute: "2-digit" });
    expect(paraguay).not.toBe(madrid);
  });

  it("devuelve un guion para una fecha inválida en vez de lanzar", () => {
    expect(formatInTimeZone("no-es-una-fecha", VENUE_TIMEZONE, { hour: "2-digit" })).toBe("—");
  });
});
