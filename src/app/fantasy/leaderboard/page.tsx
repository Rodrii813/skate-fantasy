import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSegmentLocked, effectiveLocksAt } from "@/lib/segments";
import {
  computeCompetitionFantasyLeaderboard,
  computeCompetitionLeaderboardsBySegment,
} from "@/lib/scoring";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { translateCategoryName, translateDisciplineName } from "@/lib/i18n/categoryTranslations";
import RankSummaryCards from "../RankSummaryCards";
import ArchivedCompetitionSelect from "../ArchivedCompetitionSelect";
import { getMyLeagueRanks } from "../rankSummary";
import LiveRefresh from "../LiveRefresh";
import ProgramScoresAccordion, { type ProgramScoresColumn } from "./ProgramScoresAccordion";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = getDictionary(getLocale()).fantasyLeaderboard;
  return { title: t.title, description: t.subtitle };
}

// /fantasy/leaderboard: la clasificación completa de una competición (antes
// vivía embebida dentro de /fantasy, ver el commit que la quitó de ahí) —
// ahora es su propia página, igual que /events/[id] ya era su propia página
// para draftear ("Draft Room" en la jerga que trajo el usuario de la
// referencia). Arriba, las mismas tarjetas Global/Liga Privada que en el
// Fantasy Hub (mismo componente, RankSummaryCards) y debajo la clasificación
// global de la competición (paginada) más el desglose por prueba y segmento
// (acordeón por disciplina, cada segmento con su propia mini-clasificación
// paginada — ProgramScoresAccordion).
export default async function FantasyLeaderboardPage({
  searchParams,
}: {
  searchParams: { competition?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.fantasyLeaderboard;
  const tf = dict.fantasyHub;
  const genderLabel = dict.common.gender;

  const competitions = await prisma.competition.findMany({
    orderBy: { startDate: "asc" },
    include: {
      events: {
        orderBy: [{ discipline: { name: "asc" } }, { category: { order: "asc" } }],
        include: {
          discipline: true,
          category: true,
          segments: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (competitions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
        <div className="max-w-5xl mx-auto">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            {tf.noCompetitions}
          </div>
        </div>
      </div>
    );
  }

  const selectedCompetitionId = searchParams.competition || competitions[0].id;
  const activeCompetition =
    competitions.find((c) => c.id === selectedCompetitionId) || competitions[0];

  const now = new Date();
  const activeCompetitions = competitions.filter((c) => c.endDate >= now);
  const archivedCompetitions = competitions.filter((c) => c.endDate < now);
  const competitionTabs = activeCompetitions.length > 0 ? activeCompetitions : competitions;
  const archivedForSelect = activeCompetitions.length > 0 ? archivedCompetitions : [];

  // Tarjetas de resumen (puesto global + puesto por liga) y el desglose por
  // prueba (Program Scores) son consultas independientes entre sí — se
  // lanzan todas en paralelo con Promise.all en vez de una detrás de otra,
  // igual que se hizo en el Fantasy Hub, para no sumar sus tiempos. La
  // clasificación global de la competición (computeCompetitionFantasyLeaderboard)
  // y el desglose por prueba+segmento (computeCompetitionLeaderboardsBySegment)
  // son cada una 2 consultas en bloque sin importar cuántos eventos tenga la
  // competición (ver scoring.ts) — ya no escalan con el número de pruebas.
  const [competitionRanking, user, boardsByEvent] = await Promise.all([
    computeCompetitionFantasyLeaderboard(activeCompetition.id),
    session?.user?.email
      ? prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      : Promise.resolve(null as { id: string } | null),
    computeCompetitionLeaderboardsBySegment(activeCompetition.id),
  ]);
  const myGlobalIndex = user ? competitionRanking.findIndex((r) => r.userId === user!.id) : -1;
  const myGlobalRank = myGlobalIndex === -1 ? null : myGlobalIndex + 1;
  const myLeagueRanks = user ? await getMyLeagueRanks(user.id) : [];

  // Clasificación Global paginada — mismo patrón de paginación por URL
  // (?page=N) que tenía antes el Fantasy Hub, movido aquí con ella.
  const RANK_PAGE_SIZE = 15;
  const totalRankPages = Math.max(1, Math.ceil(competitionRanking.length / RANK_PAGE_SIZE));
  const currentRankPage = Math.min(Math.max(1, Number(searchParams.page) || 1), totalRankPages);
  const pagedRanking = competitionRanking.slice(
    (currentRankPage - 1) * RANK_PAGE_SIZE,
    currentRankPage * RANK_PAGE_SIZE
  );
  const rankPageHref = (page: number) => {
    const params = new URLSearchParams();
    params.set("competition", activeCompetition.id);
    if (page > 1) params.set("page", String(page));
    return `/fantasy/leaderboard?${params.toString()}`;
  };

  // Columnas dinámicas (disciplina+género), igual que en el Fantasy Hub —
  // y por cada evento, la clasificación de cada uno de sus segmentos
  // (computeEventLeaderboardBySegment), con el estado de bloqueo que ya usa
  // la clasificación de un evento suelto (fantasy/[eventId]/leaderboard).
  type Column = { key: string; label: string };
  const columns: Column[] = [];
  for (const ev of activeCompetition.events) {
    const key = `${ev.disciplineId}__${ev.gender ?? "none"}`;
    if (!columns.find((c) => c.key === key)) {
      const translatedDisciplineName = translateDisciplineName(ev.discipline.name, locale);
      columns.push({
        key,
        label: `${translatedDisciplineName}${ev.gender ? ` · ${genderLabel[ev.gender as keyof typeof genderLabel] ?? ev.gender}` : ""}`,
      });
    }
  }

  const ROW_LABELS = [tf.shortLabel, tf.longLabel] as const;

  // boardsByEvent ya se calculó más arriba, en paralelo con el resto —
  // aquí solo se filtran los eventos con segmentos configurados.
  const eventsWithSegments = activeCompetition.events.filter((ev) => ev.segments.length > 0);

  const programScoresColumns: ProgramScoresColumn[] = columns
    .map((col) => {
      const eventsInColumn = eventsWithSegments.filter(
        (ev) => `${ev.disciplineId}__${ev.gender ?? "none"}` === col.key
      );
      return {
        key: col.key,
        label: col.label,
        events: eventsInColumn.map((ev) => {
          const orderedSegments = [...ev.segments].sort((a, b) => a.order - b.order);
          const categoryLabel = `${translateCategoryName(ev.category.name, locale)}${
            ev.showFormat
              ? ` · ${dict.common.showFormat[ev.showFormat as keyof typeof dict.common.showFormat]}`
              : ""
          }`;
          const board = boardsByEvent.get(ev.id);
          return {
            id: ev.id,
            categoryLabel,
            isTest: Boolean(ev.isTest),
            segments: orderedSegments.map((segment, segIndex) => {
              const segmentBoard = board?.get(segment.id);
              const segmentLabel = ROW_LABELS[segIndex] ?? segment.name;
              return {
                id: segment.id,
                label: segmentLabel,
                showLabel: orderedSegments.length > 1,
                locked: isSegmentLocked(segment, ev.rosterLocksAt),
                deadlineIso: effectiveLocksAt(segment, ev.rosterLocksAt).toISOString(),
                hasScores: segmentBoard?.hasScores ?? false,
                // Los equipos de otros solo viajan al navegador cuando el
                // plazo de ESTE segmento ya cerró: si no, quedarían visibles
                // en la respuesta aunque la interfaz los oculte.
                rosters: isSegmentLocked(segment, ev.rosterLocksAt) ? segmentBoard?.rosters ?? [] : [],
                // Formateado aquí, en el servidor: ProgramScoresAccordion es
                // un Client Component y no puede recibir una función como
                // prop (ver el comentario en emptyText, en su definición).
                emptyText: t.emptySegment(segmentLabel),
              };
            }),
          };
        }),
      };
    })
    .filter((col) => col.events.length > 0);

  // Hay algo "en juego": algún segmento ya cerrado en un evento que aún no ha
  // terminado -> la página se refresca sola para ir mostrando los puntos.
  const isLive = activeCompetition.events.some(
    (ev) => ev.status !== "FINISHED" && ev.segments.some((seg) => isSegmentLocked(seg, ev.rosterLocksAt))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <LiveRefresh enabled={isLive} />
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="border-b border-slate-800 pb-6">
          <Link href="/fantasy" className="text-xs text-slate-400 hover:text-slate-200">
            {t.backToHub}
          </Link>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl">🏆</span>
            <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">{t.subtitle}</p>
        </div>

        {/* Selector de Competición: mismo patrón que el Fantasy Hub. */}
        <div className="flex flex-wrap items-center gap-2">
          {competitionTabs.map((c) => (
            <Link
              key={c.id}
              href={`/fantasy/leaderboard?competition=${c.id}`}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                c.id === activeCompetition.id
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-900/20"
                  : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              {c.name}
            </Link>
          ))}
          {archivedForSelect.length > 0 && (
            <ArchivedCompetitionSelect
              competitions={archivedForSelect}
              selectedId={archivedForSelect.some((c) => c.id === activeCompetition.id) ? activeCompetition.id : null}
              placeholder={tf.archivedCompetitionsPlaceholder}
            />
          )}
        </div>

        <RankSummaryCards
          globalLabel={t.globalCardLabel}
          globalRank={myGlobalRank}
          globalTotal={competitionRanking.length}
          globalHref="#global-standings"
          leagues={myLeagueRanks}
          joinLabel={t.joinLeagueCardLabel}
          joinHref="/fantasy/leagues"
          ofWord={t.ofWord}
          noRankLabel={t.noRankYet}
        />

        <div
          id="global-standings"
          className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40"
        >
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              {t.globalStandingsTitle(activeCompetition.name)}
            </h2>
          </div>

          {competitionRanking.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">{tf.noRankableRosters}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-800/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                      <th className="py-3 px-4 w-16">{tf.rank}</th>
                      <th className="py-3 px-4">{tf.coach}</th>
                      <th className="py-3 px-4 text-center">{tf.events}</th>
                      <th className="py-3 px-4 text-right font-bold text-white">{tf.points}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {pagedRanking.map((row, index) => {
                      const absoluteIndex = (currentRankPage - 1) * RANK_PAGE_SIZE + index;
                      return (
                        <tr key={row.userId} className="hover:bg-slate-800/30 transition font-mono">
                          <td className="py-3 px-4 font-bold text-slate-400">
                            {absoluteIndex === 0
                              ? "🥇"
                              : absoluteIndex === 1
                                ? "🥈"
                                : absoluteIndex === 2
                                  ? "🥉"
                                  : `#${absoluteIndex + 1}`}
                          </td>
                          <td className="py-3 px-4 font-sans font-semibold text-slate-200">{row.userName}</td>
                          <td className="py-3 px-4 text-center text-slate-400 font-sans text-xs">
                            {row.eventsPlayed}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-indigo-400">
                            {row.total.toFixed(2)} {tf.pointsSuffix}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalRankPages > 1 && (
                <div className="flex items-center justify-center gap-3 p-4 border-t border-slate-800 text-xs">
                  {currentRankPage > 1 ? (
                    <Link
                      href={rankPageHref(currentRankPage - 1)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:border-slate-600 hover:text-white"
                    >
                      {tf.prevPage}
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-600">
                      {tf.prevPage}
                    </span>
                  )}
                  <span className="text-slate-400">{tf.pageOf(currentRankPage, totalRankPages)}</span>
                  {currentRankPage < totalRankPages ? (
                    <Link
                      href={rankPageHref(currentRankPage + 1)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:border-slate-600 hover:text-white"
                    >
                      {tf.nextPage}
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-600">
                      {tf.nextPage}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">{t.programScoresTitle}</h2>
          </div>
          {programScoresColumns.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">{t.noEventsWithScores}</p>
          ) : (
            <ProgramScoresAccordion
              columns={programScoresColumns}
              expandAllLabel={tf.expandAll}
              collapseAllLabel={tf.collapseAll}
            />
          )}
        </div>
      </div>
    </div>
  );
}
