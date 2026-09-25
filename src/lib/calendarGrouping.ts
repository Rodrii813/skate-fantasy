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
