import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

// El código tiene 6 caracteres de un alfabeto de 33 (más de mil millones de
// combinaciones, ver src/lib/leagueCode.ts), así que adivinarlo a fuerza
// bruta no es viable ni con esto — pero igualmente limitamos los intentos
// por cuenta para frenar un script que fuera probando códigos sin parar.
const JOIN_LIMIT = 20;
const JOIN_WINDOW_MS = 60 * 60 * 1000;

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

    const limit = checkRateLimit(`join-league:${user.id}`, JOIN_LIMIT, JOIN_WINDOW_MS);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "Demasiados intentos de unirte a una liga. Prueba de nuevo más tarde.");
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
