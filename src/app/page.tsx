import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

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
    include: { competition: true },
    orderBy: { rosterLocksAt: "asc" },
    take: 2,
  });

  const nextActiveEvent = upcomingEvents[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Barra superior minimalista estilo Rocker */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50 px-4 py-3.5 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-xl tracking-tight text-white flex items-center gap-1.5">
              SKATE<span className="text-indigo-400">HUB</span>
            </span>
            <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded tracking-widest font-semibold">
              {t.betaTag}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden sm:inline">
                  {session.user?.name || session.user?.email}
                </span>
                <Link
                  href="/admin"
                  className="text-xs bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 px-3 py-1.5 rounded-lg transition"
                >
                  {t.panel}
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg transition shadow-sm"
              >
                {t.login}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-6xl mx-auto w-full px-4 py-8 sm:py-12 sm:px-8 space-y-8 flex-1">
        
        {/* Banner de evento destacado */}
        {nextActiveEvent ? (
          <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-black/40">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full animate-pulse">
                  ● {t.liveBanner}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {nextActiveEvent.competition.name}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-100">
                {nextActiveEvent.name}
              </h2>
              <p className="text-xs text-slate-400">
                {t.picksClose}: {new Date(nextActiveEvent.rosterLocksAt).toLocaleDateString()}{" "}
                {new Date(nextActiveEvent.rosterLocksAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Link
                href={`/predictions?event=${nextActiveEvent.id}`}
                className="flex-1 sm:flex-none text-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition"
              >
                {t.predictPodium}
              </Link>
              <Link
                href={`/events/${nextActiveEvent.id}`}
                className="flex-1 sm:flex-none text-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition"
              >
                {t.createRoster}
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              {t.heroTitle}
            </h1>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              {t.heroSubtitle}
            </p>
          </div>
        )}

        {/* Rejilla de Tarjetas táctiles (Móvil: 1 columna | Tablet: 2 cols | PC: 3 cols) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Card 1: Competition Hub */}
          <Link
            href="/competitions"
            className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition duration-200 flex flex-col justify-between min-h-[160px] active:scale-[0.98] shadow-lg shadow-black/30"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xl">
                🏆
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-blue-400 transition">
                  {t.cardHubTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
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
            className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition duration-200 flex flex-col justify-between min-h-[160px] active:scale-[0.98] shadow-lg shadow-black/30"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl">
                🎯
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-100 group-hover:text-emerald-400 transition">
                    {t.cardPredictionsTitle}
                  </h3>
                  <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    TOP 3/5
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
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
            className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition duration-200 flex flex-col justify-between min-h-[160px] active:scale-[0.98] shadow-lg shadow-black/30"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl">
                ✨
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-indigo-400 transition">
                  {t.cardFantasyTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
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
            className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition duration-200 flex flex-col justify-between min-h-[160px] active:scale-[0.98] shadow-lg shadow-black/30"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xl">
                📊
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-amber-400 transition">
                  {t.cardRulesTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {t.cardRulesBody}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-amber-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 mt-4">
              {t.cardRulesCta}
            </span>
          </Link>

          {/* Card 5: Reglas y Puntuación Rollart */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between min-h-[160px] opacity-90">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-xl">
                📋
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">
                  {t.cardScoringTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {t.cardScoringBody}
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-500 mt-4">
              {t.cardScoringFooter}
            </span>
          </div>

          {/* Card 6: Acceso Rápido Registro / Login */}
          {!session ? (
            <div className="bg-gradient-to-br from-indigo-900/30 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 flex flex-col justify-between min-h-[160px]">
              <div className="space-y-2">
                <span className="text-xl">⛸️</span>
                <h3 className="text-lg font-bold text-slate-100">{t.cardSignupTitle}</h3>
                <p className="text-xs text-slate-400">
                  {t.cardSignupBody}
                </p>
              </div>
              <Link
                href="/register"
                className="w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-md shadow-indigo-900/30 mt-4"
              >
                {t.cardSignupCta}
              </Link>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between min-h-[160px]">
              <div className="space-y-2">
                <span className="text-xl">✅</span>
                <h3 className="text-lg font-bold text-slate-100">{t.cardActiveTitle}</h3>
                <p className="text-xs text-slate-400">
                  {t.cardActiveBody(session.user?.name || session.user?.email || "")}
                </p>
              </div>
              <Link
                href="/competitions"
                className="w-full text-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 rounded-xl border border-slate-700 transition mt-4"
              >
                {t.cardActiveCta}
              </Link>
            </div>
          )}

        </div>
      </main>

      {/* Footer minimalista */}
      <footer className="border-t border-slate-900 text-slate-600 text-xs py-6 text-center px-4">
        <p>{t.footer}</p>
      </footer>
    </div>
  );
}