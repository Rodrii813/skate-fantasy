import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateFantasyRoster } from "@/lib/fantasyValidation";
import { isSegmentLocked } from "@/lib/segments";

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
        slots: { select: { id: true, label: true, segmentId: true } },
        registrations: { select: { skaterId: true, warmupGroupShort: true, warmupGroupLong: true } },
        segments: { select: { id: true, order: true, locksAt: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
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

    // Cada segmento (Corto/Largo) tiene su propio plazo efectivo — ver
    // src/lib/segments.ts. Un slot sin segmentId (evento legado sin
    // segmentos configurados) usa directamente el rosterLocksAt del evento.
    // Se bloquea POR SLOT, no para el roster completo: un pick que cae en
    // un segmento ya cerrado se ignora en silencio (esa alineación ya
    // quedó fijada), mientras que los picks de un segmento todavía abierto
    // se validan y guardan con normalidad.
    const now = new Date();
    const lockedSegmentIds = new Set(
      event.segments.filter((seg) => isSegmentLocked(seg, event.rosterLocksAt, now)).map((s) => s.id)
    );
    const eventLevelLocked = now > event.rosterLocksAt;

    const isSlotLocked = (segmentId: string | null) =>
      segmentId ? lockedSegmentIds.has(segmentId) : eventLevelLocked;

    const unlockedSlotIds = new Set(event.slots.filter((s) => !isSlotLocked(s.segmentId)).map((s) => s.id));

    if (unlockedSlotIds.size === 0) {
      return NextResponse.json(
        { error: "El plazo para elegir patinadoras en este evento ya ha cerrado." },
        { status: 403 }
      );
    }

    // Mismas normas que ve el usuario en el formulario (grupos de
    // calentamiento, no repetir patinadora en técnica...), aplicadas aquí
    // de verdad, no solo sugeridas en el navegador. Solo se valida (y se
    // escribe) lo que cae en slots de segmentos todavía abiertos — los
    // picks de segmentos ya cerrados que llegue a mandar el cliente (p.ej.
    // porque siguen en su estado local) se descartan sin más, no hace
    // falta compararlos con lo ya guardado.
    const unlockedSlots = event.slots.filter((s) => unlockedSlotIds.has(s.id));
    const unlockedPicksMap: Record<string, string> = {};
    for (const p of normalizedPicks) {
      if (unlockedSlotIds.has(p.slotId)) unlockedPicksMap[p.slotId] = p.skaterId;
    }

    // OJO: aquí se pasa event.segments COMPLETO (Corto + Largo), no filtrado
    // a los abiertos. validateFantasyRoster decide qué segmentos validar de
    // verdad a partir de `slots` (ya filtrado a unlockedSlots) — pero usa
    // `segments` solo para saber el orden real (order) de cada uno y así
    // etiquetarlo como "Corto" o "Largo" y elegir warmupGroupShort vs
    // warmupGroupLong. Si aquí se pasara la lista ya filtrada (como se hacía
    // antes), en cuanto el Corto cerrase y solo quedase el Largo abierto,
    // el Largo pasaría a ser el ÚNICO elemento del array y se leería como
    // "el primer segmento" → se validaría con las normas y los grupos de
    // calentamiento del Corto, que es el segmento equivocado.
    const validation = validateFantasyRoster({
      slots: unlockedSlots,
      registrations: event.registrations,
      segments: event.segments,
      picks: unlockedPicksMap,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.errorMessage }, { status: 400 });
    }

    // 1. Obtener o crear el FantasyRoster del usuario para este evento.
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

    // 2. Reemplazar SOLO los picks de los slots de segmentos abiertos — los
    // de segmentos ya cerrados no se tocan, así la alineación fijada de
    // (p.ej.) el Corto sobrevive intacta aunque el usuario guarde cambios
    // en el Largo.
    const unlockedSlotIdList = Array.from(unlockedSlotIds);
    await prisma.$transaction([
      prisma.fantasyPick.deleteMany({
        where: { rosterId: roster.id, slotId: { in: unlockedSlotIdList } },
      }),
      prisma.fantasyPick.createMany({
        data: Object.entries(unlockedPicksMap).map(([slotId, skaterId]) => ({
          rosterId: roster.id,
          slotId,
          skaterId,
        })),
      }),
    ]);

    return NextResponse.json({ ok: true, count: Object.keys(unlockedPicksMap).length });
  } catch (error: any) {
    console.error("Error al guardar roster:", error);
    return NextResponse.json({ error: error?.message || "Error guardando roster" }, { status: 500 });
  }
}