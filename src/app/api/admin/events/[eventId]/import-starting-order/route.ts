import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractText } from "unpdf";

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

    if (!file) return NextResponse.json({ error: "Falta el archivo PDF" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const { text } = await extractText(arrayBuffer);
    const fullText = Array.isArray(text) ? text.join("\n") : text;

    // 1. Separar el documento por "Warm Up Group 1", "Warm Up Group 2"...
    const segments = fullText.split(/Warm\s*Up\s*Group\s*(\d+)/i);
    let importedCount = 0;

    if (segments.length > 1) {
      // Procesar cada grupo de calentamiento por separado
      for (let i = 1; i < segments.length; i += 2) {
        const groupNumber = parseInt(segments[i], 10);
        const blockContent = segments[i + 1];
        const count = await parseAndRegisterSkaters(blockContent, groupNumber, eventId, currentEvent);
        importedCount += count;
      }
    } else {
      // Si no hay grupos detectados, procesa todo el texto como Grupo 1
      importedCount = await parseAndRegisterSkaters(fullText, 1, eventId, currentEvent);
    }

    return NextResponse.json({ ok: true, count: importedCount });
  } catch (error: any) {
    console.error("Error importando Starting Order:", error);
    return NextResponse.json({ error: error?.message || "Error procesando el PDF" }, { status: 500 });
  }
}

// Función mágica que extrae a los patinadores pase lo que pase
async function parseAndRegisterSkaters(blockText: string, group: number, eventId: string, currentEvent: any) {
  let count = 0;

  // 1. Limpieza radical: Borramos todas las horas (12:27, 05:15), fechas (07/09/2026) y ruido de encabezados
  let clean = blockText
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, "") // Elimina formatos HH:MM
    .replace(/\d{2}\/\d{2}\/\d{4}/g, "")    // Elimina formatos DD/MM/YYYY
    .replace(/(Start|Length|End|Nation|TIME|SKATING|ORDER|SHORT|PROGRAM|WORLD|SKATE)/gi, "")
    .replace(/Seniores|Free|Ladies/gi, "");

  // 2. Expresión regular infalible: Busca (Dorsal) -> (Espacios/Saltos) -> (Nombre) -> (Espacios) -> (País de 3 letras)
  const regex = /(\b\d{1,2}\b)\s+([a-zA-ZÁÉÍÓÚÑÏÜáéíóúñïü '-]{4,})\s+([A-Z]{3})\b/g;

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

    // 4. Inscribirlo (Registration)
    await prisma.registration.upsert({
      where: { eventId_skaterId: { eventId, skaterId: skater.id } },
      update: { startOrder: order, warmupGroup: group },
      create: { eventId, skaterId: skater.id, startOrder: order, warmupGroup: group },
    });

    count++;
  }

  return count;
}