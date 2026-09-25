export interface SlotTemplate {
  name: string;
  slotType: "TECHNICAL" | "COMPONENT";
  categoryCode: string;
  rule?: "BEST_1" | "BEST_2" | "AXEL_ONLY" | "SUM_ALL" | "COMBINED_PCS";
}

// 1. PROGRAMA CORTO (SHORT PROGRAM)
export const FREE_SKATING_SHORT_SLOTS: SlotTemplate[] = [
  // Técnica (5 slots)
  { name: "Combo Jump", slotType: "TECHNICAL", categoryCode: "COMBO_JUMP", rule: "BEST_1" },
  { name: "Solo Jump", slotType: "TECHNICAL", categoryCode: "SOLO_JUMP", rule: "BEST_1" },
  { name: "Axel", slotType: "TECHNICAL", categoryCode: "AXEL_JUMP", rule: "AXEL_ONLY" },
  { name: "Spins (Piruetas)", slotType: "TECHNICAL", categoryCode: "SPINS_TOTAL", rule: "BEST_1" },
  { name: "Step Sequence (St)", slotType: "TECHNICAL", categoryCode: "STEP_SEQUENCE", rule: "BEST_1" },

  // Componentes (2 slots agrupados)
  { name: "Skating Skills + Transitions", slotType: "COMPONENT", categoryCode: "PCS_SKATING_TRANSITIONS", rule: "COMBINED_PCS" },
  { name: "Performance + Choreography", slotType: "COMPONENT", categoryCode: "PCS_PERFORMANCE_CHOREO", rule: "COMBINED_PCS" },
];

// 2. PROGRAMA LARGO (FREE PROGRAM)
export const FREE_SKATING_LONG_SLOTS: SlotTemplate[] = [
  // Técnica (6 slots)
  { name: "Combo Jump 1", slotType: "TECHNICAL", categoryCode: "COMBO_JUMP", rule: "BEST_1" },
  { name: "Combo Jump 2", slotType: "TECHNICAL", categoryCode: "COMBO_JUMP", rule: "BEST_2" },
  { name: "Solo Jump 1", slotType: "TECHNICAL", categoryCode: "SOLO_JUMP", rule: "BEST_1" },
  { name: "Solo Jump 2", slotType: "TECHNICAL", categoryCode: "SOLO_JUMP", rule: "BEST_2" },
  { name: "Spins (Piruetas)", slotType: "TECHNICAL", categoryCode: "SPINS_TOTAL", rule: "BEST_1" },
  { name: "Choreo Sequence (ChSt)", slotType: "TECHNICAL", categoryCode: "CHOREO_SEQUENCE", rule: "BEST_1" },

  // Componentes (2 slots agrupados)
  { name: "Skating Skills + Transitions", slotType: "COMPONENT", categoryCode: "PCS_SKATING_TRANSITIONS", rule: "COMBINED_PCS" },
  { name: "Performance + Choreography", slotType: "COMPONENT", categoryCode: "PCS_PERFORMANCE_CHOREO", rule: "COMBINED_PCS" },
];

// 3. SOLO DANZA — STYLE DANCE
// Misma mecánica que Libre (un slot por elemento técnico + 2 slots de
// componentes agrupados), pero con los elementos propios de Danza en vez de
// saltos/giros. Nombres y elementos confirmados por el usuario.
export const SOLO_DANCE_STYLE_SLOTS: SlotTemplate[] = [
  // Técnica (5 slots)
  { name: "Pattern Sequence", slotType: "TECHNICAL", categoryCode: "PATTERN_SEQUENCE", rule: "BEST_1" },
  { name: "Cluster", slotType: "TECHNICAL", categoryCode: "CLUSTER", rule: "BEST_1" },
  { name: "Traveling", slotType: "TECHNICAL", categoryCode: "TRAVELING", rule: "BEST_1" },
  { name: "Choreo Stop", slotType: "TECHNICAL", categoryCode: "CHOREO_STOP", rule: "BEST_1" },
  { name: "Art Sequence", slotType: "TECHNICAL", categoryCode: "ART_SEQUENCE", rule: "BEST_1" },

  // Componentes (2 slots agrupados, igual que en Libre)
  { name: "Skating Skills + Transitions", slotType: "COMPONENT", categoryCode: "PCS_SKATING_TRANSITIONS", rule: "COMBINED_PCS" },
  { name: "Performance + Choreography", slotType: "COMPONENT", categoryCode: "PCS_PERFORMANCE_CHOREO", rule: "COMBINED_PCS" },
];

// 4. SOLO DANZA — FREEDANCE
export const SOLO_DANCE_FREE_SLOTS: SlotTemplate[] = [
  // Técnica (5 slots)
  { name: "Foot Sequence", slotType: "TECHNICAL", categoryCode: "FOOT_SEQUENCE", rule: "BEST_1" },
  { name: "Cluster", slotType: "TECHNICAL", categoryCode: "CLUSTER", rule: "BEST_1" },
  { name: "Traveling", slotType: "TECHNICAL", categoryCode: "TRAVELING", rule: "BEST_1" },
  { name: "Choreo Stop", slotType: "TECHNICAL", categoryCode: "CHOREO_STOP", rule: "BEST_1" },
  { name: "Dance Step", slotType: "TECHNICAL", categoryCode: "DANCE_STEP", rule: "BEST_1" },

  // Componentes (2 slots agrupados, igual que en Libre)
  { name: "Skating Skills + Transitions", slotType: "COMPONENT", categoryCode: "PCS_SKATING_TRANSITIONS", rule: "COMBINED_PCS" },
  { name: "Performance + Choreography", slotType: "COMPONENT", categoryCode: "PCS_PERFORMANCE_CHOREO", rule: "COMBINED_PCS" },
];