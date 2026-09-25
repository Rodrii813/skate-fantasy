import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { zonedTimeToUtc, VENUE_TIMEZONE } from "@/lib/timezone";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (user?.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Acceso denegado: solo administradores" }, { status: 403 }) };
  }

  return { user };
}

export async function PATCH(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { eventId } = params;

    const existing = await prisma.event.findUnique({ where: { id: eventId } });
    if (!existing) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const { name, competitionId, disciplineId, categoryId, rosterLocksAt, gender, scheduledAt, showFormat } = body;

    if (gender !== undefined && gender !== null && gender !== "MALE" && gender !== "FEMALE") {
      return NextResponse.json({ error: "Género inválido" }, { status: 400 });
    }

    if (
      showFormat !== undefined &&
      showFormat !== null &&
      showFormat !== "QUARTET" &&
      showFormat !== "SMALL_GROUP" &&
      showFormat !== "LARGE_GROUP"
    ) {
      return NextResponse.json({ error: "Formato de Show inválido" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (competitionId !== undefined) data.competitionId = competitionId;
    if (disciplineId !== undefined) data.disciplineId = disciplineId;
    if (categoryId !== undefined) data.categoryId = categoryId;
    // Mismo criterio que el POST: el datetime-local del admin es hora de la
    // sede (Paraguay), se convierte a UTC de verdad antes de guardar.
    if (rosterLocksAt !== undefined) data.rosterLocksAt = zonedTimeToUtc(rosterLocksAt, VENUE_TIMEZONE);
    if (gender !== undefined) data.gender = gender || null;
    if (scheduledAt !== undefined)
      data.scheduledAt = scheduledAt ? zonedTimeToUtc(scheduledAt, VENUE_TIMEZONE) : null;
    if (showFormat !== undefined) data.showFormat = showFormat || null;

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data,
    });

    return NextResponse.json({ ok: true, event: updatedEvent });
  } catch (error: any) {
    console.error("Error actualizando evento:", error);
    return NextResponse.json({ error: error.message || "Error interno al actualizar evento" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { eventId } = params;

    const existing = await prisma.event.findUnique({ where: { id: eventId } });
    if (!existing) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    // Borrado en cascada explícito dentro de una transacción, en orden de
    // dependencia (hijos antes que padres), para no depender únicamente de
    // las restricciones ON DELETE CASCADE del schema y evitar registros
    // huérfanos o errores de clave foránea.
    await prisma.$transaction([
      // ElementScore depende de Registration y de Segment; basta con
      // filtrar por Registration del evento porque toda ElementScore
      // pertenece siempre a una Registration de este mismo evento.
      prisma.elementScore.deleteMany({ where: { registration: { eventId } } }),
      // FantasyPick depende de FantasySlot y de FantasyRoster; basta con
      // filtrar por FantasyRoster del evento por la misma razón.
      prisma.fantasyPick.deleteMany({ where: { roster: { eventId } } }),
      prisma.fantasyRoster.deleteMany({ where: { eventId } }),
      prisma.prediction.deleteMany({ where: { eventId } }),
      prisma.registration.deleteMany({ where: { eventId } }),
      prisma.fantasySlot.deleteMany({ where: { eventId } }),
      prisma.segment.deleteMany({ where: { eventId } }),
      prisma.event.delete({ where: { id: eventId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error borrando evento:", error);
    return NextResponse.json({ error: error.message || "Error interno al borrar evento" }, { status: 500 });
  }
}
