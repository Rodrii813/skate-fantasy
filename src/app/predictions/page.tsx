import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PredictionForm from "./PredictionForm";
import { formatSkaterName, isPairDiscipline } from "@/lib/skaterName";
import { firstSegmentEffectiveLocksAt, getPredictionsStatus } from "@/lib/segments";
import PaginatedPredictionRanking from "./PaginatedPredictionRanking";
import { computeEventPredictionLeaderboard, computeCompetitionPredictionLeaderboard } from "@/lib/scoring";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import LocalDateTime from "@/app/_components/LocalDateTime";
import PublicFavoritesImageButton from "./PublicFavoritesImageButton";
import MyPredictionShare from "./MyPredictionShare";
import TestEventBanner from "@/app/_components/TestEventBanner";
import { translateCategoryName, translateDisciplineName } from "@/lib/i18n/categoryTranslations";
import PredictionEventSelector, { type PredictionEventGroup } from "./PredictionEventSelector";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = getDictionary(getLocale()).meta.predictions;
  return { title: t.title, description: t.description };
}

// /predictions es ahora el hub de Predicción: selector Competición → Evento
// (agrupado, más simple que el de /fantasy — no hace falta la tabla Draft
// Status porque las predicciones no son por segmento), el formulario de
// siempre, el widget "Favoritos del Público" (movido aquí desde
// /leaderboard, scoped al evento elegido) y el ranking de predicciones con
// dos vistas: por evento y global por competición.
export default async function PredictionsPage({
  searchParams,
}: {
  searchParams: { competition?: string; event?: string; rank?: string };
}) {
  const session = await getServerSession(authOptions);
  // El botón de descargar la imagen de Favoritos del Público es solo para admin.
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.predictions;
  const genderLabel = dict.common.gender;
  // Sin locale explícito, toLocaleDateString() usa el locale del SERVIDOR
  // (en-US: mes/día), así que "cierra el 30 de septiembre" se veía como
  // "9/30/2026" — al revés de como se lee en español (30/9/2026). Mismo
  // criterio que ya usan /competitions y /competitions/[id].
  const dateLocale = locale === "en" ? "en-US" : "es-ES";

  const competitions = await prisma.competition.findMany({
    orderBy: { startDate: "asc" },
    include: {
      events: {
        orderBy: { rosterLocksAt: "asc" },
        include: {
          competition: true,
          discipline: true,
          category: true,
          segments: { select: { id: true, order: true, locksAt: true } },
          registrations: {
            include: { skater: true },
            orderBy: { skater: { lastName: "asc" } },
          },
          predictions: true,
        },
      },
    },
  });

  const allEvents = competitions.flatMap((c) => c.events);
  const competitionsWithEvents = competitions.filter((c) => c.events.length > 0);

  // Selector en DOS pasos (Competición -> Evento), igual criterio que
  // /fantasy — antes se mostraban TODOS los eventos de TODAS las
  // competiciones a la vez, solo agrupados por el nombre de la competición
  // (un simple <p>), lo que con una competición grande (World Skate Games,
  // ~20 eventos entre todas las disciplinas) se veía como una pared plana de
  // botones sin ninguna jerarquía real. Ahora primero se elige la
  // competición y solo se listan (agrupados por disciplina) los eventos de
  // ESA competición.
  const activeCompetition =
    competitionsWithEvents.find((c) => c.id === searchParams.competition) ||
    competitionsWithEvents.find((c) => c.events.some((e) => e.id === searchParams.event)) ||
    competitionsWithEvents[0];

  // Evento activo: el indicado por la URL si pertenece a la competición
  // elegida, si no el primero de esa competición.
  const selectedEventId = searchParams.event;
  const activeEvent =
    activeCompetition?.events.find((e) => e.id === selectedEventId) || activeCompetition?.events[0];

  // Eventos de la competición activa agrupados por disciplina, en el orden
  // en que aparece cada disciplina por primera vez. Se calcula aquí (en vez
  // de con un .reduce() inline en el JSX) porque, con el cliente de Prisma
  // sustituido por `any` en este entorno de pruebas, TypeScript no puede
  // inferir el tipo del Map resultante — tipando explícitamente el array de
  // salida se evita ese arrastre de "any".
  type PredictionEvent = NonNullable<typeof activeCompetition>["events"][number];
  const eventsByDiscipline: { disciplineName: string; events: PredictionEvent[] }[] = [];
  for (const e of activeCompetition?.events ?? []) {
    const disciplineName: string = e.discipline.name;
    let group = eventsByDiscipline.find((g) => g.disciplineName === disciplineName);
    if (!group) {
      group = { disciplineName, events: [] };
      eventsByDiscipline.push(group);
    }
    group.events.push(e);
  }

  // Misma agrupación pero ya resuelta a lo que pide PredictionEventSelector
  // (componente cliente con pestañas por disciplina) — labels y hrefs ya
  // traducidos/armados aquí en el servidor.
  const predictionEventGroups: PredictionEventGroup[] = eventsByDiscipline.map(({ disciplineName, events }) => ({
    disciplineName: translateDisciplineName(disciplineName, locale),
    events: events.map((e) => ({
      id: e.id,
      href: `/predictions?competition=${activeCompetition?.id ?? ""}&event=${e.id}`,
      label: `${translateCategoryName(e.category.name, locale)}${
        e.gender ? ` · ${genderLabel[e.gender] ?? e.gender}` : ""
      }${e.showFormat ? ` · ${dict.common.showFormat[e.showFormat as keyof typeof dict.common.showFormat]}` : ""}`,
      isActive: e.id === activeEvent?.id,
      isTest: Boolean(e.isTest),
    })),
  }));

  let userPrediction = null;
  if (session?.user?.email && activeEvent) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (user) {
      userPrediction = await prisma.prediction.findUnique({
        where: {
          userId_eventId: {
            userId: user.id,
            eventId: activeEvent.id,
          },
        },
      });
    }
  }

  // Estado real de las Predicciones (ver getPredictionsStatus): CLOSED si ya
  // pasó el plazo, UPCOMING si todavía no hay patinadores inscritos o no ha
  // llegado su hora de apertura, OPEN si se pueden enviar. Antes solo se
  // miraba el cierre, así que cada evento las tenía "abiertas" (y vacías)
  // desde que se creaba.
  const predictionsStatus = activeEvent
    ? getPredictionsStatus(
        activeEvent,
        activeEvent.segments,
        activeEvent.registrations.length,
        new Date()
      )
    : "CLOSED";
  const isLocked = predictionsStatus === "CLOSED";

  // Favoritos del Público: porcentaje de la comunidad que predijo a cada
  // patinadora en cada puesto del podio, para el evento activo — movido
  // aquí desde /leaderboard (antes era una vista global independiente del
  // selector de evento de Predicción; ahora vive junto al propio formulario
  // del evento al que corresponde).
  let statsRank1: { skaterName: string; country: string; percent: number; count: number }[] = [];
  let statsRank2: { skaterName: string; country: string; percent: number; count: number }[] = [];
  let statsRank3: { skaterName: string; country: string; percent: number; count: number }[] = [];

  if (activeEvent && activeEvent.predictions.length > 0) {
    const totalPredictions = activeEvent.predictions.length;
    const skaterMap = new Map<string, { name: string; country: string }>();
    activeEvent.registrations.forEach((r) => {
      skaterMap.set(r.skater.id, {
        name: formatSkaterName(r.skater, isPairDiscipline(activeEvent.discipline?.name)),
        country: r.skater.country,
      });
    });

    const getRankStats = (rankKey: "rank1SkaterId" | "rank2SkaterId" | "rank3SkaterId") => {
      const counts = new Map<string, number>();
      activeEvent.predictions.forEach((p: any) => {
        const skaterId = p[rankKey];
        if (skaterId) counts.set(skaterId, (counts.get(skaterId) || 0) + 1);
      });

      return Array.from(counts.entries())
        .map(([skaterId, count]) => {
          const skater = skaterMap.get(skaterId) || { name: t.defaultSkaterName, country: "—" };
          return {
            skaterName: skater.name,
            country: skater.country,
            count,
            percent: Math.round((count / totalPredictions) * 100),
          };
        })
        .sort((a, b) => b.count - a.count);
    };

    statsRank1 = getRankStats("rank1SkaterId");
    statsRank2 = getRankStats("rank2SkaterId");
    statsRank3 = getRankStats("rank3SkaterId");
  }

  // Mis elecciones (sin porcentajes) para la imagen que cada usuario puede
  // compartir: top 3, 4 o 5 según lo que haya enviado.
  let myPicks: { name: string; country: string }[] = [];
  if (activeEvent && userPrediction) {
    const isPairEv = isPairDiscipline(activeEvent.discipline?.name);
    const byId = new Map<string, { name: string; country: string }>();
    activeEvent.registrations.forEach((r: any) =>
      byId.set(r.skater.id, { name: formatSkaterName(r.skater, isPairEv), country: r.skater.country })
    );
    const up: any = userPrediction;
    myPicks = [up.rank1SkaterId, up.rank2SkaterId, up.rank3SkaterId, up.rank4SkaterId, up.rank5SkaterId]
      .filter(Boolean)
      .map((id: string) => byId.get(id))
      .filter((x): x is { name: string; country: string } => Boolean(x));
  }

  // Ranking de Predicciones: por evento o global por competición, según la
  // pestaña activa — reutilizando las funciones de src/lib/scoring.ts
  // basadas en Prediction.pointsEarned ya calculado. Antes se calculaban
  // SIEMPRE los dos rankings en cada carga de la página (aunque solo se
  // mostrara uno), duplicando consultas a la base de datos sin necesidad en
  // cada visita — con esta página sin caché (force-dynamic), eso es tráfico
  // extra a Neon en cada visita, tanto de quien ve la web como de quien no.
  const rankTab = searchParams.rank === "competition" ? "competition" : "event";
  const eventRanking =
    activeEvent && rankTab === "event" ? await computeEventPredictionLeaderboard(activeEvent.id) : [];
  const competitionRanking =
    activeEvent && rankTab === "competition"
      ? await computeCompetitionPredictionLeaderboard(activeEvent.competitionId)
      : [];

  const rankHref = (tab: "event" | "competition") =>
    `/predictions?event=${activeEvent?.id ?? ""}${tab === "competition" ? "&rank=competition" : ""}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Encabezado estilo Rocker Prediction Central */}
        <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {t.subtitle}
            </p>
          </div>

          <Link
            href="/competitions"
            className="text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg hover:border-slate-500 transition"
          >
            {t.viewCalendar}
          </Link>
        </div>

        {allEvents.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            {t.noEvents}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Paso 1: Competición (solo si hay más de una con eventos) */}
            {competitionsWithEvents.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t.selectCompetition}
                </label>
                <div className="flex flex-wrap gap-2">
                  {competitionsWithEvents.map((c) => (
                    <Link
                      key={c.id}
                      href={`/predictions?competition=${c.id}`}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                        c.id === activeCompetition?.id
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-900/20"
                          : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Paso 2: Evento de la competición elegida, agrupado por
                disciplina — así una competición grande (World Skate Games)
                se ve en varios grupos pequeños en vez de una única pared
                de botones. */}
            {activeCompetition && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t.selectEvent}
                </label>
                <PredictionEventSelector groups={predictionEventGroups} />
              </div>
            )}

            {/* Ficha del evento activo */}
            {activeEvent && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
                {activeEvent.isTest && <TestEventBanner locale={locale} />}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">{activeEvent.name}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeEvent.competition.name} • 📍 {activeEvent.competition.location || t.officialSite}
                    </p>
                  </div>
                  <div>
                    {predictionsStatus === "UPCOMING" ? (
                      <span className="px-3 py-1 text-xs font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30 rounded-full">
                        {t.notYetOpen}
                      </span>
                    ) : isLocked ? (
                      <span className="px-3 py-1 text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
                        {t.locked}
                      </span>
                    ) : (
                      <span className="px-3 py-1 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">
                        {t.closesAt}{" "}
                        <LocalDateTime
                          value={firstSegmentEffectiveLocksAt(activeEvent.segments, activeEvent.rosterLocksAt)}
                          options={{ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }}
                        />
                      </span>
                    )}
                  </div>
                </div>

                {/* Formulario */}
                {!session ? (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-8 text-center space-y-3">
                    <p className="text-sm text-slate-300">
                      {t.loginRequired}
                    </p>
                    <Link
                      href="/login"
                      className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                    >
                      {t.loginCta}
                    </Link>
                  </div>
                ) : predictionsStatus === "UPCOMING" ? (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-300">
                    {t.notYetOpenBody}
                  </div>
                ) : activeEvent.registrations.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-400">
                    {t.noSkaters}
                  </div>
                ) : (
                  <PredictionForm
                    eventId={activeEvent.id}
                    isLocked={isLocked}
                    skaters={activeEvent.registrations.map((r) => r.skater)}
                    isPair={isPairDiscipline(activeEvent.discipline?.name)}
                    initialPrediction={userPrediction}
                  />
                )}

                {/* Compartir mi predicción (cualquier usuario que ya haya enviado la suya) */}
                {myPicks.length >= 3 && (
                  <MyPredictionShare
                    eventName={activeEvent.name}
                    competitionName={activeEvent.competition.name}
                    picks={myPicks}
                    linkPath={`/predictions?competition=${activeEvent.competition.id}&event=${activeEvent.id}`}
                    labels={{
                      title: t.myPredImgTitle,
                      share: t.favImgShare,
                      download: t.favImgDownloadUser,
                      copyLink: t.favImgCopy,
                      copied: t.favImgCopied,
                      downloaded: t.favImgDownloaded,
                      working: t.favImgWorking,
                      error: t.favImgError,
                      shareText: t.myPredImgText,
                    }}
                  />
                )}

                {/* Favoritos del Público */}
                {activeEvent.predictions.length > 0 && (
                  <div className="border-t border-slate-800 pt-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-mono font-bold tracking-wider text-indigo-400 uppercase bg-indigo-950/70 border border-indigo-800/60 px-2 py-0.5 rounded">
                        {t.consensusTag}
                      </span>
                      <h3 className="text-sm font-bold text-slate-100 mt-1.5">{t.publicFavorites}</h3>
                      <p className="text-xs text-slate-400">
                        {t.predictionsSubmitted(activeEvent.predictions.length)}
                      </p>
                    </div>
                    {/* Solo admin: descarga la imagen (story) con el top 3 de cada puesto. */}
                    {isAdmin && (
                      <PublicFavoritesImageButton
                        eventName={activeEvent.name}
                        competitionName={activeEvent.competition.name}
                        groups={[
                          { title: t.favImgGold, color: "#c9a227", stats: statsRank1 },
                          { title: t.favImgSilver, color: "#b8c2cc", stats: statsRank2 },
                          { title: t.favImgBronze, color: "#cd7f32", stats: statsRank3 },
                        ].map((g) => ({
                          ...g,
                          stats: g.stats.slice(0, 3).map((x) => ({ name: x.skaterName, country: x.country, percent: x.percent })),
                        }))}
                        labels={{
                          button: t.favImgDownload,
                          working: t.favImgWorking,
                          error: t.favImgError,
                          title: t.publicFavorites.toUpperCase(),
                          subtitle: t.predictionsSubmitted(activeEvent.predictions.length),
                        }}
                      />
                    )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        {
                          title: t.goldVotes,
                          stats: statsRank1,
                          text: "text-amber-400",
                          bar: "bg-amber-400",
                        },
                        {
                          title: t.silverVotes,
                          stats: statsRank2,
                          text: "text-slate-300",
                          bar: "bg-slate-300",
                        },
                        {
                          title: t.bronzeVotes,
                          stats: statsRank3,
                          text: "text-amber-600",
                          bar: "bg-amber-600",
                        },
                      ].map(({ title, stats, text, bar }) => (
                        <div
                          key={title}
                          className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3"
                        >
                          <span className={`text-sm font-bold ${text}`}>{title}</span>
                          <div className="space-y-2.5">
                            {stats.slice(0, 3).map((s, idx) => (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                  <span className="text-slate-200">{s.skaterName}</span>
                                  <span className={`font-mono font-bold ${text}`}>{s.percent}%</span>
                                </div>
                                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${bar}`}
                                    style={{ width: `${s.percent}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ranking de Predicciones: por evento / global por competición */}
                <div className="border-t border-slate-800 pt-5 space-y-3">
                  <div className="flex border-b border-slate-800 gap-2">
                    <Link
                      href={rankHref("event")}
                      className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${
                        rankTab === "event"
                          ? "border-blue-500 text-blue-400"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {t.eventRanking}
                    </Link>
                    <Link
                      href={rankHref("competition")}
                      className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${
                        rankTab === "competition"
                          ? "border-blue-500 text-blue-400"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {t.globalRanking(activeEvent.competition.name)}
                    </Link>
                  </div>

                  {(() => {
                    const ranking = rankTab === "event" ? eventRanking : competitionRanking;
                    if (ranking.length === 0) {
                      return (
                        <p className="text-xs text-slate-500 text-center py-6">
                          {t.noRanking}
                        </p>
                      );
                    }
                    return (
                      <PaginatedPredictionRanking
                        key={rankTab}
                        rows={ranking}
                        showEvents={rankTab === "competition"}
                        labels={{ user: t.user, events: t.events, points: t.points, pointsSuffix: t.pointsSuffix }}
                      />
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
