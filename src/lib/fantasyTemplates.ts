export interface SlotTemplate {
  name: string;
  slotType: "TECHNICAL" | "COMPONENT";
  categoryCode: string;
  rule?: "BEST_1" | "BEST_2" | "AXEL_ONLY" | "SUM_ALL" | "COMBINED_PCS" | "SINGLE_PCS";
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

// 5. PAREJAS — SHORT PROGRAM
// Elementos propios de Parejas (Death Spiral, Twist, Lifts, Throw Jumps...
// no existen en Libre/Inline). Componentes: mismos 2 grupos que en el resto
// de disciplinas. OJO: el usuario ha avisado de que la lectura de los PDFs
// de resultados para Parejas tiene particularidades más complejas que se
// revisarán aparte cuando lleguen esos PDFs reales — esto de aquí es solo
// la plantilla de slots del Fantasy (qué eliges), no el parser de PDFs.
//
// "Jumps" era un único slot genérico que mezclaba el salto side-by-side
// (ambos patinadores saltan a la vez) con el throw jump (élla es lanzada) —
// dos elementos distintos del Programa Corto real, cada uno con su propia
// nota. Separados en 2 slots (decisión confirmada por el usuario) para
// poder draftear cada uno por separado, igual que ya se hace con Combo
// Jump / Solo Jump en Libre. Usa los mismos nombres/categoryCode que el
// Programa Largo (más abajo) para compartir la misma ElementCategory.
export const PAIRS_SHORT_SLOTS: SlotTemplate[] = [
  // Técnica (6 slots)
  { name: "Side by Side Jump", slotType: "TECHNICAL", categoryCode: "SIDE_BY_SIDE_JUMP", rule: "BEST_1" },
  { name: "Throw Jump", slotType: "TECHNICAL", categoryCode: "THROW_JUMP", rule: "BEST_1" },
  { name: "Step Sequence", slotType: "TECHNICAL", categoryCode: "STEP_SEQUENCE", rule: "BEST_1" },
  { name: "Lifts", slotType: "TECHNICAL", categoryCode: "LIFTS", rule: "BEST_1" },
  { name: "Death Spiral", slotType: "TECHNICAL", categoryCode: "DEATH_SPIRAL", rule: "BEST_1" },
  { name: "Combo Spin", slotType: "TECHNICAL", categoryCode: "COMBO_SPIN", rule: "BEST_1" },

  // Componentes (2 slots agrupados, igual que en el resto de disciplinas)
  { name: "Skating Skills + Transitions", slotType: "COMPONENT", categoryCode: "PCS_SKATING_TRANSITIONS", rule: "COMBINED_PCS" },
  { name: "Performance + Choreography", slotType: "COMPONENT", categoryCode: "PCS_PERFORMANCE_CHOREO", rule: "COMBINED_PCS" },
];

// 6. PAREJAS — FREE PROGRAM
// "Jumps" y "Throw Jumps" pasan a llamarse igual que en el Programa Corto
// ("Side by Side Jump" / "Throw Jump", en singular) para que ambos
// segmentos compartan la misma ElementCategory en vez de crear una
// duplicada solo por el nombre. Se añade "Combo Spin", que faltaba del
// todo — el Programa Largo de Parejas SÍ incluye un combo spin (visto en
// las actas reales que pasó el usuario) y antes no tenía ningún slot para
// draftearlo.
export const PAIRS_FREE_SLOTS: SlotTemplate[] = [
  // Técnica (7 slots)
  { name: "Death Spiral", slotType: "TECHNICAL", categoryCode: "DEATH_SPIRAL", rule: "BEST_1" },
  { name: "Twist", slotType: "TECHNICAL", categoryCode: "TWIST", rule: "BEST_1" },
  { name: "Side by Side Jump", slotType: "TECHNICAL", categoryCode: "SIDE_BY_SIDE_JUMP", rule: "BEST_1" },
  { name: "Throw Jump", slotType: "TECHNICAL", categoryCode: "THROW_JUMP", rule: "BEST_1" },
  { name: "Choreo Step", slotType: "TECHNICAL", categoryCode: "CHOREO_STEP", rule: "BEST_1" },
  { name: "Lifts", slotType: "TECHNICAL", categoryCode: "LIFTS", rule: "BEST_1" },
  { name: "Combo Spin", slotType: "TECHNICAL", categoryCode: "COMBO_SPIN", rule: "BEST_1" },

  // Componentes (2 slots agrupados, igual que en el resto de disciplinas)
  { name: "Skating Skills + Transitions", slotType: "COMPONENT", categoryCode: "PCS_SKATING_TRANSITIONS", rule: "COMBINED_PCS" },
  { name: "Performance + Choreography", slotType: "COMPONENT", categoryCode: "PCS_PERFORMANCE_CHOREO", rule: "COMBINED_PCS" },
];

// 7. PAREJA DANZA — STYLE DANCE
export const COUPLE_DANCE_STYLE_SLOTS: SlotTemplate[] = [
  // Técnica (5 slots)
  { name: "Cluster", slotType: "TECHNICAL", categoryCode: "CLUSTER", rule: "BEST_1" },
  { name: "Choreo Stop", slotType: "TECHNICAL", categoryCode: "CHOREO_STOP", rule: "BEST_1" },
  { name: "Pattern Sequence", slotType: "TECHNICAL", categoryCode: "PATTERN_SEQUENCE", rule: "BEST_1" },
  { name: "Lift", slotType: "TECHNICAL", categoryCode: "LIFT", rule: "BEST_1" },
  { name: "Hold Sequence", slotType: "TECHNICAL", categoryCode: "HOLD_SEQUENCE", rule: "BEST_1" },

  // Componentes (2 slots agrupados, igual que en el resto de disciplinas)
  { name: "Skating Skills + Transitions", slotType: "COMPONENT", categoryCode: "PCS_SKATING_TRANSITIONS", rule: "COMBINED_PCS" },
  { name: "Performance + Choreography", slotType: "COMPONENT", categoryCode: "PCS_PERFORMANCE_CHOREO", rule: "COMBINED_PCS" },
];

// 8. PAREJA DANZA — FREE DANCE
export const COUPLE_DANCE_FREE_SLOTS: SlotTemplate[] = [
  // Técnica (5 slots)
  { name: "Lifts", slotType: "TECHNICAL", categoryCode: "LIFT", rule: "BEST_1" },
  { name: "Cluster", slotType: "TECHNICAL", categoryCode: "CLUSTER", rule: "BEST_1" },
  { name: "No Hold Sequence", slotType: "TECHNICAL", categoryCode: "NO_HOLD_SEQUENCE", rule: "BEST_1" },
  { name: "Choreo Stop", slotType: "TECHNICAL", categoryCode: "CHOREO_STOP", rule: "BEST_1" },
  { name: "Traveling", slotType: "TECHNICAL", categoryCode: "TRAVELING", rule: "BEST_1" },

  // Componentes (2 slots agrupados, igual que en el resto de disciplinas)
  { name: "Skating Skills + Transitions", slotType: "COMPONENT", categoryCode: "PCS_SKATING_TRANSITIONS", rule: "COMBINED_PCS" },
  { name: "Performance + Choreography", slotType: "COMPONENT", categoryCode: "PCS_PERFORMANCE_CHOREO", rule: "COMBINED_PCS" },
];

// 9. SHOW — CUARTETOS
// Único formato de Show que sí tiene elementos técnicos propios (Creative,
// Canon...). Los componentes son los mismos 2 grupos combinados que en el
// resto de disciplinas.
export const SHOW_QUARTET_SLOTS: SlotTemplate[] = [
  // Técnica (4 slots)
  { name: "Creative", slotType: "TECHNICAL", categoryCode: "CREATIVE", rule: "BEST_1" },
  { name: "Canon", slotType: "TECHNICAL", categoryCode: "CANON", rule: "BEST_1" },
  { name: "Traveling", slotType: "TECHNICAL", categoryCode: "TRAVELING", rule: "BEST_1" },
  { name: "Cluster", slotType: "TECHNICAL", categoryCode: "CLUSTER", rule: "BEST_1" },

  // Componentes (2 slots agrupados, igual que en el resto de disciplinas)
  { name: "Skating Skills + Transitions", slotType: "COMPONENT", categoryCode: "PCS_SKATING_TRANSITIONS", rule: "COMBINED_PCS" },
  { name: "Performance + Choreography", slotType: "COMPONENT", categoryCode: "PCS_PERFORMANCE_CHOREO", rule: "COMBINED_PCS" },
];

// 9b. PRECISIÓN
// Programa único (sin Corto/Largo, como Show), con una lista FIJA de 8
// elementos técnicos que todo equipo incluye (confirmado por el usuario a
// partir de un protocolo real: los códigos W4/L4/PB3... son solo el nivel
// elegido para cada elemento, no cambian la categoría). Componentes
// agrupados de 2 en 2, igual que en el resto de disciplinas (no como Show).
export const PRECISION_SLOTS: SlotTemplate[] = [
  // Técnica (8 slots)
  { name: "Rotating Wheel", slotType: "TECHNICAL", categoryCode: "WHEEL", rule: "BEST_1" },
  { name: "Linear Line", slotType: "TECHNICAL", categoryCode: "LINE", rule: "BEST_1" },
  { name: "Pivoting Block", slotType: "TECHNICAL", categoryCode: "BLOCK", rule: "BEST_1" },
  { name: "Move Element", slotType: "TECHNICAL", categoryCode: "MOVE_ELEMENT", rule: "BEST_1" },
  { name: "Intersection", slotType: "TECHNICAL", categoryCode: "INTERSECTION", rule: "BEST_1" },
  { name: "Traveling", slotType: "TECHNICAL", categoryCode: "TRAVELING", rule: "BEST_1" },
  { name: "Creative", slotType: "TECHNICAL", categoryCode: "CREATIVE", rule: "BEST_1" },
  { name: "No Hold Element", slotType: "TECHNICAL", categoryCode: "NO_HOLD_ELEMENT", rule: "BEST_1" },

  // Componentes (2 slots agrupados, igual que en el resto de disciplinas)
  { name: "Skating Skills + Transitions", slotType: "COMPONENT", categoryCode: "PCS_SKATING_TRANSITIONS", rule: "COMBINED_PCS" },
  { name: "Performance + Choreography", slotType: "COMPONENT", categoryCode: "PCS_PERFORMANCE_CHOREO", rule: "COMBINED_PCS" },
];

// 10. SHOW — GRUPOS PEQUEÑOS y GRUPOS GRANDES
// Sin elementos técnicos: todo el programa se puntúa por 4 categorías de
// Componentes, cada una en SU PROPIO slot (a diferencia del resto de
// disciplinas, donde los componentes se agrupan de 2 en 2). Grupos Pequeños
// y Grupos Grandes usan exactamente la misma lista — el usuario ha
// confirmado que son idénticos en estructura de slots.
export const SHOW_GROUP_SLOTS: SlotTemplate[] = [
  { name: "Skating Skills", slotType: "COMPONENT", categoryCode: "PCS_SKATING_SKILLS_SHOW", rule: "SINGLE_PCS" },
  { name: "Group Technique", slotType: "COMPONENT", categoryCode: "PCS_GROUP_TECHNIQUE", rule: "SINGLE_PCS" },
  { name: "Performance", slotType: "COMPONENT", categoryCode: "PCS_PERFORMANCE_SHOW", rule: "SINGLE_PCS" },
  { name: "Idea and Choreography", slotType: "COMPONENT", categoryCode: "PCS_IDEA_CHOREOGRAPHY", rule: "SINGLE_PCS" },
];

// Lookup inverso name → slotType, construido una sola vez a partir de TODAS
// las plantillas de arriba. Se usa para separar, en pantalla, los picks ya
// guardados de un usuario (FantasySlot.label — ver generate-slots/route.ts,
// que crea cada slot con `label: t.name`, el mismo `name` que aquí) en
// "Elements" (técnica) y "Components", sin tener que guardar el tipo en la
// base de datos (el slot ya no "sabe" de qué plantilla vino una vez creado).
const ALL_SLOT_TEMPLATES: SlotTemplate[] = [
  ...FREE_SKATING_SHORT_SLOTS,
  ...FREE_SKATING_LONG_SLOTS,
  ...SOLO_DANCE_STYLE_SLOTS,
  ...SOLO_DANCE_FREE_SLOTS,
  ...PAIRS_SHORT_SLOTS,
  ...PAIRS_FREE_SLOTS,
  ...COUPLE_DANCE_STYLE_SLOTS,
  ...COUPLE_DANCE_FREE_SLOTS,
  ...SHOW_QUARTET_SLOTS,
  ...PRECISION_SLOTS,
  ...SHOW_GROUP_SLOTS,
];

const SLOT_TYPE_BY_LABEL: Record<string, "TECHNICAL" | "COMPONENT"> = {};
for (const t of ALL_SLOT_TEMPLATES) {
  if (!(t.name in SLOT_TYPE_BY_LABEL)) SLOT_TYPE_BY_LABEL[t.name] = t.slotType;
}

/**
 * "TECHNICAL" (Elements) o "COMPONENT" según la etiqueta del slot
 * (FantasySlot.label / ElementCategory.name). Si la etiqueta no se
 * reconoce (plantilla editada a mano desde el admin, por ejemplo), cae en
 * "TECHNICAL" por ser el grupo más numeroso — así ese pick sigue apareciendo
 * en algún sitio en vez de desaparecer silenciosamente.
 */
export function getSlotTypeByLabel(label: string): "TECHNICAL" | "COMPONENT" {
  return SLOT_TYPE_BY_LABEL[label] ?? "TECHNICAL";
}