import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { computeEventOpenStatus } from "@/lib/eventOpenStatus";
import WorldSkateGamesCountdown from "@/app/_components/WorldSkateGamesCountdown";
import ShareSiteCard from "@/app/_components/ShareSiteCard";
import HomeEventCarousel, {
  type HomeEventCarouselLabels,
  type HomeEventSlide,
} from "@/app/_components/HomeEventCarousel";
import { formatInTimeZone, VENUE_TIMEZONE } from "@/lib/timezone";

export const dynamic = "force-dynamic";

// Sin generateMetadata propio a propósito: el título/descripción por
// defecto del layout raíz (src/app/layout.tsx) ya es exactamente el de la
// home, y la plantilla de título ("%s — Rollart Fantasy") duplicaría la
// marca si se repitiera aquí.

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const locale = getLocale();
  const t = getDictionary(locale).home;
  // Mismo criterio que /competitions y /competitions/[id]: sin locale
  // explícito, toLocaleDateString() usaba el locale del SERVIDOR (en-US),
  // así que una fecha como "30 de septiembre" se veía "9/30/2026"
  // (mes/día, al revés de como se lee en español) en vez de "30/9/2026".
  const dateLocale = locale === "en" ? "en-US" : "es-ES";

  const now = new Date();

  // Se piden hasta 20 candidatos (antes solo 2, y solo se usaba el primero)
  // para poder recorrerlos buscando el primero que tenga REALMENTE algo
  // abierto (ver el "porqué" completo unas líneas más abajo) y para que la
  // lista de "en directo ahora" tenga margen de sobra para encontrar varias
  // competiciones DISTINTAS, no solo varios eventos de la misma.
  const upcomingEvents = await prisma.event.findMany({
    where: {
      rosterLocksAt: { gte: now },
      status: "UPCOMING",
      // No queremos que el evento "de prueba" (ver admin/events) pueda salir
      // en la portada como si fuera una prueba real en directo.
      isTest: false,
    },
    include: {
      competition: true,
      segments: true,
      slots: { select: { segmentId: true } },
      _count: { select: { registrations: true } },
    },
    orderBy: { rosterLocksAt: "asc" },
    take: 20,
  });

  // Tipado explícito: el cliente de Prisma en este entorno de verificación
  // está "stubeado" como `any` (ver notas del proyecto), lo que hace que
  // `upcomingEvents` sea `any[]` y arrastre ese "any" a cualquier callback
  // que se encadene después (find/filter/map, incluso desestructurando en
  // el JSX más abajo) sin que noImplicitAny pueda inferir nada. Anotar el
  // tipo de `candidates` aquí corta esa cadena de una vez.
  const candidates: { event: (typeof upcomingEvents)[number]; status: ReturnType<typeof computeEventOpenStatus> }[] =
    upcomingEvents.map((ev: (typeof upcomingEvents)[number]) => ({ event: ev, status: computeEventOpenStatus(ev, now) }));

  // Bug reportado: el banner se quedaba pegado al evento con el rosterLocksAt
  // más próximo aunque ESE evento ya no tuviera nada abierto (p.ej. su primer
  // segmento ya cerró para Predicciones y su Draft tampoco ha abierto
  // todavía), mientras que otro evento algo más lejano en el tiempo sí tenía
  // Predicciones o Draft abiertos ahora mismo. Se recorre la lista y se
  // escoge el primero que tenga algo REALMENTE abierto; si ninguno lo tiene,
  // se cae al más próximo de todos (mismo comportamiento "próximamente" de
  // siempre).
  const activeCandidate = candidates.find((c) => c.status.predictionsOpen || c.status.draftOpen) || candidates[0];
  const nextActiveEvent = activeCandidate?.event;
  const fmtDate = (d: Date) =>
    `${d.toLocaleDateString(dateLocale)} ${d.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}`;

  // Lista "en directo ahora": por COMPETICIÓN, no por evento — antes salía
  // una fila por cada prueba (Corto Senior, Largo Senior, Danza...), y una
  // sola competición con varias disciplinas/categorías abiertas a la vez
  // llenaba la lista entera repitiendo el mismo nombre de competición. Ahora
  // se agrupa por competitionId: una fila por competición, con las pastillas
  // combinadas (si CUALQUIERA de sus pruebas tiene Predicciones y/o Draft
  // abiertos). Se excluye la competición que ya protagoniza el banner grande
  // de arriba, para no mostrarla dos veces.
  const liveNowByCompetition = new Map<
    string,
    { competitionId: string; competitionName: string; predictionsOpen: boolean; draftOpen: boolean }
  >();
  for (const c of candidates) {
    if (!c.status.predictionsOpen && !c.status.draftOpen) continue;
    if (c.event.competitionId === nextActiveEvent?.competitionId) continue;
    const existing = liveNowByCompetition.get(c.event.competitionId);
    if (existing) {
      existing.predictionsOpen = existing.predictionsOpen || c.status.predictionsOpen;
      existing.draftOpen = existing.draftOpen || c.status.draftOpen;
    } else {
      liveNowByCompetition.set(c.event.competitionId, {
        competitionId: c.event.competitionId,
        competitionName: c.event.competition.name,
        predictionsOpen: c.status.predictionsOpen,
        draftOpen: c.status.draftOpen,
      });
    }
  }
  const liveNowCompetitions = Array.from(liveNowByCompetition.values()).slice(0, 5);

  // Carrusel del banner: pruebas del mismo día de sede que la destacada,
  // ordenadas por hora de pista. Sin scheduledAt (o sin ninguna otra ese día)
  // se queda solo la destacada.
  const venueDayKey = (d: Date | null | undefined) =>
    d ? formatInTimeZone(d, VENUE_TIMEZONE, { year: "numeric", month: "2-digit", day: "2-digit" }) : null;
  const featuredDay = venueDayKey(nextActiveEvent?.scheduledAt);
  const carouselCandidates: typeof candidates = !nextActiveEvent
    ? []
    : featuredDay
    ? candidates
        .filter((c) => venueDayKey(c.event.scheduledAt) === featuredDay)
        .sort(
          (x, y) =>
            new Date(x.event.scheduledAt as Date).getTime() - new Date(y.event.scheduledAt as Date).getTime()
        )
    : [activeCandidate!];
  const closeLinesFor = (st: ReturnType<typeof computeEventOpenStatus>) => {
    if (st.predictionsOpen && st.draftOpen && st.predictionsCloseAt.getTime() !== st.draftCloseAt.getTime()) {
      return [
        { label: t.picksClosePredictions, value: fmtDate(st.predictionsCloseAt) },
        { label: t.picksCloseDraft, value: fmtDate(st.draftCloseAt) },
      ];
    }
    const at = st.predictionsOpen
      ? st.predictionsCloseAt
      : st.draftOpen
      ? st.draftCloseAt
      : st.predictionsCloseAt.getTime() < st.draftCloseAt.getTime()
      ? st.predictionsCloseAt
      : st.draftCloseAt;
    return [{ label: t.picksClose, value: fmtDate(at) }];
  };
  const bannerSlides: HomeEventSlide[] = carouselCandidates.map((c) => ({
    id: c.event.id,
    competitionName: c.event.competition.name,
    name: c.event.name,
    predictionsOpen: c.status.predictionsOpen,
    draftOpen: c.status.draftOpen,
    closeLines: closeLinesFor(c.status),
  }));
  const carouselLabels: HomeEventCarouselLabels = {
    liveBoth: t.liveBanner,
    livePredictionsOnly: t.liveBannerPredictionsOnly,
    liveDraftOnly: t.liveBannerDraftOnly,
    upcoming: t.upcomingBanner,
    predictOpen: t.predictPodium,
    predictClosed: t.predictPodiumClosed,
    draftOpen: t.createRoster,
    draftClosed: t.createRosterClosed,
    prev: t.carouselPrev,
    next: t.carouselNext,
    goTo: t.carouselGoTo,
  };

  // Cuenta atrás de la home: ajustable desde /admin/settings (activar o
  // desactivar, título, sede y fecha objetivo) en vez de detectarse sola
  // buscando una Competition llamada "World Skate Games" — así se puede
  // quitar sin más cuando no aplique, o reutilizar para cualquier otro
  // evento destacado.
  const siteSettings = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  const countdownVisible =
    !!siteSettings?.countdownEnabled &&
    !!siteSettings.countdownTargetDate &&
    siteSettings.countdownTargetDate.getTime() > now.getTime();

  return (
    // La home tenía su PROPIA cabecera ("SKATEHUB", con su propio botón de
    // login/panel) por debajo del menú de verdad (NavBar, en el layout raíz)
    // — dos barras superiores distintas, con marca y colores distintos entre
    // sí y con el resto de la web. Se quita esa segunda cabecera entera (el
    // login/logout y el enlace de admin ya están en el menú de siempre) y se
    // deja de tapar el fondo degradado (rink + halos dorado/turquesa) que ya
    // pone globals.css, igual que se hizo en /competitions.
    <div className="min-h-screen text-ice-50 flex flex-col justify-between">
      <main className="w-full py-4 space-y-8 flex-1">
        {/* Aviso de beta / en construcción: la web ya funciona de verdad,
            pero todavía se están puliendo cosas y puede haber cambios — se
            avisa arriba del todo para que nadie se lleve una sorpresa. */}
        <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs rounded-xl px-4 py-2.5">
          <span className="text-sm shrink-0">🚧</span>
          <p>
            <span className="font-bold">{t.betaNoticeTag}</span> {t.betaNoticeBody}
          </p>
        </div>

        {/* Anuncio de la home: aviso de texto libre, activable/desactivable
            desde /admin/settings sin tocar código ni esperar un despliegue
            (ver SiteSettings.announcementEnabled/announcementText) — para
            cosas puntuales como "todavía no hay órdenes de salida". */}
        {siteSettings?.announcementEnabled && siteSettings.announcementText && (
          <div className="flex items-start gap-2.5 bg-sky-500/10 border border-sky-500/25 text-sky-100 text-xs rounded-xl px-4 py-2.5 whitespace-pre-line">
            <span className="text-sm shrink-0">📢</span>
            <p>{siteSettings.announcementText}</p>
          </div>
        )}

        {countdownVisible && (
          <WorldSkateGamesCountdown
            targetDate={siteSettings!.countdownTargetDate!.toISOString()}
            title={siteSettings!.countdownTitle || t.heroTitle}
            location={siteSettings!.countdownLocation}
            prefix={t.countdownPrefix}
            labels={{
              days: t.countdownDays,
              hours: t.countdownHours,
              minutes: t.countdownMinutes,
              seconds: t.countdownSeconds,
            }}
          />
        )}

        {/* Banner de evento destacado: carrusel con TODAS las pruebas del
            mismo día (en la sede) que la prueba destacada — p.ej. Junior
            femenino + Senior masculino + Senior femenino —, de una en una. */}
        {nextActiveEvent ? (
          <HomeEventCarousel slides={bannerSlides} labels={carouselLabels} />
        ) : (
          <div className="text-center py-4 space-y-2">
            <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-white">
              {t.heroTitle}
            </h1>
            <p className="text-ice-100/60 text-sm max-w-xl mx-auto">
              {t.heroSubtitle}
            </p>
          </div>
        )}

        {/* Lista "en directo ahora": una fila por COMPETICIÓN (no por
            prueba/evento) con Predicciones o Draft abiertos en alguna de sus
            pruebas, aparte de la que ya protagoniza el banner de arriba.
            Antes salía una fila por cada evento, y una sola competición con
            varias disciplinas/categorías abiertas a la vez llenaba la lista
            repitiendo su propio nombre una y otra vez. Cada fila enlaza a la
            página general de esa competición (p.ej. World Skate Games), no a
            una prueba/Predicción/Draft concretos — desde ahí se ve todo lo
            suyo y se entra a lo que interese. Las pastillas son solo
            informativas (qué hay abierto en esa competición), no enlaces
            por separado. */}
        {liveNowCompetitions.length > 0 && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-4 pb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-ice-100/70">{t.liveNowTitle}</h2>
            </div>
            <div className="divide-y divide-white/5">
              {liveNowCompetitions.map((comp) => (
                <Link
                  key={comp.competitionId}
                  href={`/competitions/${comp.competitionId}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/5 transition"
                >
                  <p className="text-sm font-semibold text-ice-50 truncate min-w-0">{comp.competitionName}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {comp.predictionsOpen && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-accent/20 text-accent border border-accent/30 px-2.5 py-1 rounded-full">
                        {t.liveNowPredictionsPill}
                      </span>
                    )}
                    {comp.draftOpen && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-gold/20 text-gold border border-gold/30 px-2.5 py-1 rounded-full">
                        {t.liveNowDraftPill}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Rejilla de Tarjetas táctiles (Móvil: 1 columna | Tablet: 2 cols | PC: 3 cols).
            Cada tarjeta mantiene su propio color de acento (azul, esmeralda,
            índigo, ámbar, morado) para distinguirse de un vistazo — solo se
            unifica el fondo/borde de la tarjeta y el texto neutro al mismo
            rink/ice que el resto de la web. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Competition Hub */}
          <Link
            href="/competitions"
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-6 transition duration-200 flex flex-col justify-between min-h-[160px] active:scale-[0.98] shadow-lg shadow-black/30"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xl">
                🏆
              </div>
              <div>
                <h3 className="text-lg font-bold text-ice-50 group-hover:text-blue-400 transition">
                  {t.cardHubTitle}
                </h3>
                <p className="text-xs text-ice-100/50 mt-1 leading-relaxed">
                  {t.cardHubBody}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-blue-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 mt-4">
              {t.cardHubCta}
            </span>
          </Link>

          {/* Card 2: Prediction Central */}
          <Link
            href="/predictions"
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-6 transition duration-200 flex flex-col justify-between min-h-[160px] active:scale-[0.98] shadow-lg shadow-black/30"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl">
                🎯
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-ice-50 group-hover:text-emerald-400 transition">
                    {t.cardPredictionsTitle}
                  </h3>
                  <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    TOP 3/5
                  </span>
                </div>
                <p className="text-xs text-ice-100/50 mt-1 leading-relaxed">
                  {t.cardPredictionsBody}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-emerald-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 mt-4">
              {t.cardPredictionsCta}
            </span>
          </Link>

          {/* Card 3: Fantasy Hub */}
          <Link
            href="/fantasy"
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-6 transition duration-200 flex flex-col justify-between min-h-[160px] active:scale-[0.98] shadow-lg shadow-black/30"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl">
                ✨
              </div>
              <div>
                <h3 className="text-lg font-bold text-ice-50 group-hover:text-indigo-400 transition">
                  {t.cardFantasyTitle}
                </h3>
                <p className="text-xs text-ice-100/50 mt-1 leading-relaxed">
                  {t.cardFantasyBody}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-indigo-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 mt-4">
              {t.cardFantasyCta}
            </span>
          </Link>

          {/* Card 4: Normas del Fantasy */}
          <Link
            href="/fantasy/normas"
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-6 transition duration-200 flex flex-col justify-between min-h-[160px] active:scale-[0.98] shadow-lg shadow-black/30"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xl">
                📊
              </div>
              <div>
                <h3 className="text-lg font-bold text-ice-50 group-hover:text-amber-400 transition">
                  {t.cardRulesTitle}
                </h3>
                <p className="text-xs text-ice-100/50 mt-1 leading-relaxed">
                  {t.cardRulesBody}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-amber-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 mt-4">
              {t.cardRulesCta}
            </span>
          </Link>

          {/* Card 5: Compartir la web */}
          <ShareSiteCard
            title={t.cardShareTitle}
            body={t.cardShareBody}
            buttonLabel={t.cardShareCta}
            copiedLabel={t.cardShareCopied}
            shareTitle={t.cardShareNativeTitle}
            shareText={t.cardShareNativeText}
          />

          {/* Card 6: Acceso Rápido Registro / Login */}
          {!session ? (
            <div className="bg-gradient-to-br from-gold/10 to-white/5 border border-gold/20 rounded-2xl p-6 flex flex-col justify-between min-h-[160px]">
              <div className="space-y-2">
                <span className="text-xl">🛼</span>
                <h3 className="text-lg font-bold text-ice-50">{t.cardSignupTitle}</h3>
                <p className="text-xs text-ice-100/50">
                  {t.cardSignupBody}
                </p>
              </div>
              <Link
                href="/register"
                className="w-full text-center bg-gold hover:bg-gold/90 text-rink text-xs font-semibold py-2.5 rounded-xl transition shadow-md shadow-black/30 mt-4"
              >
                {t.cardSignupCta}
              </Link>
            </div>
          ) : (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[160px]">
              <div className="space-y-2">
                <span className="text-xl">✅</span>
                <h3 className="text-lg font-bold text-ice-50">{t.cardActiveTitle}</h3>
                <p className="text-xs text-ice-100/50">
                  {t.cardActiveBody(session.user?.name || session.user?.email || "")}
                </p>
              </div>
              <div className="flex gap-2 mt-4">
                <Link
                  href="/competitions"
                  className="flex-1 text-center bg-white/10 hover:bg-white/15 text-ice-100/90 text-xs font-semibold py-2.5 rounded-xl border border-white/15 transition"
                >
                  {t.cardActiveCta}
                </Link>
                <Link
                  href="/profile"
                  className="flex-1 text-center bg-white/5 hover:bg-white/10 text-ice-100/70 text-xs font-semibold py-2.5 rounded-xl border border-white/10 transition"
                >
                  {t.cardActiveProfileCta}
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer minimalista */}
      <footer className="border-t border-white/10 text-ice-100/40 text-xs py-6 text-center px-4">
        <p>{t.footer}</p>
      </footer>
    </div>
  );
}
