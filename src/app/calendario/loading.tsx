// Skeleton instantáneo para /calendario mientras se resuelve la consulta a
// Prisma en el servidor — ver nota en /competitions/loading.tsx.
export default function LoadingCalendario() {
  return (
    <div className="animate-pulse">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-white/10" />
          <div className="h-4 w-64 rounded bg-white/5" />
        </div>
        <div className="h-8 w-40 rounded-lg bg-white/5" />
      </div>

      <div className="mt-8 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-4 w-40 rounded bg-white/10" />
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-10 rounded-lg bg-white/5" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
