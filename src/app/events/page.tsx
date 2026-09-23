import Link from "next/link";
import { prisma } from "@/lib/prisma";

const statusLabel: Record<string, string> = {
  UPCOMING: "Picks abiertos",
  LOCKED: "En pista",
  RESULTS_IN: "Resultados parciales",
  FINISHED: "Finalizado",
};

export default async function EventsPage() {
  const events = await prisma.event.findMany({
    orderBy: { rosterLocksAt: "desc" },
    include: { competition: true, discipline: true, category: true },
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-white">Eventos</h1>
      <ul className="mt-8 divide-y divide-white/10">
        {events.map((e) => (
          <li key={e.id} className="py-4">
            <Link href={`/events/${e.id}`} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-accent">{e.competition.name}</p>
                <p className="font-display text-lg font-semibold text-white">{e.name}</p>
                <p className="text-sm text-ice-100/60">
                  {e.discipline.name} · {e.category.name}
                </p>
              </div>
              <span className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1 text-xs text-ice-100/80">
                {statusLabel[e.status]}
              </span>
            </Link>
          </li>
        ))}
        {events.length === 0 && <p className="py-6 text-ice-100/60">Aún no hay eventos creados.</p>}
      </ul>
    </div>
  );
}
