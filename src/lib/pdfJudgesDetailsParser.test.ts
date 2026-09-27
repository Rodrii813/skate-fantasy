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

// Textos reproducidos tal cual los da unpdf para actas reales de Danza y
// Parejas (Seniores_Couple_Dance_FINAL.pdf / Seniores_Pairs_FINAL.pdf) —
// antes de este fix, "Lift", "ComboLift", "Dance Traveling", "Dance Step" y
// "Spiral" no estaban en la lista de palabras clave del parser, así que
// estas dos modalidades no producían NINGÚN elemento (se quedaban en 0).
describe("parseJudgesDetailsText — Danza: elementos con nota separada Hombre/Mujer", () => {
  const danceText = `
JUDGES DETAILS PER SKATER
CATERINA ARTONI - RAOUL
ALLEGRANTI
Rank Name
Total
Element
score
Nation
# Executed Element QOEInfo J1 J2 J4J3
Base
Value
Scores of
Panel
5.50 6.10Lift1 Dance Lift RotationalRtLi4 +2+2+1+10.60
5.00 5.50Dance Step2 Hold Cluster SequenceHClSq2 +2+1+1+10.50
4.70 5.60Dance Traveling3 Traveling Couples (M)TrC4 +3+3+3+20.90%
4.70 5.60Traveling Couples (L)TrC4 +3+3+3+20.90%
3.20 3.80Dance Step4 No Hold Sequence (M)NoH2 +2+2+2+10.60
3.90 4.50No Hold Sequence (L)NoH3 +2+2+2+10.60
6.50 7.50Lift5 Dance Lift ComboCliLi4 +3+2+2+11.00
3.00 3.40Dance Step6 Choreo Stop/Step seq.ChStS +2+2+2+10.40
42.0036.50 5.50
Total
Segment
score
Total
Component
score (factored)
Total
Deductions1 ITA
42.00 46.46 0.00 88.46
Program Components Factor
Skating Skills 7.50 8.75 8.75 8.75 8.751.3
Transitions/Linking Footwork/Movement 7.75 8.50 8.75 9.00 8.621.3
Performance/Execution 7.50 9.00 9.25 9.25 9.121.3
Choreography/Composition 7.75 9.25 9.25 9.50 9.251.3
Judges Total Program Component Score (factored) 46.46
Deductions 0.00
`;

  it("suma la nota (M) y la nota (L) de 'Traveling Couples' en un solo elemento", () => {
    const [skater] = parseJudgesDetailsText(danceText);
    const travelings = skater.elements.filter((e) => e.type === "DANCE_TRAVELING");
    expect(travelings).toHaveLength(1);
    expect(travelings[0].score).toBeCloseTo(5.6 + 5.6, 2);
    expect(skater.slotScores.danceTravelingTotal).toBeCloseTo(11.2, 2);
  });

  it("suma la nota (M) y la nota (L) de 'No Hold Sequence', sin mezclarla con los otros 'Dance Step'", () => {
    const [skater] = parseJudgesDetailsText(danceText);
    const danceSteps = skater.elements.filter((e) => e.type === "DANCE_STEP");
    // 3 elementos "Dance Step" en el acta: Hold Cluster Sequence (5.50),
    // No Hold Sequence M+L (3.80+4.50=8.30) y Choreo Stop/Step seq. (3.40).
    expect(danceSteps).toHaveLength(3);
    expect(danceSteps.map((e) => e.score).sort((a, b) => a - b)).toEqual([3.4, 5.5, 8.3]);
    expect(skater.slotScores.danceStepTotal).toBeCloseTo(5.5 + 8.3 + 3.4, 2);
  });

  it("suma los dos Lift (elevaciones) del programa en un solo total", () => {
    const [skater] = parseJudgesDetailsText(danceText);
    expect(skater.slotScores.liftsTotal).toBeCloseTo(6.1 + 7.5, 2);
  });
});

describe("parseJudgesDetailsText — Parejas: Twist/Throw/Lift/Death Spiral ya no se pierden", () => {
  const pairsText = `
JUDGES DETAILS PER SKATER
MICOL MILLS - TOMMASO CORTINI
Rank Name
Total
Element
score
Nation
# Executed Element QOEInfo J1 J2 J5J4J3
Base
Value
Scores of
Panel
7.00 7.47Jump1 3 Twist Lutz3TwB 0+1+1+100.47
8.50 8.50Jump2 Throw 3 Loop3TL +200000.00
1.30 0.90Jump3 2 Axel2A <<< -3-3-3-3-3-0.40
9.48 10.58ComboLift4 Spin Pancake LiftSpPan4 +1+20+1+11.10
6.30 7.17Spiral6 Death SpiralDS4 +2+2+1+1+10.87
3.00 3.30Step Sequence7 Choreo StepChSt1 +1+20+1+10.30
2.30 2.30Jump8 Throw 2 Flip2TF -10-1+1+10.00
7.40 7.40Lift11 Reversed MilitanoRMil3 -100000.00
61.9560.31 1.64
Total
Segment
score
Total
Component
score (factored)
Total
Deductions1 ITA
61.95 53.26 -1.00 114.21
Program Components Factor
Skating Skills 7.25 7.50 7.00 7.50 7.00 7.251.8
Judges Total Program Component Score (factored) 53.26
Deductions -1.00 Falls: -1.0
`;

  it("clasifica los saltos de Parejas por tipo (Twist / Throw / Axel) en vez de perderlos todos en 'salto individual'", () => {
    const [skater] = parseJudgesDetailsText(pairsText);
    expect(skater.slotScores.twistJumpTotal).toBeCloseTo(7.47, 2);
    expect(skater.slotScores.throwJumpTotal).toBeCloseTo(8.5 + 2.3, 2);
    expect(skater.slotScores.axel).toBeCloseTo(0.9, 2);
  });

  it("suma Lift/ComboLift en un único total y reconoce Death Spiral (antes no capturaba ninguno de los dos)", () => {
    const [skater] = parseJudgesDetailsText(pairsText);
    expect(skater.slotScores.liftsTotal).toBeCloseTo(10.58 + 7.4, 2);
    expect(skater.slotScores.deathSpiralTotal).toBeCloseTo(7.17, 2);
  });
});
