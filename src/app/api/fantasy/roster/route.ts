import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const { eventId, picks } = body;

    if (!eventId || !picks) {
      return NextResponse.json({ error: "Faltan datos de la plantilla" }, { status: 400 });
    }

    // Normalizar picks a un formato plano consistente: Array<{ slotId: string, skaterId: string }>
    let normalizedPicks: { slotId: string; skaterId: string }[] = [];

    if (Array.isArray(picks)) {
      normalizedPicks = picks
        .map((p: any) => ({
          slotId: typeof p.slotId === "string" ? p.slotId : String(p.slotId),
          skaterId: typeof p.skaterId === "string" ? p.skaterId : p.skaterId?.skaterId,
        }))
        .filter((p) => p.slotId && p.skaterId);
    } else if (typeof picks === "object") {
      normalizedPicks = Object.entries(picks)
        .map(([slotId, value]: [string, any]) => ({
          slotId,
          skaterId: typeof value === "string" ? value : value?.skaterId,
        }))
        .filter((p) => p.slotId && p.skaterId);
    }

    // 1. Obtener o crear el FantasyRoster del usuario para este evento
    const roster = await prisma.fantasyRoster.upsert({
      where: {
        userId_eventId: {
          userId: user.id,
          eventId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        eventId,
      },
    });

    // 2. Limpiar picks anteriores de este roster
    await prisma.fantasyPick.deleteMany({
      where: { rosterId: roster.id },
    });

    // 3. Crear los nuevos picks garantizando que skaterId sea un String
    for (const item of normalizedPicks) {
      await prisma.fantasyPick.create({
        data: {
          rosterId: roster.id,
          slotId: item.slotId,
          skaterId: item.skaterId,
        },
      });
    }

    return NextResponse.json({ ok: true, count: normalizedPicks.length });
  } catch (error: any) {
    console.error("Error al guardar roster:", error);
    return NextResponse.json({ error: error?.message || "Error guardando roster" }, { status: 500 });
  }
}