import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSegmentDraftStatus } from "@/lib/segments";
import { computeEventLeaderboard, computeCompetitionFantasyLeaderboard } from "@/lib/scoring";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { translateCategoryName, translateDisciplineName } from "@/lib/i18n/categoryTranslations";
import DraftStatusAccordion, { type DraftStatusColumn } from "./DraftStatusAccordion";
import ArchivedCompetitionSelect from "./ArchivedCompetitionSelect";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = getDictionary(getLocale()).meta.fantasy;
  return { title: t.title, description: t.description };
}

// /fantasy es el hub del modo Fantasy: selector Competición → Evento
// presentado como tabla "Draft Status" (filas = segmento Corto/Largo,
// columnas = combinaciones disciplina+género que existan de verdad en la
// competición elegida, construidas dinámicamente — no hay nombres fijos
// tipo "Men/Women" porque el catálogo de disciplinas es editable desde
// admin), y debajo el Ranking Fantasy con las dos vistas: por evento
// (reutiliza computeEventLeaderboard) y global por competición (nueva
// computeCompetitionFantasyLeaderboard, que sí es nueva pero construida
// sumando computeEventLeaderboard evento a evento, no reimplementando la
// puntuación).
export default async function FantasyHubPage({
  searchParams,
}: {
  searchParams: { competition?: string; event?: string; rank?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.fantasyHub;
  const genderLabel = dict.common.gender;
  const ROW_LABELS = [t.shortLabel, t.longLabel] as const;

  const competitions = await prisma.competition.findMany({
    orderBy: { startDate: "asc" },
    include: {
      events: {
        orderBy: [{ discipline: { name: "asc" } }, { category: { order: "asc" } }],
        include: {
          discipline: true,
          category: true,
          segments: { orderBy: { order: "asc" } },
          slots: { select: { id: true, segmentId: true } },
          _count: { select: { rosters: true } },
        },
      },
    },
  });

  if (competitions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
        <div className="max-w-5xl mx-auto">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            {t.noCompetitions}
          </div>
        </div>
      </div>
    );
  }

  const selectedCompetitionId = searchParams.competition || competitions[0].id;
  const activeCompetition =
    competitions.find((c) => c.id === selectedCompetitionId) || competitions[0];

  // Picks ya guardados por el usuario actual en ESTA competición, para
  // marcar en la tabla qué segmentos ya tiene "draft hecho".
  let draftedSlotIds = new Set<string>();
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (user) {
      const rosters = await prisma.fantasyRoster.findMany({
        where: { userId: user.id, event: { competitionId: activeCompetition.id } },
        include: { picks: { select: { slotId: true } } },
      });
      draftedSlotIds = new Set(rosters.flatMap((r) => r.picks.map((p) => p.slotId)));
    }
  }

  // Columnas dinámicas: combinaciones Disciplina + Género realmente
  // presentes en los eventos de esta competición.
  type Column = { key: string; disciplineName: string; gender: string | null; label: string };
  const columns: Column[] = [];
  for (const ev of activeCompetition.events) {
    const key = `${ev.disciplineId}__${ev.gender ?? "none"}`;
    if (!columns.find((c) => c.key === key)) {
      const translatedDisciplineName = translateDisciplineName(ev.discipline.name, locale);
      columns.push({
        key,
        disciplineName: translatedDisciplineName,
        gender: ev.gender,
        label: `${translatedDisciplineName}${ev.gender ? ` · ${genderLabel[ev.gender] ?? ev.gender}` : ""}`,
      });
    }
  }

  type CellEvent = {
    eventId: string;
    eventName: string;
    categoryName: string;
    state: "proximamente" | "abierto" | "cerrado";
    drafted: boolean;
    isTest: boolean;
  };

  const stateBadge: Record<CellEvent["state"], { label: string; className: string }> = {
    proximamente: { label: t.stateUpcoming, className: "bg-slate-800 text-slate-400 border-slate-700" },
    abierto: {
      label: t.stateOpen,
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    cerrado: { label: t.stateClosed, className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  };

  // Ranking: por evento (con selector de evento propio) o global por
  // competición — solo se calcula el de la pestaña activa. Antes se
  // calculaban SIEMPRE los dos en cada carga de la página, y el ranking
  // "global por competición" reutiliza computeEventLeaderboard EVENTO A
  // EVENTO (ver src/lib/scoring.ts) — con una competición de 20 pruebas eso
  // son ~20 consultas extra a la base de datos en cada visita a /fantasy,
  // aunque quien la visite ni siquiera mire esa pestaña. Con esta página sin
  // caché (force-dynamic), es tráfico a Neon que se repite en cada visita.
  const rankTab = searchParams.rank === "competition" ? "competition" : "event";
  const rankEventId = searchParams.event || activeCompetition.events[0]?.id;
  const rankEvent = activeCompetition.events.find((e) => e.id === rankEventId);

  const eventRanking =
    rankEvent && rankTab === "event" ? await computeEventLeaderboard(rankEvent.id) : [];
  const competitionRanking =
    rankTab === "competition" ? await computeCompetitionFantasyLeaderboard(activeCompetition.id) : [];

  const rankHref = (tab: "event" | "competition", eventId?: string) =>
    `/fantasy?competition=${activeCompetition.id}${
      tab === "competition" ? "&rank=competition" : `&event=${eventId ?? rankEventId ?? ""}`
    }#leaderboard`;

  // Paginación del ranking: con muchos participantes la tabla se hacía
  // interminable (igual que el motivo del acordeón de Draft Status). Se
  // pagina por URL (?page=N), no con estado de cliente, para mantener el
  // mismo patrón que el resto de esta página (pestañas y selector de
  // competición también son enlaces). Cambiar de pestaña o de evento
  // siempre vuelve a la página 1 (rankHref no incluye `page`).
  const RANK_PAGE_SIZE = 15;
  const fullRanking = rankTab === "event" ? eventRanking : competitionRanking;
  const totalRankPages = Math.max(1, Math.ceil(fullRanking.length / RANK_PAGE_SIZE));
  const currentRankPage = Math.min(Math.max(1, Number(searchParams.page) || 1), totalRankPages);
  const ranking = fullRanking.slice(
    (currentRankPage - 1) * RANK_PAGE_SIZE,
    currentRankPage * RANK_PAGE_SIZE
  );

  const rankPageHref = (page: number) => {
    const params = new URLSearchParams();
    params.set("competition", activeCompetition.id);
    if (rankTab === "competition") {
      params.set("rank", "competition");
    } else if (rankEventId) {
      params.set("event", rankEventId);
    }
    if (page > 1) params.set("page", String(page));
    return `/fantasy?${params.toString()}#leaderboard`;
  };

  // Activas (pestañas) vs archivadas (desplegable aparte) — una competición
  // ya terminada (fecha de fin pasada) no necesita su propia pestaña
  // permanente; con varias temporadas acumuladas esa fila de pestañas se
  // haría interminable. Si TODAS las competiciones ya terminaron (ninguna
  // activa), se muestran igualmente como pestañas para no dejar la página
  // sin ningún selector visible.
  const now = new Date();
  const activeCompetitions = competitions.filter((c) => c.endDate >= now);
  const archivedCompetitions = competitions.filter((c) => c.endDate < now);
  const competitionTabs = activeCompetitions.length > 0 ? activeCompetitions : competitions;
  const archivedForSelect = activeCompetitions.length > 0 ? archivedCompetitions : [];

  // Datos para el acordeón de Draft Status (ver DraftStatusAccordion.tsx):
  // todo ya traducido/calculado aquí en el servidor, el componente cliente
  // solo decide qué disciplina está plegada.
  const draftStatusColumns: DraftStatusColumn[] = columns.map((col) => {
    const eventsInColumn = activeCompetition.events.filter(
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
        return {
          id: ev.id,
          categoryLabel,
          isTest: Boolean(ev.isTest),
          segments: orderedSegments.map((segment, segIndex) => {
            const slotsForSegment = ev.slots.filter((s) => s.segmentId === segment.id);
            const draftStatus = getSegmentDraftStatus(
              segment,
              ev.rosterLocksAt,
              slotsForSegment.length > 0
            );
            const state: CellEvent["state"] =
              draftStatus === "UPCOMING" ? "proximamente" : draftStatus === "CLOSED" ? "cerrado" : "abierto";
            const badge = stateBadge[state];
            const drafted = slotsForSegment.some((s) => draftedSlotIds.has(s.id));
            return {
              id: segment.id,
              label: ROW_LABELS[segIndex] ?? segment.name,
              showLabel: orderedSegments.length > 1,
              badgeLabel: badge.label,
              badgeClassName: badge.className,
              drafted,
              draftedText: session && state !== "proximamente" ? (drafted ? t.alreadyDrafted : t.notDrafted) : null,
              href: state === "proximamente" ? null : `/events/${ev.id}`,
            };
          }),
        };
      }),
    };
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="border-b border-slate-800 pb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            {t.subtitle}
          </p>
        </div>

        {/* Ligas Privadas */}
        <Link
          href="/fantasy/leagues"
          className="flex items-center justify-between gap-3 bg-indigo-600/10 border border-indigo-500/30 rounded-2xl p-4 hover:border-indigo-500/60 transition"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="font-bold text-slate-100 text-sm">{t.leaguesCardTitle}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t.leaguesCardBody}</p>
            </div>
          </div>
          <span className="text-indigo-400 text-xs font-semibold whitespace-nowrap">{t.leaguesCardCta} →</span>
        </Link>

        {/* Accesos directos: antes había que localizar la tarjeta o el
            estado concreto para entrar a draftear o ver el ranking; ahora
            dos botones llevan directamente a esas secciones de esta misma
            página (sin navegar a otra URL, solo un salto de ancla). */}
        <div className="flex flex-wrap gap-2">
          <a
            href="#draft-room"
            className="flex-1 min-w-[160px] text-center rounded-xl border border-indigo-500/40 bg-indigo-600/15 px-4 py-2.5 text-sm font-bold text-indigo-300 transition hover:border-indigo-500/70 hover:bg-indigo-600/25"
          >
            {t.draftRoomCta}
          </a>
          <a
            href="#leaderboard"
            className="flex-1 min-w-[160px] text-center rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-300 transition hover:border-amber-500/70 hover:bg-amber-500/20"
          >
            {t.leaderboardCta}
          </a>
        </div>

        {/* Selector de Competición: activas como pestañas, terminadas en un
            desplegable aparte (ver comentario junto a `archivedCompetitions`
            más arriba). */}
        <div className="flex flex-wrap items-center gap-2">
          {competitionTabs.map((c) => (
            <Link
              key={c.id}
              href={`/fantasy?competition=${c.id}`}
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
              placeholder={t.archivedCompetitionsPlaceholder}
            />
          )}
        </div>

        {/* Draft Status: antes era una tabla matriz (filas = Corto/Largo,
            columnas = disciplina+género), donde cada celda apilaba verticalmente
            TODOS los eventos de esa combinación que cayeran en esa fila — y
            una fila ("Corto"/"Largo") comparte altura entre TODAS las
            columnas de una tabla HTML, así que una disciplina sin esa
            distinción (Show, Precisión: un único segmento) metía sus varias
            categorías apiladas en la fila "Corto" por defecto, inflando esa
            fila para TODAS las columnas (aunque Parejas solo tuviera 1
            evento ahí) y dejando la fila "Largo" con huecos vacíos en esas
            columnas. Luego pasó a columnas independientes con scroll
            horizontal. Ahora, con muchas más disciplinas/categorías que las
            4 de referencia, cada disciplina+género es una fila plegable
            (acordeón) que empieza cerrada — mismo patrón que /calendario y
            /competitions — para que la lista no se haga interminable. */}
        <div id="draft-room" className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              {t.draftStatus(activeCompetition.name)}
            </h2>
          </div>

          {columns.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">
              {t.noEvents}
            </p>
          ) : (
            <DraftStatusAccordion
              columns={draftStatusColumns}
              expandAllLabel={t.expandAll}
              collapseAllLabel={t.collapseAll}
            />
          )}
        </div>

        {/* Ranking Fantasy */}
        <div id="leaderboard" className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Link
                href={rankHref("event")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  rankTab === "event"
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.byEvent}
              </Link>
              <Link
                href={rankHref("competition")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  rankTab === "competition"
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.global(activeCompetition.name)}
              </Link>
            </div>

            {rankTab === "event" && activeCompetition.events.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activeCompetition.events.map((e) => (
                  <Link
                    key={e.id}
                    href={rankHref("event", e.id)}
                    className={`text-[11px] px-2 py-1 rounded-lg border transition ${
                      e.id === rankEvent?.id
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {translateDisciplineName(e.discipline.name, locale)} ·{" "}
                    {translateCategoryName(e.category.name, locale)}
                    {e.gender ? ` · ${genderLabel[e.gender] ?? e.gender}` : ""}
                    {e.showFormat
                      ? ` · ${dict.common.showFormat[e.showFormat as keyof typeof dict.common.showFormat]}`
                      : ""}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {rankTab === "event" && rankEvent && (
            <div className="p-4 border-b border-slate-800/80">
              <Link
                href={`/fantasy/${rankEvent.id}/leaderboard`}
                className="text-xs text-amber-400 underline hover:text-amber-300"
              >
                {t.viewFullLeaderboard}
              </Link>
            </div>
          )}

          {fullRanking.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">
              {t.noRankableRosters}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-800/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                      <th className="py-3 px-4 w-16">{t.rank}</th>
                      <th className="py-3 px-4">{t.coach}</th>
                      {rankTab === "competition" && (
                        <th className="py-3 px-4 text-center">{t.events}</th>
                      )}
                      <th className="py-3 px-4 text-right font-bold text-white">{t.points}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {ranking.map((row: any, index: number) => {
                      const absoluteIndex = (currentRankPage - 1) * RANK_PAGE_SIZE + index;
                      return (
                        <tr
                          key={rankTab === "event" ? row.rosterId : row.userId}
                          className="hover:bg-slate-800/30 transition font-mono"
                        >
                          <td className="py-3 px-4 font-bold text-slate-400">
                            {absoluteIndex === 0
                              ? "🥇"
                              : absoluteIndex === 1
                                ? "🥈"
                                : absoluteIndex === 2
                                  ? "🥉"
                                  : `#${absoluteIndex + 1}`}
                          </td>
                          <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                            {row.userName}
                          </td>
                          {rankTab === "competition" && (
                            <td className="py-3 px-4 text-center text-slate-400 font-sans text-xs">
                              {row.eventsPlayed}
                            </td>
                          )}
                          <td className="py-3 px-4 text-right font-bold text-indigo-400">
                            {row.total.toFixed(2)} {t.pointsSuffix}
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
                      {t.prevPage}
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-600">
                      {t.prevPage}
                    </span>
                  )}
                  <span className="text-slate-400">{t.pageOf(currentRankPage, totalRankPages)}</span>
                  {currentRankPage < totalRankPages ? (
                    <Link
                      href={rankPageHref(currentRankPage + 1)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:border-slate-600 hover:text-white"
                    >
                      {t.nextPage}
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-600">
                      {t.nextPage}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
