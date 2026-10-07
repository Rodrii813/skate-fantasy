import { describe, it, expect } from "vitest";
import { formatSkaterName, isPairDiscipline } from "./skaterName";

describe("formatSkaterName", () => {
  it("separa a la pareja con /", () => {
    expect(formatSkaterName({ firstName: "Ana Ruiz", lastName: "Juan Pérez" }, true)).toBe("Ana Ruiz / Juan Pérez");
  });
  it("individual igual que siempre", () => {
    expect(formatSkaterName({ firstName: "Ana", lastName: "Ruiz" })).toBe("Ana Ruiz");
  });
  it("detecta la disciplina", () => {
    expect(isPairDiscipline("Parejas")).toBe(true);
    expect(isPairDiscipline("Pareja Danza")).toBe(true);
    expect(isPairDiscipline("Libre")).toBe(false);
    expect(
      formatSkaterName({ firstName: "A", lastName: "B", discipline: { name: "Parejas" } })
    ).toBe("A / B");
  });
});
