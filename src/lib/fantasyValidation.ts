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
// Ahora hay una sola función, usada tanto por el formulario (para pintar
// los contadores en vivo) como por la API (para rechazar de verdad los
// roster que no las cumplen).

export interface SlotInfo {
  id: string;
  label: string;
}

export interface RegistrationInfo {
  skaterId: string;
  warmupGroup: number | null;
}

export function isComponentSlotLabel(label: string): boolean {
  const l = label.toLowerCase();
  // OJO: "Choreo Sequence (ChSt)" es un elemento TÉCNICO del Programa Largo
  // (ver fantasyTemplates.ts), no debe confundirse con "Choreography", que
  // solo aparece como parte del slot de componentes "Performance +
  // Choreography" (ya detectado por el "performance" de abajo). Antes
  // "choreo sequence" estaba aquí por error y metía ese slot técnico en la
  // sección de Componentes.
  return (
    l.includes("skating") ||
    l.includes("transition") ||
    l.includes("performance") ||
    l.includes("composition") ||
    l.includes("pcs")
  );
}

export interface ValidateRosterInput {
  slots: SlotInfo[];
  registrations: RegistrationInfo[];
  picks: Record<string, string>; // slotId -> skaterId
}

export interface ValidateRosterResult {
  valid: boolean;
  errorMessage: string;
  // Detalles para pintar los contadores en la UI, incluso mientras el
  // roster todavía es válido (p.ej. "1/2" antes de llegar al límite).
  countTopGroup: number;
  countSecondGroup: number;
  maxGroupNum: number;
  secondMaxGroupNum: number;
  exceedsTopTech: boolean;
  exceedsSecondTech: boolean;
  exceedsCompGroup: boolean;
}

export function validateFantasyRoster({
  slots,
  registrations,
  picks,
}: ValidateRosterInput): ValidateRosterResult {
  const technicalSlots = slots.filter((s) => !isComponentSlotLabel(s.label));
  const componentSlots = slots.filter((s) => isComponentSlotLabel(s.label));

  const warmupGroupOf = new Map(registrations.map((r) => [r.skaterId, r.warmupGroup || 1]));

  // Grupos ordenados de mayor a menor (el "último grupo" real de calentamiento
  // es el número de grupo más alto, no necesariamente "el grupo 2").
  const groupNums = Array.from(new Set(registrations.map((r) => r.warmupGroup || 1))).sort(
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
  const filledCount = Object.values(picks).filter(Boolean).length;
  const missingSlots = totalSlots - filledCount;

  let errorMessage = "";
  if (missingSlots > 0) {
    errorMessage = `Faltan por rellenar ${missingSlots} ${missingSlots === 1 ? "slot" : "slots"}`;
  } else if (repeatedTechSkater) {
    errorMessage = "No puedes elegir a la misma patinadora en dos elementos técnicos";
  } else if (exceedsTopTech) {
    errorMessage = `Máximo 2 patinadoras técnicas en Warmup Group ${maxGroupNum} (llevas ${countTopGroup})`;
  } else if (exceedsSecondTech) {
    errorMessage = `Máximo 2 patinadoras técnicas en Warmup Group ${secondMaxGroupNum} (llevas ${countSecondGroup})`;
  } else if (exceedsCompGroup) {
    errorMessage = "En Componentes: Máximo 1 patinadora por cada grupo de calentamiento";
  }

  const valid =
    missingSlots === 0 &&
    !repeatedTechSkater &&
    !exceedsTopTech &&
    !exceedsSecondTech &&
    !exceedsCompGroup;

  return {
    valid,
    errorMessage,
    countTopGroup,
    countSecondGroup,
    maxGroupNum,
    secondMaxGroupNum,
    exceedsTopTech,
    exceedsSecondTech,
    exceedsCompGroup,
  };
}
