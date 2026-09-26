import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { zonedTimeToUtc, VENUE_TIMEZONE } from "@/lib/timezone";

// Permite al admin fijar (o quitar):
// - El plazo de fichaje propio de UN segmento (locksAt), independiente del
//   rosterLocksAt general del Event — ver src/lib/segments.ts.
// - La hora de APERTURA propia de ese segmento (opensAt): antes de esa hora
//   el estado es "Upcoming" aunque ya existan los slots — pensado para el
//   Largo, que puede tener el draft generado con antelación pero no debe
//   abrirse hasta que se sepa el resultado del Corto (a veces al día
//   siguiente). Si es null, se abre en cuanto tiene slots (de siempre).
// - Un override manual (manuallyOpened) para abrir el segmento a mano
//   aunque `opensAt` todavía no haya llegado.
// - La hora de pista propia de ese segmento para el calendario
//   (scheduledAt), si va a horas distintas del resto del evento.
// - Un split de horario dentro del MISMO segmento (splitLabel +
//   splitScheduledAt): mismos inscritos/picks/resultado, pero la sesión se
//   reparte en dos bloques a horas distintas (p.ej. Largo "Top 10" y
//   "Resto") — ver src/lib/calendarGrouping.ts.
// Cada campo se actualiza solo si viene presente en el body, para poder
// guardar unos sin tocar los otros.
export async function PATCH(
  req: Request,
  { params }: { params: { eventId: string; segmentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Acceso denegado: solo administradores" }, { status: 403 });
    }

    const { eventId, segmentId } = params;

    const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
    if (!segment || segment.eventId !== eventId) {
      return NextResponse.json({ error: "Segmento no encontrado en este evento" }, { status: 404 });
    }

    const body = await req.json();
    const {
      locksAt,
      opensAt,
      manuallyOpened,
      scheduledAt,
      scheduleLabel,
      splitLabel,
      splitScheduledAt,
    } = body as {
      locksAt?: string | null;
      opensAt?: string | null;
      manuallyOpened?: boolean;
      scheduledAt?: string | null;
      scheduleLabel?: string | null;
      splitLabel?: string | null;
      splitScheduledAt?: string | null;
    };

    const data: Record<string, unknown> = {};
    // locksAt vacío/null -> quita el override y el segmento vuelve a
    // heredar el rosterLocksAt del evento.
    if (locksAt !== undefined) data.locksAt = locksAt ? zonedTimeToUtc(locksAt, VENUE_TIMEZONE) : null;
    // opensAt vacío/null -> el segmento vuelve a abrirse en cuanto tenga
    // slots generados, sin hora de apertura propia.
    if (opensAt !== undefined) data.opensAt = opensAt ? zonedTimeToUtc(opensAt, VENUE_TIMEZONE) : null;
    if (manuallyOpened !== undefined) data.manuallyOpened = Boolean(manuallyOpened);
    if (scheduledAt !== undefined)
      data.scheduledAt = scheduledAt ? zonedTimeToUtc(scheduledAt, VENUE_TIMEZONE) : null;
    if (scheduleLabel !== undefined) data.scheduleLabel = scheduleLabel || null;
    if (splitLabel !== undefined) data.splitLabel = splitLabel || null;
    if (splitScheduledAt !== undefined)
      data.splitScheduledAt = splitScheduledAt ? zonedTimeToUtc(splitScheduledAt, VENUE_TIMEZONE) : null;

    const updated = await prisma.segment.update({
      where: { id: segmentId },
      data,
    });

    return NextResponse.json({ ok: true, segment: updated });
  } catch (error: any) {
    console.error("Error actualizando el plazo del segmento:", error);
    return NextResponse.json(
      { error: error?.message || "Error interno al actualizar el segmento" },
      { status: 500 }
    );
  }
}