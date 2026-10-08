import {
  effectiveLocksAt,
  getSegmentDraftStatus,
  type SegmentLockInput,
  type SegmentOpenInput,
} from "./segments";

// Decide qué avisos automáticos tocan para un segmento en este momento.
// Función pura (sin base de datos) para poder probarla; el envío real y la
// deduplicación están en autoNotify.ts.

export const OPEN_WINDOW_MIN = 90; // "se ha abierto" solo si fue hace menos de esto
export const CLOSING_WINDOW_MIN = 60; // "cierra pronto" cuando quede esto o menos

export interface SegmentNotifyDecision {
  opened: boolean;
  closingSoon: boolean;
  minutesLeft: number | null;
}

function toDate(v: Date | string): Date {
  return typeof v === "string" ? new Date(v) : v;
}

export function decideSegmentNotifications(
  segment: SegmentLockInput & SegmentOpenInput,
  eventRosterLocksAt: Date | string,
  hasSlots: boolean,
  now: Date = new Date()
): SegmentNotifyDecision {
  const status = getSegmentDraftStatus(segment, eventRosterLocksAt, hasSlots, now);
  if (status !== "OPEN") return { opened: false, closingSoon: false, minutesLeft: null };

  // Apertura: solo si tiene hora de apertura propia reciente. Las aperturas
  // manuales o sin fecha no se pueden datar, así que no avisan solas.
  let opened = false;
  if (segment.opensAt) {
    const minutesSinceOpen = (now.getTime() - toDate(segment.opensAt).getTime()) / 60000;
    opened = minutesSinceOpen >= 0 && minutesSinceOpen <= OPEN_WINDOW_MIN;
  }

  const minutesLeft = (effectiveLocksAt(segment, eventRosterLocksAt).getTime() - now.getTime()) / 60000;
  const closingSoon = minutesLeft > 0 && minutesLeft <= CLOSING_WINDOW_MIN;

  return { opened, closingSoon, minutesLeft: Math.round(minutesLeft) };
}
