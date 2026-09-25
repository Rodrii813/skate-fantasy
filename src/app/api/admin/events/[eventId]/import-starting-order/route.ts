import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractText } from "unpdf";

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

    // Obtener la disciplina y categoría del propio evento
    const currentEvent = await prisma.event.findUnique({
      where: { id: eventId },
      select: { disciplineId: true, categoryId: true },
    });

    if (!currentEvent) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const segmentName = (formData.get("segmentName") as string) || "";
    const warmupGroupField = resolveWarmupGroupField(segmentName);

    if (!file) return NextResponse.json({ error: "Falta el archivo PDF" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const { text } = await extractText(arrayBuffer);
    const fullText = Array.isArray(text) ? text.join("\n") : text;

    // 1. Separar el documento por "Warm Up Group 1", "Warm Up Group 2"...
    const groupBlocks = fullText.split(/Warm\s*Up\s*Group\s*(\d+)/i);
    const importedSkaters: {
      startOrder: number;
      warmupGroup: number;
      fullName: string;
      country: string;
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
          warmupGroupField
        );
        importedSkaters.push(...skaters);
      }
    } else {
      // Si no hay grupos detectados, procesa todo el texto como Grupo 1
      const skaters = await parseAndRegisterSkaters(fullText, 1, eventId, currentEvent, warmupGroupField);
      importedSkaters.push(...skaters);
    }

    return NextResponse.json({ ok: true, count: importedSkaters.length, skaters: importedSkaters });
  } catch (error: any) {
    console.error("Error importando Starting Order:", error);
    return NextResponse.json({ error: error?.message || "Error procesando el PDF" }, { status: 500 });
  }
}

// Función mágica que extrae a los patinadores pase lo que pase
async function parseAndRegisterSkaters(
  blockText: string,
  group: number,
  eventId: string,
  currentEvent: any,
  warmupGroupField: WarmupGroupField
) {
  const imported: { startOrder: number; warmupGroup: number; fullName: string; country: string }[] = [];

  // 1. Limpieza radical: Borramos todas las horas (12:27, 05:15), fechas (07/09/2026) y ruido de encabezados
  //
  // OJO: las dos líneas de palabras de ruido llevan \b (límites de palabra)
  // a propósito. Sin ellos, el replace buscaba esas letras EN CUALQUIER
  // SITIO, incluso dentro de un nombre real — por ejemplo "BRENDA" contiene
  // "END" (bR-END-a) y "Nation" sin \b tacharía el trozo "NAT" de cualquier
  // nombre que lo contuviera. Esto convertía de verdad "BRENDA LUQUE
  // SANTAMARIA" en "BRA LUQUE SANTAMARIA" al importar. Con \b solo se borran
  // esas palabras completas (encabezados de tabla), nunca un trozo de un
  // nombre.
  let clean = blockText
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, "") // Elimina formatos HH:MM
    .replace(/\d{2}\/\d{2}\/\d{4}/g, "")    // Elimina formatos DD/MM/YYYY
    .replace(/\b(Start|Length|End|Nation|TIME|SKATING|ORDER|SHORT|PROGRAM|WORLD|SKATE)\b/gi, "")
    .replace(/\b(Seniores|Free|Ladies)\b/gi, "");

  // 2. Expresión regular: Busca (Dorsal) -> (Espacios/Saltos) -> (Nombre) -> (Espacios) -> (País de 3 letras)
  //
  // OJO: el grupo del nombre es "no-greedy" (+?) a propósito. Con captura
  // "greedy" (como estaba antes), si en la línea del PDF aparecían DOS
  // tokens de 3 letras mayúsculas seguidos (p.ej. el país real y, más
  // adelante en la misma línea, alguna otra sigla de 3 letras), el nombre se
  // "comía" el primero de los dos como si fuera parte del nombre y el país
  // quedaba mal asignado al segundo — esto creó un patinador duplicado real
  // ("MADALENA RODRIGUES COSTA POR" / país "FOR" en vez de "MADALENA
  // RODRIGUES COSTA" / país "POR"). Con "no-greedy" el regex se detiene en
  // el primer código de 3 letras que encuentra, que es el país correcto.
  const regex = /(\b\d{1,2}\b)\s+([a-zA-ZÁÉÍÓÚÑÏÜáéíóúñïü '-]{4,}?)\s+([A-Z]{3})\b/g;

  let match;
  while ((match = regex.exec(clean)) !== null) {
    const order = parseInt(match[1], 10);
    const fullName = match[2].trim();
    const country = match[3];

    const parts = fullName.split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");

    // 3. Buscar o Crear Patinador
    let skater = await prisma.skater.findFirst({
      where: {
        OR: [
          { AND: [{ firstName: { equals: firstName, mode: "insensitive" } }, { lastName: { equals: lastName, mode: "insensitive" } }] },
          { AND: [{ firstName: { equals: lastName, mode: "insensitive" } }, { lastName: { equals: firstName, mode: "insensitive" } }] },
        ],
      },
    });

    if (!skater) {
      skater = await prisma.skater.create({
        data: {
          firstName,
          lastName,
          country,
          disciplineId: currentEvent.disciplineId,
          categoryId: currentEvent.categoryId,
        },
      });
    } else if (!skater.country) {
      await prisma.skater.update({
        where: { id: skater.id },
        data: { country },
      });
    }

    // 4. Inscribirlo (Registration) — el grupo de calentamiento se guarda en
    // el campo del segmento indicado (warmupGroupShort/warmupGroupLong), o
    // en el campo legado warmupGroup si no se especificó segmento.
    await prisma.registration.upsert({
      where: { eventId_skaterId: { eventId, skaterId: skater.id } },
      update: { startOrder: order, [warmupGroupField]: group },
      create: { eventId, skaterId: skater.id, startOrder: order, [warmupGroupField]: group },
    });

    imported.push({ startOrder: order, warmupGroup: group, fullName, country });
  }

  return imported;
}
