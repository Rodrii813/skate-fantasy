import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  FREE_SKATING_SHORT_SLOTS,
  FREE_SKATING_LONG_SLOTS,
} from "@/lib/fantasyTemplates";

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acceso denegado: solo administradores" },
        { status: 403 }
      );
    }

    const { eventId } = params;
    const body = await req.json();
    const segmentType = body.segment as "SHORT" | "LONG";

    if (!segmentType) {
      return NextResponse.json(
        { error: "Falta especificar el segmento (SHORT o LONG)" },
        { status: 400 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 }
      );
    }

    const segmentName =
      segmentType === "SHORT" ? "Short Program" : "Long Program";
    const segmentOrder = segmentType === "SHORT" ? 1 : 2;
    const templates =
      segmentType === "SHORT"
        ? FREE_SKATING_SHORT_SLOTS
        : FREE_SKATING_LONG_SLOTS;

    // 1. Buscar o crear el Segmento para este evento
    let segment = await prisma.segment.findFirst({
      where: {
        eventId: event.id,
        name: segmentName,
      },
    });

    if (!segment) {
      segment = await prisma.segment.create({
        data: {
          eventId: event.id,
          name: segmentName,
          order: segmentOrder,
        },
      });
    }

    // 2. Limpiar slots previos vinculados a este segmento
    await prisma.fantasySlot.deleteMany({
      where: { segmentId: segment.id },
    });

    // 3. Crear las categorías si no existen y los slots
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      const categorySlug = generateSlug(t.name);

      let category = await prisma.elementCategory.findFirst({
        where: {
          OR: [
            { name: t.name },
            { slug: categorySlug },
          ],
        },
      });

      if (!category) {
        category = await prisma.elementCategory.create({
          data: {
            name: t.name,
            slug: categorySlug,
          },
        });
      }

      await prisma.fantasySlot.create({
        data: {
          eventId: event.id,
          segmentId: segment.id,
          label: t.name,
          order: i + 1,
          elementCategoryId: category.id,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Generados ${templates.length} slots para ${segmentName} correctamente`,
    });
  } catch (error: any) {
    console.error("Error generando slots:", error);
    return NextResponse.json(
      { error: error?.message || "Error interno al generar slots" },
      { status: 500 }
    );
  }
}