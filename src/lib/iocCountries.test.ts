import { describe, it, expect } from "vitest";
import { VALID_COUNTRY_CODES } from "./iocCountries";
import { countryFlagEmoji } from "./countryFlags";

describe("iocCountries", () => {
  it("reconoce los países que antes fallaban y los que ya se usaban", () => {
    for (const c of ["CIV", "EGY", "ESP", "GER", "CRI", "SIN", "KSA", "NGR", "KEN", "MAR"]) {
      expect(VALID_COUNTRY_CODES.has(c)).toBe(true);
    }
  });
  it("no confunde palabras de equipo con países", () => {
    expect(VALID_COUNTRY_CODES.has("ONE")).toBe(false);
  });
  it("devuelve bandera para CIV y EGY", () => {
    expect(countryFlagEmoji("CIV")).toBe("🇨🇮");
    expect(countryFlagEmoji("EGY")).toBe("🇪🇬");
  });
});
