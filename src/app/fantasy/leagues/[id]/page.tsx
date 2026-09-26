import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeLeagueLeaderboard } from "@/lib/scoring";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionary";
import JoinLeagueForm from "../JoinLeagueForm";
import CopyCodeButton from "./CopyCodeButton";

export const dynamic = "force-dynamic";

export default async function LeagueDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const locale = getLocale();
  const dict = getDictionary(locale);
  const t = dict.leagues.detail;
  const tf = dict.fantasyHub;
  const genderLabel = dict.common.gender;

  const league = await prisma.league.findUnique({
    where: { id: params.id },
    include: {
      memberships: { include: { user: { select: { id: true, name: true } } }, orderBy: { joinedAt: "asc" } },
      events: {
        include: {
          event: { include: { discipline: true, category: true, competition: true } },
        },
      },
    },
  });

  if (!league) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <Link href="/fantasy/leagues" className="text-xs text-slate-400 hover:text-slate-200">
            {t.back}
          </Link>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 mt-4">
            {t.notFound}
          </div>
        </div>
      </div>
    );
  }

  const currentUser = session?.user?.email
    ? await prisma.user.findUnique({ where: { email: session.user.email } })
    : null;
  const isMember = !!currentUser && league.memberships.some((m) => m.userId === currentUser.id);

  if (!isMember) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <Link href="/fantasy/leagues" className="text-xs text-slate-400 hover:text-slate-200">
            {t.back}
          </Link>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
            <p className="text-sm text-slate-300">{t.notMember}</p>
            <p className="text-xs text-slate-500">{t.joinWithCode}</p>
            {currentUser && (
              <div className="max-w-xs mx-auto">
                <JoinLeagueForm />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const ranking = await computeLeagueLeaderboard(league.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="border-b border-slate-800 pb-6">
          <Link href="/fantasy/leagues" className="text-xs text-slate-400 hover:text-slate-200">
            {t.back}
          </Link>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl">🏆</span>
            <h1 className="text-2xl font-extrabold tracking-tight">{league.name}</h1>
          </div>
        </div>

        {/* Código de invitación */}
        <div className="flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t.codeLabel}</p>
            <p className="text-xl font-mono font-bold tracking-widest text-indigo-300 mt-1">{league.code}</p>
            <p className="text-xs text-slate-500 mt-1">{t.codeHint}</p>
          </div>
          <CopyCodeButton code={league.code} />
        </div>

        {/* Miembros */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">{t.membersTitle}</h2>
          </div>
          <div className="flex flex-wrap gap-2 p-4">
            {league.memberships.map((m) => (
              <span
                key={m.id}
                className="text-xs bg-slate-800 text-slate-200 px-3 py-1.5 rounded-full font-medium"
              >
                {m.user.name}
                {m.userId === league.ownerId && (
                  <span className="ml-1.5 text-amber-400 font-semibold">★</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Eventos de la liga */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">{t.eventsTitle}</h2>
          </div>
          <div className="divide-y divide-slate-800/80">
            {league.events.map((le) => (
              <Link
                key={le.id}
                href={`/events/${le.event.id}`}
                className="block p-4 hover:bg-slate-800/30 transition"
              >
                <p className="text-sm font-semibold text-slate-100">
                  {le.event.discipline.name} · {le.event.category.name}
                  {le.event.gender ? ` · ${genderLabel[le.event.gender as keyof typeof genderLabel] ?? le.event.gender}` : ""}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {le.event.competition.name} — {le.event.name}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Ranking */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">{t.rankingTitle}</h2>
          </div>
          {ranking.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">{t.noRanking}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-800/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                    <th className="py-3 px-4 w-16">{tf.rank}</th>
                    <th className="py-3 px-4">{tf.coach}</th>
                    <th className="py-3 px-4 text-center">{tf.events}</th>
                    <th className="py-3 px-4 text-right font-bold text-white">{tf.points}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {ranking.map((row, index) => (
                    <tr key={row.userId} className="hover:bg-slate-800/30 transition font-mono">
                      <td className="py-3 px-4 font-bold text-slate-400">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-slate-200">{row.userName}</td>
                      <td className="py-3 px-4 text-center text-slate-400 font-sans text-xs">
                        {row.eventsPlayed}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-400">
                        {row.total.toFixed(2)} {tf.pointsSuffix}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
