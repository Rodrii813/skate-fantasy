import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSegmentDraftStatus } from "@/lib/segments";
import { computeEventLeaderboard, computeCompetitionFantasyLeaderboard } from "@/lib/scoring";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { translateCategoryName, translateDisciplineName } from "@/lib/i18n/categoryTranslations";

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
  searchParams: { competition?: string; event?: string; rank?: string };
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
    }`;

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

        {/* Selector de Competición */}
        <div className="flex flex-wrap gap-2">
          {competitions.map((c) => (
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
        </div>

        {/* Draft Status: antes era una tabla matriz (filas = Corto/Largo,
            columnas = disciplina+género), donde cada celda apilaba verticalmente
            TODOS los eventos de esa combinación que cayeran en esa fila — con
            una disciplina como Show (varias categorías: Cuartetos, Grupos
            Pequeños, Grupos Grandes...) eso dejaba columnas desiguales y muy
            altas, además de forzar scroll horizontal con 5+ columnas de
            180px cada una. Ahora es una rejilla de tarjetas (una por
            disciplina+género) y, dentro de cada una, una fila por evento con
            sus 1-2 segmentos como chips compactos en línea — mismo contenido,
            una fracción del espacio, y se adapta mejor a cada competición
            tenga 2 o 10 disciplinas distintas. */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              {t.draftStatus(activeCompetition.name)}
            </h2>
            {columns.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                {(["proximamente", "abierto", "cerrado"] as const).map((state) => (
                  <span key={state} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full border ${stateBadge[state].className}`} />
                    {stateBadge[state].label}
                  </span>
                ))}
                {session && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    {t.legendDrafted}
                  </span>
                )}
              </div>
            )}
          </div>

          {columns.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">
              {t.noEvents}
            </p>
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {columns.map((col) => {
                const eventsInColumn = activeCompetition.events.filter(
                  (ev) => `${ev.disciplineId}__${ev.gender ?? "none"}` === col.key
                );
                return (
                  <div
                    key={col.key}
                    className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 space-y-2.5"
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-300 truncate">
                      {col.label}
                    </p>
                    <div className="space-y-1.5">
                      {eventsInColumn.map((ev) => {
                        const orderedSegments = [...ev.segments].sort((a, b) => a.order - b.order);
                        return (
                          <div key={ev.id} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-400 truncate">
                              {translateCategoryName(ev.category.name, locale)}
                              {ev.isTest && <span className="ml-1 text-amber-400">🧪</span>}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {orderedSegments.map((segment, segIndex) => {
                                const slotsForSegment = ev.slots.filter((s) => s.segmentId === segment.id);
                                const draftStatus = getSegmentDraftStatus(
                                  segment,
                                  ev.rosterLocksAt,
                                  slotsForSegment.length > 0
                                );
                                const state: CellEvent["state"] =
                                  draftStatus === "UPCOMING"
                                    ? "proximamente"
                                    : draftStatus === "CLOSED"
                                      ? "cerrado"
                                      : "abierto";
                                const badge = stateBadge[state];
                                const drafted = slotsForSegment.some((s) => draftedSlotIds.has(s.id));
                                const rowLabel = ROW_LABELS[segIndex] ?? segment.name;

                                const chip = (
                                  <span
                                    title={`${rowLabel} · ${badge.label}${
                                      session && state !== "proximamente"
                                        ? ` · ${drafted ? t.alreadyDrafted : t.notDrafted}`
                                        : ""
                                    }`}
                                    className={`relative flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-bold ${badge.className}`}
                                  >
                                    {rowLabel.charAt(0)}
                                    {session && state !== "proximamente" && drafted && (
                                      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                    )}
                                  </span>
                                );

                                return state === "proximamente" ? (
                                  <span key={segment.id}>{chip}</span>
                                ) : (
                                  <Link
                                    key={segment.id}
                                    href={`/events/${ev.id}`}
                                    className="hover:opacity-80 transition"
                                  >
                                    {chip}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ranking Fantasy */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
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

          {(() => {
            const ranking = rankTab === "event" ? eventRanking : competitionRanking;
            if (ranking.length === 0) {
              return (
                <p className="p-8 text-center text-xs text-slate-400">
                  {t.noRankableRosters}
                </p>
              );
            }
            return (
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
                    {ranking.map((row: any, index: number) => (
                      <tr
                        key={rankTab === "event" ? row.rosterId : row.userId}
                        className="hover:bg-slate-800/30 transition font-mono"
                      >
                        <td className="py-3 px-4 font-bold text-slate-400">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
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
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
