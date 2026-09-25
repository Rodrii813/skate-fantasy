import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeSegmentResultBlocks } from "@/lib/segmentResults";
import SegmentResultsTables from "@/app/_components/SegmentResultsTables";

export const dynamic = "force-dynamic";

export default async function CompetitionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      competition: true,
      discipline: true,
      category: true,
      segments: {
        orderBy: { order: "asc" },
      },
      registrations: {
        include: {
          skater: true,
          elementScores: {
            include: {
              elementCategory: true,
              segment: true,
            },
          },
        },
        orderBy: [
          { finalRank: "asc" },
          { totalScore: "desc" },
        ],
      },
      _count: {
        select: {
          predictions: true,
          rosters: true,
        },
      },
    },
  });

  if (!event) notFound();

  const isLocked = event.status !== "UPCOMING";
  const resultBlocks = isLocked ? computeSegmentResultBlocks(event.segments, event.registrations) : [];

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

        {/* Cabecera del Evento estilo Rocker Hub */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono bg-indigo-950 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded">
                  {event.discipline.name}
                </span>
                <span className="text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded">
                  {event.category.name}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {event.competition.name}
                </span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-50 tracking-tight">{event.name}</h1>
              <p className="text-sm text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                <span>📍 {event.competition.location || "Sede oficial"}</span>
                <span>•</span>
                <span>
                  📅 Cierre de rosters: {new Date(event.rosterLocksAt).toLocaleDateString()} a las{" "}
                  {new Date(event.rosterLocksAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>
            </div>

            {/* Accesos directos a los modos de juego */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Link
                href={`/predictions?event=${event.id}`}
                className="flex-1 md:flex-none text-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-md shadow-blue-900/20"
              >
                🎯 Porra Top 3 / Top 5
              </Link>
              <Link
                href={`/events/${event.id}`}
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
              <p className="text-lg font-bold text-slate-200 mt-0.5">{event.registrations.length}</p>
            </div>
            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 text-xs">Segmentos</span>
              <p className="text-lg font-bold text-slate-200 mt-0.5">
                {event.segments.map((s) => s.name).join(" / ") || "—"}
              </p>
            </div>
            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 text-xs">Porras Realizadas</span>
              <p className="text-lg font-bold text-slate-200 mt-0.5">{event._count.predictions}</p>
            </div>
            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 text-xs">Rosters Fantasy</span>
              <p className="text-lg font-bold text-slate-200 mt-0.5">{event._count.rosters}</p>
            </div>
          </div>
        </div>

        {/* Resultados Oficiales (separados por segmento) / Inscripciones */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                {isLocked ? "Resultados Oficiales Rollart" : "Lista de Participantes / Starting Order"}
              </h2>
              <p className="text-xs text-slate-400">
                {isLocked
                  ? "Corto, Largo y Total, calculados al vuelo por segmento."
                  : "Patinadores confirmados para esta prueba."}
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-3 py-1 rounded-lg border border-slate-700">
              {event.registrations.length} Patinadores
            </span>
          </div>

          {event.registrations.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No hay patinadores registrados todavía en esta prueba.
            </div>
          ) : isLocked ? (
            <SegmentResultsTables blocks={resultBlocks} defaultOpen />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-800/60 text-slate-300 font-semibold border-b border-slate-700/80 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 w-16">Dorsal</th>
                    <th className="py-3 px-4">Patinador</th>
                    <th className="py-3 px-4">País</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {event.registrations.map((reg, index) => (
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
    </div>
  );
}