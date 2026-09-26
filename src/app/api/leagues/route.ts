import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateLeagueCode } from "@/lib/leagueCode";

// Crea una liga privada: el usuario logueado es el dueño y primer miembro
// automáticamente, y elige de una vez los eventos que puntúan en esta liga
// (no se pueden añadir/quitar eventos después, para que el ranking sea
// consistente para todos los miembros desde el primer día).
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const { name, eventIds } = await req.json();
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName) {
      return NextResponse.json({ error: "El nombre de la liga es obligatorio" }, { status: 400 });
    }
    if (trimmedName.length > 60) {
      return NextResponse.json({ error: "El nombre de la liga es demasiado largo (máx. 60 caracteres)" }, { status: 400 });
    }
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json({ error: "Selecciona al menos un evento para la liga" }, { status: 400 });
    }

    const validEvents = await prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true },
    });
    if (validEvents.length === 0) {
      return NextResponse.json({ error: "Los eventos seleccionados no son válidos" }, { status: 400 });
    }

    let league = null;
    for (let attempt = 0; attempt < 5 && !league; attempt++) {
      const code = generateLeagueCode();
      try {
        league = await prisma.league.create({
          data: {
            name: trimmedName,
            code,
            ownerId: user.id,
            events: { create: validEvents.map((e) => ({ eventId: e.id })) },
            memberships: { create: { userId: user.id } },
          },
        });
      } catch (err: any) {
        if (err?.code === "P2002") continue; // código duplicado (muy improbable) — reintenta
        throw err;
      }
    }

    if (!league) {
      return NextResponse.json(
        { error: "No se ha podido generar un código único para la liga, inténtalo de nuevo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, league });
  } catch (error) {
    console.error("Error al crear la liga:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
