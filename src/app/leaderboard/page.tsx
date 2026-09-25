import Link from "next/link";

// El ranking (Fantasy y Predicciones, por evento y global por competición)
// ahora vive en /fantasy y /predictions respectivamente — ver CAMBIO 6 de
// la reestructuración de navegación. Esta página ya no está enlazada desde
// la barra principal, pero se deja como página de compatibilidad (en vez de
// borrarla y devolver 404) para cualquier enlace o marcador antiguo que
// apunte aquí.
export default function LeaderboardCompatPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 flex items-center justify-center">
      <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-5 shadow-lg shadow-black/40">
        <span className="text-3xl">📊</span>
        <div>
          <h1 className="text-xl font-bold text-slate-100">El ranking se movió</h1>
          <p className="text-sm text-slate-400 mt-2">
            Ahora cada modo de juego tiene su propio ranking, por evento y también acumulado por
            competición completa.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/fantasy"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
          >
            ✨ Ranking Fantasy
          </Link>
          <Link
            href="/predictions"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
          >
            🎯 Ranking de Predicciones
          </Link>
        </div>
      </div>
    </div>
  );
}
