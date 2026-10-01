import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  computeEventLeaderboard,
  computeEventLeaderboardBySegment,
  type RosterScore,
} from "@/lib/scoring";
import { isSegmentLocked, effectiveLocksAt } from "@/lib/segments";
import LocalDateTime from "@/app/_components/LocalDateTime";

export const dynamic = "force-dynamic";

const medal = ["🥇", "🥈", "🥉"];

// Un roster + su desglose de puntos por slot, plegable. Se reutiliza tanto
// para el caso con segmentos (Corto/Largo, cada uno con su propia tanda)
// como para el caso legado sin segmentos configurados (un único roster).
function RosterCard({ roster, index }: { roster: RosterScore; index: number }) {
  return (
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
          <span className="font-mono font-bold text-indigo-400 text-lg">{roster.total.toFixed(2)} pts</span>
          <span className="text-slate-500 text-xs transition group-open:rotate-90">▶</span>
        </div>
      </summary>

      <div className="border-t border-slate-800 divide-y divide-slate-800/80">
        {roster.slots.map((slot) => (
          <div key={slot.slotId} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="text-slate-400">{slot.slotLabel}</p>
              <p className="text-slate-200 font-semibold truncate">{slot.skaterName}</p>
            </div>
            <span className="font-mono font-bold text-slate-300 shrink-0">{slot.points.toFixed(2)} pts</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function LockedNotice({ label, deadline }: { label: string; deadline: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
      <p className="text-sm text-slate-300 font-semibold">
        La clasificación de {label} se publica cuando cierre su plazo de fichajes.
      </p>
      <p className="text-xs text-slate-500">
        Hasta entonces los rosters de otros jugadores se mantienen en secreto, para que nadie copie
        estrategia. Cierre: <LocalDateTime value={deadline} options={{ dateStyle: "medium", timeStyle: "short" }} />
      </p>
    </div>
  );
}

function EmptyNotice({ text }: { text: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

function PendingScoresNotice({ label }: { label: string }) {
  return (
    <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-6 text-center">
      <p className="text-xs text-amber-300 font-semibold">
        🔜 El plazo de {label} ya ha cerrado, pero el admin todavía no ha cargado las puntuaciones oficiales.
        Vuelve en un rato.
      </p>
    </div>
  );
}

// Clasificación en vivo del Fantasy de un evento: una vez cerrado el plazo
// de fichajes de CADA segmento (Corto y Largo tienen plazos y sorteos de
// calentamiento independientes, ver src/lib/segments.ts), se puede ver el
// roster de cada jugador y cuántos puntos aporta cada slot en ESE segmento —
// sin esperar a que el otro segmento también termine. Antes toda la página
// esperaba a que cerrara el plazo general del evento entero
// (event.rosterLocksAt), así que si el Corto ya tenía resultados pero el
// Largo seguía abierto, no se veía nada de nada.
//
// La puntuación se calcula con computeEventLeaderboardBySegment() de
// src/lib/scoring.ts — misma lógica de puntos que computeEventLeaderboard
// (que sigue usando el resto de la app para el total combinado del evento),
// solo que aquí separada por segmento.
export default async function EventFantasyLeaderboardPage({
  params,
}: {
  params: { eventId: string };
}) {
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    include: {
      competition: true,
      segments: { orderBy: { order: "asc" } },
    },
  });

  if (!event) notFound();

  const hasSegments = event.segments.length > 0;

  // Eventos sin segmentos configurados (caso legado, ver DEFAULT_TAB_ID en
  // FantasyRosterForm.tsx): se mantiene el comportamiento de siempre, un
  // único plazo y una única clasificación para todo el evento.
  const legacyLocked = !hasSegments && new Date() > event.rosterLocksAt;
  const legacyBoard = legacyLocked ? await computeEventLeaderboard(event.id) : [];

  const boardsBySegment = hasSegments ? await computeEventLeaderboardBySegment(event.id) : null;

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

        {!hasSegments ? (
          !legacyLocked ? (
            <LockedNotice label="este evento" deadline={event.rosterLocksAt.toISOString()} />
          ) : legacyBoard.length === 0 ? (
            <EmptyNotice text="Nadie ha guardado una alineación de fantasy para este evento todavía." />
          ) : (
            <div className="space-y-3">
              {legacyBoard.map((roster, index) => (
                <RosterCard key={roster.rosterId} roster={roster} index={index} />
              ))}
            </div>
          )
        ) : (
          <div className="space-y-8">
            {event.segments.map((segment) => {
              const locked = isSegmentLocked(segment, event.rosterLocksAt);
              const deadline = effectiveLocksAt(segment, event.rosterLocksAt);
              const segmentBoard = boardsBySegment?.get(segment.id);

              return (
                <section key={segment.id} className="space-y-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
                    {segment.name}
                  </h2>
                  {!locked ? (
                    <LockedNotice label={segment.name} deadline={deadline.toISOString()} />
                  ) : !segmentBoard || segmentBoard.rosters.length === 0 ? (
                    <EmptyNotice
                      text={`Nadie ha guardado una alineación de fantasy para ${segment.name} todavía.`}
                    />
                  ) : !segmentBoard.hasScores ? (
                    <PendingScoresNotice label={segment.name} />
                  ) : (
                    <div className="space-y-3">
                      {segmentBoard.rosters.map((roster, index) => (
                        <RosterCard key={roster.rosterId} roster={roster} index={index} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
