import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

// Lista los patinadores inscritos en esta prueba, con sus datos y grupos de
// calentamiento por segmento — usada por la pantalla de admin
// "Patinadores Inscritos" para mostrar de verdad quién está inscrito (antes
// esa sección solo mostraba un texto fijo, sin listar a nadie ni poder
// quitar duplicados desde ahí).
export async function GET(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

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
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { eventId } = params;
    const body = await req.json();
    const { skaterId, warmupGroup, skatingOrder, segmentName } = body;

    // Igual que en la importación por PDF: si se indica el segmento
    // (Corto/Largo), el grupo de calentamiento se guarda en el campo
    // específico de ese segmento. Si no se indica nada, se asume
    // warmupGroupShort en vez del campo legado `warmupGroup` — el picker de
    // Fantasy (FantasyRosterForm) SOLO lee warmupGroupShort/warmupGroupLong
    // (warmupGroupShort para la pestaña única de un evento sin segmentos),
    // así que escribir en el campo legado dejaba a ese patinador sin grupo
    // real de cara a Fantasy (le tocaba siempre el grupo 1 por defecto, como
    // a todos los demás en su misma situación — el bug de "todos salen en el
    // mismo grupo").
    const normalizedSegment = (segmentName || "").trim().toLowerCase();
    const groupField = normalizedSegment.includes("long") ? "warmupGroupLong" : "warmupGroupShort";

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
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

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
