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
// 2. Echar a otra persona (userId !== tu propio id): puede hacerlo quien
//    creó la liga (a cualquiera que no sea él mismo), o un administrador
//    nombrado por el creador (ver PATCH más abajo) pero SOLO a miembros
//    normales — echar a otro administrador o al creador sigue siendo cosa
//    exclusiva de quien creó la liga.
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
      // No es el creador: solo puede echar si es administrador Y el
      // objetivo es un miembro normal (ni el creador ni otro admin).
      const requesterMembership = await prisma.leagueMembership.findUnique({
        where: { leagueId_userId: { leagueId: league.id, userId: requester.id } },
      });
      if (!requesterMembership?.isAdmin) {
        return NextResponse.json(
          { error: "Solo el creador o un administrador de la liga pueden echar a otros miembros" },
          { status: 403 }
        );
      }
      if (targetUserId === league.ownerId) {
        return NextResponse.json(
          { error: "No puedes echar a quien creó la liga" },
          { status: 403 }
        );
      }
      const targetMembership = await prisma.leagueMembership.findUnique({
        where: { leagueId_userId: { leagueId: league.id, userId: targetUserId } },
      });
      if (targetMembership?.isAdmin) {
        return NextResponse.json(
          { error: "Solo quien creó la liga puede echar a otro administrador" },
          { status: 403 }
        );
      }
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

// Nombra o quita a un administrador de la liga. Solo quien la creó puede
// hacerlo — un administrador no puede nombrar a otros administradores ni
// quitarse el cargo a sí mismo por aquí (evita que la liga se quede sin
// nadie de confianza si un admin se lía). El creador tampoco puede tocar su
// propia fila: siempre es admin de facto mientras siga siendo el dueño.
export async function PATCH(
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

    if (requester.id !== league.ownerId) {
      return NextResponse.json(
        { error: "Solo quien creó la liga puede nombrar o quitar administradores" },
        { status: 403 }
      );
    }

    const targetUserId = params.userId;
    if (targetUserId === league.ownerId) {
      return NextResponse.json(
        { error: "Quien creó la liga ya es administrador por defecto" },
        { status: 400 }
      );
    }

    const { isAdmin } = await req.json();
    if (typeof isAdmin !== "boolean") {
      return NextResponse.json({ error: "Falta indicar si debe ser administrador o no" }, { status: 400 });
    }

    const membership = await prisma.leagueMembership.findUnique({
      where: { leagueId_userId: { leagueId: league.id, userId: targetUserId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Esa persona no es miembro de la liga" }, { status: 404 });
    }

    await prisma.leagueMembership.update({ where: { id: membership.id }, data: { isAdmin } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al cambiar el rol de administrador:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
