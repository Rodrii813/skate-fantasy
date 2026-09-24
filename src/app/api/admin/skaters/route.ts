import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const skaters = await prisma.skater.findMany({
      orderBy: { lastName: "asc" },
      include: {
        discipline: true,
        category: true,
        registrations: {
          include: {
            event: true,
          },
        },
      },
    });
    return NextResponse.json(skaters);
  } catch (error: any) {
    console.error("Error cargando patinadores:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (user?.role !== "ADMIN") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const body = await req.json();
    const { id, firstName, lastName, country } = body;

    const skater = await prisma.skater.update({
      where: { id },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        country: country?.trim().toUpperCase() || "ESP",
      },
    });

    return NextResponse.json({ ok: true, skater });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (user?.role !== "ADMIN") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

    await prisma.fantasyPick.deleteMany({ where: { skaterId: id } });
    await prisma.registration.deleteMany({ where: { skaterId: id } });
    await prisma.skater.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}