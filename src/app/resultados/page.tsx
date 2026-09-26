import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeSegmentResultBlocks } from "@/lib/segmentResults";
import SegmentResultsTables from "@/app/_components/SegmentResultsTables";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

const statusClassName: Record<string, string> = {
  UPCOMING: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  LOCKED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  RESULTS_IN: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  FINISHED: "bg-slate-700 text-slate-300 border-slate-600",
};

const medal = ["🥇", "🥈", "🥉"];

export default async function ResultadosPage() {
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.resultados;
  const genderLabel = dict.common.gender;

  const events = await prisma.event.findMany({
    where: { status: { in: ["LOCKED", "RESULTS_IN", "FINISHED"] } },
    include: {
      competition: true,
      discipline: true,
      category: true,
      segments: { orderBy: { order: "asc" } },
      registrations: {
        include: {
          skater: true,
          elementScores: { include: { elementCategory: true } },
        },
        orderBy: [{ finalRank: "asc" }, { totalScore: "desc" }],
      },
    },
    orderBy: { rosterLocksAt: "desc" },
  });

  type EventWithResults = (typeof events)[number];
  type RegistrationWithSkater = EventWithResults["registrations"][number];

  const disciplineOrder: string[] = [];
  const byDiscipline = new Map<string, EventWithResults[]>();
  for (const event of events) {
    const key = event.discipline.name;
    if (!byDiscipline.has(key)) {
      byDiscipline.set(key, []);
      disciplineOrder.push(key);
    }
    byDiscipline.get(key)!.push(event);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="border-b border-slate-800 pb-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏅</span>
            <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            {t.subtitle}
          </p>
        </div>

        {events.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-slate-400 text-base">
              {t.empty}
            </p>
          </div>
        ) : (
          disciplineOrder.map((disciplineName) => (
            <section key={disciplineName} className="space-y-4">
              <h2 className="text-lg font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
                {disciplineName}
              </h2>

              <div className="grid gap-4">
                {byDiscipline.get(disciplineName)!.map((event) => {
                  const badgeLabel = t.status[event.status as keyof typeof t.status];
                  const badgeClass = statusClassName[event.status];
                  const podium = event.registrations
                    .filter((r: RegistrationWithSkater) => r.finalRank !== null)
                    .slice(0, 3);
                  const hasResults = podium.length > 0;
                  const resultBlocks = hasResults
                    ? computeSegmentResultBlocks(event.segments, event.registrations)
                    : [];

                  return (
                    <div
                      key={event.id}
                      className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg shadow-black/30"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {event.category.name}
                              {event.gender ? ` · ${genderLabel[event.gender]}` : ""}
                            </span>
                            {badgeLabel && (
                              <span
                                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badgeClass}`}
                              >
                                {badgeLabel}
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-slate-100">{event.name}</h3>
                          <p className="text-xs text-slate-500">{event.competition.name}</p>
                        </div>
                        <Link
                          href={`/competitions/${event.competitionId}?event=${event.id}`}
                          className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg border border-slate-700 transition whitespace-nowrap"
                        >
                          {t.viewFullTable}
                        </Link>
                      </div>

                      {hasResults ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
                          {podium.map((reg: RegistrationWithSkater, i: number) => (
                            <div
                              key={reg.id}
                              className="flex items-center gap-2 bg-slate-950/50 rounded-xl border border-slate-800/80 p-3"
                            >
                              <span className="text-xl">{medal[i]}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-200 truncate">
                                  {reg.skater.firstName} {reg.skater.lastName}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {reg.skater.country}
                                  {reg.totalScore != null ? ` · ${reg.totalScore.toFixed(2)} pts` : ""}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 pt-2 border-t border-slate-800/80">
                          {t.noResultsYet}
                        </p>
                      )}

                      {/* Desglose Corto / Largo / Total, colapsado por defecto para no saturar esta vista general */}
                      {hasResults && (
                        <div className="border-t border-slate-800/80 -mx-5 -mb-5">
                          <SegmentResultsTables blocks={resultBlocks} defaultOpen={false} gender={event.gender} locale={locale} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
