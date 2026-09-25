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
    const segmentName = (formData.get("segmentName") as string) || "";

    if (!file || !eventId) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    // 1. Extraer texto del PDF
    const arrayBuffer = await file.arrayBuffer();
    const { text } = await extractText(arrayBuffer);
    const fullText = Array.isArray(text) ? text.join("\n") : text;

    // 2. Parsear el acta oficial
    const parsedResults = parseJudgesDetailsText(fullText);

    if (!parsedResults || parsedResults.length === 0) {
      return NextResponse.json(
        {
          error:
            "No se pudieron extraer datos de patinadores del acta PDF. Comprueba que es un acta 'Judges Details per Skater'.",
        },
        { status: 422 }
      );
    }

    // 3. Obtener el evento, inscripciones y slots
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        registrations: { include: { skater: true } },
        segments: true,
        slots: { include: { elementCategory: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    if (event.registrations.length === 0) {
      return NextResponse.json(
        {
          error:
            `Este evento ("${event.name}") no tiene ningún patinador inscrito (Registration) todavía. ` +
            `Registra a los patinadores de este evento antes de importar resultados. ` +
            `El acta PDF se leyó bien (${parsedResults.length} patinadores), pero no hay nadie con quien compararla.`,
        },
        { status: 422 }
      );
    }

    // Resuelve el segmento real por nombre (Short/Long), no siempre el primero
    const segment = segmentName
      ? event.segments.find(
          (s) => s.name.trim().toLowerCase() === segmentName.trim().toLowerCase()
        )
      : event.segments[0];

    if (!segment) {
      return NextResponse.json(
        {
          error: `No existe el segmento "${segmentName}" en este evento. Genera sus slots antes de importar.`,
        },
        { status: 400 }
      );
    }

    // Solo los slots de este segmento concreto
    const segmentSlots = event.slots.filter((s) => s.segmentId === segment.id);

    if (segmentSlots.length === 0) {
      return NextResponse.json(
        { error: `El segmento "${segment.name}" no tiene slots generados todavía.` },
        { status: 400 }
      );
    }

    let matchedAndScored = 0;
    const unmatchedNames: string[] = [];

    for (const res of parsedResults) {
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
        unmatchedNames.push(rawName);
        console.log(`⚠️ Patinador no registrado en este evento: "${rawName}"`);
        continue;
      }

      // El parser real devuelve segmentScore (TES + PCS - deducciones, el
      // total real de ESTE segmento) y tes (solo el técnico). "segment1Score"
      // / "segment2Score" deben guardar el total de cada segmento, no solo
      // el técnico, porque son los que se muestran como "Seg 1"/"Seg 2" en
      // las tablas de resultados y porque "totalScore" (el que decide el
      // ranking) se calcula sumando estos dos.
      const total = (res as any).segmentScore ?? null;
      const isFirstSegment = segment.order <= 1;

      // Antes de esta corrección, subir el segundo segmento (p.ej. el
      // Programa Largo) SOBRESCRIBÍA totalScore con solo el total de ese
      // segmento, borrando de facto la puntuación del Programa Corto ya
      // cargado. Ahora se suma al otro segmento, que ya está en memoria
      // (matchedReg viene de la consulta del evento, sin "select", así que
      // trae también segment1Score/segment2Score tal como están en este
      // momento en la base de datos, antes de este update).
      const otherSegmentScore = isFirstSegment
        ? matchedReg.segment2Score ?? 0
        : matchedReg.segment1Score ?? 0;
      const newTotalScore = total !== null ? Number((Number(total) + otherSegmentScore).toFixed(2)) : null;

      await prisma.registration.update({
        where: { id: matchedReg.id },
        data: {
          ...(isFirstSegment
            ? { segment1Score: total !== null ? Number(total) : null }
            : { segment2Score: total !== null ? Number(total) : null }),
          ...(newTotalScore !== null ? { totalScore: newTotalScore } : {}),
        },
      });

      for (const slot of segmentSlots) {
        let earnedScore = 0;
        const tag = (slot.label + " " + (slot.elementCategory?.name || "")).toLowerCase();
        const scores = res.slotScores || ({} as any);
        const isSecond = /\b2\b/.test(tag);

        if (tag.includes("combo jump") || tag.includes("combinacion")) {
          earnedScore = isSecond ? scores.comboJump2 || 0 : scores.comboJump1 || 0;
        } else if (tag.includes("solo jump") || tag.includes("salto solo")) {
          earnedScore = isSecond ? scores.soloJump2 || 0 : scores.soloJump1 || 0;
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
          update: { value: Number(earnedScore) },
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

    // Recalcular el ranking (finalRank) y marcar el evento como "con
    // resultados" cada vez que se importa un acta. Antes nada en la app
    // actualizaba estos dos campos, así que aunque las puntuaciones se
    // guardaban bien, la tabla y el podio público (/resultados,
    // /competitions/[id]) no tenían de dónde sacar el puesto de cada
    // patinadora ni sabían que el evento ya tenía resultados que mostrar.
    const allRegs = await prisma.registration.findMany({
      where: { eventId },
      orderBy: [{ totalScore: "desc" }],
    });
    type RegistrationRow = (typeof allRegs)[number];

    await prisma.$transaction(
      allRegs
        .filter((r: RegistrationRow) => r.totalScore !== null)
        .map((r: RegistrationRow, index: number) =>
          prisma.registration.update({
            where: { id: r.id },
            data: { finalRank: index + 1 },
          })
        )
    );

    if (event.status === "UPCOMING" || event.status === "LOCKED") {
      await prisma.event.update({
        where: { id: eventId },
        data: { status: "RESULTS_IN" },
      });
    }

    return NextResponse.json({
      ok: true,
      skatersParsed: parsedResults.length,
      matchedAndScored,
      registrationsInEvent: event.registrations.length,
      segment: segment.name,
      unmatchedNames,
      registeredNames: event.registrations.map(
        (r) => `${r.skater.firstName} ${r.skater.lastName}`
      ),
      parsedNames: parsedResults.map((r: any) => r.fullName || r.skaterName || "(vacío)"),
    });
  } catch (error: any) {
    console.error("Error al procesar Judges Details:", error);
    return NextResponse.json(
      { error: error?.message || "Error procesando resultados" },
      { status: 500 }
    );
  }
}