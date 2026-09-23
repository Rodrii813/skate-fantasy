import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// body: { eventId: string, picks: { slotId: string, skaterId: string }[] }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Tienes que iniciar sesión." }, { status: 401 });
  }

  const { eventId, picks } = await req.json();
  if (!eventId || !Array.isArray(picks)) {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { slots: true },
  });
  if (!event) return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });

  if (new Date() > event.rosterLocksAt || event.status !== "UPCOMING") {
    return NextResponse.json(
      { error: "El plazo para elegir patinadores en este evento ya ha cerrado." },
      { status: 403 }
    );
  }

  const validSlotIds = new Set(event.slots.map((s) => s.id));
  for (const pick of picks) {
    if (!validSlotIds.has(pick.slotId)) {
      return NextResponse.json({ error: "Slot inválido para este evento." }, { status: 400 });
    }
  }

  const userId = (session.user as any).id as string;

  const roster = await prisma.fantasyRoster.upsert({
    where: { userId_eventId: { userId, eventId } },
    create: { userId, eventId },
    update: {},
  });

  // Reemplaza todos los picks del roster por los nuevos (más simple y evita
  // estados inconsistentes si el usuario cambia de idea varias veces).
  await prisma.$transaction([
    prisma.fantasyPick.deleteMany({ where: { rosterId: roster.id } }),
    prisma.fantasyPick.createMany({
      data: picks.map((p: { slotId: string; skaterId: string }) => ({
        rosterId: roster.id,
        slotId: p.slotId,
        skaterId: p.skaterId,
      })),
    }),
  ]);

  return NextResponse.json({ ok: true, rosterId: roster.id });
}
