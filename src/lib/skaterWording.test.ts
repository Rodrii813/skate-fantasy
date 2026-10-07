import { describe, it, expect } from "vitest";
import { adaptSkaterText, getSkaterAudience } from "./skaterWording";

describe("getSkaterAudience", () => {
  it("elige según disciplina y género", () => {
    expect(getSkaterAudience({ gender: "MALE", discipline: { name: "Inline" } })).toBe("male");
    expect(getSkaterAudience({ gender: "FEMALE", discipline: { name: "Libre" } })).toBe("female");
    expect(getSkaterAudience({ gender: "MALE", discipline: { name: "Parejas" } })).toBe("pairs");
    expect(getSkaterAudience({ gender: null, discipline: { name: "Show" } })).toBe("show");
  });
});

describe("adaptSkaterText", () => {
  const t = "No puedes elegir a la misma patinadora; máximo 2 patinadoras técnicas";
  it("femenino no cambia", () => expect(adaptSkaterText(t, "female")).toBe(t));
  it("masculino", () =>
    expect(adaptSkaterText(t, "male")).toBe("No puedes elegir al mismo patinador; máximo 2 patinadores técnicos"));
  it("show", () =>
    expect(adaptSkaterText("Pocas patinadoras: cada una", "show")).toBe("Pocos grupos: cada uno"));
});
