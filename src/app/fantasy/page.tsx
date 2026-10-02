import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSegmentDraftStatus } from "@/lib/segments";
import { computeCompetitionFantasyLeaderboard, computeMyPicksForCompetition } from "@/lib/scoring";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { translateCategoryName, translateDisciplineName } from "@/lib/i18n/categoryTranslations";
import DraftStatusAccordion, { type DraftStatusColumn } from "./DraftStatusAccordion";
import ArchivedCompetitionSelect from "./ArchivedCompetitionSelect";
import RankSummaryCards from "./RankSummaryCards";
import { getMyLeagueRanks } from "./rankSummary";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = getDictionary(getLocale()).meta.fantasy;
  return { title: t.title, description: t.description };
}

// /fantasy es el Fantasy Hub (el "dashboard" en la jerga de la referencia
// que trajo el usuario): selector de Competición, tus tarjetas de resumen
// (puesto global de la competición y puesto en cada liga privada a la que
// pertenezcas — RankSummaryCards, compartido con /fantasy/leaderboard) y la
// tabla "Draft Status" (columnas = combinaciones disciplina+género que
// existan de verdad en la competición, en acordeón por disciplina porque hay
// muchas más categorías que en la referencia) con tu equipo ya elegido
// (computeMyPicksForCompetition) visible al desplegar cada disciplina. La
// clasificación completa de TODOS los participantes — antes vivía aquí mismo
// con pestañas "por evento/global" — ahora es su propia página,
// /fantasy/leaderboard, igual que draftear ya era su propia página
// (/events/[id], el "Draft Room").
export default async function FantasyHubPage({
  searchParams,
}: {
  searchParams: { competition?: string };
}) {
  const session = await getServerSession(authOptions);
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.fantasyHub;
  const tl = dict.fantasyLeaderboard;
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

  // Puesto global de la competición (tarjeta "Global") y todo lo que depende
  // del usuario actual (qué tiene drafteado, su equipo por prueba, sus
  // ligas) son consultas independientes entre sí — se lanzan en paralelo con
  // Promise.all en vez de una detrás de otra, para no sumar sus tiempos.
  const [competitionRanking, myData] = await Promise.all([
    computeCompetitionFantasyLeaderboard(activeCompetition.id),
    (async () => {
      if (!session?.user?.email) return null;
      const user = await prisma.user.findUnique({ where: { email: session.user.email } });
      if (!user) return null;
      const [rosters, myPicksByEvent, myLeagueRanks] = await Promise.all([
        prisma.fantasyRoster.findMany({
          where: { userId: user.id, event: { competitionId: activeCompetition.id } },
          include: { picks: { select: { slotId: true } } },
        }),
        computeMyPicksForCompetition(activeCompetition.id, user.id),
        getMyLeagueRanks(user.id),
      ]);
      return {
        userId: user.id,
        draftedSlotIds: new Set(rosters.flatMap((r) => r.picks.map((p) => p.slotId))),
        myPicksByEvent,
        myLeagueRanks,
      };
    })(),
  ]);

  const draftedSlotIds = myData?.draftedSlotIds ?? new Set<string>();
  const myPicksByEvent: Awaited<ReturnType<typeof computeMyPicksForCompetition>> =
    myData?.myPicksByEvent ?? new Map();
  const myLeagueRanks: Awaited<ReturnType<typeof getMyLeagueRanks>> = myData?.myLeagueRanks ?? [];
  const myGlobalIndex = myData ? competitionRanking.findIndex((r) => r.userId === myData!.userId) : -1;
  const myGlobalRank = myGlobalIndex === -1 ? null : myGlobalIndex + 1;

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

            const myEventPicks = myPicksByEvent.get(ev.id);
            const mySegmentSlots = myEventPicks?.slotsBySegment.get(segment.id) ?? null;
            const hasScores = myEventPicks?.hasScoresBySegment.has(segment.id) ?? false;
            const myPicks =
              mySegmentSlots && mySegmentSlots.length > 0
                ? mySegmentSlots.map((slot) => ({
                    slotId: slot.slotId,
                    slotLabel: slot.slotLabel,
                    skaterName: slot.skaterName,
                    points: hasScores ? slot.points : null,
                  }))
                : null;
            const myTotal =
              myPicks && hasScores ? myPicks.reduce((sum, p) => sum + (p.points ?? 0), 0) : null;

            // Pulsar una celda del Hub lleva al Draft Room con esta misma
            // prueba+segmento ya cargada debajo (editable si está abierta,
            // solo lectura si está cerrada) — mismo patrón de enlace que usa
            // el propio Draft Room entre sus celdas (ver draft/page.tsx).
            const href =
              state === "proximamente"
                ? null
                : `/fantasy/draft?competition=${activeCompetition.id}&event=${ev.id}&segment=${segment.id}#draft-form`;

            return {
              id: segment.id,
              label: ROW_LABELS[segIndex] ?? segment.name,
              showLabel: orderedSegments.length > 1,
              badgeLabel: badge.label,
              badgeClassName: badge.className,
              drafted,
              draftedText: session && state !== "proximamente" ? (drafted ? t.alreadyDrafted : t.notDrafted) : null,
              href,
              myPicks,
              myTotal,
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
          <Link
            href={`/fantasy/draft?competition=${activeCompetition.id}`}
            className="flex-1 min-w-[160px] text-center rounded-xl border border-indigo-500/40 bg-indigo-600/15 px-4 py-2.5 text-sm font-bold text-indigo-300 transition hover:border-indigo-500/70 hover:bg-indigo-600/25"
          >
            {t.draftRoomCta}
          </Link>
          <Link
            href={`/fantasy/leaderboard?competition=${activeCompetition.id}`}
            className="flex-1 min-w-[160px] text-center rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-300 transition hover:border-amber-500/70 hover:bg-amber-500/20"
          >
            {t.leaderboardCta}
          </Link>
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

        {/* Tarjetas de resumen: tu puesto global de esta competición y tu
            puesto en cada liga privada — mismo componente que usa
            /fantasy/leaderboard, para que el "Nº de Nº" se calcule siempre
            igual. Clican a la clasificación completa. */}
        <RankSummaryCards
          globalLabel={tl.globalCardLabel}
          globalRank={myGlobalRank}
          globalTotal={competitionRanking.length}
          globalHref={`/fantasy/leaderboard?competition=${activeCompetition.id}`}
          leagues={myLeagueRanks}
          joinLabel={tl.joinLeagueCardLabel}
          joinHref="/fantasy/leagues"
          ofWord={tl.ofWord}
          noRankLabel={tl.noRankYet}
        />

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
              goToEventLabel={t.goToEvent}
            />
          )}
        </div>
      </div>
    </div>
  );
}
