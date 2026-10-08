import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseJudgesDetailTables } from "./pdfJudgesDetailTable";

const text = fs.readFileSync(path.join(__dirname, "__fixtures__/judgesDetailTable.txt"), "utf8");

describe("parseJudgesDetailTables", () => {
  const tables = parseJudgesDetailTables(text);

  it("lee los dos patinadores y el nº de jueces", () => {
    expect(tables).toHaveLength(2);
    expect(tables[0].name).toBe("INDIA GONZALEZ");
    expect(tables[0].judgeCount).toBe(6);
  });

  it("devuelve las notas de los jueces en orden J1..Jn", () => {
    const first = tables[0].elements[0].rows[0];
    expect(first.code).toBe("2A");
    expect(first.judges).toEqual([0, 1, 1, 0, 0, 1]);
    expect(first.base).toBe(7.02);
    expect(first.qoe).toBe(0.4);
    expect(first.score).toBe(7.42);
  });

  it("agrupa los spins con la nota en la cabecera", () => {
    const spin = tables[0].elements[2];
    expect(spin.type).toBe("ComboSpin");
    expect(spin.judges).toEqual([1, 0, -2, 1, 0, 0]);
    expect(spin.rows.map((r) => r.code)).toEqual(["HBD", "S", "NLCBD", "U"]);
  });

  it("interpreta marcas de rotación y elementos no permitidos", () => {
    const down = tables[0].elements[4].rows[0];
    expect(down.marks).toBe("<<<");
    expect(down.qoe).toBe(-0.4);
    const notAllowed = tables[0].elements[5].rows[0];
    expect(notAllowed.flags).toContain("*");
    expect(notAllowed.score).toBeNull();
  });

  it("lee components y totales", () => {
    expect(tables[0].components).toHaveLength(4);
    expect(tables[0].components[0]).toMatchObject({ name: "Skating Skills", factor: 1.6, score: 5.94 });
    expect(tables[0].components[0].judges).toEqual([6, 5.5, 6, 6.25, 6.25, 5.5]);
    expect(tables[0]).toMatchObject({ tes: 38.5, pcs: 39.41, ded: -1, total: 76.91, baseTotal: 37.94, qoeTotal: 0.56 });
  });

  it("separa nombre y código del Step Sequence", () => {
    const step = tables[0].elements[3].rows[0];
    expect(step.name).toBe("Choreo Step");
    expect(step.code).toBe("ChStB");
  });
});
