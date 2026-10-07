import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeSegmentResultBlocks } from "@/lib/segmentResults";
import { formatSkaterName, isPairDiscipline } from "@/lib/skaterName";
import SegmentResultsTables from "@/app/_components/SegmentResultsTables";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { translateCategoryName, translateDisciplineName } from "@/lib/i18n/categoryTranslations";

export const dynamic = "force-dynamic";

const statusClassName: Record<string, string> = {
  UPCOMING: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  LOCKED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  RESULTS_IN: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  FINISHED: "bg-slate-700 text-slate-300 border-slate-600",
};

const medal = ["🥇", "🥈", "🥉"];

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: { discipline?: string; event?: string };
}) {
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.resultados;
  const genderLabel = dict.common.gender;

  const events = await prisma.event.findMany({
    // Igual que en /calendario, /competitions y la portada: un evento de
    // prueba (ver admin/events) no es competición real y no debe mezclarse
    // con resultados reales, aunque alguien lo marque como terminado para
    // probar cómo se ve esa pantalla.
    where: { status: { in: ["LOCKED", "RESULTS_IN", "FINISHED"] }, isTest: false },
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

  // Modalidad (disciplina) activa: la de la prueba pedida con ?event=... (así
  // llegar desde otra pantalla abre directamente la modalidad correcta), o la
  // pedida con ?discipline=..., o la primera. Solo se muestran las pruebas de
  // esa modalidad — antes salían TODAS las modalidades apiladas una tras otra.
  const requestedEvent = searchParams.event ? events.find((e) => e.id === searchParams.event) : undefined;
  const activeDiscipline =
    requestedEvent?.discipline.name ??
    (searchParams.discipline && disciplineOrder.includes(searchParams.discipline)
      ? searchParams.discipline
      : disciplineOrder[0]);

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
          <>
            {/* Pestañas por modalidad, deslizables en horizontal */}
            <div className="flex gap-1.5 overflow-x-auto border-b border-slate-800 pb-3">
              {disciplineOrder.map((disciplineName) => (
                <Link
                  key={disciplineName}
                  href={`/resultados?discipline=${encodeURIComponent(disciplineName)}`}
                  className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                    disciplineName === activeDiscipline
                      ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                      : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {translateDisciplineName(disciplineName, locale)}{" "}
                  <span className="font-normal normal-case opacity-60">
                    ({byDiscipline.get(disciplineName)!.length})
                  </span>
                </Link>
              ))}
            </div>

          {disciplineOrder
            .filter((disciplineName) => disciplineName === activeDiscipline)
            .map((disciplineName) => (
            <section key={disciplineName} className="space-y-4">

              <div className="grid gap-4">
                {byDiscipline.get(disciplineName)!.map((event) => {
                  const badgeLabel = t.status[event.status as keyof typeof t.status];
                  const badgeClass = statusClassName[event.status];
                  const podium = event.registrations
                    .filter((r: RegistrationWithSkater) => r.finalRank !== null)
                    .slice(0, 3);
                  const hasResults = podium.length > 0;
                  const resultBlocks = hasResults
                    ? computeSegmentResultBlocks(event.segments, event.registrations, isPairDiscipline(event.discipline.name))
                    : [];

                  return (
                    <div
                      key={event.id}
                      id={event.id}
                      className={`bg-slate-900/80 border rounded-2xl p-5 space-y-4 shadow-lg shadow-black/30 ${
                        event.id === searchParams.event ? "border-indigo-500/60" : "border-slate-800"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {translateCategoryName(event.category.name, locale)}
                              {event.gender ? ` · ${genderLabel[event.gender]}` : ""}
                              {event.showFormat
                                ? ` · ${dict.common.showFormat[event.showFormat as keyof typeof dict.common.showFormat]}`
                                : ""}
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
                                  {formatSkaterName(reg.skater, isPairDiscipline(event.discipline.name))}
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
          ))}
          </>
        )}
      </div>
    </div>
  );
}
