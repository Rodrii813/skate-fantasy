import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractText } from "unpdf";
import { parseJudgesDetailsText, parseShowGroupResults, type SkaterDetailedResult } from "./pdfJudgesDetailsParser";

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
    const travelings = skater.elements.filter((e) => e.type === "TRAVELING");
    expect(travelings).toHaveLength(1);
    expect(travelings[0].score).toBeCloseTo(5.6 + 5.6, 2);
    expect(skater.slotScores.travelingTotal).toBeCloseTo(11.2, 2);
  });

  it("distingue 'Hold Cluster Sequence', 'No Hold Sequence' (con M+L sumados) y 'Choreo Stop/Step seq.', aunque las 3 compartan la misma palabra clave 'Dance Step' en el acta", () => {
    const [skater] = parseJudgesDetailsText(danceText);
    const clusters = skater.elements.filter((e) => e.type === "CLUSTER");
    const noHolds = skater.elements.filter((e) => e.type === "NO_HOLD_SEQUENCE");
    const choreoStops = skater.elements.filter((e) => e.type === "CHOREO_STOP");
    const genericDanceSteps = skater.elements.filter((e) => e.type === "DANCE_STEP");

    expect(clusters).toHaveLength(1);
    expect(clusters[0].score).toBeCloseTo(5.5, 2);
    expect(noHolds).toHaveLength(1);
    expect(noHolds[0].score).toBeCloseTo(3.8 + 4.5, 2);
    expect(choreoStops).toHaveLength(1);
    expect(choreoStops[0].score).toBeCloseTo(3.4, 2);
    // Ninguno de los 3 debería caer en el cajón genérico sin sub-tipo.
    expect(genericDanceSteps).toHaveLength(0);

    expect(skater.slotScores.clusterTotal).toBeCloseTo(5.5, 2);
    expect(skater.slotScores.noHoldSequenceTotal).toBeCloseTo(8.3, 2);
    expect(skater.slotScores.choreoStopTotal).toBeCloseTo(3.4, 2);
    expect(skater.slotScores.danceStepTotal).toBe(0);
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

  it("suma TODOS los saltos side-by-side (los que no son Twist ni Throw) en un pack, en vez de quedarse solo con el mejor como en Libre", () => {
    const [skater] = parseJudgesDetailsText(pairsText);
    // Jump3 "2 Axel" (0.90) es el único salto de este fixture que no es
    // Twist ni Throw, así que cae en el pack side-by-side (vía AXEL).
    expect(skater.slotScores.sideBySideJumpTotal).toBeCloseTo(0.9, 2);
  });
});

describe("parseJudgesDetailsText — Solo Danza Free (Foot Sequence, Cluster, Traveling, Choreo Stop, Dance Step genérico)", () => {
  const soloDanceFreeText = `
JUDGES DETAILS PER SKATER
MIREIA MONTILLA SÁNCHEZ
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
7.50 8.55Dance Step1 Cluster SequenceClSq4 0+1+2+21.05
YYYY YYYY (DE-BM-DF)
9.30 10.80Dance Step2 Dance Step SeqDSSq4 +1+1+2+21.50
8.50 9.60Dance Traveling3 TravelingTr4 +2+2+2+11.10%
3.00 3.20Dance Step4 Choreo Stop/Step seq.ChStS +1+1+3+10.20
10.30 11.30Dance Sequence5 Foot SeqFoSq4 +2+1+1+11.00
43.4538.60 4.85
Total
Segment
score
Total
Component
score (factored)
Total
Deductions1 ESP
43.45 42.25 0.00 85.70
Program Components Factor
Skating Skills 8.50 8.00 8.00 6.75 8.001.3
Transitions/Linking Footwork/Movement 8.25 8.25 7.75 6.50 8.001.3
Performance/Execution 8.75 9.00 7.75 6.50 8.251.3
Choreography/Composition 8.50 8.75 8.00 6.50 8.251.3
Judges Total Program Component Score (factored) 42.25
Deductions 0.00
`;

  it("mapea los 5 elementos de Solo Danza Free: Cluster, Dance Step (genérico), Traveling, Choreo Stop y Foot Sequence", () => {
    const [skater] = parseJudgesDetailsText(soloDanceFreeText);
    expect(skater.slotScores.clusterTotal).toBeCloseTo(8.55, 2);
    expect(skater.slotScores.danceStepTotal).toBeCloseTo(10.8, 2);
    expect(skater.slotScores.travelingTotal).toBeCloseTo(9.6, 2);
    expect(skater.slotScores.choreoStopTotal).toBeCloseTo(3.2, 2);
    expect(skater.slotScores.footSequenceTotal).toBeCloseTo(11.3, 2);
  });

  it("no confunde ninguno de estos 5 elementos entre sí (sin cruces de tipo)", () => {
    const [skater] = parseJudgesDetailsText(soloDanceFreeText);
    const byType = (t: string) => skater.elements.filter((e) => e.type === t);
    expect(byType("CLUSTER")).toHaveLength(1);
    expect(byType("DANCE_STEP")).toHaveLength(1);
    expect(byType("TRAVELING")).toHaveLength(1);
    expect(byType("CHOREO_STOP")).toHaveLength(1);
    expect(byType("FOOT_SEQUENCE")).toHaveLength(1);
    expect(skater.elements).toHaveLength(5);
  });

  it("lee correctamente los 4 componentes PCS con Factor 1.3", () => {
    const [skater] = parseJudgesDetailsText(soloDanceFreeText);
    expect(skater.components.skatingSkills).toBeCloseTo(8 * 1.3, 2);
    expect(skater.components.choreography).toBeCloseTo(8.25 * 1.3, 2);
  });
});

describe("parseJudgesDetailsText — Solo Danza Style (Pattern Sequence, Cluster, Traveling, Choreo Stop, Art Sequence)", () => {
  const soloDanceStyleText = `
JUDGES DETAILS PER SKATER
MIREIA MONTILLA SÁNCHEZ
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
5.70 5.85Pattern Sequence1 Quickstep Sequence 1QSS1L3 00+1+10.15
Y N(pe) Y Y
7.80 8.90Dance Traveling2 TravelingTr4 +2+2+2+21.10%
3.00 3.20Dance Step3 Choreo Stop/Step seq.ChStS +1+1+2+10.20
5.00 5.50Dance Step4 One Set Cluster Sequence1SClSq4 +1+1+1+10.50
YYYYY (DE-BM-JU)
9.30 10.80Dance Step5 Art SeqASq4 +1+1+2+21.50
34.2530.80 3.45
Total
Segment
score
Total
Component
score (factored)
Total
Deductions1 ESP
34.25 31.12 0.00 65.37
Program Components Factor
Skating Skills 7.75 7.75 7.50 6.75 7.621
Transitions/Linking Footwork/Movement 7.75 8.00 7.50 6.50 7.621
Performance/Execution 8.25 8.50 7.75 6.50 8.001
Choreography/Composition 8.00 8.25 7.75 6.25 7.881
Judges Total Program Component Score (factored) 31.12
Deductions 0.00
`;

  it("distingue Pattern Sequence, Traveling, Choreo Stop, Cluster ('One Set Cluster Sequence' sin la palabra 'Hold') y Art Sequence", () => {
    const [skater] = parseJudgesDetailsText(soloDanceStyleText);
    expect(skater.slotScores.patternSequenceTotal).toBeCloseTo(5.85, 2);
    expect(skater.slotScores.travelingTotal).toBeCloseTo(8.9, 2);
    expect(skater.slotScores.choreoStopTotal).toBeCloseTo(3.2, 2);
    expect(skater.slotScores.clusterTotal).toBeCloseTo(5.5, 2);
    expect(skater.slotScores.artSequenceTotal).toBeCloseTo(10.8, 2);
    expect(skater.slotScores.danceStepTotal).toBe(0);
  });
});

describe("parseJudgesDetailsText — Pareja Danza Style (suma Man+Lady, Pattern Sequence, Hold Sequence)", () => {
  const coupleDanceStyleText = `
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
4.10 4.90Dance Step1 One Set Cluster Sequence
Couple (M)
1SClSqC3 +3+2+2+20.80
YYYYN (DE-BM-JU)
4.50 5.30One Set Cluster Sequence
Couple (L)
1SClSqC4 +3+2+2+20.80
YYYYY (DE-BM-JU)
3.00 3.20Dance Step2 Choreo Stop/Step seq.ChStS +1+1+1+10.20
5.55 5.85Pattern Sequence3 Westminster WaltzWW2 +1+1+2+10.30
Y Y N(e) N(e)
5.50 6.10Lift4 Dance Lift StationaryStLi4 +2+2+1+10.60
6.80 7.80Dance Step5 Hold SequenceHo2 +2+2+2+21.00
33.1529.45 3.70
Total
Segment
score
Total
Component
score (factored)
Total
Deductions1 ITA
33.15 33.01 0.00 66.16
Program Components Factor
Skating Skills 7.50 8.25 8.25 8.75 8.251
Transitions/Linking Footwork/Movement 7.50 8.00 8.00 8.75 8.001
Performance/Execution 7.75 8.50 8.25 9.25 8.381
Choreography/Composition 8.00 8.75 8.00 9.25 8.381
Judges Total Program Component Score (factored) 33.01
Deductions 0.00
`;

  it("suma el Cluster partido en (M)/(L) en un único valor (4.90 + 5.30)", () => {
    const [skater] = parseJudgesDetailsText(coupleDanceStyleText);
    expect(skater.slotScores.clusterTotal).toBeCloseTo(4.9 + 5.3, 2);
  });

  it("mapea Choreo Stop, Pattern Sequence, Lift y Hold Sequence sin cruces", () => {
    const [skater] = parseJudgesDetailsText(coupleDanceStyleText);
    expect(skater.slotScores.choreoStopTotal).toBeCloseTo(3.2, 2);
    expect(skater.slotScores.patternSequenceTotal).toBeCloseTo(5.85, 2);
    expect(skater.slotScores.liftsTotal).toBeCloseTo(6.1, 2);
    expect(skater.slotScores.holdSequenceTotal).toBeCloseTo(7.8, 2);
    // "No Hold Sequence" y "Hold Sequence" no deben confundirse entre sí.
    expect(skater.slotScores.noHoldSequenceTotal).toBe(0);
  });
});

describe("parseJudgesDetailsText — Show Quartets (Creative, Canon, Traveling, Cluster)", () => {
  const quartetsText = `
JUDGES DETAILS PER SKATER
FASHION ONE
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
8.50 8.30Dance Traveling1 TravelingTr4 0-1+10-1-0.20%
8.30 8.30Quartets Element2 ClusterQCL4 -100000.00
3.00 3.13Quartets Element3 CreativeQCr1 +1+1+1000.13
6.80 7.40Quartets Element4 CanonQC4 +1+1+1+1+10.60
27.1326.60 0.53
Total
Segment
score
Total
Component
score (factored)
Total
Deductions1 ITA
27.13 24.84 0.00 51.97
Program Components Factor
Skating Skills 5.75 6.00 6.25 6.00 6.00 6.001
Transitions/Linking Footwork/Movement 6.25 5.75 6.50 6.25 6.00 6.171
Performance/Execution 6.00 6.00 6.50 6.50 6.25 6.251
Choreography/Composition 6.25 5.75 6.75 6.50 6.50 6.421
Judges Total Program Component Score (factored) 24.84
Deductions 0.00
`;

  it("distingue los 3 sub-elementos de 'Quartets Element' (Cluster/Creative/Canon) y reconoce Traveling", () => {
    const [team] = parseJudgesDetailsText(quartetsText);
    expect(team.slotScores.travelingTotal).toBeCloseTo(8.3, 2);
    expect(team.slotScores.clusterTotal).toBeCloseTo(8.3, 2);
    expect(team.slotScores.creativeTotal).toBeCloseTo(3.13, 2);
    expect(team.slotScores.canonTotal).toBeCloseTo(7.4, 2);
  });
});

describe("parseJudgesDetailsText — Precisión (8 elementos, incluida la variante en minúscula 'Pivoting block')", () => {
  const precisionText = `
JUDGES DETAILS PER SKATER
MONZA PRECISION TEAM
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
4.00 4.20Precision Element1 Rotating WheelW4 0+10+10.20
4.00 4.40Precision Element2 Linear LineL4 0+1+1+10.40
5.50 5.50Precision Element3 Pivoting blockPB3 000-10.00
6.00 6.40Precision Element4 Move ElementME4 0+1+1+10.40%
5.50 5.30Precision Element5 IntersectionI4 0+1-1-1-0.20%
5.00 5.25Precision Element6 TravelingTCW4 0+1+100.25
4.50 4.95Precision Element7 CreativeCr1 0+1+1+10.45
6.50 6.50Precision Element8 No Hold ElementNH4 00000.00%
42.5041.00 1.50
Total
Segment
score
Total
Component
score (factored)
Total
Deductions1 ITA
42.50 31.20 0.00 73.70
Program Components Factor
Skating Skills 6.50 6.50 6.25 6.25 6.381.2
Transitions/Linking Footwork/Movement 6.50 6.50 6.00 6.00 6.251.2
Performance/Execution 7.00 7.00 6.25 6.25 6.621.2
Choreography/Composition 7.50 7.00 6.50 6.00 6.751.2
Judges Total Program Component Score (factored) 31.20
Deductions 0.00
`;

  it("mapea los 8 elementos de Precisión a sus 8 tipos correctos, incluida 'Pivoting block' en minúscula", () => {
    const [team] = parseJudgesDetailsText(precisionText);
    expect(team.slotScores.wheelTotal).toBeCloseTo(4.2, 2);
    expect(team.slotScores.lineTotal).toBeCloseTo(4.4, 2);
    expect(team.slotScores.blockTotal).toBeCloseTo(5.5, 2);
    expect(team.slotScores.moveElementTotal).toBeCloseTo(6.4, 2);
    expect(team.slotScores.intersectionTotal).toBeCloseTo(5.3, 2);
    expect(team.slotScores.travelingTotal).toBeCloseTo(5.25, 2);
    expect(team.slotScores.creativeTotal).toBeCloseTo(4.95, 2);
    expect(team.slotScores.noHoldElementTotal).toBeCloseTo(6.5, 2);
  });

  it("suma TES = 42.50 a partir de los 8 elementos", () => {
    const [team] = parseJudgesDetailsText(precisionText);
    const sum = Number(team.elements.reduce((acc, e) => acc + e.score, 0).toFixed(2));
    expect(sum).toBeCloseTo(42.5, 2);
    expect(team.tes).toBeCloseTo(42.5, 2);
  });
});

describe("parseShowGroupResults — Show Small/Large Groups (sin TES, solo 4 componentes PCS por equipo)", () => {
  const showGroupsText = `
ARTISTIC WORLD CUP SHOW & PRECISION
CESENA - 30/05/2026
SHOW Small Groups
FINAL RESULT - SHOW
PointsNationClub SS GT PE CH DEDPl. Group
ESP 35.717.08 9.30 7.58 11.75CPA CONDADO
PENELOPE
0.01
ITA 30.096.17 8.00 6.42 10.00HANAMI
SON OF THE JUNGLE
-0.52
23:16:42WORLDSKATE - RollArt System v.5.3 © 2026 RollArt. All rights reserved.30/05/2026
Verified
ARTISTIC WORLD CUP SHOW & PRECISION
CESENA - 30/05/2026
Show Small Groups
CPA CONDADO - PENELOPE
Rank Group Name Nation
Total
Segment
score
Total
Component
score (factored)
Total
Deductions1 ESP
35.71 0.00 35.71
Program Components Factor J1 J2 J3 J4 J5 J6 J7 J8 J9
7.50 6.75 7.75 7.00 6.00 7.08Skating Skills 1.0
8.00 7.50 8.25 7.75 7.25 9.30Group Technique 1.2
7.50 7.50 8.00 7.75 7.00 7.58Performance/Execution 1.0
8.00 7.75 8.00 7.75 7.50 11.75Idea and Choreography 1.5
Judges Total Program Component Score (factored) 35.71
Deductions 0.00
WORLDSKATE - RollArt System v.5.3 © 2026 RollArt. All rights reserved. Pagina 1 di 1230/05/2026
23:16:37
Verified
Show Small Groups
HANAMI - SON OF THE JUNGLE
Rank Group Name Nation
Total
Segment
score
Total
Component
score (factored)
Total
Deductions2 ITA
30.59 -0.50 30.09
Program Components Factor J1 J2 J3 J4 J5 J6 J7 J8 J9
6.75 6.25 6.50 5.75 5.75 6.17Skating Skills 1.0
7.25 6.75 6.75 6.50 6.00 8.00Group Technique 1.2
7.00 6.75 6.00 6.50 5.50 6.42Performance/Execution 1.0
7.50 7.00 6.25 6.75 5.75 10.00Idea and Choreography 1.5
Judges Total Program Component Score (factored) 30.59
Deductions -0.50 Falls: -0.5
WORLDSKATE - RollArt System v.5.3 © 2026 RollArt. All rights reserved. Pagina 2 di 1230/05/2026
23:16:38
Verified
`;

  it("extrae los 2 equipos con su nombre, nación, rank y total", () => {
    const teams = parseShowGroupResults(showGroupsText);
    expect(teams).toHaveLength(2);
    expect(teams[0].rank).toBe(1);
    expect(teams[0].nation).toBe("ESP");
    expect(teams[0].teamName).toBe("CPA CONDADO - PENELOPE");
    expect(teams[0].total).toBeCloseTo(35.71, 2);
    expect(teams[1].rank).toBe(2);
    expect(teams[1].teamName).toBe("HANAMI - SON OF THE JUNGLE");
    expect(teams[1].total).toBeCloseTo(30.09, 2);
  });

  it("lee los 4 componentes YA facturados (el número pegado justo antes de la etiqueta), sin multiplicar por el Factor", () => {
    const teams = parseShowGroupResults(showGroupsText);
    expect(teams[0].components.skatingSkills).toBeCloseTo(7.08, 2);
    expect(teams[0].components.groupTechnique).toBeCloseTo(9.3, 2);
    expect(teams[0].components.performance).toBeCloseTo(7.58, 2);
    expect(teams[0].components.ideaChoreography).toBeCloseTo(11.75, 2);
  });

  it("aplica correctamente las deducciones negativas al total (30.59 - 0.50 = 30.09)", () => {
    const teams = parseShowGroupResults(showGroupsText);
    expect(teams[1].deductions).toBeCloseTo(-0.5, 2);
    const sum = Number(
      Object.values(teams[1].components)
        .reduce((acc, v) => acc + v, 0)
        .toFixed(2)
    );
    expect(sum).toBeCloseTo(30.59, 2);
    expect(Number((sum + teams[1].deductions).toFixed(2))).toBeCloseTo(teams[1].total, 2);
  });
});

// Bug real encontrado con actas de Inline (checklist de lanzamiento, sección
// "Producto"): en el Largo (Free Program), la ÚLTIMA fila de Componentes
// ("Choreography/Composition") a veces queda pegada SIN salto de línea al
// texto siguiente en la extracción del PDF — p.ej.
// "...7.001.6Judges Total Program Component Score (factored) 44.80", todo en
// una sola línea. El regex antiguo de getPcsValue exigía que el Factor fuera
// lo último antes de fin de línea (\s*$), así que esta fila nunca hacía
// match y el componente se quedaba en 0. Este test fija ese caso exacto para
// que no vuelva a colarse.
describe("parseJudgesDetailsText — Largo Inline: última fila de Componentes pegada al texto siguiente", () => {
  const inlineGluedText = `
JUDGES DETAILS PER SKATER
TEST SKATER NAME
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
5.00 5.30Jump1 3Lo3Lo +1+1+1+11.10
5.30 5.30
Total
Segment
score
Total
Component
score (factored)
Total
Deductions1 GER
5.30 44.80 0.00 50.10
Program Components Factor
Skating Skills 7.00 7.00 7.00 7.00 7.001.6
Transitions/Linking Footwork/Movement 7.00 7.00 7.00 7.00 7.001.6
Performance/Execution 7.00 7.00 7.00 7.00 7.001.6
Choreography/Composition 7.00 7.00 7.00 7.00 7.001.6Judges Total Program Component Score (factored) 44.80
Deductions 0.00
`;

  it("lee 'Choreography/Composition' aunque quede pegada sin salto de línea al texto siguiente", () => {
    const [skater] = parseJudgesDetailsText(inlineGluedText);
    expect(skater.components.choreography).toBeCloseTo(11.2, 2);
    // Los otros 3 componentes (que sí llevan salto de línea detrás) no deben
    // verse afectados por el cambio de regex.
    expect(skater.components.skatingSkills).toBeCloseTo(11.2, 2);
    expect(skater.components.transitions).toBeCloseTo(11.2, 2);
    expect(skater.components.performance).toBeCloseTo(11.2, 2);
  });
});
