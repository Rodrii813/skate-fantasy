import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  FREE_SKATING_SHORT_SLOTS,
  FREE_SKATING_LONG_SLOTS,
  SOLO_DANCE_STYLE_SLOTS,
  SOLO_DANCE_FREE_SLOTS,
  PAIRS_SHORT_SLOTS,
  PAIRS_FREE_SLOTS,
  COUPLE_DANCE_STYLE_SLOTS,
  COUPLE_DANCE_FREE_SLOTS,
  SHOW_QUARTET_SLOTS,
  SHOW_GROUP_SLOTS,
  type SlotTemplate,
} from "@/lib/fantasyTemplates";

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Crea (o reutiliza) un Segmento y genera sus slots a partir de una
// plantilla. Reutilizada tanto por el flujo Corto/Largo (Libre, Danza,
// Parejas...) como por el flujo de un \u00fanico programa por formato (Show).
async function generateSlotsForSegment(
  eventId: string,
  segmentName: string,
  segmentOrder: number,
  templates: SlotTemplate[]
) {
  // 1. Buscar o crear el Segmento para este evento
  let segment = await prisma.segment.findFirst({
    where: { eventId, name: segmentName },
  });

  if (!segment) {
    segment = await prisma.segment.create({
      data: { eventId, name: segmentName, order: segmentOrder },
    });
  }

  // 2. Limpiar slots previos vinculados a este segmento
  await prisma.fantasySlot.deleteMany({
    where: { segmentId: segment.id },
  });

  // 3. Crear las categor\u00edas si no existen y los slots
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const categorySlug = generateSlug(t.name);

    let category = await prisma.elementCategory.findFirst({
      where: {
        OR: [{ name: t.name }, { slug: categorySlug }],
      },
    });

    if (!category) {
      category = await prisma.elementCategory.create({
        data: { name: t.name, slug: categorySlug },
      });
    }

    await prisma.fantasySlot.create({
      data: {
        eventId,
        segmentId: segment.id,
        label: t.name,
        order: i + 1,
        elementCategoryId: category.id,
      },
    });
  }

  return { segmentName, count: templates.length };
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

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { discipline: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 }
      );
    }

    // Show no tiene Corto/Largo — es un único programa, y dentro de la
    // disciplina "Show" hay 3 formatos con slots distintos (Cuartetos,
    // Grupos Pequeños, Grupos Grandes) que el admin elige explícitamente,
    // en vez del segmento SHORT/LONG que usan el resto de disciplinas.
    if (event.discipline.slug === "show") {
      const format = body.format as "QUARTET" | "SMALL_GROUP" | "LARGE_GROUP";

      const showFormats: Record<string, { segmentName: string; templates: SlotTemplate[] }> = {
        QUARTET: { segmentName: "Programa (Cuartetos)", templates: SHOW_QUARTET_SLOTS },
        SMALL_GROUP: { segmentName: "Programa (Grupos Pequeños)", templates: SHOW_GROUP_SLOTS },
        LARGE_GROUP: { segmentName: "Programa (Grupos Grandes)", templates: SHOW_GROUP_SLOTS },
      };

      const showConfig = showFormats[format];
      if (!showConfig) {
        return NextResponse.json(
          { error: "Falta especificar el formato de Show (QUARTET, SMALL_GROUP o LARGE_GROUP)" },
          { status: 400 }
        );
      }

      const result = await generateSlotsForSegment(event.id, showConfig.segmentName, 1, showConfig.templates);

      return NextResponse.json({
        ok: true,
        message: `Generados ${result.count} slots para ${result.segmentName} correctamente`,
      });
    }

    const segmentType = body.segment as "SHORT" | "LONG";

    if (!segmentType) {
      return NextResponse.json(
        { error: "Falta especificar el segmento (SHORT o LONG)" },
        { status: 400 }
      );
    }

    // Slots de Fantasy por disciplina. "inline" usa exactamente la misma
    // estructura que "libre" (patinaje libre sobre ruedas en línea: mismos
    // elementos técnicos y componentes), así que reutiliza sus plantillas
    // en vez de duplicarlas.
    const disciplineTemplates: Record<
      string,
      { shortName: string; longName: string; short: typeof FREE_SKATING_SHORT_SLOTS; long: typeof FREE_SKATING_LONG_SLOTS }
    > = {
      libre: {
        shortName: "Short Program",
        longName: "Long Program",
        short: FREE_SKATING_SHORT_SLOTS,
        long: FREE_SKATING_LONG_SLOTS,
      },
      inline: {
        shortName: "Short Program",
        longName: "Long Program",
        short: FREE_SKATING_SHORT_SLOTS,
        long: FREE_SKATING_LONG_SLOTS,
      },
      "solo-danza": {
        shortName: "Style Dance",
        longName: "Freedance",
        short: SOLO_DANCE_STYLE_SLOTS,
        long: SOLO_DANCE_FREE_SLOTS,
      },
      parejas: {
        shortName: "Short Program",
        longName: "Free Program",
        short: PAIRS_SHORT_SLOTS,
        long: PAIRS_FREE_SLOTS,
      },
      "pareja-danza": {
        shortName: "Style Dance",
        longName: "Free Dance",
        short: COUPLE_DANCE_STYLE_SLOTS,
        long: COUPLE_DANCE_FREE_SLOTS,
      },
    };

    const disciplineConfig = disciplineTemplates[event.discipline.slug];

    if (!disciplineConfig) {
      return NextResponse.json(
        {
          error:
            "La generación automática de slots aún no está disponible para esta disciplina",
        },
        { status: 400 }
      );
    }

    const segmentName =
      segmentType === "SHORT" ? disciplineConfig.shortName : disciplineConfig.longName;
    const segmentOrder = segmentType === "SHORT" ? 1 : 2;
    const templates =
      segmentType === "SHORT" ? disciplineConfig.short : disciplineConfig.long;

    const result = await generateSlotsForSegment(event.id, segmentName, segmentOrder, templates);

    return NextResponse.json({
      ok: true,
      message: `Generados ${result.count} slots para ${result.segmentName} correctamente`,
    });
  } catch (error: any) {
    console.error("Error generando slots:", error);
    return NextResponse.json(
      { error: error?.message || "Error interno al generar slots" },
      { status: 500 }
    );
  }
}