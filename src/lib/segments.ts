// Plazos de fichaje por segmento — fuente única de verdad.
//
// Un Event tiene un rosterLocksAt general, pero cada Segment (Corto/Largo)
// puede tener su propio locksAt que lo sobreescribe. Si el segmento no
// tiene locksAt propio (null), hereda el del Event — así los eventos
// creados antes de esta feature, y cualquier segmento al que el admin no le
// haya puesto un plazo específico, siguen comportándose exactamente igual
// que antes (un único plazo para todo el evento).
//
// Se usa tanto en servidor (páginas, /api/fantasy/roster, /api/predictions)
// como en el formulario de picks, para que el plazo efectivo de cada
// segmento se calcule siempre de la misma forma.

export interface SegmentLockInput {
  id: string;
  order: number;
  locksAt: Date | string | null;
}

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** Plazo real de un segmento: el suyo propio, o si no tiene, el del evento. */
export function effectiveLocksAt(
  segment: SegmentLockInput,
  eventRosterLocksAt: Date | string
): Date {
  return segment.locksAt ? toDate(segment.locksAt) : toDate(eventRosterLocksAt);
}

/** Si el plazo efectivo de este segmento ya ha pasado. */
export function isSegmentLocked(
  segment: SegmentLockInput,
  eventRosterLocksAt: Date | string,
  now: Date = new Date()
): boolean {
  return now > effectiveLocksAt(segment, eventRosterLocksAt);
}

/**
 * Plazo efectivo del PRIMER segmento (menor `order`, el Corto) de un
 * evento — es la fuente del cierre de Predicciones, que siguen teniendo un
 * único plazo (no por segmento) pero ahora tomado de aquí en vez de
 * rosterLocksAt directamente, para que admita el mismo override que el
 * Fantasy. Si el evento no tiene segmentos, se usa rosterLocksAt tal cual.
 */
export function firstSegmentEffectiveLocksAt(
  segments: SegmentLockInput[],
  eventRosterLocksAt: Date | string
): Date {
  if (segments.length === 0) return toDate(eventRosterLocksAt);
  const [first] = [...segments].sort((a, b) => a.order - b.order);
  return effectiveLocksAt(first, eventRosterLocksAt);
}
