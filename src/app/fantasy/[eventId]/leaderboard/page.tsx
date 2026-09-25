import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeEventLeaderboard } from "@/lib/scoring";
import LocalDateTime from "@/app/_components/LocalDateTime";

export const dynamic = "force-dynamic";

const medal = ["🥇", "🥈", "🥉"];

// Clasificación en vivo del Fantasy de un evento: una vez cerrado el plazo
// de fichajes, cualquiera puede ver el roster de cada jugador y cuántos
// puntos aporta cada slot — igual que /resultados y /competitions/[id] son
// públicas una vez hay algo que mostrar. La puntuación se calcula con
// computeEventLeaderboard() de src/lib/scoring.ts, la MISMA función que ya
// usa el resto de la app (el leaderboard global en /leaderboard reimplementa
// su propio cálculo por separado; aquí se reutiliza la función existente a
// propósito, para no acabar con dos lógicas de puntuación que puedan
// desincronizarse).
export default async function EventFantasyLeaderboardPage({
  params,
}: {
  params: { eventId: string };
}) {
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    include: { competition: true },
  });

  if (!event) notFound();

  const isLocked = new Date() > event.rosterLocksAt;

  const board = isLocked ? await computeEventLeaderboard(event.id) : [];

  return (
    <div className="min-h-screen bg-[#070b18] text-slate-100 p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link
            href={`/events/${event.id}`}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition inline-flex items-center gap-1.5"
          >
            ← Volver a mi Roster
          </Link>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-400">{event.competition.name}</p>
          <h1 className="text-2xl font-black text-slate-100 mt-1">🏆 Clasificación Fantasy en vivo</h1>
          <p className="text-sm text-slate-400 mt-1">{event.name}</p>
        </div>

        {!isLocked ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
            <p className="text-sm text-slate-300 font-semibold">
              La clasificación se publica cuando cierre el plazo de fichajes.
            </p>
            <p className="text-xs text-slate-500">
              Hasta entonces los rosters de otros jugadores se mantienen en secreto, para que nadie
              copie estrategia. Cierre:{" "}
              <LocalDateTime
                value={event.rosterLocksAt}
                options={{ dateStyle: "medium", timeStyle: "short" }}
              />
            </p>
          </div>
        ) : board.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-400">
              Nadie ha guardado una alineación de fantasy para este evento todavía.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {board.map((roster, index) => (
              <details
                key={roster.rosterId}
                className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
                open={index < 3}
              >
                <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg font-black text-slate-400 w-10 shrink-0 text-center">
                      {medal[index] || `#${index + 1}`}
                    </span>
                    <span className="font-semibold text-slate-100 truncate">{roster.userName}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-bold text-indigo-400 text-lg">
                      {roster.total.toFixed(2)} pts
                    </span>
                    <span className="text-slate-500 text-xs transition group-open:rotate-90">▶</span>
                  </div>
                </summary>

                <div className="border-t border-slate-800 divide-y divide-slate-800/80">
                  {roster.slots.map((slot) => (
                    <div
                      key={slot.slotId}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="text-slate-400">{slot.slotLabel}</p>
                        <p className="text-slate-200 font-semibold truncate">{slot.skaterName}</p>
                      </div>
                      <span className="font-mono font-bold text-slate-300 shrink-0">
                        {slot.points.toFixed(2)} pts
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
