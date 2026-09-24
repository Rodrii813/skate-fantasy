import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { rosterLocksAt: "desc" },
      include: {
        competition: true,
        discipline: true,
        category: true,
        slots: true,
        _count: { select: { registrations: true } },
      },
    });

    return NextResponse.json(events);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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

    const body = await req.json();
    const { name, competitionId, disciplineId, categoryId, rosterLocksAt } = body;

    if (!name || !competitionId || !disciplineId || !categoryId || !rosterLocksAt) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const newEvent = await prisma.event.create({
      data: {
        name,
        competitionId,
        disciplineId,
        categoryId,
        rosterLocksAt: new Date(rosterLocksAt),
      },
    });

    return NextResponse.json({ ok: true, event: newEvent });
  } catch (error: any) {
    console.error("Error creando evento:", error);
    return NextResponse.json({ error: error.message || "Error interno al crear evento" }, { status: 500 });
  }
}