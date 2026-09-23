import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ResultsGrid from "./results-grid";

export default async function AdminResultsPage({ params }: { params: { eventId: string } }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "ADMIN") redirect("/");

  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    include: {
      slots: { include: { elementCategory: true, segment: true }, orderBy: { order: "asc" } },
      registrations: { include: { skater: true } },
    },
  });
  if (!event) return <p className="py-10 text-ice-100/70">Evento no encontrado.</p>;

  // Columnas = combinaciones únicas segmento+categoría de elemento que
  // definen los slots de este evento (solo eso afecta a la puntuación).
  const columns = event.slots
    .filter((s) => s.segmentId)
    .map((s) => ({
      segmentId: s.segmentId as string,
      segmentName: s.segment!.name,
      elementCategoryId: s.elementCategoryId,
      elementCategoryName: s.elementCategory.name,
    }))
    .filter((c, i, arr) => arr.findIndex((x) => x.segmentId === c.segmentId && x.elementCategoryId === c.elementCategoryId) === i);

  const existingScores = await prisma.elementScore.findMany({
    where: { registration: { eventId: event.id } },
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-white">Resultados — {event.name}</h1>
      <p className="mt-2 text-ice-100/60">
        Introduce la puntuación oficial de cada patinador tal como aparece en el protocolo, por
        segmento y categoría de elemento. El cálculo del fantasy se actualiza al instante.
      </p>

      <ResultsGrid
        registrations={event.registrations.map((r) => ({
          registrationId: r.id,
          skaterName: `${r.skater.firstName} ${r.skater.lastName}`,
          country: r.skater.country,
        }))}
        columns={columns}
        existingScores={existingScores.map((s) => ({
          registrationId: s.registrationId,
          segmentId: s.segmentId,
          elementCategoryId: s.elementCategoryId,
          value: s.value,
        }))}
      />
    </div>
  );
}
