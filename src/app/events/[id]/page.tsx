import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEventLeaderboard } from "@/lib/scoring";
import RosterBuilder from "./roster-builder";

export default async function EventPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      competition: true,
      discipline: true,
      category: true,
      slots: { include: { elementCategory: true, segment: true }, orderBy: { order: "asc" } },
      registrations: { include: { skater: true } },
    },
  });

  if (!event) {
    return <p className="py-10 text-ice-100/70">Evento no encontrado.</p>;
  }

  let existingPicks: { slotId: string; skaterId: string }[] = [];
  if (session?.user) {
    const roster = await prisma.fantasyRoster.findUnique({
      where: { userId_eventId: { userId: (session.user as any).id, eventId: event.id } },
      include: { picks: true },
    });
    existingPicks = roster?.picks.map((p) => ({ slotId: p.slotId, skaterId: p.skaterId })) ?? [];
  }

  const leaderboard = await computeEventLeaderboard(event.id);
  const locked = new Date() > event.rosterLocksAt || event.status !== "UPCOMING";

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-accent">{event.competition.name}</p>
      <h1 className="font-display mt-1 text-3xl font-semibold text-white">{event.name}</h1>
      <p className="mt-1 text-ice-100/60">
        {event.discipline.name} · {event.category.name} · cierra el{" "}
        {new Date(event.rosterLocksAt).toLocaleString("es-ES")}
      </p>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold text-white">Tu equipo</h2>
        {!session?.user ? (
          <p className="mt-3 text-ice-100/70">
            <a href="/login" className="text-gold hover:underline">
              Inicia sesión
            </a>{" "}
            para elegir a tus patinadores.
          </p>
        ) : (
          <RosterBuilder
            eventId={event.id}
            locked={locked}
            slots={event.slots.map((s) => ({
              id: s.id,
              label: s.label,
              elementCategoryName: s.elementCategory.name,
              segmentName: s.segment?.name ?? null,
            }))}
            skaters={event.registrations.map((r) => ({
              id: r.skater.id,
              name: `${r.skater.firstName} ${r.skater.lastName}`,
              country: r.skater.country,
            }))}
            initialPicks={existingPicks}
          />
        )}
      </section>

      <section className="mt-12 border-t border-white/10 pt-8">
        <h2 className="font-display text-xl font-semibold text-white">Clasificación del evento</h2>
        {leaderboard.length === 0 ? (
          <p className="mt-3 text-ice-100/60">Todavía nadie ha hecho su equipo.</p>
        ) : (
          <ol className="mt-4 space-y-2">
            {leaderboard.map((row, i) => (
              <li
                key={row.rosterId}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <span className="flex items-center gap-3">
                  <span className="scoreboard-num w-6 text-ice-100/50">{i + 1}</span>
                  <span className="text-white">{row.userName}</span>
                </span>
                <span className="scoreboard-num font-semibold text-gold">{row.total.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
