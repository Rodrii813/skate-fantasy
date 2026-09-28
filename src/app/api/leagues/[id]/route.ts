import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Borra una liga privada por completo: solo puede hacerlo quien la creó. Las
// membresías y los LeagueEvent de esta liga se borran solos (onDelete:
// Cascade en el esquema), así que no hace falta borrarlos a mano aquí.
// A diferencia de "salir de la liga" (que solo te quita a ti), esto la
// borra para TODOS los miembros — por eso solo el creador puede hacerlo, no
// cualquier miembro.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const league = await prisma.league.findUnique({ where: { id: params.id } });
    if (!league) {
      return NextResponse.json({ error: "Liga no encontrada" }, { status: 404 });
    }

    if (league.ownerId !== user.id) {
      return NextResponse.json(
        { error: "Solo quien creó la liga puede borrarla" },
        { status: 403 }
      );
    }

    await prisma.league.delete({ where: { id: league.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al borrar la liga:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
