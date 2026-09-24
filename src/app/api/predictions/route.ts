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

    const { eventId, rank1SkaterId, rank2SkaterId, rank3SkaterId, rank4SkaterId, rank5SkaterId } =
      await req.json();

    if (!eventId || !rank1SkaterId || !rank2SkaterId || !rank3SkaterId) {
      return NextResponse.json(
        { error: "Debes seleccionar al menos el Top 3 (1º, 2º y 3º puesto)" },
        { status: 400 }
      );
    }

    // Verificar que no se repita el mismo patinador en varios puestos
    const selectedSkaters = [
      rank1SkaterId,
      rank2SkaterId,
      rank3SkaterId,
      rank4SkaterId,
      rank5SkaterId,
    ].filter(Boolean);

    const hasDuplicates = new Set(selectedSkaters).size !== selectedSkaters.length;
    if (hasDuplicates) {
      return NextResponse.json(
        { error: "No puedes elegir al mismo patinador en diferentes posiciones" },
        { status: 400 }
      );
    }

    // Comprobar que el evento aún no haya cerrado
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    if (new Date() > new Date(event.rosterLocksAt) || event.status !== "UPCOMING") {
      return NextResponse.json(
        { error: "El plazo para enviar o modificar porras ya ha finalizado" },
        { status: 400 }
      );
    }

    // Guardar o actualizar la porra (upsert)
    const prediction = await prisma.prediction.upsert({
      where: {
        userId_eventId: {
          userId: user.id,
          eventId: eventId,
        },
      },
      update: {
        rank1SkaterId,
        rank2SkaterId,
        rank3SkaterId,
        rank4SkaterId: rank4SkaterId || null,
        rank5SkaterId: rank5SkaterId || null,
      },
      create: {
        userId: user.id,
        eventId,
        rank1SkaterId,
        rank2SkaterId,
        rank3SkaterId,
        rank4SkaterId: rank4SkaterId || null,
        rank5SkaterId: rank5SkaterId || null,
      },
    });

    return NextResponse.json({ ok: true, prediction });
  } catch (error) {
    console.error("Error al guardar predicción:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}