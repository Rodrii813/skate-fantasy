"use client";

import { useMemo } from "react";
import { useTimezone } from "./TimezoneProvider";
import { VENUE_TIMEZONE } from "@/lib/timezone";
import { groupCalendarRowsByVenueDay, type CalendarRow } from "@/lib/calendarGrouping";

// Cada fila del calendario ya viene renderizada desde el Server Component
// (con sus botones de Predicción/Draft/Resultados, traducciones, etc.) — este
// componente solo decide en QUÉ DÍA cae cada una y las agrupa, porque eso
// depende de la zona horaria de quien mira la página (ver el comentario en
// groupCalendarRowsByVenueDay). `node` es el <li>...</li> ya construido.
export interface CalendarDayRow {
  key: string;
  scheduledAt: string;
  node: React.ReactNode;
}

/**
 * Agrupa filas de calendario por día SEGÚN LA ZONA HORARIA de quien mira la
 * página, no la de la sede — un evento a las 20:00 en Paraguay es ya la
 * madrugada del día siguiente en España, y antes salía encuadrado en el día
 * de Paraguay aunque la hora mostrada (vía <LocalDateTime>) fuera la
 * española, lo cual desconcertaba ("sale a las 01:00 pero está en el bloque
 * del sábado"). Antes de montar en el cliente no se conoce esa zona (mismo
 * problema que <LocalDateTime>), así que se usa la de la sede como
 * marcador estable para que el HTML del servidor y el del cliente coincidan,
 * y se reagrupa con la zona real en cuanto se monta.
 */
export default function CalendarDayGroups({
  rows,
  emptyMessage,
  sectionClassName = "mt-8",
  headingClassName = "font-display text-lg font-semibold capitalize text-white",
  listClassName = "mt-3 space-y-2",
}: {
  rows: CalendarDayRow[];
  emptyMessage?: React.ReactNode;
  sectionClassName?: string;
  headingClassName?: string;
  listClassName?: string;
}) {
  const { timeZone, mounted } = useTimezone();
  const effectiveTimeZone = mounted ? timeZone : VENUE_TIMEZONE;

  const groups = useMemo(() => {
    const calendarRows: CalendarRow<CalendarDayRow>[] = rows.map((row) => ({
      scheduledAt: new Date(row.scheduledAt),
      rowLabel: null,
      segmentId: null,
      event: row,
    }));
    return groupCalendarRowsByVenueDay(calendarRows, effectiveTimeZone);
  }, [rows, effectiveTimeZone]);

  if (groups.length === 0) return emptyMessage ? <>{emptyMessage}</> : null;

  return (
    <>
      {groups.map((group) => (
        <section key={group.key} className={sectionClassName}>
          <h2 className={headingClassName}>{group.label}</h2>
          <ul className={listClassName}>
            {group.events.map((row) => (
              <li key={row.event.key}>{row.event.node}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
