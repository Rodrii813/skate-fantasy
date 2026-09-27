// Skeleton mostrado al instante mientras /competitions hace su consulta a la
// base de datos (la página es un Server Component con dynamic="force-dynamic").
// Sin este archivo, Next.js no pinta nada nuevo hasta que la consulta termina
// y la navegación se siente "congelada" un instante; con él, el usuario ve
// feedback inmediato al pulsar el enlace del menú.
export default function LoadingCompetitions() {
  return (
    <div className="min-h-screen text-ice-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-8 animate-pulse">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="h-7 w-56 rounded bg-white/10" />
            <div className="h-4 w-72 rounded bg-white/5" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-28 rounded-lg bg-white/5" />
            <div className="h-8 w-20 rounded-lg bg-white/5" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="h-5 w-3/4 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/10" />
              <div className="h-3 w-2/3 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
