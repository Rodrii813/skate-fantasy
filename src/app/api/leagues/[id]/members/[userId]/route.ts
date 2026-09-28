import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Quita a alguien de una liga privada. Dos casos posibles, con reglas
// distintas de quién puede hacerlo:
//
// 1. Salir tú mismo (userId === tu propio id): cualquier miembro puede
//    hacerlo EXCEPTO quien creó la liga — si el creador se fuera, la liga se
//    quedaría sin dueño, así que tiene que borrarla entera en su lugar (ver
//    DELETE /api/leagues/[id]).
// 2. Echar a otra persona (userId !== tu propio id): solo puede hacerlo
//    quien creó la liga, y no puede echarse a sí mismo por esta vía ni
//    (obviamente) echar a otra persona si no es el dueño.
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const requester = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!requester) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const league = await prisma.league.findUnique({ where: { id: params.id } });
    if (!league) {
      return NextResponse.json({ error: "Liga no encontrada" }, { status: 404 });
    }

    const targetUserId = params.userId;
    const isSelf = targetUserId === requester.id;
    const isOwner = requester.id === league.ownerId;

    if (isSelf) {
      if (isOwner) {
        return NextResponse.json(
          { error: "Quien creó la liga no puede salir de ella; puedes borrarla si ya no la quieres." },
          { status: 400 }
        );
      }
    } else if (!isOwner) {
      return NextResponse.json(
        { error: "Solo quien creó la liga puede echar a otros miembros" },
        { status: 403 }
      );
    } else if (targetUserId === league.ownerId) {
      // No debería poder pasar (el dueño no aparece como "echable" en la UI),
      // pero por si acaso llega una llamada directa a la API.
      return NextResponse.json(
        { error: "El creador de la liga no se puede echar a sí mismo" },
        { status: 400 }
      );
    }

    const membership = await prisma.leagueMembership.findUnique({
      where: { leagueId_userId: { leagueId: league.id, userId: targetUserId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Esa persona no es miembro de la liga" }, { status: 404 });
    }

    await prisma.leagueMembership.delete({ where: { id: membership.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al quitar al miembro de la liga:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
