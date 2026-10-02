import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSegmentDraftStatus } from "@/lib/segments";
import { computeMyPicksForCompetition } from "@/lib/scoring";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { translateCategoryName, translateDisciplineName } from "@/lib/i18n/categoryTranslations";
import DraftStatusAccordion, { type DraftStatusColumn } from "../DraftStatusAccordion";
import ArchivedCompetitionSelect from "../ArchivedCompetitionSelect";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = getDictionary(getLocale()).fantasyDraft;
  return { title: t.title, description: t.subtitle };
}

// /fantasy/draft es el Draft Room: el selector de Draft Status (acordeón por
// disciplina, cada prueba+segmento es su propia tarjeta plegable — ver
// DraftStatusAccordion.tsx) ahora vive aquí, en su propia página, en vez de
// en el Fantasy Hub. Al abrir una tarjeta ves tu equipo si ya lo tienes; si
// la prueba sigue abierta hay un enlace para ir a draftear (/events/[id],
// que sigue siendo la página donde realmente se eligen patinadores); si está
// cerrada, solo puedes consultar lo que ya elegiste.
//
// El Fantasy Hub (/fantasy) mantiene su propia copia de estas mismas
// tarjetas (tu equipo, puntuado si ya hay resultados) porque el usuario
// quiere verlas también ahí a modo de resumen — este Draft Room es la
// página dedicada a la que lleva el botón de acceso directo "Draft Room".
export default async function FantasyDraftPage({
  searchParams,
}: {
  searchParams: { competition?: string };
}) {
  const session = await getServerSession(authOptions);
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.fantasyHub;
  const td = dict.fantasyDraft;
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

  // Solo necesitamos qué ha drafteado el usuario actual en esta competición
  // (para marcar las tarjetas y mostrar su equipo) — nada de ranking aquí,
  // eso es cosa del Leaderboard.
  let draftedSlotIds = new Set<string>();
  let myPicksByEvent: Awaited<ReturnType<typeof computeMyPicksForCompetition>> = new Map();
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (user) {
      const [rosters, picks] = await Promise.all([
        prisma.fantasyRoster.findMany({
          where: { userId: user.id, event: { competitionId: activeCompetition.id } },
          include: { picks: { select: { slotId: true } } },
        }),
        computeMyPicksForCompetition(activeCompetition.id, user.id),
      ]);
      draftedSlotIds = new Set(rosters.flatMap((r) => r.picks.map((p) => p.slotId)));
      myPicksByEvent = picks;
    }
  }

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

  type SegmentState = "proximamente" | "abierto" | "cerrado";
  const stateBadge: Record<SegmentState, { label: string; className: string }> = {
    proximamente: { label: t.stateUpcoming, className: "bg-slate-800 text-slate-400 border-slate-700" },
    abierto: {
      label: t.stateOpen,
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    cerrado: { label: t.stateClosed, className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  };

  const now = new Date();
  const activeCompetitions = competitions.filter((c) => c.endDate >= now);
  const archivedCompetitions = competitions.filter((c) => c.endDate < now);
  const competitionTabs = activeCompetitions.length > 0 ? activeCompetitions : competitions;
  const archivedForSelect = activeCompetitions.length > 0 ? archivedCompetitions : [];

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
            const state: SegmentState =
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

            return {
              id: segment.id,
              label: ROW_LABELS[segIndex] ?? segment.name,
              showLabel: orderedSegments.length > 1,
              badgeLabel: badge.label,
              badgeClassName: badge.className,
              drafted,
              draftedText: session && state !== "proximamente" ? (drafted ? t.alreadyDrafted : t.notDrafted) : null,
              // Solo las pruebas ABIERTAS enlazan al Draft Room real
              // (/events/[id]) para elegir patinadores — si está cerrada,
              // la tarjeta sigue sirviendo para consultar tu equipo, pero no
              // hay enlace para "ir a draftear" porque ya no se puede.
              href: state === "abierto" ? `/events/${ev.id}?segment=${segment.id}` : null,
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
          <Link href="/fantasy" className="text-xs text-slate-400 hover:text-slate-200">
            {td.backToHub}
          </Link>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl">🎯</span>
            <h1 className="text-3xl font-extrabold tracking-tight">{td.title}</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">{td.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {competitionTabs.map((c) => (
            <Link
              key={c.id}
              href={`/fantasy/draft?competition=${c.id}`}
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

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              {t.draftStatus(activeCompetition.name)}
            </h2>
          </div>

          {columns.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">{t.noEvents}</p>
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
