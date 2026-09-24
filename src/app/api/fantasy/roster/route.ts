import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateFantasyRoster } from "@/lib/fantasyValidation";

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

    // Cargamos el evento con sus slots e inscripciones reales: es la única
    // fuente fiable para comprobar el plazo y las normas, porque lo que
    // manda el navegador (picks) no es de fiar por sí solo.
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        slots: { select: { id: true, label: true } },
        registrations: { select: { skaterId: true, warmupGroup: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    if (new Date() > event.rosterLocksAt) {
      return NextResponse.json(
        { error: "El plazo para elegir patinadoras en este evento ya ha cerrado." },
        { status: 403 }
      );
    }

    // Los slots y patinadoras elegidos tienen que pertenecer de verdad a
    // este evento (si no, se podría fichar a alguien de otra prueba, o
    // rellenar un slot que no existe).
    const validSlotIds = new Set(event.slots.map((s) => s.id));
    const validSkaterIds = new Set(event.registrations.map((r) => r.skaterId));
    for (const pick of normalizedPicks) {
      if (!validSlotIds.has(pick.slotId)) {
        return NextResponse.json(
          { error: "Uno de los slots no pertenece a este evento." },
          { status: 400 }
        );
      }
      if (!validSkaterIds.has(pick.skaterId)) {
        return NextResponse.json(
          { error: "Una de las patinadoras elegidas no está inscrita en este evento." },
          { status: 400 }
        );
      }
    }

    // Mismas normas que ve el usuario en el formulario (grupos de
    // calentamiento, no repetir patinadora en técnica...), aplicadas aquí
    // de verdad, no solo sugeridas en el navegador.
    const picksMap: Record<string, string> = {};
    for (const p of normalizedPicks) picksMap[p.slotId] = p.skaterId;

    const validation = validateFantasyRoster({
      slots: event.slots,
      registrations: event.registrations,
      picks: picksMap,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.errorMessage }, { status: 400 });
    }

    // 1. Obtener o crear el FantasyRoster del usuario para este evento, y
    // reemplazar sus picks anteriores de forma atómica.
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

    await prisma.$transaction([
      prisma.fantasyPick.deleteMany({ where: { rosterId: roster.id } }),
      prisma.fantasyPick.createMany({
        data: normalizedPicks.map((item) => ({
          rosterId: roster.id,
          slotId: item.slotId,
          skaterId: item.skaterId,
        })),
      }),
    ]);

    return NextResponse.json({ ok: true, count: normalizedPicks.length });
  } catch (error: any) {
    console.error("Error al guardar roster:", error);
    return NextResponse.json({ error: error?.message || "Error guardando roster" }, { status: 500 });
  }
}