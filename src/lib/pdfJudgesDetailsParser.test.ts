import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractText } from "unpdf";
import { parseJudgesDetailsText, type SkaterDetailedResult } from "./pdfJudgesDetailsParser";

const FIXTURE_PATH = join(__dirname, "__fixtures__", "SHORT PROGRAM Seniores Free Skating Ladies RESULTS.pdf");
const TOLERANCE = 0.05;

const EXPECTED_NAMES = [
  "MADALENA RODRIGUES COSTA",
  "SIRA BELLA GALLARDO",
  "GIADA ROMITI",
  "ELNA FRANCÉS MARÍN",
  "MARTINA STEFANI",
  "LETÍCIA CARVALHO MARINHO",
  "QUINTY VAN LARE",
  "GINEVRA OTTAVIANI",
  "CAROLINA RODRIGUES PEREIRA",
  "RICARDA ZANDER",
  "VIOLA WIESE",
  "MAR CAJAL TRIAS",
  "ANNA BOESEN",
  "AURORA SCLOCCHINI",
  "RONI GABAY",
  "BRENDA LUQUE SANTAMARIA",
  "GIULIA RAGUZZONI",
  "JANA GALABERT GASCH",
  "ELOÏSE CASTILLON",
  "CALI GUILLOMET-SURGET",
  "ZOÉ FRISCHMUTH",
];

// Textos de cabecera de tabla que el parser leía por error antes del fix
// (ver commit "Fix: importador de resultados PDF lee correctamente el acta
// real de World Skate").
const FORBIDDEN_NAME_FRAGMENTS = ["total element", "program component", "rank", "deductions"];

describe("parseJudgesDetailsText (fixture real: World Skate RESULTS DETAILS)", () => {
  let results: SkaterDetailedResult[];

  beforeAll(async () => {
    const buffer = readFileSync(FIXTURE_PATH);
    const { text } = await extractText(new Uint8Array(buffer));
    const fullText = Array.isArray(text) ? text.join("\n") : text;
    results = parseJudgesDetailsText(fullText);
  });

  it("extrae exactamente las 21 patinadoras del acta", () => {
    expect(results).toHaveLength(21);
  });

  it.each(EXPECTED_NAMES.map((name, i) => [i, name] as const))(
    "patinadora #%i: nombre correcto (%s)",
    (index, expectedName) => {
      const skater = results[index];
      expect(skater.fullName).toBe(expectedName);
      for (const forbidden of FORBIDDEN_NAME_FRAGMENTS) {
        expect(skater.fullName.toLowerCase()).not.toContain(forbidden);
      }
    }
  );

  it.each(EXPECTED_NAMES.map((name, i) => [i, name] as const))(
    "patinadora #%i (%s): suma de elementos técnicos coincide con tes",
    (index) => {
      const skater = results[index];
      const elementsSum = skater.elements.reduce((acc, el) => acc + el.score, 0);
      expect(elementsSum).toBeGreaterThan(0);
      expect(Math.abs(elementsSum - skater.tes)).toBeLessThanOrEqual(TOLERANCE);
    }
  );

  it.each(EXPECTED_NAMES.map((name, i) => [i, name] as const))(
    "patinadora #%i (%s): suma de los 4 componentes coincide con pcs",
    (index) => {
      const skater = results[index];
      const { skatingSkills, transitions, performance, choreography } = skater.components;
      const componentsSum = skatingSkills + transitions + performance + choreography;
      expect(componentsSum).toBeGreaterThan(0);
      expect(Math.abs(componentsSum - skater.pcs)).toBeLessThanOrEqual(TOLERANCE);
    }
  );
});
