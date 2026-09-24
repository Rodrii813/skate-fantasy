import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  // Consultar si hay eventos abiertos para picks/porras o en vivo
  const now = new Date();
  const upcomingEvents = await prisma.event.findMany({
    where: {
      rosterLocksAt: { gte: now },
      status: "UPCOMING",
    },
    include: { competition: true },
    orderBy: { rosterLocksAt: "asc" },
    take: 2,
  });

  const nextActiveEvent = upcomingEvents[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Barra superior minimalista estilo Rocker */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50 px-4 py-3.5 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-xl tracking-tight text-white flex items-center gap-1.5">
              SKATE<span className="text-indigo-400">HUB</span>
            </span>
            <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded tracking-widest font-semibold">
              BETA
            </span>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden sm:inline">
                  {session.user?.name || session.user?.email}
                </span>
                <Link
                  href="/admin"
                  className="text-xs bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 px-3 py-1.5 rounded-lg transition"
                >
                  Panel
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg transition shadow-sm"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-6xl mx-auto w-full px-4 py-8 sm:py-12 sm:px-8 space-y-8 flex-1">
        
        {/* Banner de evento destacado */}
        {nextActiveEvent ? (
          <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-black/40">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full animate-pulse">
                  ● DRAFTS & PORRAS OPEN
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {nextActiveEvent.competition.name}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-100">
                {nextActiveEvent.name}
              </h2>
              <p className="text-xs text-slate-400">
                Cierre de picks: {new Date(nextActiveEvent.rosterLocksAt).toLocaleDateString()} a las{" "}
                {new Date(nextActiveEvent.rosterLocksAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Link
                href={`/predictions?event=${nextActiveEvent.id}`}
                className="flex-1 sm:flex-none text-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition"
              >
                🎯 Jugar Porra
              </Link>
              <Link
                href={`/events/${nextActiveEvent.id}`}
                className="flex-1 sm:flex-none text-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition"
              >
                ✨ Crear Roster
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              El Hub del Patinaje Artístico
            </h1>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Sigue el calendario internacional, predice los podios de cada categoría y compite en el fantasy de Rollart.
            </p>
          </div>
        )}

        {/* Rejilla de Tarjetas táctiles (Móvil: 1 columna | Tablet: 2 cols | PC: 3 cols) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Card 1: Competition Hub */}
          <Link
            href="/competitions"
            className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition duration-200 flex flex-col justify-between min-h-[160px] active:scale-[0.98] shadow-lg shadow-black/30"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xl">
                🏆
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-blue-400 transition">
                  Competition Hub
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Calendario de competiciones, órdenes de salida y actas de resultados Rollart.
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-blue-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 mt-4">
              Ver calendario oficial →
            </span>
          </Link>

          {/* Card 2: Prediction Central */}
          <Link
            href="/predictions"
            className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition duration-200 flex flex-col justify-between min-h-[160px] active:scale-[0.98] shadow-lg shadow-black/30"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl">
                🎯
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-100 group-hover:text-emerald-400 transition">
                    Prediction Central
                  </h3>
                  <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    TOP 3/5
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Porras oficiales: predice los patinadores que subirán al podio en cada categoría.
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-emerald-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 mt-4">
              Hacer mis predicciones →
            </span>
          </Link>

          {/* Card 3: Fantasy Hub */}
          <Link
            href="/events"
            className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition duration-200 flex flex-col justify-between min-h-[160px] active:scale-[0.98] shadow-lg shadow-black/30"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl">
                ✨
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-indigo-400 transition">
                  Skate Fantasy
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Configura tu equipo por slots (saltos, giros, componentes) y suma puntos con los protocolos reales.
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-indigo-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 mt-4">
              Gestionar mis rosters →
            </span>
          </Link>

          {/* Card 4: Leaderboard / Clasificación */}
          <Link
            href="/leaderboard"
            className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition duration-200 flex flex-col justify-between min-h-[160px] active:scale-[0.98] shadow-lg shadow-black/30"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xl">
                📊
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-amber-400 transition">
                  Clasificación General
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Ranking acumulado de la temporada tanto para el Fantasy como para la Porra Central.
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-amber-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 mt-4">
              Ver tabla de puntos →
            </span>
          </Link>

          {/* Card 5: Reglas y Puntuación Rollart */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between min-h-[160px] opacity-90">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-xl">
                📋
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">
                  Sistema de Juego
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Top 3 exacto = 5 pts. Patinador en podio alterno = 2 pts. El fantasy suma las notas reales oficiales.
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-500 mt-4">
              Reglamento adaptado a la temporada 2026
            </span>
          </div>

          {/* Card 6: Acceso Rápido Registro / Login */}
          {!session ? (
            <div className="bg-gradient-to-br from-indigo-900/30 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 flex flex-col justify-between min-h-[160px]">
              <div className="space-y-2">
                <span className="text-xl">⛸️</span>
                <h3 className="text-lg font-bold text-slate-100">¿Aún no juegas?</h3>
                <p className="text-xs text-slate-400">
                  Crea tu cuenta gratis en 15 segundos para guardar tus porras y rosters.
                </p>
              </div>
              <Link
                href="/register"
                className="w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-md shadow-indigo-900/30 mt-4"
              >
                Crear Cuenta Gratis
              </Link>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between min-h-[160px]">
              <div className="space-y-2">
                <span className="text-xl">✅</span>
                <h3 className="text-lg font-bold text-slate-100">Sesión Activa</h3>
                <p className="text-xs text-slate-400">
                  Conectado como <strong className="text-slate-200">{session.user?.name || session.user?.email}</strong>.
                </p>
              </div>
              <Link
                href="/competitions"
                className="w-full text-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 rounded-xl border border-slate-700 transition mt-4"
              >
                Explorar Pruebas
              </Link>
            </div>
          )}

        </div>
      </main>

      {/* Footer minimalista */}
      <footer className="border-t border-slate-900 text-slate-600 text-xs py-6 text-center px-4">
        <p>SkateHub — Plataforma no oficial de seguimiento, Fantasy y Predicciones de Patinaje Artístico.</p>
      </footer>
    </div>
  );
}