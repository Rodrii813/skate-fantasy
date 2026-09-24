export interface SkaterPickInfo {
  slotType: "TECHNICAL" | "COMPONENT";
  skaterId: string;
  warmupGroup: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  counters?: {
    techLast: number;
    techPenultimate: number;
    compLast: number;
    compPenultimate: number;
    lastGroupNum: number;
    penultimateGroupNum: number;
  };
}

export function validateFantasyRoster(
  picks: SkaterPickInfo[],
  totalGroups: number
): ValidationResult {
  if (picks.length === 0) {
    return { valid: true };
  }

  // 1. Contador de repeticiones por patinador
  const techSkaterCounts = new Map<string, number>();
  const compSkaterCounts = new Map<string, number>();

  picks.forEach((p) => {
    if (p.slotType === "TECHNICAL") {
      techSkaterCounts.set(p.skaterId, (techSkaterCounts.get(p.skaterId) || 0) + 1);
    } else {
      compSkaterCounts.set(p.skaterId, (compSkaterCounts.get(p.skaterId) || 0) + 1);
    }
  });

  // CASO 1: 1 solo Grupo de calentamiento
  if (totalGroups <= 1) {
    for (const [, count] of techSkaterCounts.entries()) {
      if (count > 2) {
        return {
          valid: false,
          error: "Con 1 solo grupo, no puedes seleccionar al mismo patinador en más de 2 slots técnicos.",
        };
      }
    }
    for (const [, count] of compSkaterCounts.entries()) {
      if (count > 1) {
        return {
          valid: false,
          error: "No puedes seleccionar al mismo patinador más de 1 vez en componentes.",
        };
      }
    }
    return { valid: true };
  }

  // Para 2 o más grupos: Prohibido repetir el mismo patinador en más de un slot técnico
  for (const [, count] of techSkaterCounts.entries()) {
    if (count > 1) {
      return {
        valid: false,
        error: "No puedes repetir al mismo patinador en más de un slot técnico.",
      };
    }
  }

  // CASO 2: Exactamente 2 Grupos de Calentamiento
  if (totalGroups === 2) {
    const lastGroup = 2;

    const techLast = picks.filter(
      (p) => p.slotType === "TECHNICAL" && p.warmupGroup === lastGroup
    ).length;

    const compLast = picks.filter(
      (p) => p.slotType === "COMPONENT" && p.warmupGroup === lastGroup
    ).length;

    if (techLast > 3) {
      return {
        valid: false,
        error: `Llevas ${techLast} patinadores del Grupo 2 en técnica. El límite permitido es 3.`,
        counters: { techLast, techPenultimate: 0, compLast, compPenultimate: 0, lastGroupNum: 2, penultimateGroupNum: 1 },
      };
    }

    if (compLast > 1) {
      return {
        valid: false,
        error: "En componentes solo puedes elegir como máximo 1 patinador del Grupo 2.",
        counters: { techLast, techPenultimate: 0, compLast, compPenultimate: 0, lastGroupNum: 2, penultimateGroupNum: 1 },
      };
    }

    return {
      valid: true,
      counters: { techLast, techPenultimate: 0, compLast, compPenultimate: 0, lastGroupNum: 2, penultimateGroupNum: 1 },
    };
  }

  // CASO 3: 3 o más Grupos de Calentamiento
  const lastGroup = totalGroups;
  const penultimateGroup = totalGroups - 1;

  const techLast = picks.filter(
    (p) => p.slotType === "TECHNICAL" && p.warmupGroup === lastGroup
  ).length;
  const techPenultimate = picks.filter(
    (p) => p.slotType === "TECHNICAL" && p.warmupGroup === penultimateGroup
  ).length;

  const compLast = picks.filter(
    (p) => p.slotType === "COMPONENT" && p.warmupGroup === lastGroup
  ).length;
  const compPenultimate = picks.filter(
    (p) => p.slotType === "COMPONENT" && p.warmupGroup === penultimateGroup
  ).length;

  const counters = {
    techLast,
    techPenultimate,
    compLast,
    compPenultimate,
    lastGroupNum: lastGroup,
    penultimateGroupNum: penultimateGroup,
  };

  if (techLast > 2) {
    return {
      valid: false,
      error: `Llevas ${techLast} patinadores del último grupo (G${lastGroup}) en técnica. El máximo permitido es 2.`,
      counters,
    };
  }

  if (techPenultimate > 2) {
    return {
      valid: false,
      error: `Llevas ${techPenultimate} patinadores del penúltimo grupo (G${penultimateGroup}) en técnica. El máximo permitido es 2.`,
      counters,
    };
  }

  if (compLast > 1) {
    return {
      valid: false,
      error: `En componentes solo puedes elegir como máximo 1 patinador del último grupo (G${lastGroup}).`,
      counters,
    };
  }

  if (compPenultimate > 1) {
    return {
      valid: false,
      error: `En componentes solo puedes elegir como máximo 1 patinador del penúltimo grupo (G${penultimateGroup}).`,
      counters,
    };
  }

  return { valid: true, counters };
}