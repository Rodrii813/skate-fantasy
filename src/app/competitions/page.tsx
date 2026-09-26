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
    // Antes: "bg-slate-950" tapaba con un gris plano el degradado de fondo
    // (rink + halos teal/dorado) que ya pone globals.css en el <body> para
    // el resto de la web — por eso esta pantalla se veía distinta al menú y
    // a la home. Quitando el color de fondo propio, se deja ver el mismo
    // fondo de siempre y solo se ajustan las tarjetas/textos a la paleta
    // rink/gold/ice.
    <div className="min-h-screen text-ice-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <h1 className="text-3xl font-display font-extrabold tracking-tight text-white">{t.title}</h1>
            </div>
            <p className="text-ice-100/60 text-sm mt-1">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/calendario"
              className="text-xs font-semibold bg-white/5 border border-white/15 text-ice-100/80 px-3 py-1.5 rounded-lg hover:border-white/30 hover:text-white transition inline-flex items-center gap-1.5"
            >
              {t.viewCalendar}
            </Link>
            <span className="text-xs font-mono bg-gold/10 border border-gold/30 px-3 py-1.5 rounded-lg text-gold">
              {t.season}
            </span>
          </div>
        </div>

        {competitions.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-ice-100/60 text-base">{t.empty}</p>
            <p className="text-ice-100/40 text-xs mt-2">{t.emptyHint}</p>
          </div>
        ) : (
          <CompetitionsSearch competitions={competitions} />
        )}
      </div>
    </div>
  );
}
