import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { firstSegmentEffectiveLocksAt, getSegmentDraftStatus } from "@/lib/segments";
import WorldSkateGamesCountdown from "@/app/_components/WorldSkateGamesCountdown";

export const dynamic = "force-dynamic";

// Sin generateMetadata propio a propósito: el título/descripción por
// defecto del layout raíz (src/app/layout.tsx) ya es exactamente el de la
// home, y la plantilla de título ("%s — Rollart Fantasy") duplicaría la
// marca si se repitiera aquí.

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const t = getDictionary(getLocale()).home;

  // Consultar si hay eventos abiertos para picks/predicciones o en vivo
  const now = new Date();
  const upcomingEvents = await prisma.event.findMany({
    where: {
      rosterLocksAt: { gte: now },
      status: "UPCOMING",
    },
    include: {
      competition: true,
      segments: true,
      slots: { select: { segmentId: true } },
    },
    orderBy: { rosterLocksAt: "asc" },
    take: 2,
  });

  const nextActiveEvent = upcomingEvents[0];

  // Este banner afirmaba SIEMPRE "DRAFTS Y PREDICCIONES ABIERTAS" con los 2
  // botones en color activo, solo por existir un evento UPCOMING con
  // rosterLocksAt futuro — sin comprobar si de verdad hay algo que se pueda
  // draftear o predecir YA MISMO (mismos criterios reales que usan
  // /predictions y /fantasy: ver src/lib/segments.ts).
  const predictionsOpen = nextActiveEvent
    ? nextActiveEvent.status === "UPCOMING" &&
      now <= firstSegmentEffectiveLocksAt(nextActiveEvent.segments, nextActiveEvent.rosterLocksAt)
    : false;

  const draftOpen = nextActiveEvent
    ? (() => {
        const slotsBySegment = new Map<string, number>();
        for (const slot of nextActiveEvent.slots) {
          if (slot.segmentId) slotsBySegment.set(slot.segmentId, (slotsBySegment.get(slot.segmentId) || 0) + 1);
        }
        return nextActiveEvent.segments.some(
          (seg) =>
            getSegmentDraftStatus(
              seg,
              nextActiveEvent.rosterLocksAt,
              (slotsBySegment.get(seg.id) || 0) > 0,
              now
            ) === "OPEN"
        );
      })()
    : false;

  const somethingLiveNow = predictionsOpen || draftOpen;

  // Cuenta atrás llamativa hasta el inicio de los World Skate Games — se
  // busca por nombre (en vez de un id fijo) para no depender de qué
  // competición concreta se haya creado como "la" de este año; si hay más
  // de una que matchee (poco probable), se coge la de inicio más próximo.
  // Solo se manda al cliente lo que necesita (fecha, nombre, sede), nunca el
  // registro completo de Prisma.
  const worldSkateGames = await prisma.competition.findFirst({
    where: { name: { contains: "World Skate Games", mode: "insensitive" } },
    orderBy: { startDate: "asc" },
    select: { name: true, location: true, startDate: true },
  });

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
        {worldSkateGames && (
          <WorldSkateGamesCountdown
            targetDate={worldSkateGames.startDate.toISOString()}
            title={worldSkateGames.name}
            location={worldSkateGames.location}
            prefix={t.countdownPrefix}
            labels={{
              days: t.countdownDays,
              hours: t.countdownHours,
              minutes: t.countdownMinutes,
              seconds: t.countdownSeconds,
            }}
          />
        )}

        {/* Banner de evento destacado */}
        {nextActiveEvent ? (
          <div className="bg-gradient-to-r from-gold/10 via-white/5 to-white/5 border border-gold/30 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-black/40">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {somethingLiveNow ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full animate-pulse">
                    ● {t.liveBanner}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-white/10 text-ice-100/60 border border-white/15 px-2 py-0.5 rounded-full">
                    {t.upcomingBanner}
                  </span>
                )}
                <span className="text-xs text-ice-100/50 font-mono">
                  {nextActiveEvent.competition.name}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-black text-white">
                {nextActiveEvent.name}
              </h2>
              <p className="text-xs text-ice-100/50">
                {t.picksClose}: {new Date(nextActiveEvent.rosterLocksAt).toLocaleDateString()}{" "}
                {new Date(nextActiveEvent.rosterLocksAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Link
                href={`/predictions?event=${nextActiveEvent.id}`}
                className={`flex-1 sm:flex-none text-center text-xs font-semibold px-4 py-2.5 rounded-xl transition ${
                  predictionsOpen
                    ? "bg-accent hover:bg-accent/90 text-rink"
                    : "bg-white/10 hover:bg-white/15 text-ice-100/50 border border-white/10"
                }`}
              >
                {predictionsOpen ? t.predictPodium : t.predictPodiumClosed}
              </Link>
              <Link
                href={`/events/${nextActiveEvent.id}`}
                className={`flex-1 sm:flex-none text-center text-xs font-semibold px-4 py-2.5 rounded-xl transition ${
                  draftOpen
                    ? "bg-gold hover:bg-gold/90 text-rink"
                    : "bg-white/10 hover:bg-white/15 text-ice-100/50 border border-white/10"
                }`}
              >
                {draftOpen ? t.createRoster : t.createRosterClosed}
              </Link>
            </div>
          </div>
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

          {/* Card 5: Reglas y Puntuación Rollart */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[160px] opacity-90">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-xl">
                📋
              </div>
              <div>
                <h3 className="text-lg font-bold text-ice-50">
                  {t.cardScoringTitle}
                </h3>
                <p className="text-xs text-ice-100/50 mt-1 leading-relaxed">
                  {t.cardScoringBody}
                </p>
              </div>
            </div>
            <span className="text-xs text-ice-100/35 mt-4">
              {t.cardScoringFooter}
            </span>
          </div>

          {/* Card 6: Acceso Rápido Registro / Login */}
          {!session ? (
            <div className="bg-gradient-to-br from-gold/10 to-white/5 border border-gold/20 rounded-2xl p-6 flex flex-col justify-between min-h-[160px]">
              <div className="space-y-2">
                <span className="text-xl">⛸️</span>
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
              <Link
                href="/competitions"
                className="w-full text-center bg-white/10 hover:bg-white/15 text-ice-100/90 text-xs font-semibold py-2.5 rounded-xl border border-white/15 transition mt-4"
              >
                {t.cardActiveCta}
              </Link>
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
