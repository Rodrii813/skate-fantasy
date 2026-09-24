import { prisma } from "@/lib/prisma";

export async function scoreEventPredictions(eventId: string) {
  // 1. Obtener las inscripciones del evento que ya tengan finalRank
  const registrations = await prisma.registration.findMany({
    where: {
      eventId,
      finalRank: { not: null },
    },
    select: {
      skaterId: true,
      finalRank: true,
    },
  });

  if (registrations.length === 0) return { updated: 0 };

  // Mapeo: skaterId -> puesto real
  const skaterToOfficialRank = new Map<string, number>();
  registrations.forEach((r) => {
    if (r.finalRank !== null) {
      skaterToOfficialRank.set(r.skaterId, r.finalRank);
    }
  });

  // 2. Traer todas las predicciones de los usuarios para este evento
  const predictions = await prisma.prediction.findMany({
    where: { eventId },
  });

  let count = 0;

  for (const pred of predictions) {
    let totalScore = 0;

    // Lista de picks del usuario: [posición predicha, skaterId]
    const userPicks: { predictedRank: number; skaterId: string | null }[] = [
      { predictedRank: 1, skaterId: pred.rank1SkaterId },
      { predictedRank: 2, skaterId: pred.rank2SkaterId },
      { predictedRank: 3, skaterId: pred.rank3SkaterId },
      { predictedRank: 4, skaterId: pred.rank4SkaterId },
      { predictedRank: 5, skaterId: pred.rank5SkaterId },
    ];

    let exactPodiumHits = 0;

    for (const pick of userPicks) {
      if (!pick.skaterId) continue;

      const actualRank = skaterToOfficialRank.get(pick.skaterId);
      // Si el patinador no compitió o no tiene puesto oficial registrado, 0 pts
      if (actualRank === undefined) continue;

      const diff = Math.abs(pick.predictedRank - actualRank);

      if (diff === 0) {
        // Acierto exacto del puesto
        totalScore += 5;
        if (pick.predictedRank <= 3) {
          exactPodiumHits++;
        }
      } else {
        // Fallo por solo un puesto de diferencia (ej. lo puso 5º y quedó 4º o 6º)
        if (diff === 1) {
          totalScore += 1;
        }

        // Si el usuario lo predijo en el podio (1º, 2º o 3º) y realmente terminó en podio (1º, 2º o 3º)
        if (pick.predictedRank <= 3 && actualRank <= 3) {
          totalScore += 2;
        }
      }
    }

    // Bonus de 3 puntos extra por clavar el podio completo exacto (1º, 2º y 3º)
    if (exactPodiumHits === 3) {
      totalScore += 3;
    }

    // Guardar los puntos calculados
    await prisma.prediction.update({
      where: { id: pred.id },
      data: { pointsEarned: totalScore },
    });

    count++;
  }

  return { updated: count };
}