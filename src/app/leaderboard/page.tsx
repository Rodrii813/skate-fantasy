import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { tab?: string; event?: string };
}) {
  const currentTab = searchParams.tab || "predictions"; // 'predictions' | 'fantasy'

  // 1. Cargar todos los eventos para el selector de estadísticas
  const events = await prisma.event.findMany({
    orderBy: { rosterLocksAt: "desc" },
    include: {
      competition: true,
      discipline: true,
      category: true,
      predictions: true,
      registrations: {
        include: { skater: true },
      },
    },
  });

  const selectedEventId = searchParams.event || events[0]?.id;
  const activeEvent = events.find((e) => e.id === selectedEventId) || events[0];

  // 2. Calcular los porcentajes de la comunidad para el evento seleccionado
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
      activeEvent.predictions.forEach((p) => {
        const skaterId = p[rankKey];
        if (skaterId) {
          counts.set(skaterId, (counts.get(skaterId) || 0) + 1);
        }
      });

      return Array.from(counts.entries())
        .map(([skaterId, count]) => {
          const skater = skaterMap.get(skaterId) || { name: "Patinador", country: "—" };
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

  // 3. Leaderboard Porras (Prediction Central)
  const predictionsByUser = await prisma.prediction.findMany({
    where: { pointsEarned: { not: null } },
    include: { user: true },
  });

  const predictionUserScores = new Map<string, { user: any; totalPoints: number; eventsPlayed: number }>();
  predictionsByUser.forEach((p) => {
    const prev = predictionUserScores.get(p.userId) || { user: p.user, totalPoints: 0, eventsPlayed: 0 };
    predictionUserScores.set(p.userId, {
      user: p.user,
      totalPoints: prev.totalPoints + (p.pointsEarned || 0),
      eventsPlayed: prev.eventsPlayed + 1,
    });
  });

  const predictionRanking = Array.from(predictionUserScores.values()).sort(
    (a, b) => b.totalPoints - a.totalPoints
  );

  // 4. Leaderboard Fantasy (Suma de notas de los slots)
  const rosters = await prisma.fantasyRoster.findMany({
    include: {
      user: true,
      picks: {
        include: {
          slot: true,
          skater: {
            include: {
              registrations: {
                include: { elementScores: true },
              },
            },
          },
        },
      },
    },
  });

  const fantasyUserScores = new Map<string, { user: any; totalPoints: number; rostersCount: number }>();
  rosters.forEach((roster) => {
    let rosterScore = 0;
    roster.picks.forEach((pick) => {
      const reg = pick.skater.registrations.find((r) => r.eventId === roster.eventId);
      if (reg) {
        const elScore = reg.elementScores.find(
          (es) => es.elementCategoryId === pick.slot.elementCategoryId
        );
        if (elScore) {
          rosterScore += elScore.value;
        }
      }
    });

    const prev = fantasyUserScores.get(roster.userId) || { user: roster.user, totalPoints: 0, rostersCount: 0 };
    fantasyUserScores.set(roster.userId, {
      user: roster.user,
      totalPoints: prev.totalPoints + rosterScore,
      rostersCount: prev.rostersCount + 1,
    });
  });

  const fantasyRanking = Array.from(fantasyUserScores.values()).sort(
    (a, b) => b.totalPoints - a.totalPoints
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <h1 className="text-3xl font-extrabold tracking-tight">Leaderboard & Tendencias</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Clasificaciones oficiales y consensos de predicciones de la comunidad.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg hover:border-slate-500 transition"
          >
            ← Volver al Hub
          </Link>
        </div>

        {/* WIDGET: Consenso de la Comunidad / Tendencias (%) */}
        {activeEvent && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl shadow-black/40">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[11px] font-mono font-bold tracking-wider text-indigo-400 uppercase bg-indigo-950/70 border border-indigo-800/60 px-2 py-0.5 rounded">
                  Consenso Público (%)
                </span>
                <h2 className="text-lg font-bold text-slate-100 mt-1">
                  ¿A quién ve ganando la afición?
                </h2>
                <p className="text-xs text-slate-400">
                  {activeEvent.name} • {activeEvent.predictions.length} predicciones enviadas[cite: 1, 2]
                </p>
              </div>

              {/* Selector de Evento */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-400">Prueba:</span>
                <div className="flex flex-wrap gap-1.5">
                  {events.slice(0, 3).map((e) => (
                    <Link
                      key={e.id}
                      href={`/leaderboard?tab=${currentTab}&event=${e.id}`}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                        e.id === activeEvent.id
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {e.category.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {activeEvent.predictions.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                Aún no hay predicciones registradas para calcular porcentajes en esta prueba.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Oro */}
                <div className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                      🥇 Votos al Oro (1º)
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {statsRank1.slice(0, 3).map((s, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-200">{s.skaterName}</span>
                          <span className="font-mono text-amber-400 font-bold">{s.percent}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${s.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plata */}
                <div className="bg-slate-950/60 border border-slate-400/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-sm font-bold text-slate-300 flex items-center gap-1.5">
                      🥈 Votos a la Plata (2º)
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {statsRank2.slice(0, 3).map((s, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-200">{s.skaterName}</span>
                          <span className="font-mono text-slate-300 font-bold">{s.percent}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-slate-300 h-full rounded-full transition-all duration-500"
                            style={{ width: `${s.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bronce */}
                <div className="bg-slate-950/60 border border-amber-700/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-sm font-bold text-amber-600 flex items-center gap-1.5">
                      🥉 Votos al Bronce (3º)
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {statsRank3.slice(0, 3).map((s, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-200">{s.skaterName}</span>
                          <span className="font-mono text-amber-600 font-bold">{s.percent}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${s.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pestañas de Clasificación General */}
        <div className="space-y-4">
          <div className="flex border-b border-slate-800 gap-2">
            <Link
              href={`/leaderboard?tab=predictions&event=${selectedEventId}`}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
                currentTab === "predictions"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              🎯 Ranking Porras (Predicciones)[cite: 1]
            </Link>
            <Link
              href={`/leaderboard?tab=fantasy&event=${selectedEventId}`}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
                currentTab === "fantasy"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              ✨ Ranking Fantasy Clásico[cite: 1, 2]
            </Link>
          </div>

          {/* Tabla de Porras */}
          {currentTab === "predictions" && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Baremo: 5 pts acierto exacto | +2 podio | +1 fallo por 1 puesto | +3 podio completo
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {predictionRanking.length} Jugadores
                </span>
              </div>

              {predictionRanking.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">
                  Aún no se han puntuado porras en ningún evento.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-800/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                        <th className="py-3 px-4 w-16">Rank</th>
                        <th className="py-3 px-4">Usuario</th>
                        <th className="py-3 px-4 text-center">Eventos Jugados</th>
                        <th className="py-3 px-4 text-right font-bold text-white">Puntos Totales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {predictionRanking.map((item, index) => (
                        <tr key={item.user.id} className="hover:bg-slate-800/30 transition font-mono">
                          <td className="py-3.5 px-4 font-bold text-slate-400">
                            {index === 0 ? "🥇 1" : index === 1 ? "🥈 2" : index === 2 ? "🥉 3" : `#${index + 1}`}
                          </td>
                          <td className="py-3.5 px-4 font-sans font-semibold text-slate-200">
                            {item.user.name || item.user.email}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-400 font-sans text-xs">
                            {item.eventsPlayed}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-blue-400 text-base">
                            {item.totalPoints} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tabla de Fantasy */}
          {currentTab === "fantasy" && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Puntos Fantasy = Suma de notas oficiales en los slots seleccionados[cite: 2]
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {fantasyRanking.length} Equipos
                </span>
              </div>

              {fantasyRanking.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">
                  Aún no hay puntuaciones acumuladas en el modo Fantasy.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-800/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                        <th className="py-3 px-4 w-16">Rank</th>
                        <th className="py-3 px-4">Entrenador</th>
                        <th className="py-3 px-4 text-center">Rosters</th>
                        <th className="py-3 px-4 text-right font-bold text-white">Puntuación Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {fantasyRanking.map((item, index) => (
                        <tr key={item.user.id} className="hover:bg-slate-800/30 transition font-mono">
                          <td className="py-3.5 px-4 font-bold text-slate-400">
                            {index === 0 ? "🥇 1" : index === 1 ? "🥈 2" : index === 2 ? "🥉 3" : `#${index + 1}`}
                          </td>
                          <td className="py-3.5 px-4 font-sans font-semibold text-slate-200">
                            {item.user.name || item.user.email}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-400 font-sans text-xs">
                            {item.rostersCount}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-indigo-400 text-base">
                            {item.totalPoints.toFixed(2)} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}