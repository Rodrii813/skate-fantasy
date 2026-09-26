import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeSegmentResultBlocks } from "@/lib/segmentResults";
import SegmentResultsTables from "@/app/_components/SegmentResultsTables";
import LocalDateTime from "@/app/_components/LocalDateTime";
import { buildCalendarRows, groupCalendarRowsByVenueDay } from "@/lib/calendarGrouping";

const statusLabel: Record<string, string> = {
  UPCOMING: "Picks abiertos",
  LOCKED: "En pista",
  RESULTS_IN: "Resultados parciales",
  FINISHED: "Finalizado",
};

export const dynamic = "force-dynamic";

const genderLabel: Record<string, string> = {
  FEMALE: "Femenino",
  MALE: "Masculino",
};

// params.id es el id de la Competición (torneo), no de un Event concreto.
// Dentro se navega por pestañas, una por cada Event (disciplina · categoría)
// de esa competición — patrón inspirado en rockerskating.com.
export default async function CompetitionDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { event?: string; view?: string; cal?: string };
}) {
  const competition = await prisma.competition.findUnique({
    where: { id: params.id },
    include: {
      events: {
        include: {
          discipline: true,
          category: true,
          segments: { orderBy: { order: "asc" } },
          registrations: {
            include: {
              skater: true,
              elementScores: { include: { elementCategory: true } },
            },
            orderBy: [{ finalRank: "asc" }, { startOrder: "asc" }],
          },
          _count: { select: { registrations: true, predictions: true, rosters: true } },
        },
        orderBy: [{ category: { order: "asc" } }, { discipline: { name: "asc" } }],
      },
    },
  });

  if (!competition) notFound();

  const events = competition.events;
  const activeEvent = events.find((e) => e.id === searchParams.event) || events[0];
  const isLocked = activeEvent ? activeEvent.status !== "UPCOMING" : false;
  const view = searchParams.view === "entries" || searchParams.view === "results"
    ? searchParams.view
    : isLocked
    ? "results"
    : "entries";

  const resultBlocks =
    activeEvent && isLocked ? computeSegmentResultBlocks(activeEvent.segments, activeEvent.registrations) : [];

  // Género de las patinadoras/patinadores de ESTE evento concreto, para
  // rotular la tabla de orden de salida — "Patinadoras" si el evento es
  // Ladies, "Patinadores" si es Men o si el evento es mixto (gender null).
  const skaterWord = (ev: { gender: string | null } | undefined, plural: boolean) => {
    const isFemale = ev?.gender === "FEMALE";
    if (plural) return isFemale ? "Patinadoras" : "Patinadores";
    return isFemale ? "Patinadora" : "Patinador";
  };

  const tabHref = (eventId: string, forView?: "entries" | "results") =>
    `/competitions/${competition.id}?event=${eventId}${forView ? `&view=${forView}` : ""}`;

  const showCalendar = searchParams.cal === "1";
  // Una fila del calendario normalmente es "el evento entero", pero cuando
  // sus segmentos tienen hora de pista propia (Corto/Largo a horas
  // distintas, o el Largo partido en "Top 10"/"Resto"), un mismo evento
  // aparece en varias filas — ver src/lib/calendarGrouping.ts.
  const dayGroups = groupCalendarRowsByVenueDay(buildCalendarRows(events));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Enlace de regreso */}
        <div>
          <Link
            href="/competitions"
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition inline-flex items-center gap-1.5"
          >
            ← Volver a Competiciones
          </Link>
        </div>

        {/* Cabecera de la Competición */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-50 tracking-tight">{competition.name}</h1>
          <p className="text-sm text-slate-400 flex flex-wrap items-center gap-3">
            <span>📍 {competition.location || "Sede oficial"}</span>
            <span>•</span>
            <span>
              📅 {new Date(competition.startDate).toLocaleDateString("es-ES")} –{" "}
              {new Date(competition.endDate).toLocaleDateString("es-ES")}
            </span>
            {competition.website && (
              <>
                <span>•</span>
                <a
                  href={competition.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                >
                  Web oficial / Stream ↗
                </a>
              </>
            )}
          </p>
        </div>

        {events.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-slate-400 text-base">
              Esta competición todavía no tiene pruebas (Events) creadas.
            </p>
          </div>
        ) : (
          <>
            {/* Toggle entre las pestañas por disciplina (Entries/Results) y
                el Calendario de ESTA competición, agrupado por día. */}
            <div className="flex justify-end">
              <Link
                href={
                  showCalendar
                    ? tabHref(activeEvent?.id ?? events[0].id)
                    : `/competitions/${competition.id}?cal=1`
                }
                className="text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg hover:border-slate-500 transition inline-flex items-center gap-1.5"
              >
                {showCalendar ? "← Volver a las pruebas" : "📅 Ver Calendario de la competición"}
              </Link>
            </div>

            {showCalendar ? (
              <div className="space-y-6">
                {dayGroups.length === 0 ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
                    <p className="text-slate-400 text-base">
                      Ninguna prueba de esta competición tiene todavía horario confirmado.
                    </p>
                  </div>
                ) : (
                  dayGroups.map((group) => (
                    <section key={group.key}>
                      <h2 className="font-display text-lg font-semibold capitalize text-slate-100 border-b border-slate-800 pb-2">
                        {group.label}
                      </h2>
                      <ul className="mt-3 space-y-2">
                        {group.events.map((row, i) => {
                          const event = row.event;
                          return (
                          <li
                            key={`${event.id}-${i}`}
                            className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 min-w-0">
                                <LocalDateTime
                                  value={row.scheduledAt}
                                  options={{ hour: "2-digit", minute: "2-digit" }}
                                  className="font-display w-14 shrink-0 text-lg font-semibold text-indigo-400"
                                />
                                <div className="min-w-0">
                                  <p className="font-display text-base font-semibold text-slate-100 truncate">
                                    {event.name}
                                    {row.rowLabel && (
                                      <span className="ml-2 text-xs font-normal text-slate-400">
                                        — {row.rowLabel}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {event.discipline.name} · {event.category.name}
                                    {event.gender ? ` · ${genderLabel[event.gender]}` : ""}
                                  </p>
                                </div>
                              </div>
                              <span className="whitespace-nowrap rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 shrink-0">
                                {statusLabel[event.status]}
                              </span>
                            </div>
                            {/* Botones de acceso directo a Predicción, Draft
                                y Resultados de esta prueba concreta, desde la
                                propia fila del calendario. */}
                            <div className="mt-2.5 pl-[4.5rem] flex flex-wrap items-center gap-2">
                              <Link
                                href={`/predictions?event=${event.id}`}
                                className="text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition shadow-sm shadow-blue-900/30 inline-flex items-center gap-1"
                              >
                                🎯 Predicción
                              </Link>
                              <Link
                                href={`/events/${event.id}${row.segmentId ? `?segment=${row.segmentId}` : ""}`}
                                className="text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition shadow-sm shadow-indigo-900/30 inline-flex items-center gap-1"
                              >
                                ✨ Draft
                              </Link>
                              <Link
                                href={tabHref(event.id, "results")}
                                className="text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition shadow-sm shadow-emerald-900/30 inline-flex items-center gap-1"
                              >
                                📊 Resultados
                              </Link>
                            </div>
                          </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))
                )}
              </div>
            ) : (
              <>
            {/* Pestañas por disciplina · categoría, con nº de patinadoras */}
            <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-px">
              {events.map((ev) => {
                const isActive = ev.id === activeEvent?.id;
                return (
                  <Link
                    key={ev.id}
                    href={tabHref(ev.id)}
                    className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 -mb-px whitespace-nowrap ${
                      isActive
                        ? "border-indigo-500 text-indigo-300 bg-slate-900/80"
                        : "border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {ev.discipline.name} · {ev.category.name}
                    {ev.gender ? ` · ${genderLabel[ev.gender]}` : ""}
                    <span className="ml-1.5 text-[10px] font-mono text-slate-500">
                      ({ev._count.registrations})
                    </span>
                  </Link>
                );
              })}
            </div>

            {activeEvent && (
              <div className="space-y-6">
                {/* Cabecera del Event activo */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono bg-indigo-950 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded">
                          {activeEvent.discipline.name}
                        </span>
                        <span className="text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded">
                          {activeEvent.category.name}
                          {activeEvent.gender ? ` · ${genderLabel[activeEvent.gender]}` : ""}
                        </span>
                      </div>
                      <h2 className="text-2xl font-extrabold text-slate-50 tracking-tight">
                        {activeEvent.name}
                      </h2>
                      <p className="text-sm text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                        <span>
                          📅 Cierre de rosters:{" "}
                          <LocalDateTime
                            value={activeEvent.rosterLocksAt}
                            options={{ dateStyle: "short", timeStyle: "short" }}
                          />
                        </span>
                      </p>
                    </div>

                    {/* Accesos directos a los modos de juego */}
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <Link
                        href={`/predictions?event=${activeEvent.id}`}
                        className="flex-1 md:flex-none text-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-md shadow-blue-900/20"
                      >
                        🎯 Predicción Top 3 / Top 5
                      </Link>
                      <Link
                        href={`/events/${activeEvent.id}`}
                        className="flex-1 md:flex-none text-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-900/20"
                      >
                        ✨ Mi Roster Fantasy
                      </Link>
                    </div>
                  </div>

                  {/* Tarjetas de métricas rápidas */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 text-xs">Inscritos</span>
                      <p className="text-lg font-bold text-slate-200 mt-0.5">
                        {activeEvent.registrations.length}
                      </p>
                    </div>
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 text-xs">Segmentos</span>
                      <p className="text-lg font-bold text-slate-200 mt-0.5">
                        {activeEvent.segments.map((s) => s.name).join(" / ") || "—"}
                      </p>
                    </div>
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 text-xs">Predicciones Realizadas</span>
                      <p className="text-lg font-bold text-slate-200 mt-0.5">
                        {activeEvent._count.predictions}
                      </p>
                    </div>
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 text-xs">Rosters Fantasy</span>
                      <p className="text-lg font-bold text-slate-200 mt-0.5">
                        {activeEvent._count.rosters}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Entries / Results */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
                  <div className="p-5 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3">
                    <div className="flex border border-slate-700 rounded-lg overflow-hidden text-xs font-bold">
                      <Link
                        href={tabHref(activeEvent.id, "entries")}
                        className={`px-4 py-2 transition ${
                          view === "entries"
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-950 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Orden de Salida
                      </Link>
                      <Link
                        href={tabHref(activeEvent.id, "results")}
                        className={`px-4 py-2 transition ${
                          view === "results"
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-950 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Resultados
                      </Link>
                    </div>
                    <span className="text-xs font-mono bg-slate-800 text-slate-300 px-3 py-1 rounded-lg border border-slate-700">
                      {activeEvent.registrations.length} {skaterWord(activeEvent, true)}
                    </span>
                  </div>

                  {activeEvent.registrations.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">
                      No hay {skaterWord(activeEvent, true).toLowerCase()} registrados todavía en esta prueba.
                    </div>
                  ) : view === "results" ? (
                    isLocked ? (
                      <SegmentResultsTables blocks={resultBlocks} defaultOpen />
                    ) : (
                      <div className="p-12 text-center text-slate-400 text-sm">
                        Los resultados se publican cuando cierre el plazo de picks de esta prueba.
                      </div>
                    )
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-800/60 text-slate-300 font-semibold border-b border-slate-700/80 text-xs uppercase tracking-wider">
                            <th className="py-3 px-4 w-24">Orden de Salida</th>
                            <th className="py-3 px-4">{skaterWord(activeEvent, false)}</th>
                            <th className="py-3 px-4">País</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {activeEvent.registrations.map((reg, index) => (
                            <tr key={reg.id} className="hover:bg-slate-800/30 transition font-mono">
                              <td className="py-3.5 px-4 font-bold text-slate-400">
                                {reg.startOrder ?? index + 1}
                              </td>
                              <td className="py-3.5 px-4 font-sans font-semibold text-slate-200">
                                {reg.skater.firstName} {reg.skater.lastName}
                              </td>
                              <td className="py-3.5 px-4 font-sans text-xs text-slate-400">
                                <span className="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                                  {reg.skater.country}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
