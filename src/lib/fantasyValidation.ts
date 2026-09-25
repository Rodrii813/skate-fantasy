// Reglas del roster de Fantasy — fuente única de verdad.
//
// Estas son las normas reales que el usuario ve en el formulario
// (FantasyRosterForm.tsx). Antes vivían DUPLICADAS: una copia aquí (con
// umbrales distintos, y sin usar por nadie) y otra copia inline dentro del
// propio formulario (la que de verdad se aplicaba, pero solo en el
// navegador). La API que guarda el roster (/api/fantasy/roster) no
// comprobaba nada de esto, así que las reglas eran opcionales para
// cualquiera que las evitase desde fuera del formulario.
//
// Un evento puede tener 2 segmentos (Programa Corto / Programa Largo), cada
// uno con su propio sorteo de grupos de calentamiento (el del Largo se
// redibuja según el resultado del Corto). Las reglas de grupos ("máx 2
// técnicos del grupo top", "máx 1 componente por grupo"...) se aplican de
// forma INDEPENDIENTE por segmento: un roster es válido solo si TODOS sus
// segmentos lo son. A qué segmento pertenece cada slot se decide por
// slot.segmentId — nunca por el texto del label, porque "Skating Skills +
// Transitions" y "Performance + Choreography" son labels idénticos en Corto
// y Largo.
//
// Ahora hay una sola función, usada tanto por el formulario (para pintar
// los contadores en vivo, por segmento) como por la API (para rechazar de
// verdad los rosters que no las cumplen).

export interface SlotInfo {
  id: string;
  label: string;
  segmentId: string | null;
}

export interface RegistrationInfo {
  skaterId: string;
  warmupGroupShort: number | null;
  warmupGroupLong: number | null;
}

// Segmentos del evento, en el orden real de la competición (Corto = el de
// menor `order`, Largo = el siguiente). Mismo criterio que ya usa
// upload-judges-details/route.ts ("isFirstSegment = segment.order <= 1"),
// porque el nombre del segmento es configurable por el admin y no siempre
// dice literalmente "Short"/"Long".
export interface SegmentInfo {
  id: string;
  order: number;
}

export function isComponentSlotLabel(label: string): boolean {
  const l = label.toLowerCase();
  // OJO: "Choreo Sequence (ChSt)", "Choreo Stop" y "Choreo Step" son
  // elementos TÉCNICOS (ver fantasyTemplates.ts) — no deben confundirse con
  // "Choreography" (con -graphy), que solo aparece en slots de Componentes:
  // "Performance + Choreography" (Libre/Danza/Parejas, ya cubierto por
  // "performance") e "Idea and Choreography" (Show, sin "performance" en el
  // nombre, por eso "choreography" está aquí aparte). "technique" cubre
  // "Group Technique" (Show Grupos Pequeños/Grandes): ahí NO hay elementos
  // técnicos como tal, las 4 categorías son de Componentes por separado.
  return (
    l.includes("skating") ||
    l.includes("transition") ||
    l.includes("performance") ||
    l.includes("composition") ||
    l.includes("choreography") ||
    l.includes("technique") ||
    l.includes("pcs")
  );
}

export interface ValidateRosterInput {
  slots: SlotInfo[];
  registrations: RegistrationInfo[];
  segments: SegmentInfo[];
  picks: Record<string, string>; // slotId -> skaterId
}

// Resultado de validar UN segmento (Corto o Largo) de forma independiente.
export interface SegmentValidationResult {
  segmentId: string;
  segmentLabel: "Corto" | "Largo";
  valid: boolean;
  errorMessage: string;
  missingSlots: number;
  repeatedTechSkater: boolean;
  countTopGroup: number;
  countSecondGroup: number;
  maxGroupNum: number;
  secondMaxGroupNum: number;
  exceedsTopTech: boolean;
  exceedsSecondTech: boolean;
  exceedsCompGroup: boolean;
}

export interface ValidateRosterResult {
  valid: boolean;
  // Mensaje del primer segmento inválido (o vacío si todo está bien), para
  // seguir sirviendo directamente al botón de guardar / a la respuesta de
  // error de la API sin que quien la llama tenga que recorrer `segments`.
  errorMessage: string;
  segments: SegmentValidationResult[];
}

function validateSegment(
  segmentId: string,
  segmentLabel: "Corto" | "Largo",
  slots: SlotInfo[],
  registrations: RegistrationInfo[],
  picks: Record<string, string>,
  groupField: "warmupGroupShort" | "warmupGroupLong"
): SegmentValidationResult {
  const technicalSlots = slots.filter((s) => !isComponentSlotLabel(s.label));
  const componentSlots = slots.filter((s) => isComponentSlotLabel(s.label));

  const warmupGroupOf = new Map(
    registrations.map((r) => [r.skaterId, r[groupField] || 1])
  );

  // Grupos ordenados de mayor a menor (el "último grupo" real de
  // calentamiento es el número de grupo más alto, no necesariamente "el
  // grupo 2").
  const groupNums = Array.from(new Set(registrations.map((r) => r[groupField] || 1))).sort(
    (a, b) => b - a
  );
  const maxGroupNum = groupNums[0] ?? 1;
  const secondMaxGroupNum = groupNums[1] ?? 0;

  const techSkaterCounts: Record<string, number> = {};
  const techGroupUsage: Record<number, number> = {};
  for (const slot of technicalSlots) {
    const skaterId = picks[slot.id];
    if (!skaterId) continue;
    techSkaterCounts[skaterId] = (techSkaterCounts[skaterId] || 0) + 1;
    const g = warmupGroupOf.get(skaterId) ?? 1;
    techGroupUsage[g] = (techGroupUsage[g] || 0) + 1;
  }

  const compGroupUsage: Record<number, number> = {};
  for (const slot of componentSlots) {
    const skaterId = picks[slot.id];
    if (!skaterId) continue;
    const g = warmupGroupOf.get(skaterId) ?? 1;
    compGroupUsage[g] = (compGroupUsage[g] || 0) + 1;
  }

  const countTopGroup = techGroupUsage[maxGroupNum] || 0;
  const countSecondGroup = secondMaxGroupNum ? techGroupUsage[secondMaxGroupNum] || 0 : 0;
  const exceedsTopTech = countTopGroup > 2;
  const exceedsSecondTech = countSecondGroup > 2;
  const exceedsCompGroup = Object.values(compGroupUsage).some((c) => c > 1);

  const repeatedTechSkater = Object.values(techSkaterCounts).some((c) => c > 1);

  const totalSlots = slots.length;
  const filledCount = slots.filter((s) => Boolean(picks[s.id])).length;
  const missingSlots = totalSlots - filledCount;

  let errorMessage = "";
  if (missingSlots > 0) {
    errorMessage = `${segmentLabel}: faltan por rellenar ${missingSlots} ${
      missingSlots === 1 ? "slot" : "slots"
    }`;
  } else if (repeatedTechSkater) {
    errorMessage = `${segmentLabel}: no puedes elegir a la misma patinadora en dos elementos técnicos`;
  } else if (exceedsTopTech) {
    errorMessage = `${segmentLabel}: máximo 2 patinadoras técnicas en Warmup Group ${maxGroupNum} (llevas ${countTopGroup})`;
  } else if (exceedsSecondTech) {
    errorMessage = `${segmentLabel}: máximo 2 patinadoras técnicas en Warmup Group ${secondMaxGroupNum} (llevas ${countSecondGroup})`;
  } else if (exceedsCompGroup) {
    errorMessage = `${segmentLabel}: en Componentes, máximo 1 patinadora por cada grupo de calentamiento`;
  }

  const valid =
    missingSlots === 0 &&
    !repeatedTechSkater &&
    !exceedsTopTech &&
    !exceedsSecondTech &&
    !exceedsCompGroup;

  return {
    segmentId,
    segmentLabel,
    valid,
    errorMessage,
    missingSlots,
    repeatedTechSkater,
    countTopGroup,
    countSecondGroup,
    maxGroupNum,
    secondMaxGroupNum,
    exceedsTopTech,
    exceedsSecondTech,
    exceedsCompGroup,
  };
}

export function validateFantasyRoster({
  slots,
  registrations,
  segments,
  picks,
}: ValidateRosterInput): ValidateRosterResult {
  const orderedSegments = [...segments].sort((a, b) => a.order - b.order);

  // Segmentos que de verdad tienen slots asociados, en el orden real de la
  // competición (Corto primero). Un slot sin segmentId (dato legado o
  // evento sin segmentos generados) se agrupa aparte y se trata como
  // "Corto" por defecto, para no perder su validación.
  const segmentIdsWithSlots = Array.from(
    new Set(slots.map((s) => s.segmentId ?? "__sin_segmento__"))
  );

  const segmentBuckets = segmentIdsWithSlots.map((segmentId) => {
    const known = orderedSegments.find((s) => s.id === segmentId);
    const orderIndex = known
      ? orderedSegments.findIndex((s) => s.id === segmentId)
      : 0; // sin match conocido -> se trata como el primer segmento (Corto)
    const isShort = orderIndex <= 0;
    return {
      segmentId,
      segmentLabel: (isShort ? "Corto" : "Largo") as "Corto" | "Largo",
      groupField: (isShort ? "warmupGroupShort" : "warmupGroupLong") as
        | "warmupGroupShort"
        | "warmupGroupLong",
    };
  });

  const segmentResults = segmentBuckets.map((bucket) => {
    const segmentSlots = slots.filter((s) => (s.segmentId ?? "__sin_segmento__") === bucket.segmentId);
    return validateSegment(
      bucket.segmentId,
      bucket.segmentLabel,
      segmentSlots,
      registrations,
      picks,
      bucket.groupField
    );
  });

  const firstInvalid = segmentResults.find((s) => !s.valid);

  return {
    valid: segmentResults.every((s) => s.valid),
    errorMessage: firstInvalid?.errorMessage || "",
    segments: segmentResults,
  };
}
