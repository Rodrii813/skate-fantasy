import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Lista los patinadores inscritos en esta prueba, con sus datos y grupos de
// calentamiento por segmento — usada por la pantalla de admin
// "Patinadores Inscritos" para mostrar de verdad quién está inscrito (antes
// esa sección solo mostraba un texto fijo, sin listar a nadie ni poder
// quitar duplicados desde ahí).
export async function GET(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const registrations = await prisma.registration.findMany({
      where: { eventId: params.eventId },
      include: { skater: true },
      orderBy: [{ startOrder: "asc" }],
    });
    return NextResponse.json(registrations);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { eventId } = params;
    const body = await req.json();
    const { skaterId, warmupGroup, skatingOrder, segmentName } = body;

    // Igual que en la importación por PDF: si se indica el segmento
    // (Corto/Largo), el grupo de calentamiento se guarda en el campo
    // específico de ese segmento; si no se indica nada, cae en el campo
    // legado `warmupGroup` (compatibilidad con inscripciones antiguas sin
    // segmentos). Antes este formulario SIEMPRE escribía en el campo legado,
    // así que un patinador metido a mano aquí nunca aparecía con grupo en el
    // picker de Fantasy, que ya solo mira los campos por segmento.
    const normalizedSegment = (segmentName || "").trim().toLowerCase();
    const groupField = normalizedSegment.includes("short")
      ? "warmupGroupShort"
      : normalizedSegment.includes("long")
        ? "warmupGroupLong"
        : "warmupGroup";

    const reg = await prisma.registration.upsert({
      where: {
        eventId_skaterId: {
          eventId,
          skaterId,
        },
      },
      update: {
        [groupField]: Number(warmupGroup) || 1,
        startOrder: Number(skatingOrder) || 1,
      },
      create: {
        eventId,
        skaterId,
        [groupField]: Number(warmupGroup) || 1,
        startOrder: Number(skatingOrder) || 1,
      },
    });

    return NextResponse.json({ ok: true, registration: reg });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const skaterId = searchParams.get("skaterId");
    if (!skaterId) return NextResponse.json({ error: "Falta el skaterId" }, { status: 400 });

    await prisma.registration.delete({
      where: {
        eventId_skaterId: {
          eventId: params.eventId,
          skaterId,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}