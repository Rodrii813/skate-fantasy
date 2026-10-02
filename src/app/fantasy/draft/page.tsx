import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSegmentDraftStatus, effectiveLocksAt, isSegmentLocked, isSegmentOpenByTime } from "@/lib/segments";
import { computeMyPicksForCompetition } from "@/lib/scoring";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { translateCategoryName, translateDisciplineName } from "@/lib/i18n/categoryTranslations";
import FantasyRosterForm from "@/app/fantasy/[eventId]/FantasyRosterForm";
import TestEventBanner from "@/app/_components/TestEventBanner";
import ArchivedCompetitionSelect from "../ArchivedCompetitionSelect";
import DraftStatusMatrix, { type DraftMatrixGroup } from "./DraftStatusMatrix";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = getDictionary(getLocale()).fantasyDraft;
  return { title: t.title, description: t.subtitle };
}

// /fantasy/draft es el Draft Room, TODO en una sola página (como la
// referencia): arriba el selector de Draft Status, una matriz compacta de
// celdas de color por disciplina (filas = Corto/Largo, columnas = cada
// prueba de esa disciplina+género — ver DraftStatusMatrix.tsx, calcada de la
// referencia pero agrupada por disciplina porque aquí hay muchas más
// categorías), y al elegir una celda (abierta o cerrada, ver `href` más
// abajo), el propio formulario de draftear
// (FantasyRosterForm, el mismo que usa /events/[id]) aparece DEBAJO, en esta
// misma página — ya no se navega a otra URL para draftear. El formulario ya
// sabe mostrarse en modo solo-lectura cuando el segmento está cerrado (ver
// FantasyRosterForm.tsx), así que sirve igual para draftear como para
// consultar lo ya elegido.
//
// El Fantasy Hub (/fantasy) mantiene su propia copia de las tarjetas de
// Draft Status (con tu equipo, puntuado si ya hay resultados) a modo de
// resumen; este Draft Room es la página dedicada a la que lleva el botón de
// acceso directo "Draft Room", y la única que de verdad permite draftear.
// Misma lógica que /events/[id]/page.tsx (que se mantiene tal cual por si
// alguien llega por un enlace antiguo): trae el evento con todo lo que
// necesita FantasyRosterForm, más los picks ya guardados del usuario, y
// calcula el bloqueo de cada segmento con la hora del servidor.
async function loadDraftFormEvent(eventId: string, userEmail: string, initialSegmentId?: string) {
  const [user, event] = await Promise.all([
    prisma.user.findUnique({ where: { email: userEmail } }),
    prisma.event.findUnique({
      where: { id: eventId },
      include: {
        segments: { orderBy: { order: "asc" } },
        slots: { orderBy: { order: "asc" } },
        registrations: { include: { skater: true }, orderBy: [{ startOrder: "asc" }] },
      },
    }),
  ]);
  if (!event) return null;

  let initialPicks: Record<string, string> = {};
  if (user) {
    const existingRoster = await prisma.fantasyRoster.findUnique({
      where: { userId_eventId: { userId: user.id, eventId: event.id } },
      include: { picks: true },
    });
    if (existingRoster) {
      for (const p of existingRoster.picks) initialPicks[p.slotId] = p.skaterId;
    }
  }

  const segmentsWithLock = event.segments.map((seg) => {
    const closed = isSegmentLocked(seg, event.rosterLocksAt);
    const notYetOpen = !closed && !isSegmentOpenByTime(seg);
    return {
      id: seg.id,
      name: seg.name,
      order: seg.order,
      locksAt: effectiveLocksAt(seg, event.rosterLocksAt).toISOString(),
      locked: closed || notYetOpen,
      upcoming: notYetOpen,
    };
  });

  return {
    id: event.id,
    name: event.name,
    isTest: event.isTest,
    rosterLocksAt: event.rosterLocksAt.toISOString(),
    eventLocked: new Date() > event.rosterLocksAt,
    segments: segmentsWithLock,
    slots: event.slots,
    registrations: event.registrations,
    initialPicks,
    initialSegmentId,
  };
}

export default async function FantasyDraftPage({
  searchParams,
}: {
  searchParams: { competition?: string; event?: string; segment?: string };
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

  type Column = { key: string; disciplineName: string; label: string };
  const columns: Column[] = [];
  for (const ev of activeCompetition.events) {
    const key = ev.disciplineId;
    if (!columns.find((c) => c.key === key)) {
      const translatedDisciplineName = translateDisciplineName(ev.discipline.name, locale);
      columns.push({
        key,
        disciplineName: translatedDisciplineName,
        label: translatedDisciplineName,
      });
    }
  }

  type SegmentState = "proximamente" | "abierto" | "cerrado";

  const now = new Date();
  const activeCompetitions = competitions.filter((c) => c.endDate >= now);
  const archivedCompetitions = competitions.filter((c) => c.endDate < now);
  const competitionTabs = activeCompetitions.length > 0 ? activeCompetitions : competitions;
  const archivedForSelect = activeCompetitions.length > 0 ? archivedCompetitions : [];

  const draftMatrixGroups: DraftMatrixGroup[] = columns.map((col) => {
    const eventsInColumn = activeCompetition.events.filter((ev) => ev.disciplineId === col.key);
    return {
      key: col.key,
      label: col.label,
      events: eventsInColumn.map((ev) => {
        const orderedSegments = [...ev.segments].sort((a, b) => a.order - b.order);
        const categoryLabel = `${translateCategoryName(ev.category.name, locale)}${
          ev.gender ? ` · ${genderLabel[ev.gender] ?? ev.gender}` : ""
        }${
          ev.showFormat
            ? ` · ${dict.common.showFormat[ev.showFormat as keyof typeof dict.common.showFormat]}`
            : ""
        }`;
        return {
          id: ev.id,
          categoryLabel,
          isTest: Boolean(ev.isTest),
          cells: orderedSegments.map((segment, segIndex) => {
            const slotsForSegment = ev.slots.filter((s) => s.segmentId === segment.id);
            const draftStatus = getSegmentDraftStatus(
              segment,
              ev.rosterLocksAt,
              slotsForSegment.length > 0
            );
            const state: SegmentState =
              draftStatus === "UPCOMING" ? "proximamente" : draftStatus === "CLOSED" ? "cerrado" : "abierto";
            const drafted = slotsForSegment.some((s) => draftedSlotIds.has(s.id));

            return {
              segmentId: segment.id,
              segmentLabel: ROW_LABELS[segIndex] ?? segment.name,
              state,
              drafted,
              // Abierta o cerrada (pero no "próximamente"), el enlace apunta
              // a esta MISMA página con ?event=&segment= — el formulario de
              // draftear aparece debajo, en este mismo sitio (ver más abajo):
              // editable si está abierta, solo lectura si está cerrada.
              href:
                state === "proximamente"
                  ? null
                  : `/fantasy/draft?competition=${activeCompetition.id}&event=${ev.id}&segment=${segment.id}#draft-form`,
            };
          }),
        };
      }),
    };
  });

  // Si se ha elegido una prueba concreta (?event=&segment=), se trae aquí
  // todo lo que necesita FantasyRosterForm (igual que hacía /events/[id],
  // que sigue existiendo para quien llegue por un enlace antiguo) y se
  // renderiza debajo del selector, en esta misma página. Requiere sesión:
  // si no has iniciado sesión, se manda a login y se vuelve aquí mismo.
  let draftFormEvent: Awaited<ReturnType<typeof loadDraftFormEvent>> = null;
  if (searchParams.event) {
    if (!session?.user?.email) {
      const callbackUrl = `/fantasy/draft?competition=${activeCompetition.id}&event=${searchParams.event}${
        searchParams.segment ? `&segment=${searchParams.segment}` : ""
      }`;
      redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    draftFormEvent = await loadDraftFormEvent(searchParams.event, session.user.email, searchParams.segment);
  }

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
            <DraftStatusMatrix
              groups={draftMatrixGroups}
              selectedSegmentId={searchParams.segment}
              labels={{
                upcoming: t.stateUpcoming,
                openUndrafted: td.cellOpenUndrafted,
                openDrafted: td.cellOpenDrafted,
                closedDrafted: td.cellClosedDrafted,
                closedUndrafted: td.cellClosedUndrafted,
              }}
            />
          )}
        </div>

        {/* El formulario de draftear, embebido aquí mismo cuando se ha
            elegido una prueba+segmento arriba (editable si está abierta,
            solo lectura si está cerrada — lo decide FantasyRosterForm). */}
        {searchParams.event && (
          <div id="draft-form" className="scroll-mt-6">
            {draftFormEvent ? (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-lg shadow-black/40">
                {draftFormEvent.isTest && (
                  <div className="max-w-2xl mx-auto mb-6">
                    <TestEventBanner locale={locale} />
                  </div>
                )}
                <FantasyRosterForm
                  eventId={draftFormEvent.id}
                  eventName={draftFormEvent.name}
                  rosterLocksAt={draftFormEvent.rosterLocksAt}
                  eventLocked={draftFormEvent.eventLocked}
                  segments={draftFormEvent.segments}
                  slots={draftFormEvent.slots}
                  registrations={draftFormEvent.registrations}
                  initialPicks={draftFormEvent.initialPicks}
                  initialSegmentId={draftFormEvent.initialSegmentId}
                />
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
                {t.noEvents}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
