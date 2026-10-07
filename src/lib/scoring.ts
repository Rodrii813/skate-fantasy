import { prisma } from "./prisma";
import { formatSkaterName } from "@/lib/skaterName";

// Las bases de datos serverless (Neon, la que usa este proyecto) tienen un
// límite bajo de conexiones concurrentes. computeGlobalLeaderboard,
// computeCompetitionFantasyLeaderboard y computeLeagueLeaderboard lanzan 2
// consultas por evento con Promise.all — con una competición de 15-20
// pruebas eso son 30-40 conexiones a la vez, y desde que el Fantasy Hub y el
// nuevo /fantasy/leaderboard las calculan en CADA visita (antes solo al
// pulsar la pestaña "Global", así que rara vez se llegaba a ejercitar a este
// tamaño) empezó a agotar el pool y tirar la página entera con un error de
// Server Component. mapWithConcurrency limita cuántas promesas están en
// vuelo a la vez, en vez de lanzarlas todas de golpe.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    for (;;) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await fn(items[current]);
    }
  }
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export type SlotResult = {
  // true si ya hay una puntuación oficial cargada para este slot (en directo
  // se van cargando de una en una; sin ella los puntos son 0 pero no "0 de
  // verdad"). Opcional para no romper a quien construye SlotResult sin esto.
  scored?: boolean;
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
          skater: { include: { discipline: { select: { name: true } } } },
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
        skaterName: formatSkaterName(pick.skater),
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

export type SegmentLeaderboard = {
  segmentId: string;
  rosters: RosterScore[];
  // Si el admin ya ha cargado al menos una puntuación oficial de este
  // segmento. Un segmento puede estar "cerrado" (plazo pasado) sin que
  // todavía haya resultados subidos — distinguir eso evita que la
  // clasificación en vivo enseñe una pared de "0.00 pts" que parezca que
  // todo el mundo sacó cero, cuando en realidad es que aún no hay nada
  // cargado.
  hasScores: boolean;
};

/**
 * Igual que computeEventLeaderboard, pero separa el resultado POR SEGMENTO
 * (Corto/Largo) en vez de sumarlo todo junto — cada segmento tiene su propio
 * plazo de fichajes y su propio sorteo de calentamiento, así que su
 * clasificación debe poder consultarse en cuanto ESE segmento cierre y se
 * puntúe, sin esperar a que el otro también termine. Se recalculan las
 * mismas dos consultas que computeEventLeaderboard en vez de reutilizarla
 * para no tocar esa función (la usan computeGlobalLeaderboard,
 * computeCompetitionFantasyLeaderboard y computeLeagueLeaderboard, con un
 * total combinado que sigue siendo el comportamiento correcto ahí).
 * Los slots sin segmento (eventos antiguos sin segmentos configurados) no
 * aparecen aquí — para esos sigue sirviendo computeEventLeaderboard tal cual.
 */
export async function computeEventLeaderboardBySegment(
  eventId: string
): Promise<Map<string, SegmentLeaderboard>> {
  const rosters = await prisma.fantasyRoster.findMany({
    where: { eventId },
    include: {
      user: true,
      picks: {
        include: { slot: true, skater: { include: { discipline: { select: { name: true } } } } },
      },
    },
  });

  const scores = await prisma.elementScore.findMany({
    where: { registration: { eventId } },
    include: { registration: true },
  });

  const scoreKey = (skaterId: string, elementCategoryId: string, segmentId: string) =>
    `${skaterId}__${elementCategoryId}__${segmentId}`;

  const scoreMap = new Map<string, number>();
  const scoredSegmentIds = new Set<string>();
  for (const s of scores) {
    scoreMap.set(scoreKey(s.registration.skaterId, s.elementCategoryId, s.segmentId), s.value);
    scoredSegmentIds.add(s.segmentId);
  }

  const rostersBySegment = new Map<string, RosterScore[]>();

  for (const roster of rosters) {
    const slotsBySegment = new Map<string, SlotResult[]>();
    for (const pick of roster.picks) {
      const segmentId = pick.slot.segmentId;
      if (!segmentId) continue;
      const key = scoreKey(pick.skaterId, pick.slot.elementCategoryId, segmentId);
      const slotResult: SlotResult = {
        slotId: pick.slotId,
        slotLabel: pick.slot.label,
        skaterId: pick.skaterId,
        skaterName: formatSkaterName(pick.skater),
        points: scoreMap.get(key) ?? 0,
        scored: scoreMap.has(key),
      };
      if (!slotsBySegment.has(segmentId)) slotsBySegment.set(segmentId, []);
      slotsBySegment.get(segmentId)!.push(slotResult);
    }

    for (const [segmentId, slots] of slotsBySegment) {
      if (!rostersBySegment.has(segmentId)) rostersBySegment.set(segmentId, []);
      rostersBySegment.get(segmentId)!.push({
        rosterId: roster.id,
        userId: roster.userId,
        userName: roster.user.name,
        total: slots.reduce((sum, s) => sum + s.points, 0),
        slots,
      });
    }
  }

  const result = new Map<string, SegmentLeaderboard>();
  for (const [segmentId, boardRosters] of rostersBySegment) {
    result.set(segmentId, {
      segmentId,
      rosters: boardRosters.sort((a, b) => b.total - a.total),
      hasScores: scoredSegmentIds.has(segmentId),
    });
  }
  return result;
}

/**
 * Igual que computeEventLeaderboardBySegment pero para TODOS los eventos de
 * una competición de una vez (2 consultas en total, no 2 por evento) — la
 * usa /fantasy/leaderboard para las "Puntuaciones por prueba": antes pedía
 * esto evento a evento (con mapWithConcurrency para no agotar el pool de
 * Neon), lo que seguía siendo docenas de consultas y se notaba como
 * lentitud real. Mismo motivo y misma solución que computeBulkFantasyTotals,
 * arriba, solo que aquí agrupando por evento+segmento en vez de sumar un
 * único total por usuario.
 */
export async function computeCompetitionLeaderboardsBySegment(
  competitionId: string
): Promise<Map<string, Map<string, SegmentLeaderboard>>> {
  const result = new Map<string, Map<string, SegmentLeaderboard>>();

  const rosters = await prisma.fantasyRoster.findMany({
    where: { event: { competitionId } },
    include: {
      user: true,
      picks: { include: { slot: true, skater: { include: { discipline: { select: { name: true } } } } } },
    },
  });
  if (rosters.length === 0) return result;

  const eventIds = Array.from(new Set(rosters.map((r) => r.eventId)));
  const scores = await prisma.elementScore.findMany({
    where: { registration: { eventId: { in: eventIds } } },
    include: { registration: true },
  });

  const scoreKey = (skaterId: string, elementCategoryId: string, segmentId: string) =>
    `${skaterId}__${elementCategoryId}__${segmentId}`;
  const scoreMap = new Map<string, number>();
  const scoredSegmentIds = new Set<string>();
  for (const s of scores) {
    scoreMap.set(scoreKey(s.registration.skaterId, s.elementCategoryId, s.segmentId), s.value);
    scoredSegmentIds.add(s.segmentId);
  }

  // eventId -> segmentId -> rosters de ese evento+segmento
  const rostersByEventSegment = new Map<string, Map<string, RosterScore[]>>();

  for (const roster of rosters) {
    const slotsBySegment = new Map<string, SlotResult[]>();
    for (const pick of roster.picks) {
      const segmentId = pick.slot.segmentId;
      if (!segmentId) continue;
      const key = scoreKey(pick.skaterId, pick.slot.elementCategoryId, segmentId);
      const slotResult: SlotResult = {
        slotId: pick.slotId,
        slotLabel: pick.slot.label,
        skaterId: pick.skaterId,
        skaterName: formatSkaterName(pick.skater),
        points: scoreMap.get(key) ?? 0,
        scored: scoreMap.has(key),
      };
      if (!slotsBySegment.has(segmentId)) slotsBySegment.set(segmentId, []);
      slotsBySegment.get(segmentId)!.push(slotResult);
    }

    if (!rostersByEventSegment.has(roster.eventId)) rostersByEventSegment.set(roster.eventId, new Map());
    const bySegment = rostersByEventSegment.get(roster.eventId)!;

    for (const [segmentId, slots] of slotsBySegment) {
      if (!bySegment.has(segmentId)) bySegment.set(segmentId, []);
      bySegment.get(segmentId)!.push({
        rosterId: roster.id,
        userId: roster.userId,
        userName: roster.user.name,
        total: slots.reduce((sum, s) => sum + s.points, 0),
        slots,
      });
    }
  }

  for (const [eventId, bySegment] of rostersByEventSegment) {
    const segmentMap = new Map<string, SegmentLeaderboard>();
    for (const [segmentId, boardRosters] of bySegment) {
      segmentMap.set(segmentId, {
        segmentId,
        rosters: boardRosters.sort((a, b) => b.total - a.total),
        hasScores: scoredSegmentIds.has(segmentId),
      });
    }
    result.set(eventId, segmentMap);
  }

  return result;
}

/**
 * Núcleo compartido de computeGlobalLeaderboard, computeCompetitionFantasyLeaderboard
 * y computeLeagueLeaderboard. Antes cada una pedía el leaderboard evento a
 * evento (computeEventLeaderboard, 2 consultas por evento) y sumaba los
 * totales — con una competición de 15-20 pruebas eso son 30-40 consultas
 * seguidas en cada visita a /fantasy o /fantasy/leaderboard (antes solo se
 * ejecutaba al entrar a la pestaña "Global", así que casi nunca se notaba).
 * Eso disparaba conexiones a la base de datos serverless (Neon) a la vez,
 * agotaba su pool y además se notaba como una lentitud real. Esta función
 * trae TODOS los rosters y TODAS las puntuaciones de los eventos pedidos en
 * una sola tanda de 2 consultas (sin importar cuántos eventos sean) y agrega
 * los totales en memoria — mismo cálculo de puntos que computeEventLeaderboard
 * (0 si la puntuación oficial todavía no está cargada).
 */
async function computeBulkFantasyTotals(
  eventIds: string[]
): Promise<Map<string, { userName: string; total: number; eventIds: Set<string> }>> {
  const totalsByUser = new Map<string, { userName: string; total: number; eventIds: Set<string> }>();
  if (eventIds.length === 0) return totalsByUser;

  const rosters = await prisma.fantasyRoster.findMany({
    where: { eventId: { in: eventIds } },
    include: { user: true, picks: { include: { slot: true } } },
  });
  if (rosters.length === 0) return totalsByUser;

  const scores = await prisma.elementScore.findMany({
    where: { registration: { eventId: { in: eventIds } } },
    include: { registration: true },
  });

  const scoreKey = (skaterId: string, elementCategoryId: string, segmentId: string) =>
    `${skaterId}__${elementCategoryId}__${segmentId}`;
  const scoreMap = new Map<string, number>();
  for (const s of scores) {
    scoreMap.set(scoreKey(s.registration.skaterId, s.elementCategoryId, s.segmentId), s.value);
  }

  for (const roster of rosters) {
    let rosterTotal = 0;
    for (const pick of roster.picks) {
      const segmentId = pick.slot.segmentId;
      const key = segmentId ? scoreKey(pick.skaterId, pick.slot.elementCategoryId, segmentId) : null;
      rosterTotal += key ? scoreMap.get(key) ?? 0 : 0;
    }
    const existing = totalsByUser.get(roster.userId);
    if (existing) {
      existing.total += rosterTotal;
      existing.eventIds.add(roster.eventId);
    } else {
      totalsByUser.set(roster.userId, {
        userName: roster.user.name,
        total: rosterTotal,
        eventIds: new Set([roster.eventId]),
      });
    }
  }

  return totalsByUser;
}

/** Ranking global: suma los totales de cada usuario a través de todos los eventos. */
export async function computeGlobalLeaderboard() {
  const events = await prisma.event.findMany({ select: { id: true } });
  const totals = await computeBulkFantasyTotals(events.map((e) => e.id));

  return Array.from(totals.entries())
    .map(([userId, v]) => ({ userId, userName: v.userName, total: v.total }))
    .sort((a, b) => b.total - a.total);
}

export type CompetitionScore = {
  userId: string;
  userName: string;
  total: number;
  eventsPlayed: number;
};

/**
 * Ranking Fantasy GLOBAL de una competición: igual que computeGlobalLeaderboard
 * pero acotado a los eventos de UNA competición (para la tarjeta "Global" y
 * la Clasificación Global de /fantasy y /fantasy/leaderboard).
 */
export async function computeCompetitionFantasyLeaderboard(
  competitionId: string
): Promise<CompetitionScore[]> {
  const events = await prisma.event.findMany({
    where: { competitionId },
    select: { id: true },
  });
  const totals = await computeBulkFantasyTotals(events.map((e) => e.id));

  return Array.from(totals.entries())
    .map(([userId, v]) => ({ userId, userName: v.userName, total: v.total, eventsPlayed: v.eventIds.size }))
    .sort((a, b) => b.total - a.total);
}

export type LeagueScore = {
  userId: string;
  userName: string;
  total: number;
  eventsPlayed: number;
};

/**
 * Ranking Fantasy de una LIGA PRIVADA: igual que
 * computeCompetitionFantasyLeaderboard pero acotado a (a) solo los eventos
 * que el creador de la liga eligió al crearla (LeagueEvent) y (b) solo los
 * miembros de la liga (LeagueMembership) — un usuario que no está en la
 * liga no aparece aunque haya jugado esos eventos. Todos los miembros
 * aparecen desde el primer momento (0 puntos, 0 eventos) aunque todavía no
 * hayan hecho ningún draft, para que la liga se vea completa nada más
 * crearse (por eso se recorre league.memberships, no el resultado de
 * computeBulkFantasyTotals).
 */
export async function computeLeagueLeaderboard(leagueId: string): Promise<LeagueScore[]> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      events: { select: { eventId: true } },
      memberships: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!league) return [];

  const totals = await computeBulkFantasyTotals(league.events.map((e) => e.eventId));

  return league.memberships
    .map((m) => {
      const v = totals.get(m.userId);
      return {
        userId: m.userId,
        userName: m.user.name,
        total: v?.total ?? 0,
        eventsPlayed: v?.eventIds.size ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export type MyEventPicks = {
  eventId: string;
  rosterId: string;
  slotsBySegment: Map<string, SlotResult[]>;
  // Segmentos con al menos una puntuación oficial cargada — mismo motivo que
  // SegmentLeaderboard.hasScores: un segmento puede estar cerrado sin
  // resultados subidos todavía, y ahí hay que mostrar "pendiente" en vez de
  // puntos a 0 (que parecería que el patinador elegido sacó cero).
  hasScoresBySegment: Set<string>;
};

/**
 * Para el Fantasy Hub (/fantasy): el equipo que YO he elegido en cada evento
 * de una competición, con sus puntos si ya hay resultados — para mostrarlo
 * directamente al desplegar cada disciplina, sin tener que entrar al Draft
 * Room. Dos consultas en total para toda la competición (no una por evento),
 * igual que el resto de funciones de este archivo evitan N+1.
 */
export async function computeMyPicksForCompetition(
  competitionId: string,
  userId: string
): Promise<Map<string, MyEventPicks>> {
  const rosters = await prisma.fantasyRoster.findMany({
    where: { userId, event: { competitionId } },
    include: { picks: { include: { slot: true, skater: { include: { discipline: { select: { name: true } } } } } } },
  });

  const result = new Map<string, MyEventPicks>();
  if (rosters.length === 0) return result;

  const eventIds = rosters.map((r) => r.eventId);
  const scores = await prisma.elementScore.findMany({
    where: { registration: { eventId: { in: eventIds } } },
    include: { registration: true },
  });

  const scoreKey = (skaterId: string, elementCategoryId: string, segmentId: string) =>
    `${skaterId}__${elementCategoryId}__${segmentId}`;

  const scoreMap = new Map<string, number>();
  const scoredSegmentIds = new Set<string>();
  for (const s of scores) {
    scoreMap.set(scoreKey(s.registration.skaterId, s.elementCategoryId, s.segmentId), s.value);
    scoredSegmentIds.add(s.segmentId);
  }

  for (const roster of rosters) {
    const slotsBySegment = new Map<string, SlotResult[]>();
    const hasScoresBySegment = new Set<string>();
    for (const pick of roster.picks) {
      const segmentId = pick.slot.segmentId;
      if (!segmentId) continue;
      const key = scoreKey(pick.skaterId, pick.slot.elementCategoryId, segmentId);
      const slotResult: SlotResult = {
        slotId: pick.slotId,
        slotLabel: pick.slot.label,
        skaterId: pick.skaterId,
        skaterName: formatSkaterName(pick.skater),
        points: scoreMap.get(key) ?? 0,
        scored: scoreMap.has(key),
      };
      if (!slotsBySegment.has(segmentId)) slotsBySegment.set(segmentId, []);
      slotsBySegment.get(segmentId)!.push(slotResult);
      if (scoredSegmentIds.has(segmentId)) hasScoresBySegment.add(segmentId);
    }
    result.set(roster.eventId, { eventId: roster.eventId, rosterId: roster.id, slotsBySegment, hasScoresBySegment });
  }

  return result;
}

export type PredictionScore = {
  userId: string;
  userName: string;
  total: number;
  eventsPlayed: number;
};

/**
 * Ranking de Predicciones de UN evento. A diferencia del Fantasy, los
 * puntos de Prediction ya están precalculados y guardados en
 * Prediction.pointsEarned por scoreEventPredictions() (src/lib/calculatePredictions.ts,
 * se ejecuta desde el panel de admin al cargar resultados) — aquí solo se
 * lee y se ordena, no se recalcula la puntuación.
 */
export async function computeEventPredictionLeaderboard(eventId: string): Promise<PredictionScore[]> {
  const predictions = await prisma.prediction.findMany({
    where: { eventId, pointsEarned: { not: null } },
    include: { user: true },
  });

  return predictions
    .map((p) => ({
      userId: p.userId,
      userName: p.user.name,
      total: p.pointsEarned ?? 0,
      eventsPlayed: 1,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Ranking de Predicciones GLOBAL de una competición: suma pointsEarned de
 * todos los eventos ya puntuados de esa competición, por usuario.
 */
export async function computeCompetitionPredictionLeaderboard(
  competitionId: string
): Promise<PredictionScore[]> {
  const predictions = await prisma.prediction.findMany({
    where: { event: { competitionId }, pointsEarned: { not: null } },
    include: { user: true },
  });

  const totalsByUser = new Map<string, { userName: string; total: number; eventsPlayed: number }>();
  for (const p of predictions) {
    const existing = totalsByUser.get(p.userId);
    if (existing) {
      existing.total += p.pointsEarned ?? 0;
      existing.eventsPlayed += 1;
    } else {
      totalsByUser.set(p.userId, {
        userName: p.user.name,
        total: p.pointsEarned ?? 0,
        eventsPlayed: 1,
      });
    }
  }

  return Array.from(totalsByUser.entries())
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.total - a.total);
}
