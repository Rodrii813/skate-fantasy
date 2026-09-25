import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LocalDateTime from "@/app/_components/LocalDateTime";
import TimezoneSelector from "@/app/_components/TimezoneSelector";
import { groupEventsByVenueDay } from "@/lib/calendarGrouping";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  UPCOMING: "Picks abiertos",
  LOCKED: "En pista",
  RESULTS_IN: "Resultados parciales",
  FINISHED: "Finalizado",
};

const genderLabel: Record<string, string> = {
  FEMALE: "Femenino",
  MALE: "Masculino",
};

export default async function CalendarioPage() {
  const events = await prisma.event.findMany({
    include: { competition: true, discipline: true, category: true },
  });

  const unscheduled = events.filter((e) => !e.scheduledAt);

  // La HORA exacta de cada fila sí varía según quién mira (ver
  // <LocalDateTime> más abajo); el DÍA en el que cae no — ver
  // src/lib/calendarGrouping.ts.
  const dayGroups = groupEventsByVenueDay(events);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-white">Calendario</h1>
          <p className="mt-2 text-sm text-ice-100/60">
            Programa oficial de la competición, evento a evento. Los días son los de la sede
            (Paraguay); las horas se muestran en tu zona horaria.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ice-100/60">
          <span>Mostrar horas en:</span>
          <TimezoneSelector />
        </div>
      </div>

      {unscheduled.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-ice-100/80">
            Horario por confirmar
          </h2>
          <ul className="mt-3 space-y-2">
            {unscheduled.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/25 hover:bg-white/10"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-accent">
                      {event.competition.name}
                    </p>
                    <p className="font-display text-base font-semibold text-white">{event.name}</p>
                    <p className="text-sm text-ice-100/60">
                      {event.discipline.name} · {event.category.name}
                      {event.gender ? ` · ${genderLabel[event.gender]}` : ""}
                    </p>
                  </div>
                  <span className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1 text-xs text-ice-100/80">
                    {statusLabel[event.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dayGroups.map((group) => (
        <section key={group.key} className="mt-8">
          <h2 className="font-display text-lg font-semibold capitalize text-white">
            {group.label}
          </h2>
          <ul className="mt-3 space-y-2">
            {group.events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/25 hover:bg-white/10"
                >
                  <div className="flex items-center gap-4">
                    <LocalDateTime
                      value={event.scheduledAt}
                      options={{ hour: "2-digit", minute: "2-digit" }}
                      className="font-display w-14 shrink-0 text-lg font-semibold text-gold"
                    />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-accent">
                        {event.competition.name}
                      </p>
                      <p className="font-display text-base font-semibold text-white">{event.name}</p>
                      <p className="text-sm text-ice-100/60">
                        {event.discipline.name} · {event.category.name}
                        {event.gender ? ` · ${genderLabel[event.gender]}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1 text-xs text-ice-100/80">
                    {statusLabel[event.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {events.length === 0 && <p className="mt-8 text-ice-100/60">Aún no hay eventos creados.</p>}
    </div>
  );
}
