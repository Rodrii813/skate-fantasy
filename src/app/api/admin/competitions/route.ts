import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const comps = await prisma.competition.findMany({
      orderBy: { startDate: "desc" },
      include: { _count: { select: { events: true } } },
    });
    return NextResponse.json(comps);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { name, location, startDate, endDate } = body;

    const comp = await prisma.competition.create({
      data: {
        name,
        location: location || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    return NextResponse.json({ ok: true, competition: comp });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { id, name, location, startDate, endDate } = body;

    const comp = await prisma.competition.update({
      where: { id },
      data: {
        name,
        location: location || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    return NextResponse.json({ ok: true, competition: comp });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Falta el ID" }, { status: 400 });

    // Borrado en cascada
    await prisma.competition.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
