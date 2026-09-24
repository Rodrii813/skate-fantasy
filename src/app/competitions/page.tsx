import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CompetitionsPage() {
  const competitions = await prisma.competition.findMany({
    orderBy: { startDate: "asc" },
    include: {
      events: {
        include: {
          discipline: true,
          category: true,
          _count: { select: { registrations: true, predictions: true } },
        },
        orderBy: { rosterLocksAt: "asc" },
      },
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "UPCOMING":
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">
            Abierto
          </span>
        );
      case "LOCKED":
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
            En Competición
          </span>
        );
      case "RESULTS_IN":
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-full">
            Resultados Parciales
          </span>
        );
      case "FINISHED":
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-700 text-slate-300 border border-slate-600 rounded-full">
            Finalizado
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Encabezado estilo Rocker Skating */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <h1 className="text-3xl font-extrabold tracking-tight">Competition Hub</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Calendario oficial, pruebas de la temporada, inscripciones y actas de resultados Rollart.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300">
              Temporada 2026
            </span>
          </div>
        </div>

        {/* Listado de Competiciones */}
        {competitions.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-slate-400 text-base">No hay competiciones registradas en el calendario.</p>
            <p className="text-slate-500 text-xs mt-2">Puedes añadir competiciones y eventos desde el panel de admin.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {competitions.map((comp) => (
              <div
                key={comp.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg shadow-black/40 space-y-5"
              >
                {/* Cabecera de la Competición */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-800/80 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-50 tracking-tight">{comp.name}</h2>
                    <p className="text-sm text-slate-400 flex items-center gap-3 mt-1">
                      <span>📍 {comp.location || "Sede oficial"}</span>
                      <span>•</span>
                      <span>
                        📅 {new Date(comp.startDate).toLocaleDateString()} – {new Date(comp.endDate).toLocaleDateString()}
                      </span>
                    </p>
                  </div>

                  {comp.website && (
                    <a
                      href={comp.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                    >
                      Web oficial / Stream ↗
                    </a>
                  )}
                </div>

                {/* Eventos / Categorías dentro de la competición */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Pruebas y Categorías Programadas ({comp.events.length})
                  </p>

                  <div className="grid gap-3">
                    {comp.events.map((event) => (
                      <div
                        key={event.id}
                        className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-indigo-950/70 border border-indigo-800/50 text-indigo-300">
                              {event.discipline.name}
                            </span>
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {event.category.name}
                            </span>
                            {getStatusBadge(event.status)}
                          </div>

                          <h3 className="text-lg font-bold text-slate-100">
                            {event.name}
                          </h3>

                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            <span>👥 {event._count.registrations} patinadores inscritos</span>
                            <span>•</span>
                            <span>🎯 {event._count.predictions} porras enviadas</span>
                            <span>•</span>
                            <span>
                              Cierre de picks: {new Date(event.rosterLocksAt).toLocaleDateString()} a las{" "}
                              {new Date(event.rosterLocksAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>

                        {/* Botones de acción directos */}
                        <div className="flex items-center gap-2 w-full md:w-auto">
                          <Link
                            href={`/competitions/${event.id}`}
                            className="flex-1 md:flex-none text-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg border border-slate-700 transition"
                          >
                            Hub y Resultados
                          </Link>
                          
                          <Link
                            href={`/predictions?event=${event.id}`}
                            className="flex-1 md:flex-none text-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-sm"
                          >
                            🎯 Porra Top 3/5
                          </Link>

                          <Link
                            href={`/events/${event.id}`}
                            className="flex-1 md:flex-none text-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-sm"
                          >
                            ✨ Fantasy
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}