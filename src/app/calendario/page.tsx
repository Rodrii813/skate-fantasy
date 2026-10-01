import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LocalDateTime from "@/app/_components/LocalDateTime";
import TimezoneSelector from "@/app/_components/TimezoneSelector";
import CalendarDayGroups, { type CalendarDayRow } from "@/app/_components/CalendarDayGroups";
import { buildCalendarRows } from "@/lib/calendarGrouping";
import { firstSegmentEffectiveLocksAt, getSegmentDraftStatus } from "@/lib/segments";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = getDictionary(getLocale()).meta.calendario;
  return { title: t.title, description: t.description };
}

export default async function CalendarioPage() {
  const dict = getDictionary(getLocale());
  const t = dict.calendario;
  const statusLabel = dict.common.status;
  const genderLabel = dict.common.gender;

  const events = await prisma.event.findMany({
    // Los eventos marcados como "de prueba" (ver admin/events) no son
    // competición real, así que no pintan nada en el calendario público —
    // quedaría raro un "evento" ahí en medio de fechas reales. Siguen
    // existiendo y siendo accesibles desde /fantasy y /predictions (con su
    // aviso 🧪), que es donde de verdad sirven para practicar.
    where: { isTest: false },
    include: {
      competition: true,
      discipline: true,
      category: true,
      segments: { orderBy: { order: "asc" } },
      slots: { select: { segmentId: true } },
    },
  });

  const now = new Date();

  // Predicción abierta = mismo criterio real que usa /predictions para
  // aceptar envíos (ver isLocked ahí): evento sin bloquear y todavía
  // UPCOMING. El badge de estado del evento (statusLabel) NO sirve para
  // esto — es el estado general del evento (En pista/Resultados/Finalizado),
  // no si los picks siguen abiertos, así que antes este botón salía siempre
  // en azul "activo" aunque el plazo ya hubiera pasado.
  function isPredictionsOpen(event: (typeof events)[number]): boolean {
    return (
      event.status === "UPCOMING" &&
      now <= firstSegmentEffectiveLocksAt(event.segments, event.rosterLocksAt)
    );
  }

  // Draft (Fantasy) abierto = al menos un segmento realmente OPEN ahora
  // mismo (con slots generados, ya abierto por hora/manual, y sin bloquear)
  // — mismo criterio que getSegmentDraftStatus usa en /fantasy. Antes el
  // botón de Draft no comprobaba nada de esto.
  function isDraftOpen(event: (typeof events)[number]): boolean {
    const slotsBySegment = new Map<string, number>();
    for (const slot of event.slots) {
      if (slot.segmentId) slotsBySegment.set(slot.segmentId, (slotsBySegment.get(slot.segmentId) || 0) + 1);
    }
    return event.segments.some(
      (seg) =>
        getSegmentDraftStatus(seg, event.rosterLocksAt, (slotsBySegment.get(seg.id) || 0) > 0, now) === "OPEN"
    );
  }

  // Una fila del calendario normalmente es "el evento entero", pero cuando
  // sus segmentos tienen hora de pista propia (Corto/Largo a horas
  // distintas, o el Largo partido en "Top 10"/"Resto"), un mismo evento
  // aparece en varias filas — ver src/lib/calendarGrouping.ts.
  const rows = buildCalendarRows(events);
  const scheduledEventIds = new Set(rows.map((r) => r.event.id));
  const unscheduled = events.filter((e) => !scheduledEventIds.has(e.id));

  // Tanto la HORA de cada fila como el DÍA en el que se agrupa varían según
  // la zona horaria de quien mira la página — ver CalendarDayGroups.tsx.
  // Cada fila se renderiza aquí (con sus datos y traducciones ya resueltos)
  // y se le pasa a ese componente cliente solo para decidir el agrupado.
  const calendarRows: CalendarDayRow[] = rows.map((row, i) => {
    const event = row.event;
    return {
      key: `${event.id}-${i}`,
      scheduledAt: row.scheduledAt.toISOString(),
      competitionName: event.competition.name,
      disciplineName: event.discipline.name,
      status: event.status,
      node: (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/25 hover:bg-white/10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <LocalDateTime
                value={row.scheduledAt}
                options={{ hour: "2-digit", minute: "2-digit" }}
                className="font-display w-14 shrink-0 text-lg font-semibold text-gold"
              />
              <div>
                <p className="text-xs uppercase tracking-wide text-accent">
                  {event.competition.name}
                </p>
                <p className="font-display text-base font-semibold text-white">
                  {event.name}
                  {row.rowLabel && (
                    <span className="ml-2 text-sm font-normal text-ice-100/60">
                      — {row.rowLabel}
                    </span>
                  )}
                </p>
                <p className="text-sm text-ice-100/60">
                  {event.discipline.name} · {event.category.name}
                  {event.gender ? ` · ${genderLabel[event.gender]}` : ""}
                </p>
              </div>
            </div>
            <span className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1 text-xs text-ice-100/80">
              {statusLabel[event.status]}
            </span>
          </div>
          {/* Botones de acceso directo a Predicción, Draft y
              Resultados de esta prueba, sin salir del calendario para
              llegar a la ficha completa del evento. */}
          <div className="mt-2.5 pl-[4.5rem] flex flex-wrap items-center gap-2">
            <Link
              href={`/predictions?event=${event.id}`}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1 ${
                isPredictionsOpen(event)
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-900/30"
                  : "bg-white/5 hover:bg-white/10 text-ice-100/40 border border-white/10"
              }`}
            >
              {t.prediction}
            </Link>
            <Link
              href={`/events/${event.id}${row.segmentId ? `?segment=${row.segmentId}` : ""}`}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1 ${
                isDraftOpen(event)
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-900/30"
                  : "bg-white/5 hover:bg-white/10 text-ice-100/40 border border-white/10"
              }`}
            >
              {t.draft}
            </Link>
            {/* Mientras el evento no tiene resultados publicados (aún
                no ha empezado o está en pista) se ofrece el Orden de
                Salida; el botón de Resultados solo aparece cuando el
                admin ya subió las puntuaciones. */}
            {event.status === "RESULTS_IN" || event.status === "FINISHED" ? (
              <Link
                href={`/competitions/${event.competitionId}?event=${event.id}&view=results`}
                className="text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition shadow-sm shadow-emerald-900/30 inline-flex items-center gap-1"
              >
                {t.results}
              </Link>
            ) : (
              <Link
                href={`/competitions/${event.competitionId}?event=${event.id}&view=entries`}
                className="text-[11px] font-semibold bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition shadow-sm inline-flex items-center gap-1"
              >
                {t.startOrder}
              </Link>
            )}
          </div>
        </div>
      ),
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-white">{t.title}</h1>
          <p className="mt-2 text-sm text-ice-100/60">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ice-100/60">
          <span>{t.showHoursIn}</span>
          <TimezoneSelector />
        </div>
      </div>

      {unscheduled.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-ice-100/80">
            {t.unscheduled}
          </h2>
          <ul className="mt-3 space-y-2">
            {unscheduled.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/25 hover:bg-white/10"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-accent">
                      {event.competition.name}
                    </p>
                    <p className="font-display text-base font-semibold text-white">{event.name}</p>
                    <p className="text-sm text-ice-100/60">
                      {event.discipline.name} · {event.category.name}
                      {event.gender ? ` · ${genderLabel[event.gender]}` : ""}
                    </p>
                  </div>
                  <span className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1 text-xs text-ice-100/80">
                    {statusLabel[event.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CalendarDayGroups
        rows={calendarRows}
        controls={{
          filterCompetitionLabel: t.filterCompetitionLabel,
          filterDisciplineLabel: t.filterDisciplineLabel,
          filterStatusLabel: t.filterStatusLabel,
          filterAllLabel: t.filterAllLabel,
          expandAllLabel: t.expandAllLabel,
          collapseAllLabel: t.collapseAllLabel,
          noResultsFilter: t.noResultsFilter,
          statusText: statusLabel,
        }}
      />

      {events.length === 0 && <p className="mt-8 text-ice-100/60">{t.empty}</p>}
    </div>
  );
}
