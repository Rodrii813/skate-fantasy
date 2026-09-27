// Skeleton instantáneo para / (home) mientras se resuelven las consultas a
// Prisma en el servidor (evento activo, cuenta atrás) — ver la misma nota en
// /competitions/loading.tsx.
export default function LoadingHome() {
  return (
    <div className="min-h-screen text-ice-50 flex flex-col justify-between animate-pulse">
      <main className="w-full py-4 space-y-8 flex-1">
        {/* Cuenta atrás */}
        <div className="h-24 rounded-2xl border border-white/10 bg-white/5" />

        {/* Banner de evento destacado */}
        <div className="h-28 rounded-2xl border border-white/10 bg-white/5" />

        {/* Rejilla de tarjetas */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-h-[160px] rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="h-10 w-10 rounded-xl bg-white/10" />
              <div className="mt-4 h-4 w-2/3 rounded bg-white/10" />
              <div className="mt-2 h-3 w-full rounded bg-white/5" />
              <div className="mt-1 h-3 w-4/5 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
