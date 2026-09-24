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