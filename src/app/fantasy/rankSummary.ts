import { prisma } from "@/lib/prisma";
import { computeLeagueLeaderboard, mapWithConcurrency } from "@/lib/scoring";

export type MyLeagueRank = {
  id: string;
  name: string;
  rank: number | null; // null = aún no tienes puntos computados en esta liga
  total: number;
};

// Usado tanto en el Fantasy Hub como en la nueva página de Leaderboard, para
// las tarjetas "Liga Privada": una por cada liga a la que perteneces (no
// solo la primera), con tu puesto actual en ESA liga — independientemente de
// qué competición tengas seleccionada en la pestaña, porque una liga puede
// combinar eventos de varias competiciones (ver LeagueEvent).
export async function getMyLeagueRanks(userId: string): Promise<MyLeagueRank[]> {
  const leagues = await prisma.league.findMany({
    where: { memberships: { some: { userId } } },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  // mapWithConcurrency (no Promise.all suelto): computeLeagueLeaderboard ya
  // hace sus propias consultas concurrentes por evento, así que lanzar
  // además todas las ligas a la vez multiplicaba la presión sobre el pool de
  // conexiones de Neon — ver el comentario junto a mapWithConcurrency.
  return mapWithConcurrency(leagues, 3, async (league: { id: string; name: string }) => {
    const ranking = await computeLeagueLeaderboard(league.id);
    const index = ranking.findIndex((r) => r.userId === userId);
    return {
      id: league.id,
      name: league.name,
      rank: index === -1 ? null : index + 1,
      total: ranking.length,
    };
  });
}
