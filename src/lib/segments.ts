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

// Un segmento puede además tener su propia hora de APERTURA (opensAt) y un
// override manual (manuallyOpened) para saltársela. Es un input aparte
// (SegmentOpenInput) porque no todos los sitios que ya usaban
// SegmentLockInput (locksAt) tienen estos dos campos cargados desde Prisma
// — así no hace falta tocar esas llamadas existentes.
export interface SegmentOpenInput {
  id: string;
  opensAt: Date | string | null;
  manuallyOpened: boolean;
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
 * Si el segmento ya está abierto para draftear, mirando SOLO la apertura
 * (no el cierre): true si el admin lo abrió a mano, o si no tiene
 * `opensAt` propio (se abre en cuanto existen sus slots — comportamiento
 * de siempre), o si `opensAt` ya ha pasado.
 */
export function isSegmentOpenByTime(
  segment: SegmentOpenInput,
  now: Date = new Date()
): boolean {
  if (segment.manuallyOpened) return true;
  if (!segment.opensAt) return true;
  return now >= toDate(segment.opensAt);
}

export type SegmentDraftStatus = "UPCOMING" | "OPEN" | "CLOSED";

/**
 * Estado real del draft de un segmento, combinando las tres señales:
 * - Si no hay slots generados todavía, siempre es UPCOMING (no hay nada que
 *   draftear todavía, da igual lo que digan las fechas).
 * - Si el plazo de cierre ya pasó, es CLOSED (el cierre manda sobre todo lo
 *   demás, incluida una apertura manual anterior).
 * - Si no, depende de si ya llegó `opensAt` (o se abrió a mano): OPEN si sí,
 *   UPCOMING si todavía no.
 */
export function getSegmentDraftStatus(
  segment: SegmentLockInput & SegmentOpenInput,
  eventRosterLocksAt: Date | string,
  hasSlots: boolean,
  now: Date = new Date()
): SegmentDraftStatus {
  if (!hasSlots) return "UPCOMING";
  if (isSegmentLocked(segment, eventRosterLocksAt, now)) return "CLOSED";
  return isSegmentOpenByTime(segment, now) ? "OPEN" : "UPCOMING";
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
