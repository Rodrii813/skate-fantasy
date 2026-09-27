// Skeleton instantáneo para /fantasy mientras se resuelve la consulta a
// Prisma en el servidor — ver nota en /competitions/loading.tsx.
export default function LoadingFantasy() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="space-y-2">
        <div className="h-7 w-40 rounded bg-white/10" />
        <div className="h-4 w-80 rounded bg-white/5" />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-44 rounded-lg bg-white/5" />
        <div className="h-9 w-44 rounded-lg bg-white/5" />
      </div>

      <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 rounded-lg bg-white/5" />
        ))}
      </div>

      <div className="space-y-3">
        <div className="h-5 w-56 rounded bg-white/10" />
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
