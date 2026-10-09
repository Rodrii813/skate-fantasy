import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreEventPredictions } from "@/lib/calculatePredictions";
import { pushToEventParticipants } from "@/lib/push";
import { extractText } from "unpdf";
import { parseJudgesDetailsText, parseShowGroupResults } from "@/lib/pdfJudgesDetailsParser";
import { parseJudgesDetailTables } from "@/lib/pdfJudgesDetailTable";

function cleanStr(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

type ParsedSlotScores = ReturnType<typeof parseJudgesDetailsText>[number]["slotScores"];

// Libre/Inline: la l\u00f3gica que ya exist\u00eda, sin cambios. "Combo Jump 1"/"2" e
// igual con "Solo Jump" son 2 slots independientes para draftear a 2
// patinadoras distintas \u2014 NO "el mejor" vs "el segundo mejor" de la MISMA
// patinadora. Cada patinadora aporta siempre su MEJOR combo/salto sea cual
// sea el slot en el que la hayan drafteado, as\u00ed que el "1"/"2" del label ya
// no distingue qu\u00e9 valor coger (ver el comentario en
// pdfJudgesDetailsParser.ts `slotScores`).
function computeTechnicalScoreLibre(
  tag: string,
  scores: ParsedSlotScores,
  isFirstSegment: boolean,
  disciplineSlug = "libre"
): number {
  // SOLO en el Largo de Libre (no Inline): el slot "2nd Best ..." (o el
  // antiguo "... 2") puntúa con el SEGUNDO mejor combo / salto suelto de la
  // patinadora; el resto de slots, con el mejor.
  const wantsSecond = disciplineSlug === "libre" && !isFirstSegment && /(2nd|second|\b2\b)/.test(tag);
  if (tag.includes("combo jump") || tag.includes("combinacion")) {
    return (wantsSecond ? scores.comboJump2 : scores.comboJump) || 0;
  }
  if (tag.includes("solo jump") || tag.includes("salto solo")) {
    if (wantsSecond) return scores.soloOrAxel2 || 0;
    // El Axel es obligatorio en los dos programas, pero solo en el Corto
    // tiene su propio slot fijo; en el Largo puede ir en cualquier posici\u00f3n
    // y cuenta como un salto individual m\u00e1s, as\u00ed que aqu\u00ed se usa el "mejor
    // de saltos individuales + Axel" (soloOrAxel) en vez de excluir el
    // Axel como hace el Corto.
    return isFirstSegment ? scores.soloJump || 0 : scores.soloOrAxel || 0;
  }
  if (tag.includes("axel")) {
    return scores.axel || 0;
  }
  if (tag.includes("spin") || tag.includes("giro") || tag.includes("pirueta")) {
    return scores.spinsTotal || 0;
  }
  if (tag.includes("step") || tag.includes("pasos")) {
    return scores.stepSequence || 0;
  }
  if (tag.includes("choreo sequence") || tag.includes("coreografico")) {
    // El acta oficial no siempre llama a este elemento "Choreo Sequence":
    // en el Programa Largo del Campeonato de Europa lo imprime literalmente
    // como "Step Sequence" (aunque la info diga "ChSt1"), as\u00ed que el parser
    // lo clasifica como scores.stepSequence y scores.choreoSequence se
    // queda a 0. Si no hay nada bajo choreoSequence, usamos stepSequence
    // como alternativa: un programa real solo trae UNO de los dos, nunca
    // ambos a la vez.
    return scores.choreoSequence || scores.stepSequence || 0;
  }
  return 0;
}

// Parejas (Corto y Largo comparten exactamente los mismos nombres de slot
// t\u00e9cnico tras el punto 5 del plan \u2014 ver fantasyTemplates.ts \u2014 as\u00ed que no
// hace falta distinguir isFirstSegment aqu\u00ed). Todos los packs son SUM_ALL:
// se suman todos los elementos de ese tipo del programa, nunca "el mejor".
function computeTechnicalScorePairs(tag: string, scores: ParsedSlotScores): number {
  if (tag.includes("side by side jump")) return scores.sideBySideJumpTotal || 0;
  if (tag.includes("throw jump")) return scores.throwJumpTotal || 0;
  if (tag.includes("twist")) return scores.twistJumpTotal || 0;
  if (tag.includes("lift")) return scores.liftsTotal || 0;
  if (tag.includes("death spiral")) return scores.deathSpiralTotal || 0;
  // El "Choreo Step" del Programa Largo de Parejas aparece en el acta oficial
  // bajo la palabra clave "Step Sequence" (no "Choreo Step" \u2014 ver el
  // comentario de keywordToType en pdfJudgesDetailsParser.ts), as\u00ed que el
  // parser ya lo guarda en `stepSequence`; por eso los dos tags posibles
  // caen en el mismo campo.
  if (tag.includes("step sequence") || tag.includes("choreo step")) return scores.stepSequence || 0;
  if (tag.includes("combo spin") || tag.includes("spin")) return scores.spinsTotal || 0;
  return 0;
}

// Pareja Danza. Verificado con actas reales de Free Dance (Largo) Y de Style
// Dance (Corto): Lifts, Cluster, No Hold Sequence, Choreo Stop y Traveling
// (Largo) + Pattern Sequence y Hold Sequence (Corto) mapean correctamente.
// Cluster suma ya Man+Lady cuando el acta trae el elemento partido en dos
// l\u00edneas (M)/(L) \u2014 esa suma la hace el propio parser, no hace falta repetirla
// aqu\u00ed (ver el comentario de `slotScores` en pdfJudgesDetailsParser.ts).
function computeTechnicalScoreCoupleDance(tag: string, scores: ParsedSlotScores): number {
  if (tag.includes("lift")) return scores.liftsTotal || 0;
  if (tag.includes("no hold sequence")) return scores.noHoldSequenceTotal || 0;
  if (tag.includes("cluster")) return scores.clusterTotal || 0;
  if (tag.includes("choreo stop")) return scores.choreoStopTotal || 0;
  if (tag.includes("traveling")) return scores.travelingTotal || 0;
  if (tag.includes("pattern sequence")) return scores.patternSequenceTotal || 0;
  if (tag.includes("hold sequence")) return scores.holdSequenceTotal || 0;
  return 0;
}

// Solo Danza (Style Dance y Free Dance comparten los mismos 5 nombres de
// slot t\u00e9cnico salvo uno \u2014 "Art Sequence" en Style, "Dance Step" en Free \u2014
// as\u00ed que basta con mirar el tag, sin necesidad de isFirstSegment).
// Verificado con actas reales de ambos segmentos.
function computeTechnicalScoreSoloDanza(tag: string, scores: ParsedSlotScores): number {
  if (tag.includes("pattern sequence")) return scores.patternSequenceTotal || 0;
  if (tag.includes("foot sequence")) return scores.footSequenceTotal || 0;
  if (tag.includes("cluster")) return scores.clusterTotal || 0;
  if (tag.includes("traveling")) return scores.travelingTotal || 0;
  if (tag.includes("choreo stop")) return scores.choreoStopTotal || 0;
  if (tag.includes("art sequence")) return scores.artSequenceTotal || 0;
  // "Dance Step" (Free Dance) es el caj\u00f3n gen\u00e9rico que queda cuando el acta
  // no usa ninguna de las 3 sub-etiquetas de "Dance Step" reconocidas arriba
  // (Cluster/No Hold/Choreo Stop) \u2014 ver keywordToType en el parser.
  if (tag.includes("dance step")) return scores.danceStepTotal || 0;
  return 0;
}

// Show \u2014 Cuartetos (Quartets). Los "Small/Large Groups" del propio Show NO
// pasan por aqu\u00ed: no tienen elementos t\u00e9cnicos (solo 4 componentes PCS) y se
// gestionan aparte, en su propia rama SIN pasar por computeEarnedScore (ver
// m\u00e1s abajo en el POST, antes de llamar a este mapeo).
function computeTechnicalScoreQuartets(tag: string, scores: ParsedSlotScores): number {
  if (tag.includes("creative")) return scores.creativeTotal || 0;
  if (tag.includes("canon")) return scores.canonTotal || 0;
  if (tag.includes("traveling")) return scores.travelingTotal || 0;
  if (tag.includes("cluster")) return scores.clusterTotal || 0;
  return 0;
}

// Precisión: 8 elementos fijos que cada equipo ejecuta exactamente 1 vez. Los
// slots nuevos agrupan 2 elementos ("Rotating Wheel + Linear Line") y puntúan
// la SUMA de ambos; los slots antiguos de 1 solo elemento siguen funcionando
// igual (solo coincide una palabra clave).
function computeTechnicalScorePrecision(tag: string, scores: ParsedSlotScores): number {
  let total = 0;
  if (tag.includes("wheel")) total += scores.wheelTotal || 0;
  if (tag.includes("linear line") || /\bline\b/.test(tag)) total += scores.lineTotal || 0;
  if (tag.includes("block")) total += scores.blockTotal || 0;
  if (tag.includes("move element")) total += scores.moveElementTotal || 0;
  if (tag.includes("intersection")) total += scores.intersectionTotal || 0;
  if (tag.includes("traveling")) total += scores.travelingTotal || 0;
  if (tag.includes("creative")) total += scores.creativeTotal || 0;
  if (tag.includes("no hold element")) total += scores.noHoldElementTotal || 0;
  return Number(total.toFixed(2));
}

// Punto de entrada \u00fanico: los 2 slots de Componentes (agrupados de 2 en 2)
// son id\u00e9nticos en TODAS las disciplinas, as\u00ed que se resuelven aqu\u00ed antes
// de mirar la disciplina \u2014 solo los slots T\u00c9CNICOS var\u00edan de una modalidad
// a otra.
function computeEarnedScore(
  tag: string,
  scores: ParsedSlotScores,
  disciplineSlug: string,
  isFirstSegment: boolean
): number {
  if (tag.includes("skating skills") || tag.includes("transitions") || tag.includes("habilidades")) {
    return scores.pcsSkatingTransitions || 0;
  }
  if (tag.includes("performance") || tag.includes("interpretacion")) {
    return scores.pcsPerformanceChoreo || 0;
  }

  let earnedScore = 0;
  if (disciplineSlug === "parejas") {
    earnedScore = computeTechnicalScorePairs(tag, scores);
  } else if (disciplineSlug === "pareja-danza") {
    earnedScore = computeTechnicalScoreCoupleDance(tag, scores);
  } else if (disciplineSlug === "solo-danza") {
    earnedScore = computeTechnicalScoreSoloDanza(tag, scores);
  } else if (disciplineSlug === "show") {
    // Los formatos de Grupo (Small/Large Group) de esta misma disciplina
    // NO llegan aqu\u00ed \u2014 se gestionan en una rama completamente aparte del
    // POST (parseShowGroupResults + slots SINGLE_PCS), porque no tienen
    // elementos t\u00e9cnicos. Si esta rama se ejecuta con discipline "show" es
    // porque el evento es de Cuartetos.
    earnedScore = computeTechnicalScoreQuartets(tag, scores);
  } else if (disciplineSlug === "precision") {
    earnedScore = computeTechnicalScorePrecision(tag, scores);
  } else {
    // Libre/Inline, y cualquier otra disciplina sin mapeo t\u00e9cnico propio.
    earnedScore = computeTechnicalScoreLibre(tag, scores, isFirstSegment, disciplineSlug);
  }

  if (earnedScore === 0 && tag.includes("component")) {
    earnedScore = scores.pcsSkatingTransitions || scores.pcsPerformanceChoreo || 0;
  }

  return earnedScore;
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
    // Última acta del segmento: los inscritos sin resultado se dan por ausentes
    const markAbsent = formData.get("markAbsent") === "true";

    if (!file || !eventId) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    // 1. Extraer texto del PDF
    const arrayBuffer = await file.arrayBuffer();
    const { text } = await extractText(arrayBuffer);
    const fullText = Array.isArray(text) ? text.join("\n") : text;

    // 2. Obtener el evento, inscripciones, slots y disciplina PRIMERO — antes
    // de parsear el texto. Los formatos de Grupo de Show (Small/Large Group)
    // usan un acta con una estructura totalmente distinta (sin "JUDGES
    // DETAILS PER SKATER", sin elementos técnicos, solo 4 componentes PCS
    // por equipo — ver parseShowGroupResults), así que hace falta saber la
    // disciplina/showFormat ANTES de decidir qué función de parseo usar.
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        registrations: { include: { skater: true } },
        segments: true,
        slots: { include: { elementCategory: true } },
        discipline: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const isShowGroup =
      event.discipline.slug === "show" &&
      (event.showFormat === "SMALL_GROUP" || event.showFormat === "LARGE_GROUP");

    // 3. Parsear el acta oficial con la función que corresponda.
    const parsedResults = isShowGroup ? parseShowGroupResults(fullText) : parseJudgesDetailsText(fullText);
    const detailByName = new Map<string, ReturnType<typeof parseJudgesDetailTables>[number]>();
    if (!isShowGroup) {
      try {
        for (const d of parseJudgesDetailTables(fullText)) detailByName.set(cleanStr(d.name), d);
      } catch {
        /* el detalle es opcional */
      }
    }

    if (!parsedResults || parsedResults.length === 0) {
      return NextResponse.json(
        {
          error:
            "No se pudieron extraer datos de patinadores del acta PDF. Comprueba que es un acta 'Judges Details per Skater'.",
        },
        { status: 422 }
      );
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
      // Show Groups (Small/Large Group) no tiene "fullName" — sus resultados
      // vienen de parseShowGroupResults, con el nombre del equipo bajo
      // "teamName" (ver TeamShowGroupResult en pdfJudgesDetailsParser.ts).
      const rawName = (res as any).skaterName || (res as any).fullName || (res as any).teamName || "";

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
      // Show Groups guarda el total en "total" (no "segmentScore" — no hay
      // TES que sumarle a nada, el propio total YA es el total del segmento).
      const total = (res as any).segmentScore ?? (res as any).total ?? null;
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

      // TES/PCS/Deducciones OFICIALES de este segmento, tal cual los da el
      // acta (res.tes/res.pcs/res.deductions ya vienen correctos del PDF,
      // independientemente de qué slots de Fantasy existan). Se guardan
      // aparte de segment1Score/segment2Score para que /resultados y
      // /competitions/[id] puedan mostrar el desglose oficial exacto en vez
      // de reconstruirlo a partir de los slots de Fantasy (que por diseño
      // solo cuentan "los mejores N" de cada tipo de elemento y por eso no
      // cuadran con el total real — p.ej. dejaban fuera el Axel del Largo).
      // Show Groups no tiene TES (no ejecuta elementos técnicos, solo 4
      // componentes PCS por equipo) ni un campo "pcs" ya sumado — se calcula
      // aquí sumando los 4 componentes de `res.components`.
      const showGroupComponents = (res as any).components as
        | { skatingSkills: number; groupTechnique: number; performance: number; ideaChoreography: number }
        | undefined;
      const officialTes = (res as any).tes ?? (isShowGroup ? 0 : null);
      const officialPcs =
        (res as any).pcs ??
        (isShowGroup && showGroupComponents
          ? Number(
              (
                showGroupComponents.skatingSkills +
                showGroupComponents.groupTechnique +
                showGroupComponents.performance +
                showGroupComponents.ideaChoreography
              ).toFixed(2)
            )
          : null);
      const officialDed = (res as any).deductions ?? null;

      await prisma.registration.update({
        where: { id: matchedReg.id },
        data: {
          ...(isFirstSegment
            ? {
                segment1Score: total !== null ? Number(total) : null,
                segment1Tes: officialTes !== null ? Number(officialTes) : null,
                segment1Pcs: officialPcs !== null ? Number(officialPcs) : null,
                segment1Ded: officialDed !== null ? Number(officialDed) : null,
              }
            : {
                segment2Score: total !== null ? Number(total) : null,
                segment2Tes: officialTes !== null ? Number(officialTes) : null,
                segment2Pcs: officialPcs !== null ? Number(officialPcs) : null,
                segment2Ded: officialDed !== null ? Number(officialDed) : null,
              }),
          ...(newTotalScore !== null ? { totalScore: newTotalScore } : {}),
        },
      });

      // Desglose completo (elementos, QOE, notas por juez) solo para mostrarlo en
      // resultados. Va aparte y dentro de try/catch: si falla o el acta no
      // cuadra, no afecta a ninguna puntuación.
      try {
        const detail = detailByName.get(cleanStr(rawName));
        if (detail) {
          await prisma.segmentDetail.upsert({
            where: {
              registrationId_segmentId: { registrationId: matchedReg.id, segmentId: segment.id },
            },
            update: { data: detail as any },
            create: { registrationId: matchedReg.id, segmentId: segment.id, data: detail as any },
          });
        }
      } catch (e) {
        console.error("No se pudo guardar el detalle del acta:", e);
      }

      for (const slot of segmentSlots) {
        const tag = (slot.label + " " + (slot.elementCategory?.name || "")).toLowerCase();

        // Show Groups: los 4 slots son SINGLE_PCS (uno a uno, no agrupados
        // de 2 en 2 como en el resto de disciplinas), y el valor ya viene
        // facturado en `res.components` — no pasa por computeEarnedScore ni
        // por slotScores, que no existen en este tipo de resultado.
        let earnedScore = 0;
        if (isShowGroup && showGroupComponents) {
          if (tag.includes("skating skills")) earnedScore = showGroupComponents.skatingSkills || 0;
          else if (tag.includes("group technique")) earnedScore = showGroupComponents.groupTechnique || 0;
          else if (tag.includes("idea") || tag.includes("choreography")) {
            earnedScore = showGroupComponents.ideaChoreography || 0;
          } else if (tag.includes("performance")) earnedScore = showGroupComponents.performance || 0;
        } else {
          const scores = (res as any).slotScores || ({} as any);
          earnedScore = computeEarnedScore(tag, scores, event.discipline.slug, isFirstSegment);
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

    // Estado: parcial hasta que CADA segmento tenga resultados de todos los
    // patinadores inscritos. Así se pueden subir las actas sueltas (una por
    // patinador/grupo, según van saliendo) sin que el evento se dé por
    // terminado ni se puntúen las predicciones con una clasificación a medias.
    const wasFinished = event.status === "FINISHED";
    const scoredPairs = await prisma.elementScore.findMany({
      where: { segment: { eventId } },
      select: { segmentId: true, registrationId: true },
      distinct: ["segmentId", "registrationId"],
    });
    const scoredBySegment = new Map<string, Set<string>>();
    for (const p of scoredPairs) {
      if (!scoredBySegment.has(p.segmentId)) scoredBySegment.set(p.segmentId, new Set());
      scoredBySegment.get(p.segmentId)!.add(p.registrationId);
    }

    // Ausentes (no salieron a pista): al marcar "última acta", los inscritos
    // sin resultado en este segmento pasan a withdrawn y dejan de contar para
    // dar el evento por completo. Quien tenga resultados deja de estar ausente.
    const regsNow = await prisma.registration.findMany({
      where: { eventId },
      select: { id: true, withdrawn: true },
    });
    const scoredThisSeg = scoredBySegment.get(segment.id) ?? new Set<string>();
    const anyScored = new Set(scoredPairs.map((p: { registrationId: string }) => p.registrationId));
    const toWithdraw = markAbsent
      ? regsNow.filter((r: { id: string; withdrawn: boolean }) => !scoredThisSeg.has(r.id) && !r.withdrawn).map((r: { id: string }) => r.id)
      : [];
    const toRestore = regsNow
      .filter((r: { id: string; withdrawn: boolean }) => r.withdrawn && anyScored.has(r.id))
      .map((r: { id: string }) => r.id);
    if (toWithdraw.length > 0) {
      await prisma.registration.updateMany({ where: { id: { in: toWithdraw } }, data: { withdrawn: true } });
    }
    if (toRestore.length > 0) {
      await prisma.registration.updateMany({ where: { id: { in: toRestore } }, data: { withdrawn: false } });
    }
    const required = regsNow
      .filter((r: { id: string; withdrawn: boolean }) => (r.withdrawn ? toRestore.includes(r.id) : true) && !toWithdraw.includes(r.id))
      .map((r: { id: string }) => r.id);
    const allDone =
      event.segments.length > 0 &&
      required.length > 0 &&
      event.segments.every((sg: { id: string }) =>
        required.every((id: string) => scoredBySegment.get(sg.id)?.has(id))
      );

    if (!wasFinished) {
      await prisma.event.update({
        where: { id: eventId },
        data: { status: allDone ? "FINISHED" : "RESULTS_IN" },
      });
    }

    // Con el evento completo el finalRank ya es el definitivo: puntúa las
    // predicciones (también al re-subir un acta corregida de un evento ya
    // terminado, para que los puntos no queden desfasados).
    if (allDone || wasFinished) {
      try {
        await scoreEventPredictions(eventId);
      } catch (e) {
        console.error("Error puntuando predicciones:", e);
      }
    }
    // Aviso push solo la primera vez que el evento pasa a terminado
    if (allDone && !wasFinished) {
      try {
        await pushToEventParticipants(eventId, {
          title: "Resultados disponibles",
          body: `${event.name}: ya puedes ver los resultados y tu clasificación.`,
          url: `/competitions/${event.competitionId}`,
        });
      } catch (e) {
        console.error("Error enviando notificaciones:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      skatersParsed: parsedResults.length,
      matchedAndScored,
      registrationsInEvent: event.registrations.length,
      absentMarked: toWithdraw.length,
      segment: segment.name,
      unmatchedNames,
      registeredNames: event.registrations.map(
        (r) => `${r.skater.firstName} ${r.skater.lastName}`
      ),
      parsedNames: parsedResults.map((r: any) => r.fullName || r.skaterName || r.teamName || "(vacío)"),
    });
  } catch (error: any) {
    console.error("Error al procesar Judges Details:", error);
    return NextResponse.json(
      { error: error?.message || "Error procesando resultados" },
      { status: 500 }
    );
  }
}