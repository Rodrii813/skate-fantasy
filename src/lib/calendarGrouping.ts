import { formatInTimeZone, VENUE_TIMEZONE } from "@/lib/timezone";

export interface DayGroup<T> {
  key: string;
  label: string;
  events: T[];
}

/**
 * Agrupa una lista de eventos por su día de calendario EN LA SEDE
 * (Paraguay), no en UTC ni en la zona de quien mira la página — el
 * "programa del sábado" es el sábado en Asunción para todo el mundo, igual
 * que un cartel de competición real. Se usa tanto en /calendario (todos los
 * eventos) como en /competitions/[id] (solo los de esa competición), para
 * no duplicar el criterio de agrupación.
 */
export function groupEventsByVenueDay<T extends { scheduledAt: Date | null }>(
  events: T[]
): DayGroup<T>[] {
  const scheduled = events
    .filter((e): e is T & { scheduledAt: Date } => Boolean(e.scheduledAt))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const dayGroups: DayGroup<T>[] = [];
  for (const event of scheduled) {
    const key = formatInTimeZone(event.scheduledAt, VENUE_TIMEZONE, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    let group = dayGroups.find((g) => g.key === key);
    if (!group) {
      const label = formatInTimeZone(event.scheduledAt, VENUE_TIMEZONE, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      group = { key, label, events: [] };
      dayGroups.push(group);
    }
    group.events.push(event);
  }

  return dayGroups;
}

export interface CalendarSegmentInput {
  id: string;
  name: string;
  order: number;
  scheduledAt: Date | null;
  scheduleLabel: string | null;
  splitLabel: string | null;
  splitScheduledAt: Date | null;
}

export interface CalendarEventInput {
  scheduledAt: Date | null;
  segments?: CalendarSegmentInput[];
}

// Una fila del calendario: normalmente es "el evento entero" (rowLabel y
// segmentId null), pero cuando el propio evento tiene segmentos con SU
// PROPIA hora de pista (Corto y Largo van a horas distintas, o el Largo está
// partido en "Top 10"/"Less Top 10"), pasa a ser una fila por cada bloque
// horario, todas apuntando al mismo evento (mismo roster de Fantasy, mismos
// resultados) pero con el segmentId concreto de ese bloque, para poder
// enlazar directamente a la pestaña correcta del Fantasy.
export interface CalendarRow<T> {
  scheduledAt: Date;
  rowLabel: string | null;
  segmentId: string | null;
  event: T;
}

// "Long Program" + "Top 10" -> "Long Program Top 10" (sin paréntesis, pegado
// al nombre del segmento, tal como se ve en un cartel de competición real).
function labelFor(segmentName: string, suffix: string | null): string {
  return suffix ? `${segmentName} ${suffix}` : segmentName;
}

/**
 * Aplana un evento en una o varias filas de calendario, según tenga o no
 * segmentos con hora propia:
 *
 * - Si NINGÚN segmento tiene `scheduledAt` propio, se genera 1 fila con la
 *   hora del evento entero (`event.scheduledAt`) — comportamiento de
 *   siempre, para no romper ningún evento ya creado.
 * - Si ALGÚN segmento tiene `scheduledAt` propio (p.ej. Corto y Largo van a
 *   horas distintas), se genera 1 fila por cada segmento QUE TENGA su
 *   propia hora — por eso, cuando se activa esto, hay que rellenar
 *   `scheduledAt` en TODOS los segmentos relevantes del evento, no solo en
 *   uno, o los demás no aparecerán en el calendario.
 * - Si además ese segmento tiene `splitLabel` + `splitScheduledAt` (p.ej.
 *   el Largo se patina en dos bloques: "Top 10" más tarde y "Less Top 10"
 *   antes), se genera una fila EXTRA para ese bloque — mismo evento, mismos
 *   picks de Fantasy y un único resultado, solo cambia a qué hora se
 *   patina cada grupo. `scheduleLabel` es la etiqueta del bloque "base" (el
 *   de `scheduledAt`) y `splitLabel` la del bloque extra.
 */
export function buildCalendarRows<T extends CalendarEventInput>(events: T[]): CalendarRow<T>[] {
  const rows: CalendarRow<T>[] = [];

  for (const event of events) {
    const scheduledSegments = (event.segments || [])
      .filter((s) => s.scheduledAt)
      .sort((a, b) => a.order - b.order);

    if (scheduledSegments.length === 0) {
      if (event.scheduledAt) {
        rows.push({ scheduledAt: event.scheduledAt, rowLabel: null, segmentId: null, event });
      }
      continue;
    }

    for (const segment of scheduledSegments) {
      rows.push({
        scheduledAt: segment.scheduledAt as Date,
        rowLabel: labelFor(segment.name, segment.scheduleLabel),
        segmentId: segment.id,
        event,
      });

      if (segment.splitLabel && segment.splitScheduledAt) {
        rows.push({
          scheduledAt: segment.splitScheduledAt,
          rowLabel: labelFor(segment.name, segment.splitLabel),
          segmentId: segment.id,
          event,
        });
      }
    }
  }

  return rows;
}

/**
 * Como groupEventsByVenueDay, pero a partir de filas ya aplanadas con
 * buildCalendarRows (una fila puede ser un segmento/bloque suelto, no
 * necesariamente "el evento entero").
 */
export function groupCalendarRowsByVenueDay<T>(rows: CalendarRow<T>[]): DayGroup<CalendarRow<T>>[] {
  const sorted = [...rows].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const dayGroups: DayGroup<CalendarRow<T>>[] = [];
  for (const row of sorted) {
    const key = formatInTimeZone(row.scheduledAt, VENUE_TIMEZONE, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    let group = dayGroups.find((g) => g.key === key);
    if (!group) {
      const label = formatInTimeZone(row.scheduledAt, VENUE_TIMEZONE, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      group = { key, label, events: [] };
      dayGroups.push(group);
    }
    group.events.push(row);
  }

  return dayGroups;
}
