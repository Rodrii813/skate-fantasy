import { prisma } from "./prisma";

export type SlotResult = {
  slotId: string;
  slotLabel: string;
  skaterId: string;
  skaterName: string;
  points: number; // 0 si aún no hay puntuación cargada para ese slot
};

export type RosterScore = {
  rosterId: string;
  userId: string;
  userName: string;
  total: number;
  slots: SlotResult[];
};

/**
 * Calcula la puntuación fantasy de todos los rosters de un evento.
 * Para cada pick, busca la puntuación oficial (ElementScore) del patinador
 * elegido en la categoría de elemento + segmento que define el slot.
 * Si el admin aún no ha cargado esa puntuación, cuenta como 0 (pendiente).
 */
export async function computeEventLeaderboard(eventId: string): Promise<RosterScore[]> {
  const rosters = await prisma.fantasyRoster.findMany({
    where: { eventId },
    include: {
      user: true,
      picks: {
        include: {
          slot: true,
          skater: true,
        },
      },
    },
  });

  // Pre-cargamos todas las puntuaciones oficiales del evento para no hacer
  // una query por pick.
  const scores = await prisma.elementScore.findMany({
    where: { registration: { eventId } },
    include: { registration: true },
  });

  const scoreKey = (skaterId: string, elementCategoryId: string, segmentId: string) =>
    `${skaterId}__${elementCategoryId}__${segmentId}`;

  const scoreMap = new Map<string, number>();
  for (const s of scores) {
    scoreMap.set(scoreKey(s.registration.skaterId, s.elementCategoryId, s.segmentId), s.value);
  }

  const results: RosterScore[] = rosters.map((roster) => {
    const slots: SlotResult[] = roster.picks.map((pick) => {
      const key = pick.slot.segmentId
        ? scoreKey(pick.skaterId, pick.slot.elementCategoryId, pick.slot.segmentId)
        : null;
      const points = key ? scoreMap.get(key) ?? 0 : 0;
      return {
        slotId: pick.slotId,
        slotLabel: pick.slot.label,
        skaterId: pick.skaterId,
        skaterName: `${pick.skater.firstName} ${pick.skater.lastName}`,
        points,
      };
    });

    const total = slots.reduce((sum, s) => sum + s.points, 0);

    return {
      rosterId: roster.id,
      userId: roster.userId,
      userName: roster.user.name,
      total,
      slots,
    };
  });

  return results.sort((a, b) => b.total - a.total);
}

/** Ranking global: suma los totales de cada usuario a través de todos los eventos. */
export async function computeGlobalLeaderboard() {
  const events = await prisma.event.findMany({ select: { id: true, name: true } });
  const totalsByUser = new Map<string, { userName: string; total: number }>();

  for (const event of events) {
    const board = await computeEventLeaderboard(event.id);
    for (const row of board) {
      const existing = totalsByUser.get(row.userId);
      if (existing) {
        existing.total += row.total;
      } else {
        totalsByUser.set(row.userId, { userName: row.userName, total: row.total });
      }
    }
  }

  return Array.from(totalsByUser.entries())
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.total - a.total);
}
