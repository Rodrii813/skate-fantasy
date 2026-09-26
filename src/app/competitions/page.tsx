import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CompetitionsSearch from "./CompetitionsSearch";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function CompetitionsPage() {
  const t = getDictionary(getLocale()).competitionsHub;
  const competitions = await prisma.competition.findMany({
    orderBy: { startDate: "asc" },
    include: {
      events: {
        include: {
          discipline: true,
          category: true,
          _count: { select: { registrations: true, predictions: true } },
        },
        orderBy: { rosterLocksAt: "asc" },
      },
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Encabezado estilo Rocker Skating */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/calendario"
              className="text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg hover:border-slate-500 transition inline-flex items-center gap-1.5"
            >
              {t.viewCalendar}
            </Link>
            <span className="text-xs font-mono bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300">
              {t.season}
            </span>
          </div>
        </div>

        {competitions.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-slate-400 text-base">{t.empty}</p>
            <p className="text-slate-500 text-xs mt-2">{t.emptyHint}</p>
          </div>
        ) : (
          <CompetitionsSearch competitions={competitions} />
        )}
      </div>
    </div>
  );
}
