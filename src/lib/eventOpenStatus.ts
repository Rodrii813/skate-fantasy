import {
  effectiveLocksAt,
  firstSegmentEffectiveLocksAt,
  getPredictionsStatus,
  getSegmentDraftStatus,
  type PredictionsOpenInput,
  type SegmentLockInput,
  type SegmentOpenInput,
} from "./segments";

// Calcula si Predicciones y/o Draft están REALMENTE abiertos para un evento,
// con sus fechas de cierre correctas — antes esta lógica vivía duplicada (y
// mal) directamente en la home (ver page.tsx): usaba rosterLocksAt como
// "cierre de picks" para TODO, cuando en realidad Predicciones cierra en el
// plazo efectivo del primer segmento (firstSegmentEffectiveLocksAt), que
// puede ser distinto (normalmente antes) de rosterLocksAt. Centralizarlo
// aquí es lo que permite reutilizar el mismo criterio tanto en el banner
// destacado de la home como en la lista de "en directo ahora".
export type SegmentForStatus = SegmentLockInput & SegmentOpenInput;

export interface EventForStatus extends PredictionsOpenInput {
  status: string;
  rosterLocksAt: Date | string;
  segments: SegmentForStatus[];
  slots: { segmentId: string | null }[];
  // Patinadores inscritos: sin ninguno, las Predicciones no están abiertas
  // (formulario vacío) — ver getPredictionsStatus.
  _count: { registrations: number };
}

export interface EventOpenStatus {
  predictionsOpen: boolean;
  draftOpen: boolean;
  predictionsCloseAt: Date;
  draftCloseAt: Date;
}

export function computeEventOpenStatus(event: EventForStatus, now: Date = new Date()): EventOpenStatus {
  const predictionsCloseAt = firstSegmentEffectiveLocksAt(event.segments, event.rosterLocksAt);
  const predictionsOpen =
    getPredictionsStatus(event, event.segments, event._count.registrations, now) === "OPEN";

  const slotsBySegment = new Map<string, number>();
  for (const slot of event.slots) {
    if (slot.segmentId) slotsBySegment.set(slot.segmentId, (slotsBySegment.get(slot.segmentId) || 0) + 1);
  }
  const segStatus = event.segments.map((seg) => ({
    seg,
    status: getSegmentDraftStatus(seg, event.rosterLocksAt, (slotsBySegment.get(seg.id) || 0) > 0, now),
  }));
  const draftOpen = segStatus.some((x) => x.status === "OPEN");

  // Cierre del draft = plazo EFECTIVO del segmento que importa (el override
  // del segmento si lo tiene, y si no el del evento). Antes se usaba siempre
  // rosterLocksAt, que ignora el plazo propio del segmento y no coincidía con
  // el de Predicciones ni con el cierre real. Se toma, por orden: el primer
  // segmento abierto, si no el primero aún por abrir, si no el primero.
  const bySegOrder = [...segStatus].sort((a, b) => a.seg.order - b.seg.order);
  const target =
    bySegOrder.find((x) => x.status === "OPEN") ??
    bySegOrder.find((x) => x.status === "UPCOMING") ??
    bySegOrder[0];
  const draftCloseAt = target
    ? effectiveLocksAt(target.seg, event.rosterLocksAt)
    : typeof event.rosterLocksAt === "string"
    ? new Date(event.rosterLocksAt)
    : event.rosterLocksAt;

  return { predictionsOpen, draftOpen, predictionsCloseAt, draftCloseAt };
}
