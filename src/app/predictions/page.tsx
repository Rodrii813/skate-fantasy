import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PredictionForm from "./PredictionForm";
import { firstSegmentEffectiveLocksAt } from "@/lib/segments";
import { computeEventPredictionLeaderboard, computeCompetitionPredictionLeaderboard } from "@/lib/scoring";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

// /predictions es ahora el hub de Predicción: selector Competición → Evento
// (agrupado, más simple que el de /fantasy — no hace falta la tabla Draft
// Status porque las predicciones no son por segmento), el formulario de
// siempre, el widget "Favoritos del Público" (movido aquí desde
// /leaderboard, scoped al evento elegido) y el ranking de predicciones con
// dos vistas: por evento y global por competición.
export default async function PredictionsPage({
  searchParams,
}: {
  searchParams: { event?: string; rank?: string };
}) {
  const session = await getServerSession(authOptions);
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.predictions;
  const genderLabel = dict.common.gender;

  const competitions = await prisma.competition.findMany({
    orderBy: { startDate: "asc" },
    include: {
      events: {
        orderBy: { rosterLocksAt: "asc" },
        include: {
          competition: true,
          discipline: true,
          category: true,
          segments: { select: { id: true, order: true, locksAt: true } },
          registrations: {
            include: { skater: true },
            orderBy: { skater: { lastName: "asc" } },
          },
          predictions: true,
        },
      },
    },
  });

  const allEvents = competitions.flatMap((c) => c.events);

  // Evento activo seleccionado o por defecto el primero (cronológicamente)
  const selectedEventId = searchParams.event || allEvents[0]?.id;
  const activeEvent = allEvents.find((e) => e.id === selectedEventId) || allEvents[0];

  let userPrediction = null;
  if (session?.user?.email && activeEvent) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (user) {
      userPrediction = await prisma.prediction.findUnique({
        where: {
          userId_eventId: {
            userId: user.id,
            eventId: activeEvent.id,
          },
        },
      });
    }
  }

  const isLocked = activeEvent
    ? new Date() > firstSegmentEffectiveLocksAt(activeEvent.segments, activeEvent.rosterLocksAt) ||
      activeEvent.status !== "UPCOMING"
    : true;

  // Favoritos del Público: porcentaje de la comunidad que predijo a cada
  // patinadora en cada puesto del podio, para el evento activo — movido
  // aquí desde /leaderboard (antes era una vista global independiente del
  // selector de evento de Predicción; ahora vive junto al propio formulario
  // del evento al que corresponde).
  let statsRank1: { skaterName: string; country: string; percent: number; count: number }[] = [];
  let statsRank2: { skaterName: string; country: string; percent: number; count: number }[] = [];
  let statsRank3: { skaterName: string; country: string; percent: number; count: number }[] = [];

  if (activeEvent && activeEvent.predictions.length > 0) {
    const totalPredictions = activeEvent.predictions.length;
    const skaterMap = new Map<string, { name: string; country: string }>();
    activeEvent.registrations.forEach((r) => {
      skaterMap.set(r.skater.id, {
        name: `${r.skater.firstName} ${r.skater.lastName}`,
        country: r.skater.country,
      });
    });

    const getRankStats = (rankKey: "rank1SkaterId" | "rank2SkaterId" | "rank3SkaterId") => {
      const counts = new Map<string, number>();
      activeEvent.predictions.forEach((p: any) => {
        const skaterId = p[rankKey];
        if (skaterId) counts.set(skaterId, (counts.get(skaterId) || 0) + 1);
      });

      return Array.from(counts.entries())
        .map(([skaterId, count]) => {
          const skater = skaterMap.get(skaterId) || { name: t.defaultSkaterName, country: "—" };
          return {
            skaterName: skater.name,
            country: skater.country,
            count,
            percent: Math.round((count / totalPredictions) * 100),
          };
        })
        .sort((a, b) => b.count - a.count);
    };

    statsRank1 = getRankStats("rank1SkaterId");
    statsRank2 = getRankStats("rank2SkaterId");
    statsRank3 = getRankStats("rank3SkaterId");
  }

  // Ranking de Predicciones: por evento (siempre) y global por competición
  // (solo si el evento activo pertenece a una), reutilizando las funciones
  // de src/lib/scoring.ts basadas en Prediction.pointsEarned ya calculado.
  const rankTab = searchParams.rank === "competition" ? "competition" : "event";
  const eventRanking = activeEvent ? await computeEventPredictionLeaderboard(activeEvent.id) : [];
  const competitionRanking = activeEvent
    ? await computeCompetitionPredictionLeaderboard(activeEvent.competitionId)
    : [];

  const rankHref = (tab: "event" | "competition") =>
    `/predictions?event=${activeEvent?.id ?? ""}${tab === "competition" ? "&rank=competition" : ""}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Encabezado estilo Rocker Prediction Central */}
        <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {t.subtitle}
            </p>
          </div>

          <Link
            href="/competitions"
            className="text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg hover:border-slate-500 transition"
          >
            {t.viewCalendar}
          </Link>
        </div>

        {allEvents.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            {t.noEvents}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selector Competición → Evento */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t.selectEvent}
              </label>
              <div className="space-y-3">
                {competitions
                  .filter((c) => c.events.length > 0)
                  .map((c) => (
                    <div key={c.id} className="space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        {c.name}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {c.events.map((e) => (
                          <Link
                            key={e.id}
                            href={`/predictions?event=${e.id}`}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                              e.id === activeEvent?.id
                                ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/20"
                                : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                            }`}
                          >
                            {e.discipline.name} · {e.category.name}
                            {e.gender ? ` · ${genderLabel[e.gender] ?? e.gender}` : ""}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Ficha del evento activo */}
            {activeEvent && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">{activeEvent.name}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeEvent.competition.name} • 📍 {activeEvent.competition.location || t.officialSite}
                    </p>
                  </div>
                  <div>
                    {isLocked ? (
                      <span className="px-3 py-1 text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
                        {t.locked}
                      </span>
                    ) : (
                      <span className="px-3 py-1 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">
                        {t.closes(
                          new Date(
                            firstSegmentEffectiveLocksAt(activeEvent.segments, activeEvent.rosterLocksAt)
                          ).toLocaleDateString(),
                          new Date(
                            firstSegmentEffectiveLocksAt(activeEvent.segments, activeEvent.rosterLocksAt)
                          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Formulario */}
                {!session ? (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-8 text-center space-y-3">
                    <p className="text-sm text-slate-300">
                      {t.loginRequired}
                    </p>
                    <Link
                      href="/login"
                      className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                    >
                      {t.loginCta}
                    </Link>
                  </div>
                ) : activeEvent.registrations.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-400">
                    {t.noSkaters}
                  </div>
                ) : (
                  <PredictionForm
                    eventId={activeEvent.id}
                    isLocked={isLocked}
                    skaters={activeEvent.registrations.map((r) => r.skater)}
                    initialPrediction={userPrediction}
                  />
                )}

                {/* Favoritos del Público */}
                {activeEvent.predictions.length > 0 && (
                  <div className="border-t border-slate-800 pt-5 space-y-4">
                    <div>
                      <span className="text-[11px] font-mono font-bold tracking-wider text-indigo-400 uppercase bg-indigo-950/70 border border-indigo-800/60 px-2 py-0.5 rounded">
                        {t.consensusTag}
                      </span>
                      <h3 className="text-sm font-bold text-slate-100 mt-1.5">{t.publicFavorites}</h3>
                      <p className="text-xs text-slate-400">
                        {t.predictionsSubmitted(activeEvent.predictions.length)}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        {
                          title: t.goldVotes,
                          stats: statsRank1,
                          text: "text-amber-400",
                          bar: "bg-amber-400",
                        },
                        {
                          title: t.silverVotes,
                          stats: statsRank2,
                          text: "text-slate-300",
                          bar: "bg-slate-300",
                        },
                        {
                          title: t.bronzeVotes,
                          stats: statsRank3,
                          text: "text-amber-600",
                          bar: "bg-amber-600",
                        },
                      ].map(({ title, stats, text, bar }) => (
                        <div
                          key={title}
                          className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3"
                        >
                          <span className={`text-sm font-bold ${text}`}>{title}</span>
                          <div className="space-y-2.5">
                            {stats.slice(0, 3).map((s, idx) => (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                  <span className="text-slate-200">{s.skaterName}</span>
                                  <span className={`font-mono font-bold ${text}`}>{s.percent}%</span>
                                </div>
                                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${bar}`}
                                    style={{ width: `${s.percent}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ranking de Predicciones: por evento / global por competición */}
                <div className="border-t border-slate-800 pt-5 space-y-3">
                  <div className="flex border-b border-slate-800 gap-2">
                    <Link
                      href={rankHref("event")}
                      className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${
                        rankTab === "event"
                          ? "border-blue-500 text-blue-400"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {t.eventRanking}
                    </Link>
                    <Link
                      href={rankHref("competition")}
                      className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${
                        rankTab === "competition"
                          ? "border-blue-500 text-blue-400"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {t.globalRanking(activeEvent.competition.name)}
                    </Link>
                  </div>

                  {(() => {
                    const ranking = rankTab === "event" ? eventRanking : competitionRanking;
                    if (ranking.length === 0) {
                      return (
                        <p className="text-xs text-slate-500 text-center py-6">
                          {t.noRanking}
                        </p>
                      );
                    }
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="bg-slate-800/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                              <th className="py-2.5 px-3 w-16">Rank</th>
                              <th className="py-2.5 px-3">{t.user}</th>
                              {rankTab === "competition" && (
                                <th className="py-2.5 px-3 text-center">{t.events}</th>
                              )}
                              <th className="py-2.5 px-3 text-right font-bold text-white">{t.points}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/70">
                            {ranking.map((row, index) => (
                              <tr key={row.userId} className="hover:bg-slate-800/30 transition font-mono">
                                <td className="py-2.5 px-3 font-bold text-slate-400">
                                  {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                                </td>
                                <td className="py-2.5 px-3 font-sans font-semibold text-slate-200">
                                  {row.userName}
                                </td>
                                {rankTab === "competition" && (
                                  <td className="py-2.5 px-3 text-center text-slate-400 font-sans text-xs">
                                    {row.eventsPlayed}
                                  </td>
                                )}
                                <td className="py-2.5 px-3 text-right font-bold text-blue-400">
                                  {row.total} {t.pointsSuffix}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
