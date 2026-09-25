import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSegmentLocked } from "@/lib/segments";
import { computeEventLeaderboard, computeCompetitionFantasyLeaderboard } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const genderLabel: Record<string, string> = {
  FEMALE: "Femenino",
  MALE: "Masculino",
};

const ROW_LABELS = ["Corto", "Largo"] as const;

// /fantasy es el hub del modo Fantasy: selector Competición → Evento
// presentado como tabla "Draft Status" (filas = segmento Corto/Largo,
// columnas = combinaciones disciplina+género que existan de verdad en la
// competición elegida, construidas dinámicamente — no hay nombres fijos
// tipo "Men/Women" porque el catálogo de disciplinas es editable desde
// admin), y debajo el Ranking Fantasy con las dos vistas: por evento
// (reutiliza computeEventLeaderboard) y global por competición (nueva
// computeCompetitionFantasyLeaderboard, que sí es nueva pero construida
// sumando computeEventLeaderboard evento a evento, no reimplementando la
// puntuación).
export default async function FantasyHubPage({
  searchParams,
}: {
  searchParams: { competition?: string; event?: string; rank?: string };
}) {
  const session = await getServerSession(authOptions);

  const competitions = await prisma.competition.findMany({
    orderBy: { startDate: "asc" },
    include: {
      events: {
        orderBy: [{ discipline: { name: "asc" } }, { category: { order: "asc" } }],
        include: {
          discipline: true,
          category: true,
          segments: { orderBy: { order: "asc" } },
          slots: { select: { id: true, segmentId: true } },
          _count: { select: { rosters: true } },
        },
      },
    },
  });

  if (competitions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
        <div className="max-w-5xl mx-auto">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            No hay competiciones registradas todavía.
          </div>
        </div>
      </div>
    );
  }

  const selectedCompetitionId = searchParams.competition || competitions[0].id;
  const activeCompetition =
    competitions.find((c) => c.id === selectedCompetitionId) || competitions[0];

  // Picks ya guardados por el usuario actual en ESTA competición, para
  // marcar en la tabla qué segmentos ya tiene "draft hecho".
  let draftedSlotIds = new Set<string>();
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (user) {
      const rosters = await prisma.fantasyRoster.findMany({
        where: { userId: user.id, event: { competitionId: activeCompetition.id } },
        include: { picks: { select: { slotId: true } } },
      });
      draftedSlotIds = new Set(rosters.flatMap((r) => r.picks.map((p) => p.slotId)));
    }
  }

  // Columnas dinámicas: combinaciones Disciplina + Género realmente
  // presentes en los eventos de esta competición.
  type Column = { key: string; disciplineName: string; gender: string | null; label: string };
  const columns: Column[] = [];
  for (const ev of activeCompetition.events) {
    const key = `${ev.disciplineId}__${ev.gender ?? "none"}`;
    if (!columns.find((c) => c.key === key)) {
      columns.push({
        key,
        disciplineName: ev.discipline.name,
        gender: ev.gender,
        label: `${ev.discipline.name}${ev.gender ? ` · ${genderLabel[ev.gender] ?? ev.gender}` : ""}`,
      });
    }
  }

  type CellEvent = {
    eventId: string;
    eventName: string;
    categoryName: string;
    state: "proximamente" | "abierto" | "cerrado";
    drafted: boolean;
  };

  const cellFor = (column: Column, rowIndex: number): CellEvent[] => {
    const matchingEvents = activeCompetition.events.filter(
      (ev) => `${ev.disciplineId}__${ev.gender ?? "none"}` === column.key
    );

    return matchingEvents
      .map((ev): CellEvent | null => {
        const orderedSegments = [...ev.segments].sort((a, b) => a.order - b.order);
        const segment = orderedSegments[rowIndex];
        if (!segment) return null;

        const slotsForSegment = ev.slots.filter((s) => s.segmentId === segment.id);
        const locked = isSegmentLocked(segment, ev.rosterLocksAt);
        const state: CellEvent["state"] =
          slotsForSegment.length === 0 ? "proximamente" : locked ? "cerrado" : "abierto";
        const drafted = slotsForSegment.some((s) => draftedSlotIds.has(s.id));

        return {
          eventId: ev.id,
          eventName: ev.name,
          categoryName: ev.category.name,
          state,
          drafted,
        };
      })
      .filter((c): c is CellEvent => c !== null);
  };

  const stateBadge: Record<CellEvent["state"], { label: string; className: string }> = {
    proximamente: { label: "Próximamente", className: "bg-slate-800 text-slate-400 border-slate-700" },
    abierto: {
      label: "Abierto",
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    cerrado: { label: "Cerrado", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  };

  // Ranking: por evento (con selector de evento propio) o global por
  // competición.
  const rankTab = searchParams.rank === "competition" ? "competition" : "event";
  const rankEventId = searchParams.event || activeCompetition.events[0]?.id;
  const rankEvent = activeCompetition.events.find((e) => e.id === rankEventId);

  const eventRanking = rankEvent ? await computeEventLeaderboard(rankEvent.id) : [];
  const competitionRanking = await computeCompetitionFantasyLeaderboard(activeCompetition.id);

  const rankHref = (tab: "event" | "competition", eventId?: string) =>
    `/fantasy?competition=${activeCompetition.id}${
      tab === "competition" ? "&rank=competition" : `&event=${eventId ?? rankEventId ?? ""}`
    }`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="border-b border-slate-800 pb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <h1 className="text-3xl font-extrabold tracking-tight">Fantasy Hub</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Estado del draft por prueba y segmento, y el ranking Fantasy de cada competición.
          </p>
        </div>

        {/* Selector de Competición */}
        <div className="flex flex-wrap gap-2">
          {competitions.map((c) => (
            <Link
              key={c.id}
              href={`/fantasy?competition=${c.id}`}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                c.id === activeCompetition.id
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-900/20"
                  : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {/* Tabla Draft Status */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Draft Status — {activeCompetition.name}
            </h2>
          </div>

          {columns.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">
              Esta competición todavía no tiene pruebas creadas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-800/60 text-slate-300 font-semibold border-b border-slate-700/80 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 w-24">Segmento</th>
                    {columns.map((col) => (
                      <th key={col.key} className="py-3 px-4 min-w-[180px]">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {ROW_LABELS.map((rowLabel, rowIndex) => (
                    <tr key={rowLabel}>
                      <td className="py-3 px-4 font-bold text-slate-300 align-top">{rowLabel}</td>
                      {columns.map((col) => {
                        const cellEvents = cellFor(col, rowIndex);
                        return (
                          <td key={col.key} className="py-3 px-4 align-top">
                            {cellEvents.length === 0 ? (
                              <span className="text-xs text-slate-600">—</span>
                            ) : (
                              <div className="space-y-2">
                                {cellEvents.map((ce) => {
                                  const badge = stateBadge[ce.state];
                                  const content = (
                                    <div className="space-y-1">
                                      {cellEvents.length > 1 && (
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                                          {ce.categoryName}
                                        </p>
                                      )}
                                      <span
                                        className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border ${badge.className}`}
                                      >
                                        {badge.label}
                                      </span>
                                      {ce.drafted && (
                                        <span className="ml-1.5 text-[11px] text-indigo-400 font-semibold">
                                          ✓ Ya hiciste draft
                                        </span>
                                      )}
                                    </div>
                                  );

                                  return ce.state === "proximamente" ? (
                                    <div key={ce.eventId}>{content}</div>
                                  ) : (
                                    <Link
                                      key={ce.eventId}
                                      href={`/events/${ce.eventId}`}
                                      className="block hover:opacity-80 transition"
                                    >
                                      {content}
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ranking Fantasy */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Link
                href={rankHref("event")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  rankTab === "event"
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Por evento
              </Link>
              <Link
                href={rankHref("competition")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  rankTab === "competition"
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Global · {activeCompetition.name}
              </Link>
            </div>

            {rankTab === "event" && activeCompetition.events.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activeCompetition.events.map((e) => (
                  <Link
                    key={e.id}
                    href={rankHref("event", e.id)}
                    className={`text-[11px] px-2 py-1 rounded-lg border transition ${
                      e.id === rankEvent?.id
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {e.discipline.name} · {e.category.name}
                    {e.gender ? ` · ${genderLabel[e.gender] ?? e.gender}` : ""}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {rankTab === "event" && rankEvent && (
            <div className="p-4 border-b border-slate-800/80">
              <Link
                href={`/fantasy/${rankEvent.id}/leaderboard`}
                className="text-xs text-amber-400 underline hover:text-amber-300"
              >
                🏆 Ver clasificación en vivo completa (con el desglose por slot) →
              </Link>
            </div>
          )}

          {(() => {
            const ranking = rankTab === "event" ? eventRanking : competitionRanking;
            if (ranking.length === 0) {
              return (
                <p className="p-8 text-center text-xs text-slate-400">
                  Todavía no hay rosters puntuables para mostrar este ranking.
                </p>
              );
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-800/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                      <th className="py-3 px-4 w-16">Rank</th>
                      <th className="py-3 px-4">Entrenador</th>
                      {rankTab === "competition" && (
                        <th className="py-3 px-4 text-center">Eventos</th>
                      )}
                      <th className="py-3 px-4 text-right font-bold text-white">Puntos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {ranking.map((row: any, index: number) => (
                      <tr
                        key={rankTab === "event" ? row.rosterId : row.userId}
                        className="hover:bg-slate-800/30 transition font-mono"
                      >
                        <td className="py-3 px-4 font-bold text-slate-400">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                        </td>
                        <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                          {row.userName}
                        </td>
                        {rankTab === "competition" && (
                          <td className="py-3 px-4 text-center text-slate-400 font-sans text-xs">
                            {row.eventsPlayed}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right font-bold text-indigo-400">
                          {row.total.toFixed(2)} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
