import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeEventLeaderboard, computeEventLeaderboardBySegment } from "@/lib/scoring";
import { isSegmentLocked, effectiveLocksAt } from "@/lib/segments";
import LocalDateTime from "@/app/_components/LocalDateTime";
import PaginatedRosterList from "./PaginatedRosterList";

export const dynamic = "force-dynamic";

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
            <PaginatedRosterList rosters={legacyBoard} />
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
                    <PaginatedRosterList rosters={segmentBoard.rosters} />
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
