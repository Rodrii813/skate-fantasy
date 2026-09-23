import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const upcoming = await prisma.event.findMany({
    where: { status: "UPCOMING" },
    orderBy: { rosterLocksAt: "asc" },
    take: 4,
    include: { competition: true, discipline: true, category: true },
  });

  return (
    <div>
      <section className="py-10">
        <p className="mb-3 text-sm uppercase tracking-widest text-accent/80">
          Fantasy no oficial · World Skate Games
        </p>
        <h1 className="font-display max-w-3xl text-5xl font-black leading-[1.05] text-white sm:text-6xl">
          Tú eliges quién patina en tu equipo. La pista decide quién puntúa.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ice-100/80">
          Para cada programa, elige un patinador distinto para cada elemento — saltos,
          giros, secuencias, componentes — y suma su puntuación oficial real. Compite
          contra el resto del mundo en el ranking global.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/events"
            className="rounded-full bg-gold px-6 py-3 font-semibold text-rink hover:bg-gold/90"
          >
            Ver eventos abiertos
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-full border border-white/20 px-6 py-3 font-semibold text-white hover:border-white/40"
          >
            Ranking global
          </Link>
        </div>
      </section>

      <section className="mt-8 border-t border-white/10 pt-10">
        <h2 className="font-display text-2xl font-semibold text-white">Próximos cierres de roster</h2>
        {upcoming.length === 0 ? (
          <p className="mt-4 text-ice-100/70">
            Todavía no hay eventos abiertos. Un admin tiene que crearlos desde el panel.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {upcoming.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-gold/50"
                >
                  <p className="text-xs uppercase tracking-wide text-accent">{e.competition.name}</p>
                  <p className="font-display mt-1 text-xl font-semibold text-white">{e.name}</p>
                  <p className="mt-2 text-sm text-ice-100/70">
                    {e.discipline.name} · {e.category.name}
                  </p>
                  <p className="mt-3 text-sm text-gold">
                    Cierra el {new Date(e.rosterLocksAt).toLocaleString("es-ES")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
