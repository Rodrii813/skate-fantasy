import { describe, it, expect } from "vitest";
import {
  validateFantasyRoster,
  isComponentSlotLabel,
  type SlotInfo,
  type RegistrationInfo,
  type SegmentInfo,
} from "./fantasyValidation";

const SHORT_SEGMENT_ID = "seg-short";
const LONG_SEGMENT_ID = "seg-long";

const segments: SegmentInfo[] = [
  { id: SHORT_SEGMENT_ID, order: 1 },
  { id: LONG_SEGMENT_ID, order: 2 },
];

// Slots del Corto: labels distintos de los técnicos, pero los dos slots de
// componentes usan EXACTAMENTE el mismo texto que los del Largo (como en
// fantasyTemplates.ts real) — solo segmentId los distingue.
const shortSlots: SlotInfo[] = [
  { id: "short-combo", label: "Combo Jump", segmentId: SHORT_SEGMENT_ID },
  { id: "short-solo", label: "Solo Jump", segmentId: SHORT_SEGMENT_ID },
  { id: "short-axel", label: "Axel", segmentId: SHORT_SEGMENT_ID },
  { id: "short-comp1", label: "Skating Skills + Transitions", segmentId: SHORT_SEGMENT_ID },
  { id: "short-comp2", label: "Performance + Choreography", segmentId: SHORT_SEGMENT_ID },
];

const longSlots: SlotInfo[] = [
  { id: "long-combo1", label: "Combo Jump 1", segmentId: LONG_SEGMENT_ID },
  { id: "long-combo2", label: "Combo Jump 2", segmentId: LONG_SEGMENT_ID },
  { id: "long-comp1", label: "Skating Skills + Transitions", segmentId: LONG_SEGMENT_ID },
  { id: "long-comp2", label: "Performance + Choreography", segmentId: LONG_SEGMENT_ID },
];

const allSlots = [...shortSlots, ...longSlots];

// Grupos de calentamiento DISTINTOS por segmento para las mismas
// patinadoras: el sorteo del Largo se redibuja según el resultado del
// Corto, así que una patinadora puede estar en el grupo top del Corto y en
// otro grupo completamente distinto en el Largo.
const registrations: RegistrationInfo[] = [
  { skaterId: "A", warmupGroupShort: 3, warmupGroupLong: 1 },
  { skaterId: "B", warmupGroupShort: 3, warmupGroupLong: 1 },
  { skaterId: "C", warmupGroupShort: 2, warmupGroupLong: 2 },
  { skaterId: "D", warmupGroupShort: 1, warmupGroupLong: 2 },
  { skaterId: "E", warmupGroupShort: 3, warmupGroupLong: null },
];

// Un roster válido en ambos segmentos, usando grupos distintos en cada uno.
const validPicks: Record<string, string> = {
  // Corto: A y B (warmupGroupShort=3, grupo top) en técnica -> 2/2, ok.
  "short-combo": "A",
  "short-solo": "B",
  "short-axel": "D",
  "short-comp1": "C", // grupo 2
  "short-comp2": "D", // grupo 1 (distinto del anterior)
  // Largo: C y D (warmupGroupLong=2, grupo top) en técnica -> 2/2, ok.
  "long-combo1": "C",
  "long-combo2": "D",
  "long-comp1": "A", // grupo 1
  "long-comp2": "C", // grupo 2 (distinto del anterior; repetir patinadora entre técnica y componentes está permitido)
};

describe("isComponentSlotLabel", () => {
  it("clasifica los labels de componentes reales de fantasyTemplates.ts", () => {
    expect(isComponentSlotLabel("Skating Skills + Transitions")).toBe(true);
    expect(isComponentSlotLabel("Performance + Choreography")).toBe(true);
  });

  it("clasifica los labels técnicos reales de fantasyTemplates.ts", () => {
    expect(isComponentSlotLabel("Combo Jump")).toBe(false);
    expect(isComponentSlotLabel("Solo Jump")).toBe(false);
    expect(isComponentSlotLabel("Axel")).toBe(false);
    expect(isComponentSlotLabel("Spins (Piruetas)")).toBe(false);
    expect(isComponentSlotLabel("Step Sequence (St)")).toBe(false);
  });
});

describe("validateFantasyRoster — roster completo válido", () => {
  it("acepta un roster válido en Corto y en Largo, con grupos distintos por segmento", () => {
    const result = validateFantasyRoster({
      slots: allSlots,
      registrations,
      segments,
      picks: validPicks,
    });

    expect(result.valid).toBe(true);
    expect(result.errorMessage).toBe("");
    expect(result.segments).toHaveLength(2);
    expect(result.segments.every((s) => s.valid)).toBe(true);
  });

  it("devuelve el desglose de contadores correcto para cada segmento", () => {
    const result = validateFantasyRoster({
      slots: allSlots,
      registrations,
      segments,
      picks: validPicks,
    });

    const shortResult = result.segments.find((s) => s.segmentId === SHORT_SEGMENT_ID)!;
    const longResult = result.segments.find((s) => s.segmentId === LONG_SEGMENT_ID)!;

    expect(shortResult.segmentLabel).toBe("Corto");
    expect(shortResult.maxGroupNum).toBe(3);
    expect(shortResult.secondMaxGroupNum).toBe(2);
    expect(shortResult.countTopGroup).toBe(2); // A y B en técnica, grupo 3

    expect(longResult.segmentLabel).toBe("Largo");
    expect(longResult.maxGroupNum).toBe(2);
    expect(longResult.secondMaxGroupNum).toBe(1);
    expect(longResult.countTopGroup).toBe(2); // C y D en técnica, grupo 2
  });
});

describe("validateFantasyRoster — segmentId decide el segmento, nunca el label", () => {
  it("no confunde los slots de componentes del Corto y del Largo aunque compartan el mismo label", () => {
    // Mismo grupo (3) usado en el componente del Corto Y en el componente
    // "gemelo" del Largo (mismo label, distinto segmentId). Si el código
    // agrupara por label en vez de por segmentId, esto se contaría como 2
    // usos del grupo 3 en el MISMO segmento y dispararía "máx 1 por grupo".
    // Como son segmentos distintos, cada uno debe evaluarse por separado.
    const picks: Record<string, string> = {
      ...validPicks,
      "short-comp1": "A", // warmupGroupShort de A = 3
    };
    // Ajustamos el otro componente del Corto para que no choque con A en el mismo grupo.
    picks["short-comp2"] = "D"; // warmupGroupShort de D = 1

    const result = validateFantasyRoster({
      slots: allSlots,
      registrations,
      segments,
      picks,
    });

    const shortResult = result.segments.find((s) => s.segmentId === SHORT_SEGMENT_ID)!;
    expect(shortResult.exceedsCompGroup).toBe(false);
    expect(result.valid).toBe(true);
  });
});

describe("validateFantasyRoster — reglas por segmento, independientes", () => {
  it("invalida solo el Corto si excede el grupo top ahí, dejando el Largo intacto", () => {
    // El Largo solo tiene 2 slots técnicos (el límite es máx 2), así que no
    // se puede forzar un "exceeds" ahí sin más slots. El Corto sí tiene 3
    // técnicos (short-combo, short-solo, short-axel): los llenamos con 3
    // patinadoras del grupo top (3) — A, B y E — para superar el límite.
    const picks: Record<string, string> = { ...validPicks };
    picks["short-combo"] = "A";
    picks["short-solo"] = "B";
    picks["short-axel"] = "E";

    const result = validateFantasyRoster({
      slots: allSlots,
      registrations,
      segments,
      picks,
    });

    const shortResult = result.segments.find((s) => s.segmentId === SHORT_SEGMENT_ID)!;
    const longResult = result.segments.find((s) => s.segmentId === LONG_SEGMENT_ID)!;

    expect(shortResult.valid).toBe(false);
    expect(shortResult.exceedsTopTech).toBe(true);
    expect(shortResult.countTopGroup).toBe(3);
    expect(longResult.valid).toBe(true); // el Largo no se ve afectado
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain("Corto:");
    expect(result.errorMessage).toContain("Warmup Group 3");
  });

  it("invalida solo el segmento con el componente repetido en el mismo grupo", () => {
    const picks: Record<string, string> = {
      ...validPicks,
      "long-comp2": "A", // warmupGroupLong de A = 1, igual que long-comp1 (también A)
    };

    const result = validateFantasyRoster({
      slots: allSlots,
      registrations,
      segments,
      picks,
    });

    const shortResult = result.segments.find((s) => s.segmentId === SHORT_SEGMENT_ID)!;
    const longResult = result.segments.find((s) => s.segmentId === LONG_SEGMENT_ID)!;

    expect(shortResult.valid).toBe(true);
    expect(longResult.valid).toBe(false);
    expect(longResult.exceedsCompGroup).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain("Largo:");
  });

  it("invalida solo el segmento con una patinadora repetida en técnica", () => {
    const picks: Record<string, string> = {
      ...validPicks,
      "long-combo2": "C", // long-combo1 ya es "C" también
    };

    const result = validateFantasyRoster({
      slots: allSlots,
      registrations,
      segments,
      picks,
    });

    const longResult = result.segments.find((s) => s.segmentId === LONG_SEGMENT_ID)!;
    expect(longResult.valid).toBe(false);
    expect(longResult.repeatedTechSkater).toBe(true);
    expect(result.errorMessage).toContain("misma patinadora");
  });

  it("reporta los slots que faltan por rellenar en el segmento correspondiente", () => {
    const picks: Record<string, string> = { ...validPicks };
    delete picks["long-comp1"];

    const result = validateFantasyRoster({
      slots: allSlots,
      registrations,
      segments,
      picks,
    });

    const longResult = result.segments.find((s) => s.segmentId === LONG_SEGMENT_ID)!;
    expect(longResult.valid).toBe(false);
    expect(longResult.missingSlots).toBe(1);
    expect(result.errorMessage).toBe("Largo: faltan por rellenar 1 slot");
  });
});

describe("validateFantasyRoster — compatibilidad con slots sin segmentId", () => {
  it("trata los slots sin segmentId como un único segmento 'Corto' por defecto", () => {
    const legacySlots: SlotInfo[] = [
      { id: "legacy-combo", label: "Combo Jump", segmentId: null },
      { id: "legacy-comp", label: "Skating Skills + Transitions", segmentId: null },
    ];
    const legacyRegistrations: RegistrationInfo[] = [
      { skaterId: "A", warmupGroupShort: 1, warmupGroupLong: null },
      { skaterId: "B", warmupGroupShort: 2, warmupGroupLong: null },
    ];

    const result = validateFantasyRoster({
      slots: legacySlots,
      registrations: legacyRegistrations,
      segments: [],
      picks: { "legacy-combo": "A", "legacy-comp": "B" },
    });

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].segmentLabel).toBe("Corto");
    expect(result.valid).toBe(true);
  });
});
