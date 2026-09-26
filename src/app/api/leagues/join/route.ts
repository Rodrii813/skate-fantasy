import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Unirse a una liga privada existente mediante su código de invitación.
// Idempotente: si ya eres miembro, no hace nada raro (simplemente confirma).
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

    const { code } = await req.json();
    const normalizedCode = typeof code === "string" ? code.trim().toUpperCase() : "";

    if (!normalizedCode) {
      return NextResponse.json({ error: "Introduce un código de liga" }, { status: 400 });
    }

    const league = await prisma.league.findUnique({ where: { code: normalizedCode } });
    if (!league) {
      return NextResponse.json({ error: "No existe ninguna liga con ese código" }, { status: 404 });
    }

    await prisma.leagueMembership.upsert({
      where: { leagueId_userId: { leagueId: league.id, userId: user.id } },
      update: {},
      create: { leagueId: league.id, userId: user.id },
    });

    return NextResponse.json({ ok: true, leagueId: league.id });
  } catch (error) {
    console.error("Error al unirse a la liga:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
