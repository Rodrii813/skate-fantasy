import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import FantasyRosterForm from "@/app/fantasy/[eventId]/FantasyRosterForm";

export default async function EventPage({ params }: { params: { id: string } }) {
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

  return (
    <div className="min-h-screen bg-[#070b18] text-slate-100 p-6 md:p-10">
      <FantasyRosterForm
        eventId={event.id}
        eventName={event.name}
        rosterLocksAt={event.rosterLocksAt.toISOString()}
        segments={event.segments}
        slots={event.slots}
        registrations={event.registrations}
        initialPicks={initialPicks}
      />
    </div>
  );
}