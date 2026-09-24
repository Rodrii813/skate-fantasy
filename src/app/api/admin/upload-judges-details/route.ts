import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractText } from "unpdf";
import { parseJudgesDetailsText } from "@/lib/pdfJudgesDetailsParser";

function cleanStr(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

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
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const eventId = formData.get("eventId") as string;

    if (!file || !eventId) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    // 1. Extraer texto del PDF
    const arrayBuffer = await file.arrayBuffer();
    const { text } = await extractText(arrayBuffer);
    const fullText = Array.isArray(text) ? text.join("\n") : text;

    // 2. Parsear el acta oficial con tu parser
    const parsedResults = parseJudgesDetailsText(fullText);

    if (!parsedResults || parsedResults.length === 0) {
      return NextResponse.json(
        { error: "No se pudieron extraer datos de patinadores del acta PDF." },
        { status: 422 }
      );
    }

    // 3. Obtener el evento, registros y slots
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        registrations: {
          include: { skater: true },
        },
        segments: true,
        slots: {
          include: { elementCategory: true },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const segment = event.segments[0];
    if (!segment) {
      return NextResponse.json(
        { error: "Debes generar los slots del evento antes de importar resultados." },
        { status: 400 }
      );
    }

    let matchedAndScored = 0;

    for (const res of parsedResults) {
      // En tu parser el nombre viene en skaterName (o fullName)
      const rawName = (res as any).skaterName || (res as any).fullName || "";

      if (
        !rawName ||
        rawName.toLowerCase().includes("total element") ||
        rawName.toLowerCase().includes("program component") ||
        rawName.toLowerCase().includes("deductions")
      ) {
        continue;
      }

      const targetName = cleanStr(rawName);

      // Buscar coincidencia en las inscripciones del evento
      const matchedReg = event.registrations.find((reg) => {
        const fullDirect = cleanStr(`${reg.skater.firstName} ${reg.skater.lastName}`);
        const fullInverted = cleanStr(`${reg.skater.lastName} ${reg.skater.firstName}`);
        const lastNameOnly = cleanStr(reg.skater.lastName);

        return (
          targetName === fullDirect ||
          targetName === fullInverted ||
          (lastNameOnly.length >= 4 && targetName.includes(lastNameOnly)) ||
          fullDirect.includes(targetName)
        );
      });

      if (!matchedReg) {
        console.log(`⚠️ Patinador no registrado en este evento: "${rawName}"`);
        continue;
      }

      // En tu parser las notas totales vienen en totalSegmentScore y technicalElementsScore
      const total = (res as any).totalSegmentScore ?? (res as any).totalScore ?? null;
      const tech = (res as any).technicalElementsScore ?? (res as any).technicalScore ?? null;

      // 1. Guardar totales en Registration
      await prisma.registration.update({
        where: { id: matchedReg.id },
        data: {
          totalScore: total !== null ? Number(total) : null,
          segment1Score: tech !== null ? Number(tech) : null,
        },
      });

      // 2. Mapear cada slot a su nota obtenida
      for (const slot of event.slots) {
        let earnedScore = 0;
        const tag = (slot.label + " " + (slot.elementCategory?.name || "")).toLowerCase();
        const scores = res.slotScores || ({} as any);

        if (tag.includes("combo jump") || tag.includes("combinacion")) {
          earnedScore = scores.comboJump1 || scores.comboJump2 || 0;
        } else if (tag.includes("solo jump") || tag.includes("salto solo")) {
          earnedScore = scores.soloJump1 || scores.soloJump2 || 0;
        } else if (tag.includes("axel")) {
          earnedScore = scores.axel || 0;
        } else if (tag.includes("spin") || tag.includes("giro") || tag.includes("pirueta")) {
          earnedScore = scores.spinsTotal || 0;
        } else if (tag.includes("step") || tag.includes("pasos")) {
          earnedScore = scores.stepSequence || 0;
        } else if (tag.includes("choreo sequence") || tag.includes("coreografico")) {
          earnedScore = scores.choreoSequence || 0;
        } else if (tag.includes("skating skills") || tag.includes("transitions") || tag.includes("habilidades")) {
          earnedScore = scores.pcsSkatingTransitions || 0;
        } else if (tag.includes("performance") || tag.includes("interpretacion")) {
          earnedScore = scores.pcsPerformanceChoreo || 0;
        }

        if (earnedScore === 0 && tag.includes("component")) {
          earnedScore = scores.pcsSkatingTransitions || scores.pcsPerformanceChoreo || 0;
        }

        await prisma.elementScore.upsert({
          where: {
            registrationId_segmentId_elementCategoryId: {
              registrationId: matchedReg.id,
              segmentId: segment.id,
              elementCategoryId: slot.elementCategoryId,
            },
          },
          update: {
            value: Number(earnedScore),
          },
          create: {
            registrationId: matchedReg.id,
            segmentId: segment.id,
            elementCategoryId: slot.elementCategoryId,
            value: Number(earnedScore),
          },
        });
      }

      matchedAndScored++;
    }

    return NextResponse.json({
      ok: true,
      skatersParsed: parsedResults.length,
      matchedAndScored,
    });
  } catch (error: any) {
    console.error("Error al procesar Judges Details:", error);
    return NextResponse.json(
      { error: error?.message || "Error procesando resultados" },
      { status: 500 }
    );
  }
}