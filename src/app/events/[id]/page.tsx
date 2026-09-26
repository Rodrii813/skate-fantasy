import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import FantasyRosterForm from "@/app/fantasy/[eventId]/FantasyRosterForm";
import { effectiveLocksAt, isSegmentLocked, isSegmentOpenByTime } from "@/lib/segments";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { segment?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect(`/login?callbackUrl=/events/${params.id}`);
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      segments: {
        orderBy: { order: "asc" },
      },
      slots: {
        orderBy: { order: "asc" },
      },
      registrations: {
        include: { skater: true },
        orderBy: [{ startOrder: "asc" }],
      },
    },
  });

  if (!event) notFound();

  // Buscar picks previos del usuario si ya los había guardado
  let initialPicks: Record<string, string> = {};
  if (user) {
    const existingRoster = await prisma.fantasyRoster.findUnique({
      where: {
        userId_eventId: {
          userId: user.id,
          eventId: event.id,
        },
      },
      include: { picks: true },
    });

    if (existingRoster) {
      for (const p of existingRoster.picks) {
        initialPicks[p.slotId] = p.skaterId;
      }
    }
  }

  // El plazo efectivo y el estado de bloqueo de cada segmento se calculan
  // aquí, en el servidor, con la hora del servidor — así el HTML inicial
  // (SSR) y la hidratación en el cliente ven siempre el mismo "ahora" y no
  // hay parpadeo/discrepancia de hidratación por calcularlo en el cliente.
  const segmentsWithLock = event.segments.map((seg) => {
    // "Bloqueado" para el formulario significa dos cosas distintas que se
    // tratan igual de cara a impedir editar: el plazo ya cerró (locksAt
    // pasado), o el segmento todavía no se ha abierto (opensAt futuro y sin
    // abrir a mano) — un segmento como el Largo puede tener sus slots
    // generados con antelación pero no debe poder tocarse hasta esa hora.
    // `upcoming` distingue el segundo caso solo para mostrar el mensaje
    // correcto ("aún no abierto" en vez de "ya ha cerrado").
    const closed = isSegmentLocked(seg, event.rosterLocksAt);
    const notYetOpen = !closed && !isSegmentOpenByTime(seg);
    return {
      id: seg.id,
      name: seg.name,
      order: seg.order,
      locksAt: effectiveLocksAt(seg, event.rosterLocksAt).toISOString(),
      locked: closed || notYetOpen,
      upcoming: notYetOpen,
    };
  });

  return (
    <div className="min-h-screen bg-[#070b18] text-slate-100 p-6 md:p-10">
      <FantasyRosterForm
        eventId={event.id}
        eventName={event.name}
        rosterLocksAt={event.rosterLocksAt.toISOString()}
        eventLocked={new Date() > event.rosterLocksAt}
        segments={segmentsWithLock}
        slots={event.slots}
        registrations={event.registrations}
        initialPicks={initialPicks}
        initialSegmentId={searchParams.segment}
      />
    </div>
  );
}