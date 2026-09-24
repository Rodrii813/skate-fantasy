import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseStartingOrderText } from "@/lib/pdfStartingOrderParser";
import { extractText } from "unpdf";

export async function POST(req: Request) {
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

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const eventId = formData.get("eventId") as string;

    if (!file || !eventId) {
      return NextResponse.json(
        { error: "Falta el archivo PDF o el ID del evento" },
        { status: 400 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    // 1. Extraer texto del PDF con unpdf (nativo y sin problemas de bundler)
    const arrayBuffer = await file.arrayBuffer();
    const { text } = await extractText(arrayBuffer);
    const fullText = Array.isArray(text) ? text.join("\n") : text;

    // 2. Procesar el texto con nuestro parser inteligente
    const parsedSkaters = parseStartingOrderText(fullText);

    if (!parsedSkaters || parsedSkaters.length === 0) {
      return NextResponse.json(
        { error: "No se han detectado patinadores en el PDF." },
        { status: 422 }
      );
    }

    let savedCount = 0;

    // 3. Guardar patinadores e inscripciones en la base de datos
    for (const item of parsedSkaters) {
      let skater = await prisma.skater.findFirst({
        where: {
          firstName: { equals: item.firstName, mode: "insensitive" },
          lastName: { equals: item.lastName, mode: "insensitive" },
        },
      });

      if (!skater) {
        skater = await prisma.skater.create({
          data: {
            firstName: item.firstName,
            lastName: item.lastName,
            country: item.country,
            disciplineId: event.disciplineId,
            categoryId: event.categoryId,
          },
        });
      }

      await prisma.registration.upsert({
        where: {
          eventId_skaterId: {
            eventId: event.id,
            skaterId: skater.id,
          },
        },
        update: {
          startOrder: item.startOrder,
          warmupGroup: item.warmupGroup,
          club: item.club || null,
        },
        create: {
          eventId: event.id,
          skaterId: skater.id,
          startOrder: item.startOrder,
          warmupGroup: item.warmupGroup,
          club: item.club || null,
        },
      });

      savedCount++;
    }

    return NextResponse.json({
      ok: true,
      count: savedCount,
      skaters: parsedSkaters,
    });
  } catch (error: any) {
    console.error("Error al procesar starting order:", error);
    return NextResponse.json(
      { error: error?.message || "Error procesando el PDF" },
      { status: 500 }
    );
  }
}