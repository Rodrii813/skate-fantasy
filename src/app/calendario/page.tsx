import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LocalDateTime from "@/app/_components/LocalDateTime";
import TimezoneSelector from "@/app/_components/TimezoneSelector";
import { buildCalendarRows, groupCalendarRowsByVenueDay } from "@/lib/calendarGrouping";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const dict = getDictionary(getLocale());
  const t = dict.calendario;
  const statusLabel = dict.common.status;
  const genderLabel = dict.common.gender;

  const events = await prisma.event.findMany({
    include: {
      competition: true,
      discipline: true,
      category: true,
      segments: { orderBy: { order: "asc" } },
    },
  });

  // Una fila del calendario normalmente es "el evento entero", pero cuando
  // sus segmentos tienen hora de pista propia (Corto/Largo a horas
  // distintas, o el Largo partido en "Top 10"/"Resto"), un mismo evento
  // aparece en varias filas — ver src/lib/calendarGrouping.ts.
  const rows = buildCalendarRows(events);
  const scheduledEventIds = new Set(rows.map((r) => r.event.id));
  const unscheduled = events.filter((e) => !scheduledEventIds.has(e.id));

  // La HORA exacta de cada fila sí varía según quién mira (ver
  // <LocalDateTime> más abajo); el DÍA en el que cae no — ver
  // src/lib/calendarGrouping.ts.
  const dayGroups = groupCalendarRowsByVenueDay(rows);

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

      {dayGroups.map((group) => (
        <section key={group.key} className="mt-8">
          <h2 className="font-display text-lg font-semibold capitalize text-white">
            {group.label}
          </h2>
          <ul className="mt-3 space-y-2">
            {group.events.map((row, i) => {
              const event = row.event;
              return (
              <li
                key={`${event.id}-${i}`}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/25 hover:bg-white/10"
              >
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
                    className="text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition shadow-sm shadow-blue-900/30 inline-flex items-center gap-1"
                  >
                    {t.prediction}
                  </Link>
                  <Link
                    href={`/events/${event.id}${row.segmentId ? `?segment=${row.segmentId}` : ""}`}
                    className="text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition shadow-sm shadow-indigo-900/30 inline-flex items-center gap-1"
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
              </li>
              );
            })}
          </ul>
        </section>
      ))}

      {events.length === 0 && <p className="mt-8 text-ice-100/60">{t.empty}</p>}
    </div>
  );
}
