import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { zonedTimeToUtc, VENUE_TIMEZONE } from "@/lib/timezone";

// Permite al admin fijar (o quitar) el plazo de fichaje propio de UN
// segmento (Corto o Largo), independiente del rosterLocksAt general del
// Event — ver src/lib/segments.ts para cómo se resuelve el plazo efectivo.
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
    const { locksAt } = body as { locksAt: string | null };

    // locksAt vacío/null -> quita el override y el segmento vuelve a
    // heredar el rosterLocksAt del evento.
    const updated = await prisma.segment.update({
      where: { id: segmentId },
      data: { locksAt: locksAt ? zonedTimeToUtc(locksAt, VENUE_TIMEZONE) : null },
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
