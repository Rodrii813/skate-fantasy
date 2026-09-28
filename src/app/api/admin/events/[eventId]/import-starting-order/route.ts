import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractText } from "unpdf";
import { normalizeName } from "@/lib/normalizeName";

// Campo de BD donde se guarda el grupo de calentamiento según el segmento
// indicado. "" (sin segmentName) cae en el campo legado `warmupGroup`, para
// no romper llamadas existentes que no lo envían (p.ej. el formulario
// manual de /admin/events/[eventId]/skaters).
type WarmupGroupField = "warmupGroup" | "warmupGroupShort" | "warmupGroupLong";

function resolveWarmupGroupField(segmentName: string): WarmupGroupField {
  const normalized = segmentName.trim().toLowerCase();
  if (normalized.includes("short")) return "warmupGroupShort";
  if (normalized.includes("long")) return "warmupGroupLong";
  return "warmupGroup";
}

// Qué forma tiene cada línea de patinador en el acta de orden de salida,
// según la disciplina del evento — antes se asumía SIEMPRE el formato
// individual ("<dorsal> Nombre Apellido PAÍS", todo en una sola línea), que
// es el único que YA no representa a Parejas, Pareja Danza, ni a los
// formatos de equipo de Show/Precisión:
// - "individual" (Libre, Inline, Solo Danza): 1 patinador = 1 línea, con el
//   país al final de esa misma línea.
// - "pair" (Parejas, Pareja Danza): 1 pareja = 2 líneas, "<dorsal> Nombre
//   Patinador A" y, en la línea siguiente, "Nombre Patinador B PAÍS". Se
//   guarda como UN solo Skater con firstName/lastName = cada miembro de la
//   pareja — el mismo criterio que ya usa el acta de resultados oficiales
//   (JUDGES DETAILS PER SKATER), donde una pareja aparece como "Patinador A
//   - Patinador B" en una única línea.
// - "team" (Show: Cuartetos/Grupos, Precisión): 1 equipo = 2 o más líneas —
//   el nombre del equipo en la primera, seguido de 0 o más líneas con el
//   título de la coreografía/canción, y el país al final de la última. El
//   título de la coreografía se descarta (no forma parte de la identidad
//   del equipo, igual que en el acta de resultados oficiales).
type SkatingOrderMode = "individual" | "pair" | "team";

function resolveSkatingOrderMode(disciplineSlug: string): SkatingOrderMode {
  if (disciplineSlug === "parejas" || disciplineSlug === "pareja-danza") return "pair";
  if (disciplineSlug === "show" || disciplineSlug === "precision") return "team";
  return "individual";
}

// Países válidos para desambiguar un país real de una palabra de 3 letras
// mayúsculas que forme parte del nombre de un equipo o coreografía (p.ej.
// "FASHION ONE" — "ONE" no es un país, pero antes de esta lista cualquier
// palabra de 3 mayúsculas al final de una línea se confundía con uno).
const VALID_COUNTRIES = new Set(
  `ESP ITA FRA GER POR NED GBR BEL SUI AUT DEN SWE NOR FIN POL CZE SVK HUN ROU BUL GRE TUR
   CRO SLO SRB BIH MKD ALB MDA UKR RUS BLR LTU LAT EST LUX MLT CYP AND MON SMR IRL ISL
   USA CAN MEX BRA ARG CHI COL PER VEN URU PAR ECU BOL CRI PAN GUA HON DOM PUR CUB
   JPN KOR CHN TPE THA PHI MAS SIN INA VIE IND ISR UAE KSA AUS NZL RSA`
    .split(/\s+/)
    .filter(Boolean)
);

function isCountry(code: string | null | undefined): code is string {
  return !!code && VALID_COUNTRIES.has(code);
}

export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (user?.role !== "ADMIN") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const { eventId } = params;

    // Obtener la disciplina y categoría del propio evento. Se incluye
    // discipline.slug (antes no se pedía) para saber qué forma tienen las
    // líneas de patinador en ESTE acta concreto (ver resolveSkatingOrderMode).
    const currentEvent = await prisma.event.findUnique({
      where: { id: eventId },
      select: { disciplineId: true, categoryId: true, discipline: { select: { slug: true } } },
    });

    if (!currentEvent) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

    const mode = resolveSkatingOrderMode(currentEvent.discipline.slug);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const segmentName = (formData.get("segmentName") as string) || "";
    const warmupGroupField = resolveWarmupGroupField(segmentName);

    if (!file) return NextResponse.json({ error: "Falta el archivo PDF" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const { text } = await extractText(arrayBuffer);
    const fullText = Array.isArray(text) ? text.join("\n") : text;

    // 1. Separar el documento por "Warm Up Group 1", "Warm Up Group 2"...
    // (Solo aparece en Parejas/Danza — Show y Precisión no tienen grupos de
    // calentamiento, así que caen siempre en la rama "sin grupos" de abajo).
    const groupBlocks = fullText.split(/Warm\s*Up\s*Group\s*(\d+)/i);
    const importedSkaters: {
      startOrder: number;
      warmupGroup: number;
      fullName: string;
      country: string | null;
    }[] = [];

    if (groupBlocks.length > 1) {
      // Procesar cada grupo de calentamiento por separado
      for (let i = 1; i < groupBlocks.length; i += 2) {
        const groupNumber = parseInt(groupBlocks[i], 10);
        const blockContent = groupBlocks[i + 1];
        const skaters = await parseAndRegisterSkaters(
          blockContent,
          groupNumber,
          eventId,
          currentEvent,
          warmupGroupField,
          mode
        );
        importedSkaters.push(...skaters);
      }
    } else {
      // Si no hay grupos detectados, procesa todo el texto como Grupo 1
      const skaters = await parseAndRegisterSkaters(fullText, 1, eventId, currentEvent, warmupGroupField, mode);
      importedSkaters.push(...skaters);
    }

    return NextResponse.json({ ok: true, count: importedSkaters.length, skaters: importedSkaters });
  } catch (error: any) {
    console.error("Error importando Starting Order:", error);
    return NextResponse.json({ error: error?.message || "Error procesando el PDF" }, { status: 500 });
  }
}

// Limpieza del bloque de texto: quita horas, fechas y ruido de cabecera/pie
// de página que el PDF repite en cada página.
//
// OJO: antes esto se hacía con una lista de PALABRAS sueltas a borrar
// ("Start","Length","End","Nation","TIME","SKATING","ORDER","SHORT",
// "PROGRAM","WORLD","SKATE"...), con \b para no comerse trozos de nombres
// reales (ver el bug histórico de "BRENDA" → "BRA" documentado más abajo).
// Aun con \b, la palabra suelta "SKATE" es un bug real encontrado con las
// actas de Show: el nombre de equipo real "HYMNIA SKATE CLUB LORRAIN"
// contiene la palabra completa "SKATE", así que \bSKATE\b la borraba igual,
// dejando "HYMNIA CLUB LORRAIN" en vez del nombre real. Ahora se borran
// FRASES completas ("WORLDSKATE", "TIME FOR SKATING (ORDER)", "SHORT
// PROGRAM", "STYLE DANCE", "FREE DANCE") en vez de palabras sueltas — un
// equipo real no se va a llamar exactamente igual que una de esas frases.
function cleanBlock(blockText: string): string {
  return blockText
    .replace(/\d{1,2}[:.]\d{2}([:.]\d{2})?/g, "") // horas "12:27" o "21.40"
    .replace(/\d{2}\/\d{2}\/\d{2,4}/g, "") // fechas "07/09/2026" o "30/05/26"
    .replace(/#\s*Start\s+Length\s+End\s+Nation/gi, "")
    .replace(/TIME\s+FOR\s+SKATING(\s+ORDER)?/gi, "")
    .replace(/WORLD\s*SKATE\b/gi, "")
    .replace(/\bSHORT\s+PROGRAM\b/gi, "")
    .replace(/\bSTYLE\s+DANCE\b/gi, "")
    .replace(/\bFREE\s+DANCE\b/gi, "")
    .replace(/\b(Seniores|Ladies)\b/gi, "");
}

interface ParsedEntry {
  order: number;
  firstName: string | null;
  lastName: string;
  country: string | null;
}

// Extrae las entradas (patinador/pareja/equipo) de un bloque de texto, según
// la forma que tengan sus líneas en ESTE acta (ver SkatingOrderMode arriba).
function parseSkatingOrderBlock(blockText: string, mode: SkatingOrderMode): ParsedEntry[] {
  const clean = cleanBlock(blockText);
  const rawLines = clean
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const results: ParsedEntry[] = [];

  // --- Caso especial: Small/Large Groups Show. La extracción de texto de
  // ESTE PDF concreto saca TODAS las filas de cabecera (dorsal + país, ya
  // sin las horas tras la limpieza) seguidas, y solo DESPUÉS todos los
  // nombres de equipo + canción — al revés que en el resto de formatos,
  // donde cada entrada va seguida de su propio nombre. Se detecta porque
  // hay una racha larga de líneas que empiezan por dorsal antes de ver
  // ninguna línea de nombre.
  let headerStreak = 0;
  for (; headerStreak < rawLines.length; headerStreak++) {
    if (!/^\d{1,2}\b/.test(rawLines[headerStreak])) break;
  }
  if (mode === "team" && headerStreak >= 3 && headerStreak < rawLines.length) {
    const headers = rawLines.slice(0, headerStreak).map((l) => {
      const tokens = l.split(/\s+/);
      const order = parseInt(tokens[0], 10);
      const rest = tokens.slice(1);
      let country: string | null = null;
      if (rest.length && isCountry(rest[rest.length - 1])) {
        country = rest.pop()!;
      }
      // Si sobra texto entre el dorsal y el país, es una fuga del nombre de
      // equipo de esa misma fila en la extracción del PDF (visto en la
      // última fila de "Small Groups Show": "12 ONYX FRA") — para esa fila
      // ya no hace falta sacar el nombre del bloque de nombres de abajo.
      const leaked = rest.length ? rest.join(" ") : null;
      return { order, country, leaked };
    });
    const nameLines = rawLines.slice(headerStreak);
    let ni = 0;
    for (const h of headers) {
      if (h.leaked) {
        results.push({ order: h.order, firstName: h.leaked, lastName: "", country: h.country });
        continue;
      }
      // El país de este bloque ya salió de la propia fila de cabecera (no
      // va pegado a la canción, a diferencia de Quartets/Large Show), así
      // que aquí siempre se consumen exactamente 2 líneas por equipo:
      // nombre + canción (la canción se descarta, igual que en el resto de
      // formatos de equipo).
      const teamLine = nameLines[ni++] ?? null;
      ni++; // canción, descartada
      results.push({ order: h.order, firstName: teamLine, lastName: "", country: h.country });
    }
    return results;
  }

  // --- Formato normal: cada entrada ocupa 1 o más líneas consecutivas y
  // termina en la línea cuya ÚLTIMA palabra es un país válido.
  let i = 0;
  while (i < rawLines.length) {
    const startMatch = rawLines[i].match(/^(\d{1,2})\s*(.*)$/);
    if (!startMatch) {
      i++;
      continue;
    }
    const order = parseInt(startMatch[1], 10);
    const firstRest = startMatch[2].trim();
    i++;

    const entryLines: string[] = [];
    let country: string | null = null;

    if (mode === "individual" && firstRest) {
      // Formato individual: dorsal + nombre + país, todo en la misma línea.
      const m = firstRest.match(/^(.*?)\s+([A-Z]{3})$/);
      if (m && isCountry(m[2])) {
        entryLines.push(m[1]);
        country = m[2];
      } else {
        entryLines.push(firstRest);
      }
    } else if (firstRest) {
      // Parejas/Equipos: el país NUNCA va en esta primera línea (siempre en
      // una línea posterior), así que no se comprueba aquí — si se
      // comprobara, un nombre de equipo que terminase por coincidencia en 3
      // mayúsculas (p.ej. "FASHION ONE") se cortaría mal, confundiendo
      // "ONE" con un país.
      entryLines.push(firstRest);
    }

    // Seguir leyendo líneas hasta encontrar el país, o hasta la siguiente
    // entrada (dorsal nuevo), lo que pase antes.
    while (
      country === null &&
      i < rawLines.length &&
      !/^\d{1,2}(\s|$)/.test(rawLines[i])
    ) {
      const line = rawLines[i];
      const bare = line.match(/^([A-Z]{3})$/);
      const suffixed = line.match(/^(.+?)\s+([A-Z]{3})$/);
      if (bare && isCountry(bare[1])) {
        country = bare[1];
        i++;
      } else if (suffixed && isCountry(suffixed[2])) {
        if (suffixed[1]) entryLines.push(suffixed[1]);
        country = suffixed[2];
        i++;
      } else {
        entryLines.push(line);
        i++;
      }
    }

    let firstName: string | null;
    let lastName: string;
    if (mode === "pair" && entryLines.length >= 2) {
      // Pareja: los dos nombres se guardan como firstName/lastName de UN
      // solo Skater — el mismo criterio que ya usa el acta de resultados
      // oficiales (JUDGES DETAILS PER SKATER) para emparejar Parejas y
      // Pareja Danza ("Patinador A - Patinador B" en una sola línea).
      firstName = entryLines[0];
      lastName = entryLines[1];
    } else if (mode === "team") {
      // Equipo: solo el nombre del equipo (primera línea) — cualquier línea
      // de canción/coreografía que se haya colado se descarta, igual que en
      // el acta de resultados oficiales.
      firstName = entryLines[0] ?? null;
      lastName = "";
    } else {
      const full = entryLines.join(" ").trim();
      const parts = full.split(" ").filter(Boolean);
      firstName = parts[0] ?? null;
      lastName = parts.slice(1).join(" ");
    }

    results.push({ order, firstName, lastName, country });
  }

  return results;
}

// Función mágica que extrae a los patinadores/parejas/equipos pase lo que
// pase, y los guarda como Skater + Registration.
async function parseAndRegisterSkaters(
  blockText: string,
  group: number,
  eventId: string,
  currentEvent: any,
  warmupGroupField: WarmupGroupField,
  mode: SkatingOrderMode
) {
  const imported: { startOrder: number; warmupGroup: number; fullName: string; country: string | null }[] = [];

  const entries = parseSkatingOrderBlock(blockText, mode);

  for (const entry of entries) {
    // Una entrada sin nombre recuperable (p.ej. una fuga de datos en el PDF
    // que no dejó nada que guardar) se salta en vez de crear un Skater en
    // blanco.
    if (!entry.firstName) continue;

    const { order, firstName, lastName, country } = entry;

    // Buscar o Crear Patinador/Pareja/Equipo.
    //
    // OJO con esto: antes se comparaba con un `equals` de Postgres
    // (case-insensitive pero nada más), así que la misma persona con el
    // nombre escrito con acentos distintos, con "Ñ"/"N", o con un espacio de
    // más que deja la extracción de texto del PDF (frecuente entre actas de
    // distintas federaciones) no se reconocía como la misma, y cada
    // reimportación iba acumulando un Skater duplicado — que es justo el
    // problema de "la lista de patinadores no para de crecer" reportado tras
    // usar esto varias semanas seguidas. Ahora se compara en memoria con
    // normalizeName() (quita acentos, colapsa espacios, minúsculas), sobre
    // un candidato ya acotado a la MISMA disciplina+categoría — acotarlo así
    // además evita el problema contrario (fusionar sin querer con un
    // patinador de incorporeo distinto que comparta nombre), coherente con
    // que un Skater ya está pensado como una entrada de una disciplina y
    // categoría concretas, no como una persona global.
    const candidates = await prisma.skater.findMany({
      where: {
        disciplineId: currentEvent.disciplineId,
        categoryId: currentEvent.categoryId,
      },
      select: { id: true, firstName: true, lastName: true, country: true },
    });

    const nFirst = normalizeName(firstName);
    const nLast = normalizeName(lastName);
    // Para "team" (lastName="") la comparación invertida no aporta nada
    // (queda "" en los dos lados), pero tampoco rompe nada.
    const candidateMatch = candidates.find(
      (c: { id: string; firstName: string; lastName: string; country: string | null }) =>
        (normalizeName(c.firstName) === nFirst && normalizeName(c.lastName) === nLast) ||
        (normalizeName(c.firstName) === nLast && normalizeName(c.lastName) === nFirst)
    );

    let skater = candidateMatch
      ? await prisma.skater.findUnique({ where: { id: candidateMatch.id } })
      : null;

    if (!skater) {
      skater = await prisma.skater.create({
        data: {
          firstName,
          lastName,
          country: country || "",
          disciplineId: currentEvent.disciplineId,
          categoryId: currentEvent.categoryId,
        },
      });
    } else if (!skater.country && country) {
      await prisma.skater.update({
        where: { id: skater.id },
        data: { country },
      });
    }

    // Inscribirlo (Registration) — el grupo de calentamiento se guarda en
    // el campo del segmento indicado (warmupGroupShort/warmupGroupLong), o
    // en el campo legado warmupGroup si no se especificó segmento. Show y
    // Precisión no tienen grupos de calentamiento reales — al no separarse
    // por "Warm Up Group N" en el PDF, todo cae en el grupo 1 por defecto,
    // que es inofensivo porque esas disciplinas no usan ese campo para nada.
    await prisma.registration.upsert({
      where: { eventId_skaterId: { eventId, skaterId: skater.id } },
      update: { startOrder: order, [warmupGroupField]: group },
      create: { eventId, skaterId: skater.id, startOrder: order, [warmupGroupField]: group },
    });

    imported.push({
      startOrder: order,
      warmupGroup: group,
      fullName: lastName ? `${firstName} - ${lastName}` : firstName,
      country,
    });
  }

  return imported;
}
