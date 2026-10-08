import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Detalle del acta (elementos, QOE, notas por juez) de un patinador en un
// segmento. Público, como las tablas de resultados; se pide solo al
// desplegar una fila para no cargar todos los JSON en cada visita.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const registrationId = searchParams.get("registrationId");
  const segmentId = searchParams.get("segmentId");
  if (!registrationId || !segmentId) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }
  const row = await prisma.segmentDetail.findUnique({
    where: { registrationId_segmentId: { registrationId, segmentId } },
    select: { data: true },
  });
  if (!row) return NextResponse.json({ error: "Sin detalle" }, { status: 404 });
  return NextResponse.json(row.data, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
