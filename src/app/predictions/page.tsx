import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PredictionForm from "./PredictionForm";

export const dynamic = "force-dynamic";

export default async function PredictionsPage({
  searchParams,
}: {
  searchParams: { event?: string };
}) {
  const session = await getServerSession(authOptions);

  // Traer todos los eventos disponibles
  const events = await prisma.event.findMany({
    orderBy: { rosterLocksAt: "asc" },
    include: {
      competition: true,
      discipline: true,
      category: true,
      registrations: {
        include: { skater: true },
        orderBy: { skater: { lastName: "asc" } },
      },
    },
  });

  // Evento activo seleccionado o por defecto el primero
  const selectedEventId = searchParams.event || events[0]?.id;
  const activeEvent = events.find((e) => e.id === selectedEventId) || events[0];

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

  const isLocked = activeEvent ? new Date() > new Date(activeEvent.rosterLocksAt) || activeEvent.status !== "UPCOMING" : true;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Encabezado estilo Rocker Prediction Central */}
        <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              <h1 className="text-3xl font-extrabold tracking-tight">Prediction Central</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Acierta el podio o el Top 5 de cada categoría y compite en el ranking de porras.
            </p>
          </div>

          <Link
            href="/competitions"
            className="text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg hover:border-slate-500 transition"
          >
            Ver Calendario Oficial
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            No hay eventos disponibles para realizar predicciones.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selector de Evento */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Selecciona la prueba:
              </label>
              <div className="flex flex-wrap gap-2">
                {events.map((e) => (
                  <Link
                    key={e.id}
                    href={`/predictions?event=${e.id}`}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                      e.id === activeEvent.id
                        ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/20"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    {e.name}
                  </Link>
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
                      {activeEvent.competition.name} • 📍 {activeEvent.competition.location || "Sede oficial"}
                    </p>
                  </div>
                  <div>
                    {isLocked ? (
                      <span className="px-3 py-1 text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
                        🔒 Plazo Cerrado
                      </span>
                    ) : (
                      <span className="px-3 py-1 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">
                        ⏰ Cierra el {new Date(activeEvent.rosterLocksAt).toLocaleDateString()} a las{" "}
                        {new Date(activeEvent.rosterLocksAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Formulario */}
                {!session ? (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-8 text-center space-y-3">
                    <p className="text-sm text-slate-300">
                      Debes iniciar sesión para guardar tus predicciones.
                    </p>
                    <Link
                      href="/login"
                      className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                    >
                      Iniciar Sesión
                    </Link>
                  </div>
                ) : activeEvent.registrations.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-400">
                    Aún no hay patinadores inscritos en esta prueba para hacer la porra.
                  </div>
                ) : (
                  <PredictionForm
                    eventId={activeEvent.id}
                    isLocked={isLocked}
                    skaters={activeEvent.registrations.map((r) => r.skater)}
                    initialPrediction={userPrediction}
                  />
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}