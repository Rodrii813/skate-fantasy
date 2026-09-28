import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { computeEventOpenStatus } from "@/lib/eventOpenStatus";
import WorldSkateGamesCountdown from "@/app/_components/WorldSkateGamesCountdown";
import ShareSiteCard from "@/app/_components/ShareSiteCard";

export const dynamic = "force-dynamic";

// Sin generateMetadata propio a propósito: el título/descripción por
// defecto del layout raíz (src/app/layout.tsx) ya es exactamente el de la
// home, y la plantilla de título ("%s — Rollart Fantasy") duplicaría la
// marca si se repitiera aquí.

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const t = getDictionary(getLocale()).home;

  const now = new Date();

  // Se piden hasta 8 candidatos (antes solo 2, y solo se usaba el primero)
  // para poder recorrerlos buscando el primero que tenga REALMENTE algo
  // abierto — ver el "porqué" completo unas líneas más abajo.
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
    take: 8,
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
  const activeStatus = activeCandidate?.status;

  const predictionsOpen = activeStatus?.predictionsOpen || false;
  const draftOpen = activeStatus?.draftOpen || false;
  const somethingLiveNow = predictionsOpen || draftOpen;

  // Segundo bug reportado en el mismo banner: "Cierre de picks" mostraba
  // SIEMPRE rosterLocksAt, aunque lo que estuviera abierto (o lo próximo a
  // cerrar) fueran las Predicciones, cuyo plazo real es
  // predictionsCloseAt (firstSegmentEffectiveLocksAt) — casi siempre
  // IGUAL o ANTES que rosterLocksAt, nunca después. Ahora se muestra el
  // plazo que corresponde a lo que está (o va a estar) abierto, y si
  // Predicciones y Draft cierran en momentos distintos y los dos están
  // abiertos a la vez, se muestran ambos por separado en vez de uno solo.
  const showBothCloseDates =
    predictionsOpen &&
    draftOpen &&
    activeStatus!.predictionsCloseAt.getTime() !== activeStatus!.draftCloseAt.getTime();

  const fmtDate = (d: Date) =>
    `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  // Eventos "en directo ahora mismo" (Predicciones o Draft abiertos), para
  // la lista de debajo del banner destacado — hasta 5, distintos del que ya
  // protagoniza el banner grande para no repetir la misma prueba dos veces.
  const liveNowEvents = candidates
    .filter((c) => (c.status.predictionsOpen || c.status.draftOpen) && c.event.id !== nextActiveEvent?.id)
    .slice(0, 5);

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

        {/* Banner de evento destacado */}
        {nextActiveEvent ? (
          <div className="bg-gradient-to-r from-gold/10 via-white/5 to-white/5 border border-gold/30 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-black/40">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {somethingLiveNow ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full animate-pulse">
                    ●{" "}
                    {predictionsOpen && draftOpen
                      ? t.liveBanner
                      : predictionsOpen
                      ? t.liveBannerPredictionsOnly
                      : t.liveBannerDraftOnly}
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
              {showBothCloseDates ? (
                <p className="text-xs text-ice-100/50 space-x-3">
                  <span>{t.picksClosePredictions}: {fmtDate(activeStatus!.predictionsCloseAt)}</span>
                  <span>{t.picksCloseDraft}: {fmtDate(activeStatus!.draftCloseAt)}</span>
                </p>
              ) : (
                <p className="text-xs text-ice-100/50">
                  {t.picksClose}:{" "}
                  {fmtDate(
                    predictionsOpen
                      ? activeStatus!.predictionsCloseAt
                      : draftOpen
                      ? activeStatus!.draftCloseAt
                      : activeStatus!.predictionsCloseAt.getTime() < activeStatus!.draftCloseAt.getTime()
                      ? activeStatus!.predictionsCloseAt
                      : activeStatus!.draftCloseAt
                  )}
                </p>
              )}
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

        {/* Lista "en directo ahora": otras pruebas con Predicciones o Draft
            abiertos, aparte de la que ya protagoniza el banner de arriba —
            para que no haga falta ir a Predicciones o a Fantasy a comprobar
            si hay algo más abierto ahora mismo. */}
        {liveNowEvents.length > 0 && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-4 pb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-ice-100/70">{t.liveNowTitle}</h2>
            </div>
            <div className="divide-y divide-white/5">
              {liveNowEvents.map(({ event, status }) => (
                <div key={event.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ice-50 truncate">{event.name}</p>
                    <p className="text-[11px] text-ice-100/40 truncate">{event.competition.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {status.predictionsOpen && (
                      <Link
                        href={`/predictions?event=${event.id}`}
                        className="text-[10px] font-bold uppercase tracking-wide bg-accent/20 text-accent border border-accent/30 px-2.5 py-1 rounded-full hover:bg-accent/30 transition"
                      >
                        {t.liveNowPredictionsPill}
                      </Link>
                    )}
                    {status.draftOpen && (
                      <Link
                        href={`/events/${event.id}`}
                        className="text-[10px] font-bold uppercase tracking-wide bg-gold/20 text-gold border border-gold/30 px-2.5 py-1 rounded-full hover:bg-gold/30 transition"
                      >
                        {t.liveNowDraftPill}
                      </Link>
                    )}
                  </div>
                </div>
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
