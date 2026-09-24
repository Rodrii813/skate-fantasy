import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreEventPredictions } from "@/lib/calculatePredictions";

export async function POST(req: Request) {
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

    const { eventId } = await req.json();
    if (!eventId) {
      return NextResponse.json({ error: "Falta el ID del evento" }, { status: 400 });
    }

    const result = await scoreEventPredictions(eventId);

    return NextResponse.json({ ok: true, scoredCount: result.updated });
  } catch (error) {
    console.error("Error puntuando predicciones:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}